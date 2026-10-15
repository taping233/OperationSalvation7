from pathlib import Path
from PIL import Image
import hashlib
import json

root = Path(__file__).resolve().parents[3]
workspace = root.parent
source = workspace / '.tmp/imagegen/wu-swim-v1-20261015/wu-swim-v1-stars-eyes.png'
target = root / 'game/assets/portraits/full/wu-beach.webp'
manifest = root / 'game/assets/asset-manifest.json'
backup = workspace / '.tmp/imagegen/wu-swim-v1-20261015/before-install-wu-beach.webp'
receipt = Path(__file__).with_name('installed.json')
assert not receipt.exists(), 'Already installed; inspect receipt before retrying'
original = target.read_bytes()
manifest_bytes = manifest.read_bytes()
data = json.loads(manifest_bytes)
assert not any(a['path'] == 'portraits/full/wu-beach.webp' for a in data['assets'])
assert not backup.exists(), 'Backup exists; do not overwrite'
backup.write_bytes(original)
im = Image.open(source).convert('RGB')
im.save(target, 'WEBP', quality=92, method=6)
payload = target.read_bytes()
with Image.open(target) as decoded:
    decoded.load()
    assert decoded.size == im.size
assert len(payload) < 1_000_000
entry = {'path': 'portraits/full/wu-beach.webp', 'ext': 'webp',
         'license': '项目自有（AI 生成）', 'bytes': len(payload),
         'sha256': hashlib.sha256(payload).hexdigest(),
         'source': 'docs/evidence/2026-10-15-wu-swim-v1/installed.json'}
text = manifest_bytes.decode('utf-8')
newline = '\r\n' if '\r\n' in text else '\n'
needle = '    {' + newline + '      "path": "portraits/full/wu-casual-v14.webp",'
assert text.count(needle) == 1
entry_text = '\n'.join('    ' + line for line in json.dumps(entry, ensure_ascii=False, indent=2).splitlines()).replace('\n', newline)
text = text.replace(needle, entry_text + ',' + newline + needle, 1)
count_token = f'"count": {data["count"]},'
assert text.count(count_token) == 1
text = text.replace(count_token, f'"count": {data["count"] + 1},', 1)
updated = json.loads(text)
assert len(updated['assets']) == len(data['assets']) + 1
assert manifest.read_bytes() == manifest_bytes, 'Concurrent manifest change'
manifest.write_bytes(text.encode('utf-8'))
result = {'date': '2026-10-15', 'approval': '老板：替换进游戏里',
          'skin': {'character': 'wu', 'id': 'beach', 'name': '盛夏·水枪'},
          'source': str(source.relative_to(workspace)).replace('\\', '/'),
          'sourceSha256': hashlib.sha256(source.read_bytes()).hexdigest(),
          'target': entry, 'dimensions': im.size,
          'backup': str(backup.relative_to(workspace)).replace('\\', '/'),
          'backupSha256': hashlib.sha256(original).hexdigest(),
          'encoding': 'Pillow WebP quality=92 method=6 RGB; original dimensions',
          'references': 'Existing skin mapping and generated art-manifest already reference this path; no mapping/code change required.',
          'cache': 'Existing assetUrl build-version cache invalidation retained; current verification uses fresh browser navigation.'}
receipt.write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(json.dumps(result, ensure_ascii=False))
