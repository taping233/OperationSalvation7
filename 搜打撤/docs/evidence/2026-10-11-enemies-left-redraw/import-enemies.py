"""Encode the authorized 18 enemy replacements, preserving generated alpha."""
import hashlib
import json
import shutil
from pathlib import Path
from PIL import Image


ROOT = Path.cwd().resolve()
EVIDENCE = Path(__file__).resolve().parent
ASSETS = ROOT / 'game/assets'
RAW = ROOT / '.tmp/imagegen' / EVIDENCE.name
RECEIPT = EVIDENCE / 'receipt.json'
MATRIX = (1.087994, .003705, .005219, -6.56625,
          .006245, 1.079741, .004274, -6.56625,
          .002781, -.006867, 1.082379, -6.56625)


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def record(path):
    return {'path': path.relative_to(ROOT).as_posix(),
            'bytes': path.stat().st_size, 'sha256': sha(path)}


def alpha_info(image):
    if 'A' not in image.getbands():
        raise ValueError('Missing generated alpha')
    alpha = image.getchannel('A')
    histogram = alpha.histogram()
    if alpha.getextrema() != (0, 255) or histogram[0] < image.width * image.height * .01:
        raise ValueError('No usable transparent background')
    return {'size': list(image.size), 'mode': image.mode,
            'alpha_range': list(alpha.getextrema()),
            'transparent_pixels': histogram[0], 'alpha_bbox': alpha.getbbox()}


request = json.loads((EVIDENCE / 'request.json').read_text(encoding='utf-8-sig'))
if request['remaining'] or request['corrections_pending']:
    raise ValueError('Generation/corrections incomplete')
mapping = json.loads((ROOT / 'game/data/art-mapping.json').read_text(encoding='utf-8-sig'))
items = request['items']
if len(items) != 18 or {item['id'] for item in items} != set(mapping['monsterIds']):
    raise ValueError('Expected exactly the current 18 enemy ids')
if RECEIPT.exists():
    raise ValueError('Receipt exists; do not replay a completed import')
resume = RAW.exists()
for item in items:
    with Image.open(item['source']) as image:
        alpha_info(image)
    for prefix in ['portraits/enemies', 'portraits/cut/enemies', 'thumbs/portraits/enemies']:
        if not (ASSETS / prefix / (item['id'] + '.webp')).is_file():
            raise ValueError('Missing existing enemy target: ' + item['id'])

(RAW / 'sources').mkdir(parents=True, exist_ok=True)
staged = []
receipt = {'method': 'Built-in ImageGen; RGBA WebP encoding, existing 760h cut and 448w thumbnail sizes',
           'request': (EVIDENCE / 'request.json').relative_to(ROOT).as_posix(),
           'items': [], 'verification': {'source_alpha_checked': 18, 'output_alpha_checked': 0,
            'orientation': 'All 18 tool outputs visually examined for viewer-left facing; bandit stance corrected after user feedback',
            'not_run': ['game tests', 'game browser', 'build', 'full repository audits']}}
for item in items:
    enemy = item['id']
    source = Path(item['source'])
    raw = RAW / 'sources' / (enemy + '.png')
    if resume:
        if not raw.is_file() or sha(raw) != sha(source):
            raise ValueError('Resume source differs: ' + enemy)
    else:
        shutil.copy2(source, raw)
    with Image.open(source) as image:
        full = image.convert('RGBA')
    cut_scale = min(1, 760 / full.height)
    cut = full.resize((round(full.width * cut_scale), round(full.height * cut_scale)), Image.Resampling.LANCZOS)
    thumb_scale = min(1, 448 / full.width)
    thumb = full.resize((round(full.width * thumb_scale), round(full.height * thumb_scale)), Image.Resampling.LANCZOS)
    thumb_alpha = thumb.getchannel('A')
    thumb = thumb.convert('RGB').convert('RGB', MATRIX)
    thumb.putalpha(thumb_alpha)
    one = {'id': enemy, 'raw': record(raw), 'source_alpha': alpha_info(full), 'backups': [], 'outputs': []}
    for prefix, image, quality in [('portraits/enemies', full, 90), ('portraits/cut/enemies', cut, 90),
                                    ('thumbs/portraits/enemies', thumb, 82)]:
        relative = prefix + '/' + enemy + '.webp'
        target = ASSETS / relative
        backup = RAW / 'before' / relative
        pending = RAW / 'encoded' / relative
        backup.parent.mkdir(parents=True, exist_ok=True)
        pending.parent.mkdir(parents=True, exist_ok=True)
        if resume:
            if not backup.is_file() or not pending.is_file() or sha(target) != sha(backup):
                raise ValueError('Cannot resume encoded target: ' + relative)
        else:
            shutil.copy2(target, backup)
            image.save(pending, 'WEBP', quality=quality, method=6, exact=True)
        with Image.open(pending) as encoded:
            observed = alpha_info(encoded)
        one['backups'].append(record(backup))
        output = {'path': target.relative_to(ROOT).as_posix(), 'bytes': pending.stat().st_size,
                  'sha256': sha(pending), **observed}
        one['outputs'].append(output)
        staged.append((target, pending, relative, output, sha(backup)))
        receipt['verification']['output_alpha_checked'] += 1
    receipt['items'].append(one)
    print(('reused encoded ' if resume else 'encoded ') + enemy, flush=True)

manifest_path = ASSETS / 'asset-manifest.json'
manifest_bytes = manifest_path.read_bytes()
eol = '\r\n' if b'\r\n' in manifest_bytes else '\n'
bom = b'\xef\xbb\xbf' if manifest_bytes.startswith(b'\xef\xbb\xbf') else b''
original_text = manifest_bytes.decode('utf-8-sig').replace('\r\n', '\n')
manifest = json.loads(original_text)
text = original_text
entries = {entry['path']: entry for entry in manifest['assets']}
receipt_path = RECEIPT.relative_to(ROOT).as_posix()
added = []
for target, pending, relative, output, before_sha in staged:
    if sha(target) != before_sha:
        raise ValueError('Enemy target changed during encoding: ' + relative)
    if relative not in entries:
        added.append({'path': relative, 'ext': 'webp', 'license': '项目自有（AI 生成）',
                      'bytes': output['bytes'], 'sha256': output['sha256'], 'source': receipt_path})
        continue
    before = entries[relative]
    after = {**before, 'bytes': output['bytes'], 'sha256': output['sha256'], 'source': receipt_path}
    old_block = '\n'.join('    ' + line for line in json.dumps(before, ensure_ascii=False, indent=2).splitlines())
    new_block = '\n'.join('    ' + line for line in json.dumps(after, ensure_ascii=False, indent=2).splitlines())
    if text.count(old_block) != 1:
        raise ValueError('Manifest target formatting changed: ' + relative)
    text = text.replace(old_block, new_block, 1)
if added:
    anchor = '  "assets": [\n'
    if text.count(anchor) != 1:
        raise ValueError('Manifest assets anchor changed')
    blocks = ['\n'.join('    ' + line for line in json.dumps(entry, ensure_ascii=False, indent=2).splitlines()) for entry in added]
    text = text.replace(anchor, anchor + ',\n'.join(blocks) + ',\n', 1)
    old_count = '  "count": ' + str(manifest['count']) + ','
    if text.count(old_count) != 1:
        raise ValueError('Manifest count anchor changed')
    text = text.replace(old_count, '  "count": ' + str(manifest['count'] + len(added)) + ',', 1)
if manifest_path.read_bytes() != manifest_bytes:
    raise ValueError('Shared manifest changed; do not overwrite other work')
if len(json.loads(text)['assets']) != len(manifest['assets']) + len(added):
    raise ValueError('Manifest entry count changed')
for target, pending, relative, output, before_sha in staged:
    shutil.copy2(pending, target)
manifest_path.write_bytes(bom + text.replace('\n', eol).encode('utf-8'))
receipt['manifest_count'] = manifest['count'] + len(added)
receipt['manifest_entries_added'] = [entry['path'] for entry in added]
receipt['status'] = '18 enemies integrated; all 54 outputs preserve true alpha'
RECEIPT.write_text(json.dumps(receipt, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(json.dumps({'status': receipt['status'], 'receipt': receipt_path, 'raw_sources': (RAW / 'sources').relative_to(ROOT).as_posix()}, ensure_ascii=True))
