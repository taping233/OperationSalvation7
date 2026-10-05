"""Import eight original-composition ImageGen repaints; no tests or audits."""
from pathlib import Path
from PIL import Image
import hashlib
import json
import shutil

evidence = Path(__file__).resolve().parent
root = evidence.parents[2]
generated_root = Path('C:/Users/太平/.codex/generated_images/01a1072f-aa1b-7d20-9d28-a6b0afc07e00')
requests = [
    ('tt2-frostsword', '寒冰剑', 'exec-c6500a7a-77dd-4b70-bf23-458f1fa9571f.png'),
    ('tt3-twinwater-mail', '冰甲', 'exec-fb06cff2-26db-4aaf-8e00-2f0869915d43.png'),
    ('tt3-grass-armor', '草甲', 'exec-15a24d31-627a-41f8-a345-6ae70b481144.png'),
    ('tt7-naturestaff', '自然法杖', 'exec-b9e6c6c4-0e16-4597-8df5-71ddbcc20c39.png'),
    ('tt2-pearlbox', '珍珠盒', 'exec-cc56e9a2-ed1d-4767-83b0-414f84750289.png'),
    ('tt3-element-seal', '元素符印', 'exec-2752d8ef-b31b-4451-a4ee-0f9a3147cf1c.png'),
    ('tt3-fate-wheel', '命运钟表', 'exec-aa13dc03-066d-4389-bb84-b4c4741b2f82.png'),
    ('tt2-wreck', '沉船宝盒', 'exec-d644f011-8939-41ca-adb2-26e96f204254.png'),
]
backup = evidence / 'originals-before-repaint'
backup.mkdir(exist_ok=True)
matrix = ((1.087994, .003705, .005219), (.006245, 1.079741, .004274), (.002781, -.006867, 1.082379))

def record(file):
    return {'path': file.relative_to(root).as_posix(), 'bytes': file.stat().st_size,
            'sha256': hashlib.sha256(file.read_bytes()).hexdigest()}

report = {'method': 'Built-in ImageGen original-layout edits; WebP and existing thumbnail bake',
          'items': [], 'verification': '遵老板禁测令，未测试/资产门/实页'}
for card_id, name, filename in requests:
    slug = 'equip-' + card_id
    generated = generated_root / filename
    source = root / ('game/art-source/cards/' + slug + '-original-rough-20261005.png')
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
    report['items'].append({'cardId': card_id, 'name': name, 'generatedPath': str(generated),
                            'source': record(source),
                            'outputs': [dict(record(full), size=list(image.size)), dict(record(thumb), size=list(small.size))],
                            'backups': originals})
(evidence / 'images.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(json.dumps([{'cardId': item['cardId'], 'outputs': item['outputs']} for item in report['items']], ensure_ascii=False, indent=2))
