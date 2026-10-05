"""Preserve native ImageGen alpha while encoding four sealed-limb cards."""
from pathlib import Path
from PIL import Image
import hashlib
import json
import shutil

evidence = Path(__file__).resolve().parent
root = evidence.parents[2]
generated_root = Path('C:/Users/太平/.codex/generated_images/01a1072f-aa1b-7d20-9d28-a6b0afc07e00')
requests = [
    ('tt8-curseimmune', 'exec-a3702c62-5273-4a03-8214-25a9512c1d8c.png'),
    ('tt8-energycap', 'exec-2ea5d84f-42e4-4080-8017-b542f9345064.png'),
    ('tt8-nofocus', 'exec-464fdeff-1940-45a8-95e4-7d24748f15bf.png'),
    ('tt8-healplus', 'exec-2c49ea4f-6452-4e0f-a079-d49a2f542949.png'),
]
backup = evidence / 'originals-before-transparent'
backup.mkdir(exist_ok=True)
matrix = ((1.087994, .003705, .005219), (.006245, 1.079741, .004274), (.002781, -.006867, 1.082379))

def record(file):
    return {'path': file.relative_to(root).as_posix(), 'bytes': file.stat().st_size,
            'sha256': hashlib.sha256(file.read_bytes()).hexdigest()}

report = {'method': 'Built-in ImageGen native transparent background; RGBA WebP/thumb encoding',
          'items': [], 'verification': '遵老板禁测令，未测试/资产门/实页'}
for card_id, filename in requests:
    slug = 'creature-' + card_id
    generated = generated_root / filename
    source = root / ('game/art-source/cards/' + slug + '-transparent-20261004.png')
    if source.exists():
        raise RuntimeError('Candidate already exists')
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
    native = Image.open(source)
    native_mode = native.mode
    image = native.convert('RGBA')
    alpha_range = list(image.getchannel('A').getextrema())
    image.save(full, 'WEBP', quality=90, method=6)
    small = image.copy()
    small.thumbnail((448, 448), Image.Resampling.LANCZOS)
    pixels = small.load()
    for y in range(small.height):
        for x in range(small.width):
            rgba = pixels[x, y]
            if rgba[3] == 0:
                continue
            rgb = tuple(max(0, min(255, round(sum(row[i] * rgba[i] for i in range(3)) - .02575 * 255))) for row in matrix)
            pixels[x, y] = rgb + (rgba[3],)
    small.save(thumb, 'WEBP', quality=82, method=6)
    report['items'].append({'cardId': card_id, 'generatedPath': str(generated), 'source': dict(record(source), mode=native_mode, size=list(image.size), alphaRange=alpha_range),
                            'outputs': [dict(record(full), size=list(image.size), mode='RGBA'), dict(record(thumb), size=list(small.size), mode='RGBA')],
                            'backups': originals})
(evidence / 'images.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(json.dumps([{'cardId': i['cardId'], 'sourceMode': i['source']['mode'], 'alphaRange': i['source']['alphaRange'], 'outputs': i['outputs']} for i in report['items']], ensure_ascii=False, indent=2))
