"""Convert the NAI5 + built-in repaint output and add only its asset entry."""
import hashlib
import json
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[3]
source = Path('C:/Users/太平/.codex/generated_images/01a17113-c3e5-7582-91bf-a4cbb71c3078/exec-192ffeb7-b728-4114-ac5c-11c0248614e6.png')
destination = ROOT / 'game/assets/scenes/reward-salvage-v1.webp'
if destination.exists():
    raise SystemExit('Destination already exists; preserve it and choose a sibling name.')
with Image.open(source) as image:
    image.convert('RGB').save(destination, 'WEBP', quality=90, method=6)
    size = image.size
digest = lambda path: hashlib.sha256(path.read_bytes()).hexdigest()
entry = {'path': 'scenes/reward-salvage-v1.webp', 'ext': 'webp',
         'license': '项目原创（NAI5起稿＋内置imagegen重绘）',
         'bytes': destination.stat().st_size, 'sha256': digest(destination),
         'source': 'docs/evidence/2026-10-25-reward-glass/backdrop-source.json'}
manifest = ROOT / 'game/assets/asset-manifest.json'
text = manifest.read_text(encoding='utf-8')
data = json.loads(text)
if any(asset['path'] == entry['path'] for asset in data['assets']):
    raise SystemExit('Asset entry already exists; do not duplicate.')
old_count = '"count": ' + str(data['count'])
assert text.count(old_count) == 1
text = text.replace(old_count, '"count": ' + str(len(data['assets']) + 1), 1)
serialized = '\n'.join('    ' + line for line in json.dumps(entry, ensure_ascii=False, indent=2).splitlines())
text = text.replace('"assets": [', '"assets": [\n' + serialized + ',', 1)
manifest.write_text(text, encoding='utf-8')
receipt = {'pipeline': ['nai-diffusion-5-full', 'built-in imagegen repaint', 'WebP conversion only'],
           'draft': '.tmp/nai/reward-redesign-1025/nai5-draft.png',
           'repaintSource': str(source), 'repaintSha256': digest(source),
           'dimensions': list(size), 'asset': entry,
           'rejected': 'Earlier direct built-in ruined warehouse draft was rejected and was not imported.'}
Path(__file__).with_name('backdrop-source.json').write_text(json.dumps(receipt, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps({'asset': entry['path'], 'dimensions': size, 'bytes': entry['bytes']}, ensure_ascii=False))
