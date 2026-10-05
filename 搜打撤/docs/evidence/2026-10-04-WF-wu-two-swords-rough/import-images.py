"""Import two face-corrected ImageGen card artworks; no tests or audits."""
from pathlib import Path
from PIL import Image
import hashlib
import json
import shutil

evidence = Path(__file__).resolve().parent
root = evidence.parents[2]
generated_root = Path('C:/Users/太平/.codex/generated_images/01a1072f-aa1b-7d20-9d28-a6b0afc07e00')
requests = [
    ('tt8-hero-ranger', 'wu-heavensword', 'exec-298a6c83-b22e-4cfb-8477-7bd212c303b6.png'),
    ('tt8-hero-sword', 'wu-myriadswords', 'exec-1d9441ae-d15c-40b9-b65d-e727bca0f772.png'),
]
backup = evidence / 'originals-before-rough'
backup.mkdir(exist_ok=True)
matrix = ((1.087994, .003705, .005219), (.006245, 1.079741, .004274), (.002781, -.006867, 1.082379))

def record(file):
    return {'path': file.relative_to(root).as_posix(), 'bytes': file.stat().st_size,
            'sha256': hashlib.sha256(file.read_bytes()).hexdigest()}

report = {'method': 'Built-in ImageGen; face edits; WebP encoding and existing thumbnail bake',
          'items': [], 'verification': '遵老板禁测令，未测试/资产门/实页'}
for card_id, slug, filename in requests:
    generated = generated_root / filename
    source = root / ('game/art-source/cards/' + slug + '-rough-face-20261004.png')
    if source.exists():
        raise RuntimeError('Candidate exists; do not overwrite')
    shutil.copy2(generated, source)
    full = root / ('game/assets/cards/' + slug + '.webp')
    thumb = root / ('game/assets/thumbs/cards/' + slug + '.webp')
    originals = []
    for label, target in [('full', full), ('thumb', thumb)]:
        destination = backup / (label + '-' + slug + '.webp')
        if destination.exists():
            raise RuntimeError('Backup exists; do not repeat import')
        shutil.copy2(target, destination)
        originals.append(record(destination))
    image = Image.open(source).convert('RGB')
    image.save(full, 'WEBP', quality=90, method=6)
    small = image.copy()
    small.thumbnail((448, 448), Image.Resampling.LANCZOS)
    pixels = small.load()
    for y in range(small.height):
        for x in range(small.width):
            rgb = pixels[x, y]
            pixels[x, y] = tuple(max(0, min(255, round(sum(row[i] * rgb[i] for i in range(3)) - .02575 * 255))) for row in matrix)
    small.save(thumb, 'WEBP', quality=82, method=6)
    report['items'].append({'cardId': card_id, 'generatedPath': str(generated), 'source': record(source),
                            'outputs': [dict(record(full), size=list(image.size)), dict(record(thumb), size=list(small.size))],
                            'backups': originals})
(evidence / 'images.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(json.dumps([{'cardId': item['cardId'], 'outputs': item['outputs']} for item in report['items']], ensure_ascii=False, indent=2))
