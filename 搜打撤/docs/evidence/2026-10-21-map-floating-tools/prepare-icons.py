"""Encode the selected generated symbols as lossless RGBA WebP; preserve source originals."""
from pathlib import Path
from PIL import Image
import hashlib
import json

project = Path(__file__).resolve().parents[3]
source_dir = Path(r'C:\Users\太平\.codex\generated_images\01a15d62-0be6-73a0-b479-69a90febabd9')
destination = project / 'game/assets/ui/map-tools-1021'
destination.mkdir(parents=True, exist_ok=True)
selected = {
    'bag': 'exec-300d7d04-b9de-4eec-9b7d-4a2107d939a2.png',
    'safe': 'exec-07144b4a-7805-4509-a700-9dfda7d00bb6.png',
    'pocket': 'exec-a4b4176d-0149-4cbf-b2db-5b79fcd13d5d.png',
    'focus': 'exec-663b1db0-99aa-40a2-8fe6-6895e972d30c.png',
    'overview': 'exec-5b5284ff-6d3b-48f6-b134-bc1423e64a0a.png',
}
receipts = []
for tool, filename in selected.items():
    source = source_dir / filename
    target = destination / f'{tool}-v2.webp'
    if target.exists():
        raise FileExistsError(target)
    with Image.open(source) as original:
        image = original.convert('RGBA')
        image.thumbnail((256, 256), Image.Resampling.LANCZOS)
        image.save(target, 'WEBP', lossless=True, method=6)
    receipts.append({
        'tool': tool, 'source': str(source),
        'sourceSha256': hashlib.sha256(source.read_bytes()).hexdigest(),
        'path': target.relative_to(project).as_posix(),
        'sha256': hashlib.sha256(target.read_bytes()).hexdigest(),
        'bytes': target.stat().st_size,
        'encoding': 'lossless RGBA WebP, 256px; original PNG retained, no recolour, extraction or added lighting',
    })
Path(__file__).with_name('icons.json').write_text(json.dumps(receipts, ensure_ascii=False, indent=2), encoding='utf-8')
print('Five selected map tool symbols encoded; icons.json written.')
