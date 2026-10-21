"""Encode the selected built-in ImageGen PNGs as WebP, preserving their alpha."""
from pathlib import Path
from PIL import Image
import hashlib
import json

project = Path(__file__).resolve().parents[3]
generated = Path(r'C:\Users\太平\.codex\generated_images\01a15d62-0be6-73a0-b479-69a90febabd9')
destination = project / 'game/assets/scenes/map-environment-1021'
destination.mkdir(parents=True, exist_ok=True)
selected = {
    'outskirts': 'exec-da409790-5ba1-4c48-8eb0-170b261169b1.png',
    'watchline': 'exec-a1c16058-b55d-4956-99bc-045cbd67df55.png',
    'ruins': 'exec-8d46d131-2e97-4b63-8580-c3b78a30d466.png',
    'core': 'exec-9c012584-8be7-4367-a782-f5692f9ec0a6.png',
}
receipts = []
for region, filename in selected.items():
    source = generated / filename
    target = destination / f'{region}-simple.webp'
    if target.exists():
        raise FileExistsError(target)
    with Image.open(source) as image:
        image.convert('RGBA').save(target, 'WEBP', quality=88, method=6)
    receipts.append({
        'region': region, 'source': str(source),
        'sourceSha256': hashlib.sha256(source.read_bytes()).hexdigest(),
        'path': target.relative_to(project).as_posix(),
        'sha256': hashlib.sha256(target.read_bytes()).hexdigest(),
        'bytes': target.stat().st_size,
        'provenance': 'Built-in ImageGen; source alpha preserved in WebP encoding',
    })
Path(__file__).with_name('assets.json').write_text(json.dumps(receipts, ensure_ascii=False, indent=2), encoding='utf-8')
print('Encoded four selected environment fragments; assets.json written.')
