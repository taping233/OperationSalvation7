import hashlib, json, shutil
from pathlib import Path
from PIL import Image

here = Path(__file__).resolve().parent
project = here.parents[3]
receipt_path = here / 'receipt.json'
receipt = json.loads(receipt_path.read_text(encoding='utf-8'))
source = Path(receipt['builtin']['source'])
raw = here / 'imagegen-base-home-v4.png'
shutil.copy2(source, raw)
image = Image.open(raw).convert('RGB')
raw_size = image.size
# Normal delivery resampling only: correct the generator's sub-pixel 16:9 ratio
# rounding (1672x941) to an exact 1600x900 wallpaper; no crop or content editing.
image = image.resize((1600, 900), Image.Resampling.LANCZOS)
output = project / 'game' / 'assets' / 'scenes' / 'base-home-v4.webp'
image.save(output, 'WEBP', quality=87, method=6)
with Image.open(output) as decoded:
    decoded.load()
    assert decoded.size == (1600, 900)
assert output.stat().st_size < 1000000
receipt['builtin'].update(projectRawPath=str(raw.relative_to(project)), rawSHA256=hashlib.sha256(raw.read_bytes()).hexdigest(), rawBytes=raw.stat().st_size, rawSize=raw_size, retainedStyleReferenceSHA256=hashlib.sha256(Path(receipt['builtin']['referenced_image_paths'][1]).read_bytes()).hexdigest())
receipt['output'] = {'path': str(output.relative_to(project)), 'width': 1600, 'height': 900, 'ratio': '16:9 exact', 'bytes': output.stat().st_size, 'sha256': hashlib.sha256(output.read_bytes()).hexdigest(), 'alpha': 'opaque RGB', 'encoding': 'Pillow WEBP quality 87 method 6; delivery resample only, no crop'}
receipt_path.write_text(json.dumps(receipt, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(json.dumps(receipt['output'], ensure_ascii=True))
