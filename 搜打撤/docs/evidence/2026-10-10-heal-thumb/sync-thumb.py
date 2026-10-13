import hashlib
import importlib.util
import json
import shutil
from pathlib import Path
from PIL import Image

EVIDENCE = Path(__file__).resolve().parent
ROOT = EVIDENCE.parents[2]
spec = importlib.util.spec_from_file_location('card_import', 'C:/Users/太平/.codex/skills/game-card-art-fast/scripts/import_cards.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
source = ROOT / 'game/assets/cards/spell-tt3-holy-water.webp'
target = ROOT / 'game/assets/thumbs/cards/spell-tt3-holy-water.webp'
backup = ROOT / '.tmp/imagegen/2026-10-10-heal-thumb/thumb-before.webp'
if backup.exists():
    raise SystemExit('Backup exists; stop')
backup.parent.mkdir(parents=True, exist_ok=True)
shutil.copy2(target, backup)
with Image.open(source) as original:
    small = original.convert('RGB')
small.thumbnail((448, 448), Image.Resampling.LANCZOS)
pixels = small.load()
for y in range(small.height):
    for x in range(small.width):
        rgb = pixels[x, y]
        pixels[x, y] = tuple(max(0, min(255, round(sum(row[i] * rgb[i] for i in range(3)) - .02575 * 255))) for row in module.MATRIX)
small.save(target, 'WEBP', quality=82, method=6)
def record(path):
    return dict(path=path.relative_to(ROOT).as_posix(), bytes=path.stat().st_size, sha256=hashlib.sha256(path.read_bytes()).hexdigest())
receipt = dict(card_id='tt3-holy-water', method='Rebuild thumbnail from current full-size WebP with existing resize/tint recipe',
    source=record(source), backup=record(backup), output={**record(target), 'size': list(small.size)},
    revision='holy-water-thumb-sync-20261010', verification='Viewed current full/old thumb; no tests/browser/build')
(EVIDENCE / 'receipt.json').write_text(json.dumps(receipt, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(json.dumps(receipt, ensure_ascii=False, indent=2))
