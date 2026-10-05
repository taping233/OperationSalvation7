"""Encode the ImageGen card with existing thumbnail conventions; no tests."""
from pathlib import Path
from PIL import Image
import hashlib
import json
import shutil
import sys

evidence = Path(__file__).resolve().parent
root = evidence.parents[2]
generated = Path(sys.argv[1])
source = root / 'game/art-source/cards/bound-shadow-rough-20261004.png'
if source.exists():
    raise RuntimeError('Candidate already exists; do not overwrite')
shutil.copy2(generated, source)
full = root / 'game/assets/cards/bound-shadow.webp'
thumb = root / 'game/assets/thumbs/cards/bound-shadow.webp'
backup = evidence / 'originals-before-rough'
backup.mkdir(exist_ok=True)
for label, target in [('full', full), ('thumb', thumb)]:
    destination = backup / (label + '-bound-shadow.webp')
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
    return {'path': file.relative_to(root).as_posix(), 'bytes': file.stat().st_size,
            'sha256': hashlib.sha256(file.read_bytes()).hexdigest()}

report = {'method': 'Built-in ImageGen; WebP encoding and existing thumbnail color bake only',
          'generatedPath': str(generated), 'outputs': [dict(record(full),size=list(image.size)),dict(record(thumb),size=list(small.size))],
          'source': record(source), 'backups': [record(file) for file in backup.iterdir()],
          'verification': '老板明确禁止测试，本轮未测试/资产审计/实页'}
(evidence / 'images.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(json.dumps(report['outputs'], ensure_ascii=False, indent=2))
