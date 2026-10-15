"""Import only the approved rare frame; preserve other frame records."""
import hashlib
import json
import shutil
import statistics
from pathlib import Path
from PIL import Image

here = Path(__file__).resolve().parent
root = here.parents[2]
request = json.loads((here / 'request.json').read_text(encoding='utf-8'))
source = Path(request['source'])
original = root / 'game/art-source/card-frame-study-1014/rare.png'
runtime = root / 'game/assets/ui/card-frames/split-1014/rare.webp'
backup = root / '.tmp/imagegen/2026-10-15-rare-blue'
resume = backup.exists()
if resume and (not (backup / 'rare-before.png').is_file() or not (backup / 'rare-before.webp').is_file() or original.read_bytes() != source.read_bytes()):
    raise FileExistsError('Backup exists but does not match interrupted import')
image = Image.open(source).convert('RGBA')
width, height = image.size
if (width, height) != (1024, 1536):
    raise ValueError(f'Unexpected canvas: {image.size}')
alpha = image.getchannel('A')
if alpha.getpixel((width // 2, height // 2)) != 0:
    raise ValueError('Frame aperture must be transparent')

def extent(values):
    middle = len(values) // 2
    left = next(i + 1 for i in range(middle, -1, -1) if values[i] >= 160)
    right = next(i for i in range(middle, len(values)) if values[i] >= 160)
    outer_left, outer_right = left - 1, right + 1
    while outer_left > 0 and values[outer_left - 1] >= 160:
        outer_left -= 1
    while outer_right < len(values) and values[outer_right] >= 160:
        outer_right += 1
    return left, right, outer_left, outer_right

horizontal = [extent([alpha.getpixel((x, round(height * f))) for x in range(width)]) for f in (.35, .5, .65)]
vertical = [extent([alpha.getpixel((round(width * f), y)) for y in range(height)]) for f in (.3, .5, .7)]
left, right, ol, ore = [round(statistics.median(v[i] for v in horizontal)) for i in range(4)]
top, bottom, ot, ob = [round(statistics.median(v[i] for v in vertical)) for i in range(4)]
rails = dict(zip(('left', 'right', 'top', 'bottom'), (left - ol, ore - right, top - ot, ob - bottom)))
scale = 232 / (right - left)
digest = lambda path: hashlib.sha256(path.read_bytes()).hexdigest()
geometry = dict(path=original.relative_to(root).as_posix(), source=str(source), sha256=digest(source), bytes=source.stat().st_size, width=width, height=height, opening=[left, top, right, bottom], rails=rails, previewRails={side: round(size * scale, 2) for side, size in rails.items()}, preview=dict(width=round(width * scale, 4), left=round(-left * scale, 4), top=round(-top * scale, 4), apertureHeight=round((bottom - top) * scale, 4)))

def replace_record(path, key, value):
    text = path.read_text(encoding='utf-8')
    json.loads(text)
    start = text.index('  "' + key + '": {')
    end = text.index('\n  }', start) + len('\n  }')
    block = json.dumps({key: value}, ensure_ascii=False, indent=2)[2:-2]
    updated = text[:start] + block + text[end:]
    json.loads(updated)
    with path.open('w', encoding='utf-8', newline='') as stream:
        stream.write(updated)

if not resume:
    backup.mkdir(parents=True)
    shutil.copy2(original, backup / 'rare-before.png')
    shutil.copy2(runtime, backup / 'rare-before.webp')
shutil.copy2(source, original)
image.resize((512, 768), Image.Resampling.LANCZOS).save(runtime, format='WEBP', lossless=True, method=6, exact=True)
replace_record(root / 'game/art-source/card-frame-study-1014/geometry.json', 'rare', geometry)
replace_record(root / 'game/data/card-frame-layout.json', 'rare', dict(path='ui/card-frames/split-1014/rare.webp', width=512, height=768, opening=[left / 2, top / 2, (right - left) / 2, (bottom - top) / 2]))
manifest_path = root / 'game/assets/asset-manifest.json'
manifest_text = manifest_path.read_text(encoding='utf-8')
manifest = json.loads(manifest_text)
marker = '      "path": "ui/card-frames/split-1014/rare.webp"'
start = manifest_text.index('    {\n' + marker)
end = manifest_text.index('\n    }', start) + len('\n    }')
entry = dict(path='ui/card-frames/split-1014/rare.webp', ext='webp', license='老板授权项目卡框；Codex内置image_gen重绘', bytes=runtime.stat().st_size, sha256=digest(runtime), source='docs/evidence/2026-10-15-rare-blue/request.json')
block = '\n'.join('    ' + line for line in json.dumps(entry, ensure_ascii=False, indent=2).splitlines())
updated = manifest_text[:start] + block + manifest_text[end:]
json.loads(updated)
with manifest_path.open('w', encoding='utf-8', newline='') as stream:
    stream.write(updated)
receipt = dict(source=str(source), original=geometry, runtime=entry, backup=backup.relative_to(root).as_posix(), validation='仅导入所需尺寸/透明开口读取；未测试、未实页验收、未构建、未提交')
(here / 'receipt.json').write_text(json.dumps(receipt, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(json.dumps(receipt, ensure_ascii=False, indent=2))
