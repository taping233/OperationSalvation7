"""Pack FFmpeg-baked RGBA frames into a sprite atlas and viewing copies."""
from pathlib import Path
from PIL import Image
import hashlib
import json

out = Path(__file__).resolve().parent
frames = [Image.open(out / 'frames' / ('idle-%03d.png' % i)).convert('RGBA') for i in range(72)]
assert all(im.size == (768, 512) for im in frames)
atlas = Image.new('RGBA', (6144, 4608))
for i, im in enumerate(frames):
    atlas.paste(im, ((i % 8) * 768, (i // 8) * 512))
atlas.save(out / 'wu-idle-sheet.png')
atlas.save(out / 'wu-idle-sheet.webp', lossless=True)
durations = [42, 41, 42] * 24
frames[0].save(out / 'wu-idle-preview.webp', save_all=True, append_images=frames[1:],
               duration=durations, loop=0, quality=85, method=0)
gif = []
for im in frames:
    matte = Image.new('RGBA', im.size, '#202734')
    matte.alpha_composite(im)
    gif.append(matte.convert('RGB'))
gif[0].save(out / 'wu-idle-preview.gif', save_all=True, append_images=gif[1:],
            duration=[40,40,40,40,40,50]*12, loop=0, optimize=True)
meta = {'status': 'candidate', 'character': 'wu', 'animation': 'idle',
        'texture': 'wu-idle-sheet.webp', 'frameWidth': 768, 'frameHeight': 512,
        'columns': 8, 'rows': 9, 'frameCount': 72, 'fps': 24,
        'sequence': list(range(72)), 'durationsMs': durations,
        'loopDurationMs': 3000, 'loop': True,
        'method': 'imagegen calm-hair base; FFmpeg continuous breath displacement baked to PNG frames; no skeleton',
        'breathAmplitudePx': 3.5, 'fixedLowerBodyFromY': 365,
        'hair': 'settled; no independent sway'}
(out/'sprite.json').write_text(json.dumps(meta,ensure_ascii=False,indent=2),encoding='utf8')
fixed = frames[0].crop((0,365,768,512)).tobytes()
assert all(im.crop((0,365,768,512)).tobytes()==fixed for im in frames)
assert frames[0].tobytes()!=frames[18].tobytes()!=frames[36].tobytes()
assert all(im.getpixel((0,0))[3]==0 for im in frames)
report = {'passed': True, 'frames':72, 'fps':24, 'loopMs':3000,
          'lowerBodyPixelIdentical':True, 'transparentCorners':True,
          'uniqueRasterFrames':len({im.tobytes() for im in frames})}
(out/'validation.json').write_text(json.dumps(report,indent=2),encoding='utf8')
print(json.dumps(report))
