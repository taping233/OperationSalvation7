from pathlib import Path
from PIL import Image
import hashlib
import json

root = Path(__file__).resolve().parents[3]
generated = Path('C:/Users/太平/.codex/generated_images/01a13c12-9486-72f3-8090-9fd16364d883')
out = root / 'game/assets/ui/map-hud-1015'
out.mkdir(parents=True, exist_ok=True)
sources = [
    ('exec-cc06f86d-3be0-4df8-8edb-031f020bd6ab.png', 'gold-is7-v2.webp'),
    ('exec-dd84c4e8-b8d5-4153-884f-9cf6f2d69504.png', 'attack-is7-v2.webp'),
]
entries = []
receipts = []
for source, filename in sources:
    image = Image.open(generated / source).convert('RGBA')
    image.resize((128, 128), Image.Resampling.LANCZOS).save(out / filename, 'WEBP', lossless=True, method=6)
    data = (out / filename).read_bytes()
    entry = dict(path='ui/map-hud-1015/' + filename, ext='webp', bytes=len(data),
                 sha256=hashlib.sha256(data).hexdigest(),
                 license='老板授权原创图标；Codex内置image_gen生成；方舟节点图仅作画法参考',
                 source='docs/evidence/2026-10-15-WF-map-feedback/README.md')
    entries.append(entry)
    receipts.append(dict(entry, original=str(generated / source), originalSha256=hashlib.sha256((generated / source).read_bytes()).hexdigest(), encoding='128x128 RGBA lossless WebP; alpha retained'))
manifest_path = root / 'game/assets/asset-manifest.json'
with manifest_path.open('r', encoding='utf-8', newline='') as handle:
    text = handle.read()
manifest = json.loads(text)
eol = '\r\n' if '\r\n' in text else '\n'
new = ',\n'.join('    ' + json.dumps(entry, ensure_ascii=False, indent=2).replace('\n', '\n    ') for entry in entries).replace('\n', eol)
text = text.replace('"assets": [' + eol, '"assets": [' + eol + new + ',' + eol, 1)
text = text.replace('"count": ' + str(manifest['count']), '"count": ' + str(len(manifest['assets']) + len(entries)), 1)
with manifest_path.open('w', encoding='utf-8', newline='') as handle:
    handle.write(text)
(Path(__file__).parent / 'assets.json').write_text(json.dumps(receipts, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print('已编码两张图标并登记资源清单。')
