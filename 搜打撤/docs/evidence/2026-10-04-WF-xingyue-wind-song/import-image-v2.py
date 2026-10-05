"""Import the simplified second wind-song painting; preserve the rejected v1."""
from pathlib import Path
from PIL import Image
import hashlib
import json
import shutil

evidence = Path(__file__).resolve().parent
root = evidence.parents[2]
generation = json.loads((evidence / 'generation-v2.json').read_text(encoding='utf-8'))
raw = root / '.tmp/imagegen/xingyue-wind-song-20261004'
raw.mkdir(parents=True, exist_ok=True)
source = Path(generation['generatedPath'])
shutil.copy2(source, raw / 'wind-song-v2.png')
variants = evidence / 'variants'
variants.mkdir(exist_ok=True)
full = root / 'game/assets/cards/hero-sacredrain.webp'
thumb = root / 'game/assets/thumbs/cards/hero-sacredrain.webp'
for label, target in [('full', full), ('thumb', thumb)]:
    backup = variants / ('v1-' + label + '-hero-sacredrain.webp')
    if not backup.exists():
        shutil.copy2(target, backup)
image = Image.open(source).convert('RGB')
image.save(full, 'WEBP', quality=92, method=6)
small = image.copy()
small.thumbnail((448, 448), Image.Resampling.LANCZOS)
matrix = ((1.087994, .003705, .005219), (.006245, 1.079741, .004274), (.002781, -.006867, 1.082379))
pixels = small.load()
for y in range(small.height):
    for x in range(small.width):
        rgb = pixels[x, y]
        pixels[x, y] = tuple(max(0, min(255, round(sum(row[i] * rgb[i] for i in range(3)) - .02575 * 255))) for row in matrix)
small.save(thumb, 'WEBP', quality=88, method=6)

def record(file):
    im = Image.open(file)
    return {'path': str(file.relative_to(root)).replace('\\', '/'), 'bytes': file.stat().st_size,
            'sha256': hashlib.sha256(file.read_bytes()).hexdigest(), 'size': list(im.size), 'mode': im.mode}

report = {'method': 'Built-in ImageGen v2; only encoding and existing thumbnail bake',
          'outputs': [record(full), record(thumb)], 'raw': record(raw / 'wind-song-v2.png'),
          'rejectedV1': [record(file) for file in variants.iterdir()]}
(evidence / 'images-v2.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(json.dumps(report['outputs'], ensure_ascii=False, indent=2))
