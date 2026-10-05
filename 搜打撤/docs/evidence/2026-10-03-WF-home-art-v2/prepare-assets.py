from PIL import Image
from pathlib import Path
import hashlib
import json

root = Path(__file__).resolve().parents[3]
generated = Path('C:/Users/太平/.codex/generated_images/01a1025a-eb31-7e91-8193-f99ee3679743')
output = root / 'game/assets/ui/home-v2'
output.mkdir(parents=True, exist_ok=True)
sources = [
    ('camera-handpainted-v3', 'exec-25c989e3-0ba8-434b-810c-d04a4e3deb70.png', 384),
    ('achievement-handpainted-v3', 'exec-6a58f546-fb67-4d41-8936-ab256440cb19.png', 384),
    ('expedition-handpainted-v3', 'exec-7a0a2df0-e5e8-441a-abde-3cab6ad9968c.png', 640),
]
records = []
for name, filename, size in sources:
    source = generated / filename
    original = Image.open(source).convert('RGBA')
    alpha = original.getchannel('A')
    histogram = alpha.histogram()
    if histogram[0] == 0:
        raise RuntimeError(name + ': no fully transparent pixels')
    image = original.copy()
    image.thumbnail((size, size), Image.Resampling.LANCZOS)
    target = output / (name + '.webp')
    image.save(target, 'WEBP', quality=91, method=6)
    records.append({
        'name': name, 'channel': 'built-in image_gen',
        'source': str(source), 'sourceSha256': hashlib.sha256(source.read_bytes()).hexdigest(),
        'sourceSize': original.size, 'transparentFraction': histogram[0] / (original.width * original.height),
        'runtime': target.relative_to(root).as_posix(), 'runtimeSize': image.size,
        'runtimeBytes': target.stat().st_size,
        'runtimeSha256': hashlib.sha256(target.read_bytes()).hexdigest(),
        'processing': 'resize and WebP encoding only; generated alpha preserved',
    })
(Path(__file__).parent / 'assets-v3.json').write_text(json.dumps(records, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps(records, ensure_ascii=False, indent=2))
