from pathlib import Path
from PIL import Image
import hashlib, json, shutil

root = Path(__file__).resolve().parents[3]
evidence = Path(__file__).resolve().parent
source = Path('C:/Users/太平/.codex/generated_images/01a157e7-0b27-77b2-9462-0fecb53cc289/exec-aeb23844-d595-49dc-a583-4e52941cbc28.png')
asset = root / 'game/assets/reconstruction/wallpaper-wu-bass-1020.webp'
backup = root.parent / '.tmp/imagegen/wu-bass-polish-1020'
backup.mkdir(parents=True, exist_ok=True)
old_hash = 'bc6296abbe97d51a31e4f9fda360817634cc9564cce1b5fdc000e1369c575950'
assert hashlib.sha256((backup / 'before.webp').read_bytes()).hexdigest() == old_hash
assert hashlib.sha256((backup / 'refined.png').read_bytes()).hexdigest() == hashlib.sha256(source.read_bytes()).hexdigest()
with Image.open(source) as im:
    assert im.size == (1672, 941), im.size
    im.convert('RGB').save(asset, 'WEBP', quality=90, method=6)
    size = im.size
data = asset.read_bytes()
digest = hashlib.sha256(data).hexdigest()
manifest = root / 'game/assets/asset-manifest.json'
text = manifest.read_text(encoding='utf-8')
old = '"bytes": 527266,\n      "sha256": "' + old_hash + '",\n      "license": "Project AI-generated asset; owner authorized home wallpaper installation.",\n      "source": "docs/evidence/2026-10-20-wu-bass-remix/install-receipt.json"'
new = f'"bytes": {len(data)},\n      "sha256": "{digest}",\n      "license": "Project AI-generated asset; owner authorized home wallpaper installation.",\n      "source": "docs/evidence/2026-10-20-wu-bass-polish/receipt.json"'
assert text.count(old) == 1 or text.count(new) == 1, 'Manifest entry changed; stop'
with manifest.open('w', encoding='utf-8', newline='') as handle:
    handle.write(text.replace(old, new))
css = root / 'game/css/title-p0.css'
text = css.read_text(encoding='utf-8')
assert text.count('wallpaper-wu-bass-1020.webp') == 1
with css.open('w', encoding='utf-8', newline='') as handle:
    handle.write(text.replace('wallpaper-wu-bass-1020.webp', 'wallpaper-wu-bass-1020.webp?v=polish-1020'))
receipt = dict(tool='built-in image_gen', source=str(source), source_sha256=hashlib.sha256(source.read_bytes()).hexdigest(), asset=str(asset.relative_to(root)), sha256=digest, bytes=len(data), size=size, backup=str(backup / 'before.webp'), previous_sha256=old_hash, verification='Generated image visually inspected; original composition and identity retained, scratchy finish reduced. Browser pending.')
(evidence / 'receipt.json').write_text(json.dumps(receipt, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(json.dumps(receipt, ensure_ascii=False))
