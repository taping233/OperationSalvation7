from pathlib import Path
from PIL import Image
import hashlib, json, shutil

root = Path(__file__).resolve().parents[3]
evidence = Path(__file__).resolve().parent
source = root / 'game/art-source/slot-weather-20261015'
dest = root / 'game/assets/ui/slot-weather'
generated = Path('C:/Users/太平/.codex/generated_images/01a13c37-6a66-7cd0-85da-a3cd131ba197')
items = [
    ('sunny', '晴', 'exec-fbb27e17-c4a8-4e45-b036-f811f354d91d.png'),
    ('partly-cloudy', '多云', 'exec-7ee9a941-ef1e-4e82-95e4-afabd2ae8ad1.png'),
    ('rain', '雨', 'exec-bfca5839-f0e1-4dc6-badf-ef83717af890.png'),
    ('thunder', '雷', 'exec-963cf38c-604f-40b5-9cbd-b56ab3ddc705.png'),
    ('snow', '雪', 'exec-e94ee731-71a4-4b8b-8e27-b5051345abbc.png'),
]
source.mkdir(parents=True, exist_ok=True)
dest.mkdir(parents=True, exist_ok=True)
records = []
assets = []
for name, label, filename in items:
    original = source / (name + '-v1.png')
    target = dest / (name + '-v1.webp')
    if original.exists() or target.exists():
        raise RuntimeError('Refusing overwrite: ' + name)
    shutil.copy2(generated / filename, original)
    with Image.open(original) as im:
        rgba = im.convert('RGBA')
        alpha_range = rgba.getchannel('A').getextrema()
        if alpha_range != (0, 255):
            raise RuntimeError('Expected transparent RGBA: ' + name)
        rgba.resize((384, 384), Image.Resampling.LANCZOS).save(target, 'WEBP', lossless=True, exact=True, method=6)
        size = list(im.size)
    sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
    records.append(dict(slot=len(records)+1, weather=label, generated=str(generated / filename), original=original.relative_to(root).as_posix(), originalBytes=original.stat().st_size, originalSha256=sha(original), originalSize=size, alphaRange=alpha_range, asset=target.relative_to(root).as_posix(), sha256=sha(target), bytes=target.stat().st_size))
    assets.append(dict(path=target.relative_to(root / 'game/assets').as_posix(), ext='webp', bytes=target.stat().st_size, sha256=sha(target), license='老板授权原创天气图标；Codex内置image_gen生成；方舟节点仅作视觉关系参考', source='docs/evidence/2026-10-15-slot-weather/README.md'))

module = root / 'game/src/ui/slot-emblems.js'
module.write_text('// Save-slot weather icons: sunny, partly cloudy, rain, thunder, snow.\n// Approved generated artwork; transparent RGBA WebP derivatives.\nexport const SLOT_EMBLEMS = Object.freeze([\n' + ''.join('  `<img class="ic slot-ico" src="assets/ui/slot-weather/' + name + '-v1.webp" width="384" height="384" alt="" aria-hidden="true" draggable="false">`,\n' for name, _, _ in items) + ']);\n', encoding='utf-8')

css = root / 'game/css/slots-cover.css'
text = css.read_text(encoding='utf-8')
old = '  width: 110px; height: 110px; opacity: 1; animation: none;'
if text.count(old) != 1:
    raise RuntimeError('CSS anchor changed')
css.write_text(text.replace(old, '  width: 146px; height: 146px; max-width: 100%; object-fit: contain; opacity: 1; animation: none;'), encoding='utf-8')

manifest = root / 'game/assets/asset-manifest.json'
text = manifest.read_text(encoding='utf-8')
data = json.loads(text)
if any(a['path'] in {x['path'] for x in data['assets']} for a in assets):
    raise RuntimeError('Manifest already contains assets')
old_count = '"count": ' + str(data['count'])
if text.count(old_count) != 1 or text.count('"assets": [') != 1:
    raise RuntimeError('Manifest anchors changed')
entries = ',\n'.join('    ' + json.dumps(a, ensure_ascii=False, indent=2).replace('\n', '\n    ') for a in assets)
text = text.replace(old_count, '"count": ' + str(data['count'] + len(assets)), 1).replace('"assets": [', '"assets": [\n' + entries + ',', 1)
manifest.write_text(text, encoding='utf-8')
(evidence / 'receipt.json').write_text(json.dumps(records, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(json.dumps(records, ensure_ascii=False, indent=2))
