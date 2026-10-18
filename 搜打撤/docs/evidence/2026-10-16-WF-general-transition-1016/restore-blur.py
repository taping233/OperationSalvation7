import hashlib
import json
import shutil
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[3]
here = Path(__file__).resolve().parent
request = json.loads((here / 'blur-correction-request.json').read_text(encoding='utf-8'))
source = Path(request['generatedSource'])
local_source = ROOT.parent / '.tmp/nai/general-transition-1016/builtin-blur-restored-v2.png'
target = ROOT / 'game/assets/scenes/transition-general-1016.webp'
previous = json.loads((here / 'receipt.json').read_text(encoding='utf-8'))
assert previous['asset']['sha256'] == hashlib.sha256(target.read_bytes()).hexdigest()
assert not (here / 'receipt-v1.json').exists(), 'Correction already applied.'
shutil.copy2(here / 'receipt.json', here / 'receipt-v1.json')
shutil.copy2(source, local_source)
with Image.open(source) as image:
    dimensions = image.size
    image.convert('RGB').save(target, 'WEBP', quality=89, method=6)
asset = dict(previous['asset'], bytes=target.stat().st_size,
    sha256=hashlib.sha256(target.read_bytes()).hexdigest())
receipt = dict(workflow='NovelAI V5 draft -> built-in redraw -> original blur restored',
    dimensions=dimensions, encoding='WebP quality89 method6, original dimensions',
    source=str(local_source.relative_to(ROOT.parent)), sourceBytes=local_source.stat().st_size,
    sourceSha256=hashlib.sha256(local_source.read_bytes()).hexdigest(), asset=asset,
    correction='Preserve original NAI left-side and distant defocus; gateway and cloth stay sharp.')
(here / 'receipt.json').write_text(json.dumps(receipt, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
manifest = ROOT / 'game/assets/asset-manifest.json'
text = manifest.read_text(encoding='utf-8')
def entry(data):
    return '\n'.join('    ' + line for line in json.dumps(data, ensure_ascii=False, indent=2).splitlines())
old = entry(previous['asset'])
assert text.count(old) == 1, 'Manifest entry changed; inspect before updating.'
text = text.replace(old, entry(asset), 1)
manifest.write_text(text, encoding='utf-8')
print(json.dumps(receipt, ensure_ascii=False))
