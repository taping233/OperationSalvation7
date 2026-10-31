"""Read disk PNG/WebP dimensions and sfnt weight metadata; never modify source assets."""
from pathlib import Path
import hashlib
import json
import re
import struct
from PIL import Image

ROOT = Path(__file__).resolve().parents[3]
OUT = Path(__file__).resolve().parent

def font_record(path):
    data = path.read_bytes()
    tables = {}
    for index in range(struct.unpack_from('>H', data, 4)[0]):
        tag, checksum, offset, length = struct.unpack_from('>4sIII', data, 12 + index * 16)
        tables[tag.decode('ascii')] = (offset, length)
    os2 = tables['OS/2'][0]
    axes = []
    if 'fvar' in tables:
        base = tables['fvar'][0]
        offset = struct.unpack_from('>H', data, base + 4)[0]
        count, size = struct.unpack_from('>HH', data, base + 8)
        for index in range(count):
            tag, minimum, default, maximum, flags, name_id = struct.unpack_from('>4siiiHH', data, base + offset + index * size)
            axes.append(dict(tag=tag.decode(), minimum=minimum/65536, default=default/65536, maximum=maximum/65536, flags=flags, nameId=name_id))
    return dict(path=str(path.relative_to(ROOT)), sha256=hashlib.sha256(data).hexdigest(), bytes=len(data), os2Weight=struct.unpack_from('>H', data, os2 + 4)[0], variable=bool(axes), axes=axes)

frames = []
for path in sorted((ROOT / 'Assets/Resources/Art/Current/ui/card-frames/paper-1015').glob('*.png')):
    source = ROOT.parent / '搜打撤/game/assets/ui/card-frames/paper-1015' / (path.stem + '.webp')
    with Image.open(path) as image:
        dimensions = image.size
    with Image.open(source) as image:
        source_dimensions = image.size
    meta = path.with_suffix('.png.meta').read_text(encoding='utf-8')
    frames.append(dict(path=str(path.relative_to(ROOT)), diskPng=dimensions, sourceWebp=source_dimensions, sameDimensions=dimensions == source_dimensions, npotScale=int(re.search(r'^  nPOTScale: (\d+)', meta, re.M)[1]), maxTextureSize=int(re.search(r'^  maxTextureSize: (\d+)', meta, re.M)[1])))

try:
    from fontTools.ttLib import TTFont
except ImportError:
    parser = 'sfnt OS/2 + fvar direct big-endian parser (FontTools unavailable; no installation)'
else:
    parser = 'direct sfnt parser independently cross-checked with FontTools'

fonts = [font_record(ROOT / 'Assets/Resources/Fonts' / name) for name in ['NotoSansSC-Regular.ttf', 'NotoSansSC-Bold.ttf']]
if 'TTFont' in globals():
    for record in fonts:
        font = TTFont(ROOT / record['path'])
        assert record['os2Weight'] == font['OS/2'].usWeightClass
        expected_axes = [dict(tag=a.axisTag, minimum=a.minValue, default=a.defaultValue, maximum=a.maxValue, flags=a.flags, nameId=a.axisNameID) for a in font['fvar'].axes] if 'fvar' in font else []
        assert record['axes'] == expected_axes
result = dict(frames=frames, fontParser=parser, fonts=fonts, nativeImportStatus='Pending main-run CurrentTextureQuality.NormalizeAndProbe; disk metadata alone cannot prove actual import dimensions')
(OUT / 'source-inspection.json').write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps(dict(frameCount=len(frames), frameSizes=sorted(set(tuple(f['diskPng']) for f in frames)), frameNpot=sorted(set(f['npotScale'] for f in frames)), fontParser=parser, fonts=fonts), ensure_ascii=False, indent=2))
