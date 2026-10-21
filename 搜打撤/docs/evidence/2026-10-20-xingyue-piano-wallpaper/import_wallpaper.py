import hashlib
import json
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[3]
source = Path(r'C:/Users/太平/.codex/generated_images/01a15531-5eb2-78d1-8c55-f9682db767a0/exec-b559bd76-32b1-4bbd-84a3-e0573e473fdd.png')
relative = 'reconstruction/wallpaper-xingyue-piano-1020.webp'
target = ROOT / 'game/assets' / relative
manifest_path = ROOT / 'game/assets/asset-manifest.json'
before = manifest_path.read_bytes()
manifest = json.loads(before)
assert not target.exists()
assert not any(entry['path'] == relative for entry in manifest['assets'])
with Image.open(source) as image:
    size = image.size
    image.convert('RGB').save(target, 'WEBP', quality=95, method=6)
data = target.read_bytes()
assert len(data) < 1024 * 1024
with Image.open(target) as image:
    assert image.size == size
    image.verify()
receipt = dict(status='installed', source=str(source),
    source_sha256=hashlib.sha256(source.read_bytes()).hexdigest(),
    source_method='Built-in image_gen outpaint of approved original block-painted version; full canvas preserved',
    asset='game/assets/' + relative, sha256=hashlib.sha256(data).hexdigest(),
    bytes=len(data), size=size, encoding=dict(format='WebP', quality=95, method=6),
    wallpaper_id='xingyue-piano', order=3, default_wallpaper='snow-road',
    verification={}, committed=False)
receipt_path = Path(__file__).with_name('receipt.json')
receipt_path.write_text(json.dumps(receipt, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
manifest['assets'].append(dict(path=relative, ext='webp', bytes=len(data),
    sha256=receipt['sha256'], license='项目AI生成素材（老板指定星月钢琴扩图版添加为首页第三张壁纸）',
    source='docs/evidence/2026-10-20-xingyue-piano-wallpaper/receipt.json'))
manifest['count'] = len(manifest['assets'])
assert manifest_path.read_bytes() == before, 'Manifest changed concurrently'
manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(json.dumps(receipt, ensure_ascii=False))
