"""Project-local skin importer. Uses existing Python/Pillow; no browser or git writes."""
import argparse
import hashlib
import io
import json
import re
from pathlib import Path
from PIL import Image


def sha(data):
    return hashlib.sha256(data).hexdigest()


def save_json(file, value):
    file.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')


def within(root, file):
    file = file.resolve()
    file.relative_to(root)
    return file


def js(value):
    return "'" + value.replace('\\', '\\\\').replace("'", "\\'") + "'"


def import_skin(args):
    root = args.root.resolve()
    if not re.fullmatch(r'[a-z][a-z0-9]*', args.character) or not re.fullmatch(r'[a-z][a-z0-9-]*', args.id):
        raise ValueError('character/id must be lowercase identifiers; character cannot contain hyphens')
    if not args.name.strip() or any(ord(char) < 32 for char in args.name):
        raise ValueError('name must be nonempty and single-line')
    source = args.source.resolve()
    source_hash = sha(source.read_bytes())
    relative = 'portraits/full/{}-{}.webp'.format(args.character, args.id)
    target = within(root, root / 'game/assets' / relative)
    default = within(root, root / 'game/assets/portraits/full' / (args.character + '.webp'))
    default_hash = sha(default.read_bytes())
    folder = within(root, root / args.evidence)
    receipt = folder / 'skin-import.json'
    state_file = folder / 'skin-import-state.json'
    identity = dict(character=args.character, id=args.id, name=args.name,
                    source_sha256=source_hash, asset=relative, quality=args.quality)
    for file in [receipt, state_file]:
        if file.exists() and json.loads(file.read_text(encoding='utf-8'))['identity'] != identity:
            raise ValueError('Evidence belongs to a different request')
    with Image.open(source) as image:
        size = image.size
        buffer = io.BytesIO()
        image.convert('RGB').save(buffer, 'WEBP', quality=args.quality, method=6)
    encoded = buffer.getvalue()
    if target.exists() and target.read_bytes() != encoded:
        raise ValueError('Target exists with different content; replacement is not implicit')
    art = within(root, root / 'game/src/core/art.js')
    art_before = art.read_bytes()
    art_text = art_before.decode('utf-8')
    nl = '\r\n' if '\r\n' in art_text else '\n'
    entry = "    {{ id: {}, name: {}, file: {} }},".format(js(args.id), js(args.name), js(relative))
    key = '  {}: Object.freeze(['.format(args.character)
    marker = 'const SKIN_FULL_ART = Object.freeze({' + nl
    if art_text.count(marker) != 1:
        raise ValueError('Skin catalogue layout changed; inspect its source')
    catalogue = art_text.split(marker, 1)[1].split(nl + '});', 1)[0]
    if key in catalogue:
        start = art_text.index(key, art_text.index(marker))
        end = art_text.index(nl + '  ]),', start)
        block = art_text[start:end]
        if "id: " + js(args.id) in block:
            if entry not in block:
                raise ValueError('Skin id already has a different definition')
        else:
            anchor = key + nl
            art_text = art_text[:start] + art_text[start:].replace(anchor, anchor + entry + nl, 1)
    else:
        art_text = art_text.replace(marker, marker + key + nl + entry + nl + '  ]),' + nl, 1)
    manifest = within(root, root / 'game/assets/asset-manifest.json')
    manifest_before = manifest.read_bytes()
    text = manifest_before.decode('utf-8')
    mn = '\r\n' if '\r\n' in text else '\n'
    data = json.loads(text)
    if data['count'] != len(data['assets']):
        raise ValueError('Manifest count inconsistent; preserve shared changes')
    asset = dict(path=relative, ext='webp', bytes=len(encoded), sha256=sha(encoded),
                 license='项目自有（AI 生成）', source=(folder / 'skin-import.json').relative_to(root).as_posix())
    matches = [item for item in data['assets'] if item['path'] == relative]
    if matches and (len(matches) != 1 or matches[0] != asset):
        raise ValueError('Asset registration conflicts with request')
    if not matches:
        anchor = '  "assets": [' + mn if data['assets'] else '  "assets": []'
        if text.count(anchor) != 1:
            raise ValueError('Manifest layout changed')
        block = mn.join('    ' + line for line in json.dumps(asset, ensure_ascii=False, indent=2).splitlines())
        replacement = anchor + block + ',' + mn if data['assets'] else '  "assets": [' + mn + block + mn + '  ]'
        text = text.replace(anchor, replacement, 1)
        count = '"count": {},'.format(data['count'])
        if text.count(count) != 1:
            raise ValueError('Manifest count layout changed')
        text = text.replace(count, '"count": {},'.format(data['count'] + 1), 1)
    assert json.loads(text)['count'] == len(json.loads(text)['assets'])
    art_after, manifest_after = art_text.encode('utf-8'), text.encode('utf-8')
    operations = [(target, encoded, target.read_bytes() if target.exists() else None),
                  (art, art_after, art_before), (manifest, manifest_after, manifest_before)]
    result = dict(identity=identity, source=str(source), source_size=size,
                  default_sha256=default_hash, asset=asset,
                  operations=[str(file.relative_to(root)) for file, after, before in operations if after != before])
    if not args.apply:
        return dict(result, status='preview')
    folder.mkdir(parents=True, exist_ok=True)
    save_json(state_file, dict(identity=identity, status='prepared', completed=[]))
    completed = []
    for file, after, before in operations:
        current = file.read_bytes() if file.exists() else None
        if current != before:
            raise ValueError('Concurrent change at {}; rerun to replan'.format(file))
        if after != before:
            file.parent.mkdir(parents=True, exist_ok=True)
            if before is not None:
                backups = within(root, root / '.tmp/skin-import' / sha(json.dumps(identity, sort_keys=True).encode())[:16])
                backups.mkdir(parents=True, exist_ok=True)
                backup = backups / (file.name + '.' + sha(before)[:12] + '.before')
                if not backup.exists():
                    backup.write_bytes(before)
            file.write_bytes(after)
        completed.append(str(file.relative_to(root)))
        save_json(state_file, dict(identity=identity, status='applying', completed=completed))
    if sha(default.read_bytes()) != default_hash:
        raise ValueError('Default portrait changed concurrently')
    result.update(status='imported', default_unchanged=True, git_mutation=False,
                  processing='RGB WebP; full canvas, no crop or resize')
    save_json(receipt, result)
    save_json(state_file, dict(identity=identity, status='complete', completed=completed))
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', type=Path, default=Path(__file__).resolve().parents[1])
    parser.add_argument('--source', type=Path, required=True)
    parser.add_argument('--character', required=True)
    parser.add_argument('--id', required=True)
    parser.add_argument('--name', required=True)
    parser.add_argument('--evidence', required=True, help='Project-relative dedicated evidence directory')
    parser.add_argument('--quality', type=int, choices=range(1, 101), default=94)
    parser.add_argument('--apply', action='store_true', help='Import; omit to preview. Same request may safely resume.')
    args = parser.parse_args()
    try:
        print(json.dumps(import_skin(args), ensure_ascii=False))
    except Exception as error:
        print(json.dumps(dict(status='failed', error=str(error)), ensure_ascii=False))
        raise SystemExit(1)


if __name__ == '__main__':
    main()
