import hashlib
import json
import shutil
from pathlib import Path
from PIL import Image

evidence = Path(__file__).parent
root = evidence.parents[2]
workspace = root.parent
request = json.loads((evidence / 'request.json').read_text(encoding='utf-8'))
receipt = evidence / 'installed.json'
assert not receipt.exists(), 'Already installed'
manifest = root / 'game/assets/asset-manifest.json'
original_manifest = manifest.read_bytes()
data = json.loads(original_manifest)
text = original_manifest.decode('utf-8')
newline = '\r\n' if '\r\n' in text else '\n'
local = workspace / '.tmp/imagegen/wu-skin-fill-20261015'
local.mkdir(parents=True, exist_ok=True)
def sha(raw):
    return hashlib.sha256(raw).hexdigest()
def block(entry):
    return newline.join('    ' + line for line in json.dumps(entry, ensure_ascii=False, indent=2).splitlines())
prepared = []
for item in request['items']:
    target = root / 'game/assets' / item['asset']
    source = Path(item['source'])
    entry = next(x for x in data['assets'] if x['path'] == item['asset'])
    assert sha(target.read_bytes()) == entry['sha256'], 'Unexpected asset change'
    backup = local / (item['id'] + '-before.webp')
    saved = local / (item['id'] + '-expanded.png')
    assert not backup.exists() and not saved.exists()
    with Image.open(source) as image:
        assert abs(image.width / image.height - 838 / 646) < .005
    prepared.append((item, target, source, entry, backup, saved))
records = []
for item, target, source, entry, backup, saved in prepared:
    before = dict(entry)
    backup.write_bytes(target.read_bytes())
    shutil.copy2(source, saved)
    image = Image.open(saved).convert('RGB')
    image.save(target, 'WEBP', quality=92, method=6)
    payload = target.read_bytes()
    with Image.open(target) as decoded:
        decoded.load()
        assert decoded.size == image.size
    entry.update(bytes=len(payload), sha256=sha(payload), source='docs/evidence/2026-10-15-wu-skin-fill/installed.json')
    assert text.count(block(before)) == 1
    text = text.replace(block(before), block(entry), 1)
    records.append(dict(id=item['id'], target=entry, dimensions=image.size,
        source=str(saved.relative_to(workspace)), sourceSha256=sha(saved.read_bytes()),
        backup=str(backup.relative_to(workspace)), backupSha256=sha(backup.read_bytes())))
assert len(json.loads(text)['assets']) == len(data['assets'])
assert manifest.read_bytes() == original_manifest, 'Concurrent manifest change'
manifest.write_bytes(text.encode('utf-8'))
receipt.write_text(json.dumps(dict(items=records, encoding='Pillow RGB WebP quality=92 method=6; no resize/crop', countChanged=False), ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps(records, ensure_ascii=False))
