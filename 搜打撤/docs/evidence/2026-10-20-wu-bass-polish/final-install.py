from pathlib import Path
from PIL import Image
import hashlib, json, shutil, io
root = Path(__file__).resolve().parents[3]
evidence = Path(__file__).resolve().parent
source = Path('C:/Users/太平/.codex/generated_images/01a157e7-0b27-77b2-9462-0fecb53cc289/exec-c99a7760-82e6-4820-87ad-7334a14a72f6.png')
asset = root / 'game/assets/reconstruction/wallpaper-wu-bass-1020.webp'
manifest = root / 'game/assets/asset-manifest.json'
css = root / 'game/css/title-p0.css'
old_hash = hashlib.sha256(asset.read_bytes()).hexdigest()
assert old_hash == '9e435d8b6e635cc7810fa1ee77f1b5d93c6941f0f7120e54e61d07f4a216892a'
with Image.open(source) as im:
    assert im.size == (1672, 941), im.size
    output = io.BytesIO()
    im.convert('RGB').save(output, 'WEBP', quality=90, method=6)
data = output.getvalue()
digest = hashlib.sha256(data).hexdigest()
manifest_text = manifest.read_text(encoding='utf-8')
old = '"bytes": 270978,\n      "sha256": "' + old_hash + '",\n      "license": "Project AI-generated asset; owner authorized home wallpaper installation.",\n      "source": "docs/evidence/2026-10-20-wu-bass-polish/receipt.json"'
new = f'"bytes": {len(data)},\n      "sha256": "{digest}",\n      "license": "Project AI-generated asset; owner authorized home wallpaper installation.",\n      "source": "docs/evidence/2026-10-20-wu-bass-polish/final-receipt.json"'
assert manifest_text.count(old) == 1
css_text = css.read_text(encoding='utf-8')
old_url = 'wallpaper-wu-bass-1020.webp?v=hand-polish-1020'
assert css_text.count(old_url) == 1
backup = root.parent / '.tmp/imagegen/wu-bass-polish-1020'
assert not (backup / 'before-final.webp').exists()
shutil.copy2(asset, backup / 'before-final.webp')
shutil.copy2(source, backup / 'final-wallpaper.png')
asset.write_bytes(data)
with manifest.open('w', encoding='utf-8', newline='') as f:
    f.write(manifest_text.replace(old, new))
with css.open('w', encoding='utf-8', newline='') as f:
    f.write(css_text.replace(old_url, 'wallpaper-wu-bass-1020.webp?v=final-face-1020'))
receipt = dict(tool='built-in image_gen', source=str(source), source_sha256=hashlib.sha256(source.read_bytes()).hexdigest(), asset=str(asset.relative_to(root)), sha256=digest, bytes=len(data), size=[1672,941], previous_sha256=old_hash, backup=str(backup / 'before-final.webp'), verification='Generated outpaint visually inspected; full headstock and wide room visible. Asset audit and browser pending.')
(evidence / 'final-receipt.json').write_text(json.dumps(receipt,ensure_ascii=False,indent=2)+'\n', encoding='utf-8')
print(digest, len(data))
