"""Install owner-approved candidates byte-for-byte, register their fingerprints."""
import hashlib
import json
import shutil
from pathlib import Path
from PIL import Image

HERE = Path(__file__).resolve().parent
PROJECT = HERE.parents[2]
ROOT = PROJECT.parent
receipt = json.loads((HERE/'receipt.json').read_text(encoding='utf-8'))
manifest_path = PROJECT/'game/assets/asset-manifest.json'
before = manifest_path.read_bytes()
manifest = json.loads(before)
items = []
for item in receipt['items']:
    key = item['id'].split('-', 1)[1]
    source = ROOT/item['webp']
    assert hashlib.sha256(source.read_bytes()).hexdigest() == item['webp_sha256']
    with Image.open(source) as image:
        image.load()
        assert list(image.size) == item['size']
    relative = f'scenes/transitions-1021/{key}.webp'
    target = PROJECT/'game/assets'/relative
    assert not target.exists() or hashlib.sha256(target.read_bytes()).hexdigest() == item['webp_sha256'], 'Unexpected existing destination: '+str(target)
    assert not any(asset['path'] == relative for asset in manifest['assets'])
    items.append(dict(source=str(source), destination='game/assets/'+relative,
                      sha256=item['webp_sha256'], bytes=source.stat().st_size))
assert manifest_path.read_bytes() == before
for item in items:
    target = PROJECT/item['destination']
    shutil.copy2(item['source'], target)
    manifest['assets'].append(dict(path=item['destination'][len('game/assets/'):],
        ext='webp', license='项目自有（AI 生成）', bytes=item['bytes'], sha256=item['sha256'],
        source='docs/evidence/2026-10-21-transition-12-16-remake/install-receipt.json'))
manifest['count'] = len(manifest['assets'])
assert manifest_path.read_bytes() == before
manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
(HERE/'install-receipt.json').write_text(json.dumps(dict(authorization='老板：接入吧',
    installed=True, items=items, validation='pending'), ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
print('Installed 5 approved WebPs and manifest entries.')
