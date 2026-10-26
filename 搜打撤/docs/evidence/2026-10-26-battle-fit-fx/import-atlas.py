from pathlib import Path
from PIL import Image
import hashlib, json, sys

root = Path(__file__).resolve().parents[3]
evidence = Path(__file__).parent
source = Path(sys.argv[1])
target = root / 'game/assets/battle/fx-atlas.webp'
im = Image.open(source).convert('RGBA')
if im.width != im.height or im.getchannel('A').getextrema() != (0, 255):
    raise SystemExit('Expected a square atlas with real transparency')
im.save(target, 'WEBP', quality=94, method=6)
manifest_path = root / 'game/assets/asset-manifest.json'
manifest = json.loads(manifest_path.read_text(encoding='utf-8'))
raw = target.read_bytes()
row = dict(path='battle/fx-atlas.webp', ext='webp', bytes=len(raw),
           sha256=hashlib.sha256(raw).hexdigest(), license='项目自有（内置生图）',
           source='docs/evidence/2026-10-26-battle-fit-fx/atlas-receipt.json')
existing = next((entry for entry in manifest['assets'] if entry['path'] == row['path']), None)
if existing is None:
    manifest['assets'].append(row)
else:
    existing.update(row)
manifest['count'] = len(manifest['assets'])
manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
receipt = dict(**row, input=str(source), inputSha256=hashlib.sha256(source.read_bytes()).hexdigest(),
               size=list(im.size), grid=[4,4], generation='built-in imagegen; muted directional revision',
               kinds=['slash','block','magic','fire','ice','lightning','poison','heal',
                      'curse','pulse','trail','death','buff','debuff','draw','boss'])
(evidence / 'atlas-receipt.json').write_text(json.dumps(receipt, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps(receipt, ensure_ascii=False, indent=2))
