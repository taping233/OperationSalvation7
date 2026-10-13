"""第3张内置失败时保留旧画，仅恢复其原始alpha，避免留下黑底。"""
import hashlib
import importlib.util
import json
import shutil
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[3]
EVIDENCE = Path(__file__).resolve().parent
source = ROOT / '.tmp/imagegen/hands/cards-creature-tt8-nofocus-source.png'
full = ROOT / 'game/assets/cards/creature-tt8-nofocus.webp'
thumb = ROOT / 'game/assets/thumbs/cards/creature-tt8-nofocus.webp'
expected = ['7d99590414095633b4e885a8c976f77af286856e6cb1e92db4c551c81683d284',
            '4010f492cfe71f31ae8496759f0e17dfc0731419e66fa369d509d929e41c24b7']
def digest(p):
    return hashlib.sha256(p.read_bytes()).hexdigest()
for p, sha in zip((full, thumb), expected):
    p.resolve().relative_to((ROOT / 'game/assets').resolve())
    if digest(p) != sha:
        raise SystemExit('旧第3张现场变化，停止。')
with Image.open(source) as raw:
    if 'A' not in raw.getbands() or raw.getchannel('A').getextrema()[0] != 0:
        raise SystemExit('旧画来源没有alpha，停止。')
    image = raw.convert('RGBA')
backup_dir = ROOT / '.tmp/imagegen/2026-10-10-eldritch-hands/old3-alpha'
backup_dir.resolve().relative_to(ROOT.resolve())
if backup_dir.exists():
    raise SystemExit('已保留本次旧画备份，禁止重复操作。')
backup_dir.mkdir(parents=True)
before = []
for p in (full, thumb):
    target = backup_dir / ('thumb-before.webp' if p == thumb else 'full-before.webp')
    shutil.copy2(p, target)
    before.append({'path': p.relative_to(ROOT / 'game/assets').as_posix(),
                   'bytes': p.stat().st_size, 'sha256': digest(p),
                   'backup': target.relative_to(ROOT).as_posix()})
image.save(full, 'WEBP', quality=90, method=6)
small = image.copy()
small.thumbnail((448, 448), Image.Resampling.LANCZOS)
alpha = small.getchannel('A')
spec = importlib.util.spec_from_file_location('card_bake', 'C:/Users/太平/.codex/skills/game-card-art-fast/scripts/import_cards.py')
helper = importlib.util.module_from_spec(spec)
spec.loader.exec_module(helper)
rgb = small.convert('RGB')
pixels = rgb.load()
for y in range(rgb.height):
    for x in range(rgb.width):
        old = pixels[x, y]
        pixels[x, y] = tuple(max(0, min(255, round(
            sum(row[i] * old[i] for i in range(3)) - .02575 * 255))) for row in helper.MATRIX)
small = rgb.convert('RGBA')
small.putalpha(alpha)
small.save(thumb, 'WEBP', quality=82, method=6)
after = []
for p in (full, thumb):
    with Image.open(p) as decoded:
        limits = decoded.getchannel('A').getextrema()
    after.append({'path': p.relative_to(ROOT / 'game/assets').as_posix(),
                  'bytes': p.stat().st_size, 'sha256': digest(p), 'alpha_range': list(limits)})
receipt = {'card_id': 'tt8-nofocus', 'new_art_completed': False,
           'method': 'Preserve old artwork and restore original alpha only',
           'source': source.relative_to(ROOT).as_posix(), 'source_sha256': digest(source),
           'before': before, 'after': after}
(EVIDENCE / 'old3-alpha-receipt.json').write_text(
    json.dumps(receipt, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(json.dumps(after, ensure_ascii=False, indent=2))
