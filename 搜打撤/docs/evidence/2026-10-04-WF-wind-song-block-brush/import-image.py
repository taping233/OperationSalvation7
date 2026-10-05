"""Encode the approved ImageGen painting using existing card thumbnail conventions."""
from pathlib import Path
from PIL import Image
import hashlib
import json
import shutil

evidence = Path(__file__).resolve().parent
root = evidence.parents[2]
source = root / 'game/art-source/cards/hero-sacredrain-block-brush-20261004.png'
full = root / 'game/assets/cards/hero-sacredrain.webp'
thumb = root / 'game/assets/thumbs/cards/hero-sacredrain.webp'
backup = evidence / 'originals-before-integration'
backup.mkdir(exist_ok=True)
for label, target in [('full', full), ('thumb', thumb)]:
    destination = backup / (label + '-hero-sacredrain.webp')
    if destination.exists():
        raise RuntimeError('Backup already exists; do not repeat import')
    shutil.copy2(target, destination)
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
    with Image.open(file) as im:
        im.load()
        size, mode = list(im.size), im.mode
    return {'path': file.relative_to(root).as_posix(), 'bytes': file.stat().st_size,
            'sha256': hashlib.sha256(file.read_bytes()).hexdigest(), 'size': size, 'mode': mode}

report = {'method': 'Built-in ImageGen; WebP encoding and existing thumbnail color bake only',
          'outputs': [record(full), record(thumb)], 'source': record(source),
          'backups': [record(file) for file in backup.iterdir()]}
(evidence / 'images-integrated.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(json.dumps(report['outputs'], ensure_ascii=False, indent=2))
