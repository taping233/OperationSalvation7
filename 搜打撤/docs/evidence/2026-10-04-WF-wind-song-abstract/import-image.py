"""Import the approved abstract-background redraw; no test or audit execution."""
from pathlib import Path
from PIL import Image
import hashlib
import json
import shutil

evidence = Path(__file__).resolve().parent
root = evidence.parents[2]
generated = Path('C:/Users/太平/.codex/generated_images/01a1072f-aa1b-7d20-9d28-a6b0afc07e00/exec-1bf4a8b3-2e82-4ea0-b3e8-209625623b54.png')
source = root / 'game/art-source/cards/hero-sacredrain-abstract-20261004.png'
if source.exists():
    raise RuntimeError('Candidate already exists; do not overwrite')
shutil.copy2(generated, source)
full = root / 'game/assets/cards/hero-sacredrain.webp'
thumb = root / 'game/assets/thumbs/cards/hero-sacredrain.webp'
backup = evidence / 'originals-before-abstract'
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
    return {'path': file.relative_to(root).as_posix(), 'bytes': file.stat().st_size,
            'sha256': hashlib.sha256(file.read_bytes()).hexdigest()}

report = {'method': 'Built-in ImageGen; WebP encoding and existing thumbnail color bake only',
          'generatedPath': str(generated), 'outputs': [dict(record(full),size=list(image.size)),dict(record(thumb),size=list(small.size))],
          'source': record(source), 'backups': [record(file) for file in backup.iterdir()],
          'verification': '老板明确禁止测试，本轮未测试/资产审计/实页'}
(evidence / 'images.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(json.dumps(report, ensure_ascii=False, indent=2))
