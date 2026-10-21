import hashlib
import io
import json
import shutil
from pathlib import Path
from PIL import Image

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
SOURCE = ROOT / 'game/art-source/pets/redesign-20261018'
JOBS = {'dog': 2, 'falcon': 1, 'cat': 1, 'robot': 2, 'fire': 2, 'penguin': 2}
sha = lambda data: hashlib.sha256(data).hexdigest()
manifest_path = ROOT / 'game/assets/asset-manifest.json'
original = manifest_path.read_bytes()
text = original.decode('utf-8')
entries = {entry['path']: entry for entry in json.loads(text)['assets']}
prepared = []
for pet, version in JOBS.items():
    raw = SOURCE / f'{pet}-redraw-v{version}.png'
    target = ROOT / f'game/assets/icons/base-v3/companion-{pet}.webp'
    backup = SOURCE / f'{pet}-before-install.webp'
    assert not backup.exists(), 'Existing installation backup: ' + pet
    im = Image.open(raw)
    assert im.mode == 'RGBA' and im.getchannel('A').getextrema() == (0, 255)
    im = im.resize((720, 720), Image.Resampling.LANCZOS)
    encoded = io.BytesIO()
    im.save(encoded, 'WEBP', quality=88, method=6)
    data = encoded.getvalue()
    check = Image.open(io.BytesIO(data))
    assert check.size == (720, 720) and check.mode == 'RGBA'
    assert check.getchannel('A').getextrema() == (0, 255)
    entry = entries[f'icons/base-v3/companion-{pet}.webp']
    old_block = '\n'.join('    ' + line for line in json.dumps(entry, ensure_ascii=False, indent=2).splitlines())
    entry.update(bytes=len(data), sha256=sha(data), source='docs/evidence/2026-10-18-pets-redesign/install-receipts.json')
    entry['provenance'] = dict(kind='generated-source-and-conversion-record', sourceSha256=sha(raw.read_bytes()), rawPath=raw.relative_to(ROOT).as_posix(), encoder='docs/evidence/2026-10-18-pets-redesign/install.py', outputBytesMatch=True)
    new_block = '\n'.join('    ' + line for line in json.dumps(entry, ensure_ascii=False, indent=2).splitlines())
    assert text.count(old_block) == 1, pet
    text = text.replace(old_block, new_block, 1)
    prepared.append((pet, raw, target, backup, data))
assert manifest_path.read_bytes() == original, 'Concurrent manifest update'
records = []
for pet, raw, target, backup, data in prepared:
    shutil.copy2(target, backup)
    target.write_bytes(data)
    records.append(dict(id=pet, rawPath=raw.relative_to(ROOT).as_posix(), sourceSha256=sha(raw.read_bytes()), outputPath=target.relative_to(ROOT).as_posix(), outputSha256=sha(data), outputBytes=len(data), size=[720, 720], alphaExtrema=[0, 255], backup=backup.relative_to(ROOT).as_posix(), backupSha256=sha(backup.read_bytes())))
assert manifest_path.read_bytes() == original, 'Concurrent manifest update'
manifest_path.write_bytes(text.encode('utf-8'))
(HERE / 'install-receipts.json').write_text(json.dumps(records, ensure_ascii=False, indent=2), encoding='utf-8')
for record in records:
    assert sha((ROOT / record['outputPath']).read_bytes()) == record['outputSha256']
print('Installed and verified six 720x720 RGBA WebP pets; existing manifest changes preserved.')
