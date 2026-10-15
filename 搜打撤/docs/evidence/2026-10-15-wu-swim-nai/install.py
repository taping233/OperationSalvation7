import hashlib
import json
import shutil
from pathlib import Path
import tomli
from PIL import Image

root = Path(__file__).resolve().parents[3]
workspace = root.parent
evidence = Path(__file__).parent
config = workspace / '.codex/config.toml'
backup_config = sorted(config.parent.glob('config.toml.bak-nai-profile-*'))[-1]
old = tomli.loads(backup_config.read_text(encoding='utf-8'))
new = tomli.loads(config.read_text(encoding='utf-8'))
assert old.pop('sandbox_workspace_write') == {'network_access': True}
assert new.pop('default_permissions') == 'project-network'
assert new.pop('permissions') == {'project-network': {'description': 'Project workspace editing with network access.', 'extends': ':workspace', 'network': {'enabled': True}}}
assert old == new
prefix = backup_config.read_bytes().split(b'[sandbox_workspace_write]')[0]
assert prefix in config.read_bytes(), 'Non-target comment bytes changed'
network = dict(toml='passed', non_target_structure='unchanged', non_target_bytes='preserved',
    backup=str(backup_config.relative_to(workspace)), sha256=hashlib.sha256(config.read_bytes()).hexdigest(),
    fresh_profile_probe=dict(profile='project-network', http=200),
    existing_chat='Network remains restricted until the host adopts the new permission profile',
    proxy='http://127.0.0.1:12450', sandbox_probe=dict(proxy_tcp=10013, direct='DNS 11001'),
    approved_network_probe=dict(proxy_tcp=0, direct_http=200, proxy_http=200))
(evidence / 'network-verification.json').write_text(json.dumps(network, ensure_ascii=False, indent=2), encoding='utf-8')
source = Path('C:/Users/太平/.codex/generated_images/01a13fd0-6e19-7992-a3dc-4c6d1a283626/exec-a2d29bea-00c0-4123-8b4f-021f09281a68.png')
local = workspace / '.tmp/imagegen/wu-swim-nai-20261015'
local.mkdir(parents=True, exist_ok=True)
saved = local / 'wu-swim-depth.png'
backup = local / 'before-install-wu-beach.webp'
target = root / 'game/assets/portraits/full/wu-beach.webp'
manifest = root / 'game/assets/asset-manifest.json'
receipt = evidence / 'installed.json'
assert not receipt.exists() and not backup.exists() and not saved.exists()
original = target.read_bytes()
manifest_bytes = manifest.read_bytes()
data = json.loads(manifest_bytes)
entry = next(x for x in data['assets'] if x['path'] == 'portraits/full/wu-beach.webp')
before_entry = dict(entry)
assert hashlib.sha256(original).hexdigest() == entry['sha256'], 'Skin changed since manifest registration'
shutil.copy2(source, saved)
backup.write_bytes(original)
im = Image.open(saved).convert('RGB')
im.save(target, 'WEBP', quality=92, method=6)
payload = target.read_bytes()
with Image.open(target) as check:
    check.load()
    assert check.size == im.size
entry.update(bytes=len(payload), sha256=hashlib.sha256(payload).hexdigest(), source='docs/evidence/2026-10-15-wu-swim-nai/installed.json')
text = manifest_bytes.decode('utf-8')
newline = '\r\n' if '\r\n' in text else '\n'
def block(value):
    return newline.join('    ' + line for line in json.dumps(value, ensure_ascii=False, indent=2).splitlines())
assert text.count(block(before_entry)) == 1
text = text.replace(block(before_entry), block(entry), 1)
assert len(json.loads(text)['assets']) == len(data['assets'])
assert manifest.read_bytes() == manifest_bytes, 'Concurrent manifest change'
manifest.write_bytes(text.encode('utf-8'))
record = dict(approval='老板：实装吧（最新递进景深版本）', skin=dict(character='wu', id='beach', name='盛夏·水枪'),
    source=str(saved.relative_to(workspace)), sourceSha256=hashlib.sha256(saved.read_bytes()).hexdigest(),
    backup=str(backup.relative_to(workspace)), backupSha256=hashlib.sha256(original).hexdigest(),
    target=entry, dimensions=im.size, encoding='Pillow RGB WebP quality=92 method=6',
    references='Existing skin mapping retained; only image and its manifest entry changed')
receipt.write_text(json.dumps(record, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps(dict(installed=entry, dimensions=im.size, network=network), ensure_ascii=False))
