"""Import the two selected ImageGen outputs; only encode and derive game thumbnails."""
from pathlib import Path
from PIL import Image
import hashlib
import json
import shutil

root = Path(__file__).resolve().parents[3]
evidence = Path(__file__).resolve().parent
generated = Path(r'C:\Users\太平\.codex\generated_images\01a104bd-3133-7c92-8791-e82ecd2d992d')
inputs = {
    'card': generated / 'exec-52ae80a2-6520-47a4-ab9c-1df46efa97c5.png',
    'gear': generated / 'exec-3cd9c558-91c4-4f8b-934f-c1298087db04.png',
}
raw_dir = root / '.tmp/imagegen/feedback-r2'
raw_dir.mkdir(parents=True, exist_ok=True)
backup_dir = evidence / 'originals'
backup_dir.mkdir(exist_ok=True)
full = root / 'game/assets/cards/spell-cc-demon.webp'
thumb = root / 'game/assets/thumbs/cards/spell-cc-demon.webp'
gear = root / 'game/assets/ui/icons/settings-gear-r2.webp'
for target in (full, thumb):
    backup = backup_dir / ('thumb-' if target == thumb else 'full-')
    backup = backup.with_name(backup.name + target.name)
    if target.exists() and not backup.exists():
        shutil.copy2(target, backup)
for key, source in inputs.items():
    shutil.copy2(source, raw_dir / (key + '.png'))

card = Image.open(inputs['card']).convert('RGB')
card.save(full, 'WEBP', quality=92, method=6)
small = card.copy()
small.thumbnail((448, 448), Image.Resampling.LANCZOS)
# Existing gallery bake matrix, used only for the derived small gallery image.
matrix = ((1.087994, .003705, .005219), (.006245, 1.079741, .004274), (.002781, -.006867, 1.082379))
pixels = small.load()
for y in range(small.height):
    for x in range(small.width):
        rgb = pixels[x, y]
        pixels[x, y] = tuple(max(0, min(255, round(sum(row[i] * rgb[i] for i in range(3)) - .02575 * 255))) for row in matrix)
small.save(thumb, 'WEBP', quality=88, method=6)
icon = Image.open(inputs['gear']).convert('RGBA')
assert icon.width == icon.height, 'Settings gear must be square'
assert icon.getpixel((icon.width // 2, icon.height // 2))[3] == 0, 'Center hole must stay transparent'
assert icon.getpixel((0, 0))[3] == 0, 'Outer background must stay transparent'
icon.thumbnail((128, 128), Image.Resampling.LANCZOS)
icon.save(gear, 'WEBP', quality=95, method=6)

def record(file):
    image = Image.open(file)
    return {'path': str(file.relative_to(root)).replace('\\', '/'), 'bytes': file.stat().st_size,
            'sha256': hashlib.sha256(file.read_bytes()).hexdigest(), 'size': list(image.size), 'mode': image.mode}

report = {'method': 'built-in ImageGen; encoding and existing thumbnail bake only',
          'outputs': [record(file) for file in (full, thumb, gear)],
          'raw': [record(raw_dir / (key + '.png')) for key in inputs],
          'originals': [record(file) for file in backup_dir.iterdir()]}
(evidence / 'images.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(json.dumps(report, ensure_ascii=False, indent=2))
