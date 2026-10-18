import hashlib
import json
import shutil
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[3]
here = Path(__file__).resolve().parent
request = json.loads((here / 'redraw-request.json').read_text(encoding='utf-8'))
source = Path(request['generatedSource'])
local_source = ROOT.parent / '.tmp/nai/general-transition-1016/builtin-redraw-v1.png'
target = ROOT / 'game/assets/scenes/transition-general-1016.webp'
if target.exists():
    previous = json.loads((here / 'receipt.json').read_text(encoding='utf-8'))
    assert previous['asset']['sha256'] == hashlib.sha256(target.read_bytes()).hexdigest()
shutil.copy2(source, local_source)
with Image.open(source) as image:
    dimensions = image.size
    image.convert('RGB').save(target, 'WEBP', quality=89, method=6)
asset = dict(path='scenes/transition-general-1016.webp', ext='webp',
    license='项目自有（NovelAI起稿、内置ImageGen重绘）', bytes=target.stat().st_size,
    sha256=hashlib.sha256(target.read_bytes()).hexdigest(),
    source='docs/evidence/2026-10-16-WF-general-transition-1016/receipt.json')
receipt = dict(workflow='NovelAI V5 draft -> built-in image_gen redraw',
    dimensions=dimensions, encoding='WebP quality89 method6, original dimensions',
    source=str(local_source.relative_to(ROOT.parent)), sourceBytes=local_source.stat().st_size,
    sourceSha256=hashlib.sha256(local_source.read_bytes()).hexdigest(), asset=asset)
(here / 'receipt.json').write_text(json.dumps(receipt, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
manifest = ROOT / 'game/assets/asset-manifest.json'
text = manifest.read_text(encoding='utf-8')
data = json.loads(text)
assert not any(a['path'] == asset['path'] for a in data['assets'])
old_count = data['count']
text = text.replace(f'"count": {old_count},', f'"count": {old_count + 1},', 1)
entry = json.dumps(asset, ensure_ascii=False, indent=2)
entry = '\n'.join('    ' + line for line in entry.splitlines())
text = text.replace('  "assets": [\n', '  "assets": [\n' + entry + ',\n', 1)
assert len(json.loads(text)['assets']) == len(data['assets']) + 1
manifest.write_text(text, encoding='utf-8')
print(json.dumps(receipt, ensure_ascii=False))
