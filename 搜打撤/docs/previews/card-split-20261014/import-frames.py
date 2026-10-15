"""Copy generated PNGs unchanged and inspect their alpha geometry for preview placement."""
import hashlib
import json
import shutil
import statistics
import sys
from pathlib import Path
from PIL import Image

here = Path(__file__).resolve().parent
target = here.parents[2] / 'game/art-source/card-frame-study-1014'
target.mkdir(parents=True, exist_ok=True)
(target / '.gitignore').write_text('*.png\n', encoding='utf-8')
sources = json.loads(Path(sys.argv[1]).read_text(encoding='utf-8-sig'))
metadata = {}

def extent(values):
    middle = len(values) // 2
    left = next(i + 1 for i in range(middle, -1, -1) if values[i] >= 160)
    right = next(i for i in range(middle, len(values)) if values[i] >= 160)
    outer_left = left - 1
    while outer_left > 0 and values[outer_left - 1] >= 160:
        outer_left -= 1
    outer_right = right + 1
    while outer_right < len(values) and values[outer_right] >= 160:
        outer_right += 1
    return left, right, outer_left, outer_right

for key, source in sources.items():
    source = Path(source)
    if not source.is_file():
        raise FileNotFoundError(source)
    image = Image.open(source).convert('RGBA')
    width, height = image.size
    alpha = image.getchannel('A')
    horizontal = [extent([alpha.getpixel((x, round(height * fraction))) for x in range(width)]) for fraction in (.35, .5, .65)]
    vertical = [extent([alpha.getpixel((round(width * fraction), y)) for y in range(height)]) for fraction in (.3, .5, .7)]
    left, right, outside_left, outside_right = [round(statistics.median(v[i] for v in horizontal)) for i in range(4)]
    top, bottom, outside_top, outside_bottom = [round(statistics.median(v[i] for v in vertical)) for i in range(4)]
    if alpha.getpixel((width // 2, height // 2)) != 0:
        raise ValueError(f'{key}: center is not fully transparent')
    destination = target / f'{key}.png'
    shutil.copy2(source, destination)
    scale = 232 / (right - left)
    rails = dict(zip(('left', 'right', 'top', 'bottom'), (left - outside_left, outside_right - right, top - outside_top, outside_bottom - bottom)))
    metadata[key] = dict(path=destination.relative_to(here.parents[2]).as_posix(), source=str(source), sha256=hashlib.sha256(source.read_bytes()).hexdigest(), bytes=source.stat().st_size, width=width, height=height, opening=[left, top, right, bottom], rails=rails, previewRails={side: round(size * scale, 2) for side, size in rails.items()}, preview=dict(width=round(width * scale, 4), left=round(-left * scale, 4), top=round(-top * scale, 4), apertureHeight=round((bottom - top) * scale, 4)))
(target / 'geometry.json').write_text(json.dumps(metadata, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(json.dumps({key: {'opening': value['opening'], 'rails': value['previewRails'], 'apertureHeight': value['preview']['apertureHeight']} for key, value in metadata.items()}, ensure_ascii=False, indent=1))
