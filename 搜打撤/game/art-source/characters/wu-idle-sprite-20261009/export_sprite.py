"""Export generated cells as aligned sprites; no repainting or tween synthesis."""
from pathlib import Path
from PIL import Image
import hashlib
import json
import shutil
import sys

OUT = Path(__file__).resolve().parent
source = Path(sys.argv[1])
shutil.copyfile(source, OUT / 'generated-sheet.png')
sheet = Image.open(source).convert('RGBA')
assert sheet.size == (1536, 1024), sheet.size
frames = []
details = []
for i in range(4):
    x, y = (i % 2) * 768, (i // 2) * 512
    cell = sheet.crop((x, y, x + 768, y + 512))
    box = cell.getchannel('A').point(lambda a: 255 if a > 32 else 0).getbbox()
    assert box and box[0] > 0 and box[1] > 0 and box[2] < 768 and box[3] < 512
    # A shared transparent gutter preserves the whole silhouette. Align sole baseline.
    frame = Image.new('RGBA', (800, 544))
    shift_y = 512 - box[3]
    frame.paste(cell, (16, shift_y))
    frame.save(OUT / ('idle-%02d.png' % i))
    frame.save(OUT / ('idle-%02d.webp' % i), lossless=True)
    frames.append(frame)
    details.append({'sourceBounds': box, 'offset': [16, shift_y]})

atlas = Image.new('RGBA', (1600, 1088))
for i, frame in enumerate(frames):
    atlas.paste(frame, ((i % 2) * 800, (i // 2) * 544))
atlas.save(OUT / 'wu-idle-sheet.png')
atlas.save(OUT / 'wu-idle-sheet.webp', lossless=True)
order = [0, 1, 2, 3, 2, 1]
durations = [600, 450, 450, 600, 450, 450]
frames[0].save(OUT / 'wu-idle-preview.webp', save_all=True,
               append_images=[frames[i] for i in order[1:]], duration=durations,
               loop=0, lossless=True, minimize_size=True)
# GIF is a viewing copy only: opaque matte, not the transparent game asset.
gif_frames = []
for i in order:
    matte = Image.new('RGBA', frames[i].size, '#202734')
    matte.alpha_composite(frames[i])
    gif_frames.append(matte.convert('RGB'))
gif_frames[0].save(OUT / 'wu-idle-preview.gif', save_all=True,
                   append_images=gif_frames[1:], duration=durations, loop=0)
meta = {
    'status': 'candidate', 'character': 'wu', 'animation': 'idle',
    'texture': 'wu-idle-sheet.webp', 'frameWidth': 800, 'frameHeight': 544,
    'columns': 2, 'rows': 2, 'uniqueFrames': 4,
    'sequence': order, 'durationsMs': durations, 'loopDurationMs': sum(durations),
    'soleBaselineY': 512, 'loop': True, 'alignment': details,
    'method': 'imagegen keyframes; cell extraction and baseline alignment; no skeleton or generated in-between frames',
}
(OUT / 'sprite.json').write_text(json.dumps(meta, ensure_ascii=False, indent=2), encoding='utf-8')
files = []
for path in sorted(OUT.iterdir()):
    if path.is_file():
        files.append({'file': path.name, 'bytes': path.stat().st_size,
                      'sha256': hashlib.sha256(path.read_bytes()).hexdigest()})
(OUT / 'export-report.json').write_text(json.dumps({'sprite': meta, 'files': files}, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps({'frameCount': len(frames), 'size': frames[0].size, 'loopMs': sum(durations), 'files': files}, ensure_ascii=False))
