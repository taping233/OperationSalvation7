from pathlib import Path
from PIL import Image
import hashlib
import json
import sys

root = Path(__file__).resolve().parents[3]
source = Path(sys.argv[1])
target = root / 'game/assets/ui/map-hud-1015/health-is7-v1.webp'
Image.open(source).convert('RGBA').resize((128, 128), Image.Resampling.LANCZOS).save(target, 'WEBP', lossless=True, method=6)
data = target.read_bytes()
entry = dict(path='ui/map-hud-1015/health-is7-v1.webp', ext='webp', bytes=len(data),
             sha256=hashlib.sha256(data).hexdigest(),
             license='老板授权原创生命图标；Codex内置image_gen生成；方舟节点仅作视觉关系参考',
             source='docs/evidence/2026-10-15-WF-health-hud/README.md')
path = root / 'game/assets/asset-manifest.json'
with path.open('r', encoding='utf-8', newline='') as handle:
    text = handle.read()
manifest = json.loads(text)
if any(item.get('path') == entry['path'] for item in manifest['assets']):
    raise RuntimeError('生命图标已有登记，保留现场，不重复插入。')
eol = '\r\n' if '\r\n' in text else '\n'
block = ('    ' + json.dumps(entry, ensure_ascii=False, indent=2).replace('\n', '\n    ')).replace('\n', eol)
text = text.replace('"assets": [' + eol, '"assets": [' + eol + block + ',' + eol, 1)
text = text.replace('"count": ' + str(manifest['count']), '"count": ' + str(len(manifest['assets']) + 1), 1)
with path.open('w', encoding='utf-8', newline='') as handle:
    handle.write(text)
receipt = dict(entry, original=str(source), originalSha256=hashlib.sha256(source.read_bytes()).hexdigest(), encoding='128x128 RGBA lossless WebP; alpha retained')
(Path(__file__).parent / 'asset.json').write_text(json.dumps(receipt, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print('生命图标已编码并登记。')
