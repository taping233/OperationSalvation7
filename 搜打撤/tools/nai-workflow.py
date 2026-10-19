"""Local-only NAI request preparation, guard status and image difference hints."""
import argparse
import datetime
import hashlib
import json
import math
import os
from pathlib import Path
from urllib.parse import urlsplit
from PIL import Image, ImageChops, ImageStat
import nai_gen
import nai_prompt_clean as style
from nai_guard import _load, _validate_rate, _validate_usage


def digest(file):
    return hashlib.sha256(file.read_bytes()).hexdigest()


def status(state_dir, width, height, now=None):
    if type(width) is not int or type(height) is not int or min(width, height) <= 0:
        raise ValueError('Dimensions must be positive integers')
    now = datetime.datetime.now().timestamp() if now is None else now
    blocks = []
    rate = {'next_request_at': 0, 'cooldown_until': 0, 'request_pending': False}
    usage = {}
    try:
        rate = _load(state_dir / 'request-rate.json', rate)
        usage = _load(state_dir / 'large-usage.json', usage)
        _validate_rate(rate)
        _validate_usage(usage)
    except Exception as error:
        blocks.append(str(error))
        rate = {'next_request_at': 0, 'cooldown_until': 0, 'request_pending': False}
        usage = {}
    day = datetime.datetime.fromtimestamp(now).date().isoformat()  # Same day boundary as RequestGuard.
    cooldown = max(0, math.ceil(rate['cooldown_until'] - now))
    pacing = max(0, math.ceil(rate['next_request_at'] - now))
    large = width * height > nai_gen.FREE_PX_CAP
    if rate['request_pending']:
        blocks.append('Previous request pending: reconcile existing guard state; do not clear automatically')
    if cooldown:
        blocks.append('Shared HTTP429 cooldown active')
    if large and usage.get(day, 0) >= nai_gen.LARGE_QUOTA_PER_DAY:
        blocks.append('Local large-image daily quota exhausted')
    credential = 'env-present' if os.environ.get('NAI_TOKEN', '').strip() else (
        'file-present-unverified' if nai_gen.TOKEN_FILE.is_file() else 'missing')
    if credential == 'missing':
        blocks.append('No configured credential source')
    proxies = {}
    for key in ['HTTP_PROXY', 'HTTPS_PROXY', 'ALL_PROXY']:
        raw = os.environ.get(key, '')
        if raw:
            parsed = urlsplit(raw)
            proxies[key] = '{}://{}{}'.format(parsed.scheme, parsed.hostname or '', ':' + str(parsed.port) if parsed.port else '')
    return dict(networkAttempted=False, stateWritten=False, credential=credential,
                accountBalance='unknown', serverAvailability='unverified',
                readyToAttempt=not blocks and pacing == 0, blocks=blocks,
                cooldownSeconds=cooldown, pacingSeconds=pacing, quotaDay=day,
                largeImage=large, largeUsed=usage.get(day, 0), largeLimit=nai_gen.LARGE_QUOTA_PER_DAY,
                width=width, height=height, steps=nai_gen.DEFAULTS['steps'], model=nai_gen.MODEL,
                withinKnownFreeThreshold=not large and nai_gen.DEFAULTS['steps'] <= 28,
                proxyEndpoints=proxies)


def prepare(root, spec, output, state_dir):
    allowed = {'subjectIdentity', 'sceneAction', 'composition', 'lightMaterial', 'allowedChanges', 'preserve',
               'references', 'width', 'height', 'seed', 'model', 'negative'}
    if set(spec) - allowed:
        raise ValueError('Unknown specification fields; do not include credentials')
    for key in ['subjectIdentity', 'sceneAction', 'composition', 'lightMaterial']:
        if not isinstance(spec.get(key), str) or not spec[key].strip():
            raise ValueError('Missing text field: ' + key)
    for key in ['allowedChanges', 'preserve']:
        if not isinstance(spec.get(key), list) or not spec[key] or not all(isinstance(item, str) and item.strip() for item in spec[key]):
            raise ValueError('Explicit nonempty list required: ' + key)
    references = []
    for reference in spec.get('references', []):
        if reference.get('role') not in ['identity', 'composition', 'style', 'edit-target']:
            raise ValueError('Reference role must be identity/composition/style/edit-target')
        file = (root / reference['path']).resolve()
        references.append(dict(path=str(file), role=reference['role'], sha256=digest(file), uploaded=False))
    width, height = spec.get('width', 1344), spec.get('height', 768)
    preflight = status(state_dir, width, height)
    preflight['model'] = spec.get('model', nai_gen.MODEL)
    prompt = style.build_asset_prompt(spec['sceneAction'], composition_layer=spec['composition'],
        light_material_layer=spec['lightMaterial'],
        purpose_layer='Allowed changes: ' + '; '.join(spec['allowedChanges']) + '. Preserve: ' + '; '.join(spec['preserve']))
    payload = nai_gen.build_payload(prompt, style.build_uc(spec.get('negative', '')),
        width=width, height=height, seed=spec.get('seed'), model=spec.get('model', nai_gen.MODEL),
        char_prompts=[{'prompt': spec['subjectIdentity'], 'uc': ''}])
    record = dict(version=1, status='prepared', recipeVersion=style.RECIPE_VERSION,
                  specification=spec, references=references, request=payload, preflight=preflight,
                  limits=['Prepared only; no network request, upload or quota reservation',
                          'Use nai_gen.generate_image and its guard for an authorized generation'])
    output = output.resolve()
    output.relative_to(root.resolve())
    if output.exists():
        raise ValueError('Request snapshot already exists; choose a new output')
    output.parent.mkdir(parents=True, exist_ok=True)
    with output.open('x', encoding='utf-8') as handle:
        json.dump(record, handle, ensure_ascii=False, indent=2)
    return dict(status='prepared', output=str(output), requestSha256=digest(output), preflight=preflight)


def compare(first, second, region=None):
    with Image.open(first) as a, Image.open(second) as b:
        if a.size != b.size:
            return dict(comparable=False, firstSize=a.size, secondSize=b.size,
                        reason='Canvas sizes differ; no implicit resize or aesthetic judgement')
        a, b = a.convert('RGB'), b.convert('RGB')
        if region:
            x, y, width, height = region
            if min(x, y) < 0 or min(width, height) <= 0 or x + width > a.width or y + height > a.height:
                raise ValueError('Region outside image')
            a, b = a.crop((x, y, x + width, y + height)), b.crop((x, y, x + width, y + height))
        diff = ImageChops.difference(a, b)
        changed = sum(1 for pixel in diff.getdata() if any(pixel))
        return dict(comparable=True, identical=changed == 0, region=region,
                    changedPixelFraction=changed / (a.width * a.height),
                    meanAbsoluteDifference=sum(ImageStat.Stat(diff).mean) / 3,
                    limits='Pixel change hint only; cannot establish pose correctness, identity or art quality')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', type=Path, default=Path(__file__).resolve().parents[1])
    commands = parser.add_subparsers(dest='command', required=True)
    check = commands.add_parser('status', help='Read local guard/config only; never probes generation')
    check.add_argument('--width', type=int, default=1344)
    check.add_argument('--height', type=int, default=768)
    check.add_argument('--state-dir', type=Path, default=nai_gen.LARGE_USAGE_FILE.parent)
    prep = commands.add_parser('prepare', help='Save an immutable request without generating')
    prep.add_argument('--spec', type=Path, required=True)
    prep.add_argument('--out', type=Path, required=True)
    prep.add_argument('--state-dir', type=Path, default=nai_gen.LARGE_USAGE_FILE.parent)
    comparison = commands.add_parser('compare', help='Read-only pixel difference hint')
    comparison.add_argument('--before', type=Path, required=True)
    comparison.add_argument('--after', type=Path, required=True)
    comparison.add_argument('--region', type=int, nargs=4)
    args = parser.parse_args()
    try:
        if args.command == 'status':
            result = status(args.state_dir, args.width, args.height)
        elif args.command == 'prepare':
            result = prepare(args.root, json.loads(args.spec.read_text(encoding='utf-8')), args.root / args.out, args.state_dir)
        else:
            result = compare(args.before, args.after, args.region)
        print(json.dumps(result, ensure_ascii=False))
    except Exception as error:
        print(json.dumps(dict(status='failed', error=str(error)), ensure_ascii=False))
        raise SystemExit(1)


if __name__ == '__main__':
    import sys
    if hasattr(sys.stdout, 'reconfigure'):
        sys.stdout.reconfigure(encoding='utf-8')
    main()
