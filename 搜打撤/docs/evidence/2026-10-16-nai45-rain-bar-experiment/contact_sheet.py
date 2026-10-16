import math
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[3]
OUTPUT = ROOT.parent / '.tmp/nai/rain-bar-experiment-20261016'
items = [('REFERENCE', Path('C:/Users/太平/AppData/Local/Temp/codex-clipboard-bf3dd922-cc09-4063-b9eb-e692b78e0d7f.png')),
         ('BASE - no artists / CFG 5.5', ROOT.parent / '.tmp/nai/rain-bar-nai45-no-artists-20261016.png')]
items += [(p.stem, p) for p in sorted(OUTPUT.glob('*.png')) if p.stem != 'comparison']
w, h, label = 608, 416, 30
canvas = Image.new('RGB', (w * 3, (h + label) * math.ceil(len(items) / 3)), '#222222')
draw = ImageDraw.Draw(canvas)
for i, (name, path) in enumerate(items):
    x, y = (i % 3) * w, (i // 3) * (h + label)
    with Image.open(path) as image:
        image = image.convert('RGB')
        image.thumbnail((w, h), Image.Resampling.LANCZOS)
        canvas.paste(image, (x + (w-image.width)//2, y + label))
    draw.text((x + 10, y + 8), name, fill='white')
canvas.save(OUTPUT / 'comparison.jpg', quality=94)
print(OUTPUT / 'comparison.jpg')
