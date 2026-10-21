from pathlib import Path
from PIL import Image
import hashlib, json, shutil
root = Path(__file__).resolve().parents[3]
evidence = Path(__file__).resolve().parent
source = Path('C:/Users/太平/.codex/generated_images/01a157e7-0b27-77b2-9462-0fecb53cc289/exec-538882d3-be58-4f3c-8c28-695a84dd0aba.png')
asset = root / 'game/assets/reconstruction/wallpaper-wu-bass-1020.webp'
receipt_path = evidence / 'receipt.json'
receipt = json.loads(receipt_path.read_text(encoding='utf-8'))
assert hashlib.sha256(asset.read_bytes()).hexdigest() == receipt['sha256']
backup = root.parent / '.tmp/imagegen/wu-bass-polish-1020'
shutil.copy2(asset, backup / 'before-hand.webp')
shutil.copy2(source, backup / 'hand-refined.png')
with Image.open(source) as im:
    assert im.size == (1672, 941)
    im.convert('RGB').save(asset, 'WEBP', quality=90, method=6)
data = asset.read_bytes()
digest = hashlib.sha256(data).hexdigest()
manifest = root / 'game/assets/asset-manifest.json'
text = manifest.read_text(encoding='utf-8')
old = f'"bytes": {receipt["bytes"]},\n      "sha256": "{receipt["sha256"]}"'
assert text.count(old) == 1
with manifest.open('w', encoding='utf-8', newline='') as f:
    f.write(text.replace(old, f'"bytes": {len(data)},\n      "sha256": "{digest}"'))
css = root / 'game/css/title-p0.css'
text = css.read_text(encoding='utf-8')
assert text.count('wallpaper-wu-bass-1020.webp?v=polish-1020') == 1
with css.open('w', encoding='utf-8', newline='') as f:
    f.write(text.replace('wallpaper-wu-bass-1020.webp?v=polish-1020', 'wallpaper-wu-bass-1020.webp?v=hand-polish-1020'))
receipt['polish_source'] = receipt['source']
receipt.update(source=str(source), source_sha256=hashlib.sha256(source.read_bytes()).hexdigest(), sha256=digest, bytes=len(data), hand_fix='Canvas-left fretting hand redrawn, thumb behind neck, four curved fingers; generated output visually inspected.', verification='Selected asset audit and final browser check pending')
receipt_path.write_text(json.dumps(receipt, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(digest, len(data))
