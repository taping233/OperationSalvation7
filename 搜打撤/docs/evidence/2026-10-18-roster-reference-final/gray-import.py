import hashlib
import json
import shutil
from pathlib import Path
from PIL import Image

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
REQUEST = json.loads((HERE / 'gray-request.json').read_text(encoding='utf-8'))
OUT = ROOT / 'game/art-source/characters/roster-reference-gray-20261018'
BACKUP = ROOT / '.tmp/imagegen/roster-reference-gray-20261018/backup'
OUT.mkdir(parents=True, exist_ok=True)
BACKUP.mkdir(parents=True, exist_ok=True)
(OUT / '.gitignore').write_text('*.png\n', encoding='utf-8')
manifest_path = ROOT / 'game/assets/asset-manifest.json'
manifest_text = manifest_path.read_text(encoding='utf-8')
manifest = json.loads(manifest_text)
receipt = []
for item in REQUEST['items']:
    role = item['id']
    source = Path(item['source'])
    raw = Image.open(source).convert('RGB')
    assert raw.size == (1024, 1536), (role, raw.size)
    target = ROOT / f'game/assets/portraits/full/{role}.webp'
    reference = ROOT / f'docs/character-bible/ref-images/{role}.webp'
    backup = BACKUP / target.name
    if backup.exists():
        assert target.read_bytes() == (OUT / f'{role}-unified.webp').read_bytes(), 'Resume target changed'
    else:
        shutil.copy2(target, backup)
        shutil.copy2(reference, BACKUP / f'{role}-reference.webp')
    old_sha = hashlib.sha256(backup.read_bytes()).hexdigest()
    shutil.copy2(source, OUT / f'{role}-original.png')
    # Encoding/layout only: uniformly scale the entire original, never crop a figure.
    canvas = raw
    canvas.save(OUT / f'{role}-unified.webp', quality=94, method=6)
    shutil.copy2(OUT / f'{role}-unified.webp', target)
    shutil.copy2(target, reference)
    data = target.read_bytes()
    sha = hashlib.sha256(data).hexdigest()
    assert reference.read_bytes() == data
    assert Image.open(target).size == (1024, 1536)
    key = f'portraits/full/{role}.webp'
    entry = next(x for x in manifest['assets'] if x['path'] == key)
    updated = dict(entry, bytes=len(data), sha256=sha, source='docs/evidence/2026-10-18-roster-reference-final/gray-receipt.json')
    # Replace only the matching JSON object; preserve unrelated manifest entries/formatting.
    begin = manifest_text.rfind('    {', 0, manifest_text.index('"path": "' + key + '"'))
    end = manifest_text.index('\n    }', begin) + len('\n    }')
    manifest_text = manifest_text[:begin] + '    ' + json.dumps(updated, ensure_ascii=False, indent=2).replace('\n', '\n    ') + manifest_text[end:]
    receipt.append(dict(id=role, path=key, size=[1024,1536], bytes=len(data), sha256=sha, previousSha256=old_sha, sourceSha256=hashlib.sha256(source.read_bytes()).hexdigest(), source=str(source), backup=str(backup), referenceMatches=True))
assert json.loads(manifest_text)['assets']
manifest_path.write_text(manifest_text, encoding='utf-8')
(HERE / 'gray-receipt.json').write_text(json.dumps(receipt, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(json.dumps(receipt, ensure_ascii=False, indent=2))
