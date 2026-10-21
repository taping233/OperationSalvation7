import hashlib
import json
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[3]
source = Path(r'C:/Users/太平/.codex/generated_images/01a14f3d-d115-7002-98d2-5af998ea575a/exec-ecd5640a-7c63-4af6-af5c-3c6bd938ec13.png')
relative = 'portraits/full/changwuyu-drum-room.webp'
target = ROOT / 'game/assets' / relative
receipt = Path(__file__).resolve().with_name('receipt.json')
assert not target.exists() and not receipt.exists(), 'Do not overwrite an existing import.'
default = ROOT / 'game/assets/portraits/full/changwuyu.webp'
default_hash = hashlib.sha256(default.read_bytes()).hexdigest()
with Image.open(source) as image:
    image.convert('RGB').save(target, 'WEBP', quality=94, method=6)
    source_size = image.size
with Image.open(target) as image:
    assert image.size == source_size
    image.verify()
asset = dict(path=relative, ext='webp', bytes=target.stat().st_size,
    sha256=hashlib.sha256(target.read_bytes()).hexdigest(),
    license='项目自有（AI 生成）',
    source='docs/evidence/2026-10-19-changwuyu-drum-skin/receipt.json')
manifest = ROOT / 'game/assets/asset-manifest.json'
before = manifest.read_bytes()
text = before.decode('utf-8')
newline = '\r\n' if '\r\n' in text else '\n'
data = json.loads(text)
assert data['count'] == len(data['assets'])
assert not any(entry['path'] == relative for entry in data['assets'])
anchor = '    {' + newline + '      "path": "portraits/full/changwuyu.webp",'
assert text.count(anchor) == 1
block = json.dumps(asset, ensure_ascii=False, indent=2)
block = newline.join('    ' + line for line in block.splitlines()) + ',' + newline
text = text.replace(anchor, block + anchor, 1)
old_count = '"count": ' + str(data['count']) + ','
assert text.count(old_count) == 1
text = text.replace(old_count, '"count": ' + str(data['count'] + 1) + ',', 1)
updated = json.loads(text)
assert updated['count'] == len(updated['assets'])
assert [entry for entry in updated['assets'] if entry['path'] != relative] == data['assets']
assert manifest.read_bytes() == before, 'Concurrent manifest update; stop.'
manifest.write_bytes(text.encode('utf-8'))
assert hashlib.sha256(default.read_bytes()).hexdigest() == default_hash
record = dict(character='changwuyu', skin_id='drum-room', name='余响·鼓房',
    source=str(source), source_sha256=hashlib.sha256(source.read_bytes()).hexdigest(),
    source_size=source_size, asset=asset, processing='Full canvas RGB WebP quality94/method6; no crop, resize or paint changes.',
    default_sha256=default_hash, default_unchanged=True,
    acquisition='NAI5 draft followed by built-in imagegen repaint using local arknights-art-ui-design guidance; user approved skin integration on 2026-10-19.',
    original_policy='Original PNG >1MB retained at generated_images source path; recover by copying source and checking SHA256; not added to git.')
receipt.write_text(json.dumps(record, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps(dict(asset=asset, size=source_size, default_unchanged=True), ensure_ascii=False))
