import json, shutil, hashlib
from pathlib import Path
from PIL import Image

folder = Path(__file__).resolve().parent
root = folder.parents[3]
generated = Path('C:/Users/太平/.codex/generated_images/01a12b5d-efa8-7411-a5ce-699c45bc68b0')
files = [('exec-0eeb49d4-725d-4f03-87cf-0384b6941a11.png','builtin-modern-winter-entry-v1.png'), ('exec-cc9f65cc-db78-4703-9a35-41faafcbbd10.png','builtin-modern-winter-entry-v2.png')]
for name, dest in files:
    shutil.copy2(generated / name, folder / 'source' / dest)
out = root / 'game/assets/scenes/entry/modern-winter-entry-1011-v2.webp'
image = Image.open(folder / 'source/builtin-modern-winter-entry-v2.png')
image.save(out, 'WEBP', quality=95, method=6)
assets = []
for path in [folder / 'source' / dest for _, dest in files] + [out]:
    with Image.open(path) as im:
        assets.append(dict(path=str(path.relative_to(root)),width=im.width,height=im.height,bytes=path.stat().st_size,sha256=hashlib.sha256(path.read_bytes()).hexdigest()))
(folder / 'runtime-receipt.json').write_text(json.dumps(dict(status='candidate-not-approved',conversion='WebP quality95/method6; no resize, crop or repaint',assets=assets),ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(assets,ensure_ascii=False))
