import hashlib
import json
import shutil
import sys
from pathlib import Path
from PIL import Image

root = Path(__file__).resolve().parents[3]
evidence = Path(__file__).resolve().parent
sources = root / 'game/art-source/ui/cut-scenes-20261010'
version = sys.argv[1] if len(sys.argv) > 1 else 'v1'
assert version in ('v1', 'v2')
suffix = '' if version == 'v1' else '-v2'
items = json.loads((evidence / ('generated-inputs' + suffix + '.json')).read_text(encoding='utf-8'))
receipts = []
for item in items:
    scene = item['scene']
    original = Path(item['source'])
    local = sources / (scene + '-' + version + '.png')
    shutil.copy2(original, local)
    target = root / ('game/assets/scenes/transition-' + scene + '-' + version + '.webp')
    with Image.open(local) as im:
        source_size = list(im.size)
        im.convert('RGB').resize((1280, 720), Image.Resampling.LANCZOS).save(target, 'WEBP', quality=86, method=6)
    receipts.append({
        'scene': scene, 'generatedSource': str(original),
        'localSource': local.relative_to(root).as_posix(),
        'sourceSha256': hashlib.sha256(local.read_bytes()).hexdigest(),
        'sourceDimensions': source_size,
        'path': target.relative_to(root / 'game/assets').as_posix(),
        'ext': 'webp', 'license': '项目自有（AI 生成）',
        'bytes': target.stat().st_size,
        'sha256': hashlib.sha256(target.read_bytes()).hexdigest(),
        'source': 'docs/evidence/2026-10-10-cut-scenes/receipt' + suffix + '.json',
    })
(evidence / ('receipt' + suffix + '.json')).write_text(json.dumps({'tool': 'built-in image_gen', 'encoding': '1280x720 WebP quality86 method6', 'assets': receipts}, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
manifest_path = root / 'game/assets/asset-manifest.json'
before = manifest_path.read_bytes()
manifest = json.loads(before)
for item in receipts:
    entry = {key: item[key] for key in ['path', 'ext', 'license', 'bytes', 'sha256', 'source']}
    existing = next((old for old in manifest['assets'] if old['path'] == entry['path']), None)
    if existing:
        assert existing == entry, 'Existing registration differs: ' + entry['path']
    else:
        manifest['assets'].append(entry)
manifest['count'] = len(manifest['assets'])
assert manifest_path.read_bytes() == before, 'Manifest changed during registration; stop without overwriting it'
manifest_bytes = (json.dumps(manifest, ensure_ascii=False, indent=2) + '\n').encode('utf-8')
with manifest_path.open('r+b') as handle:
    handle.write(manifest_bytes)
    handle.truncate()
print(json.dumps([{'scene': item['scene'], 'bytes': item['bytes']} for item in receipts]))
