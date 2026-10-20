import hashlib
import json
import shutil
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[3]
LOCAL = ROOT.parent / '.tmp/nai/roster-nai5-redo-20261020'
SOURCE = Path('C:/Users/太平/.codex/generated_images/01a1553f-21df-7721-8862-2ed861f9ecd0/exec-24761296-96c0-4082-bf3e-259677539a61.png')
FULL = ROOT / 'game/assets/portraits/full/baita.webp'
REF = ROOT / 'docs/character-bible/ref-images/baita.webp'
RECEIPT = Path(__file__).with_name('baita-install-receipt.json')
assert not RECEIPT.exists()
sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
BACKUP = LOCAL / 'before-install'
BACKUP.mkdir(exist_ok=False)
before = []
for path, name in [(FULL, 'baita-runtime.webp'), (REF, 'baita-reference.webp')]:
    backup = BACKUP / name
    shutil.copyfile(path, backup)
    before.append(dict(path=str(path.relative_to(ROOT)), sha256=sha(path), backup=str(backup.relative_to(ROOT.parent))))
local_source = LOCAL / 'baita-books-skirt-final.png'
assert not local_source.exists()
shutil.copyfile(SOURCE, local_source)
with Image.open(SOURCE) as im:
    size = im.size
    im.convert('RGB').save(FULL, 'WEBP', quality=95, method=6)
shutil.copyfile(FULL, REF)
assert sha(FULL) == sha(REF)
record = dict(status='installed_pending_visual_check', authorization='User approved this final beret/book/skirt portrait for installation and explicitly prioritized this chat over the other Baita replacement.',
              source=dict(path=str(local_source.relative_to(ROOT.parent)), sha256=sha(local_source), acquisition=str(SOURCE), size=list(size)),
              output=dict(path='portraits/full/baita.webp', size=list(size), sha256=sha(FULL), bytes=FULL.stat().st_size, encoding='Pillow WebP quality95 method6; preserve source size and composition'),
              reference=dict(path=str(REF.relative_to(ROOT)), sha256=sha(REF)), before=before,
              content='Approved green beret, single-eye fringe as shown (viewer-right covered), rich skirt folds retained; blouse folds lightly cleaned; original-inspired lap grimoire and two floating books.',
              scope='Default full portrait and documentation reference only; battle sprites and avatars unchanged.')
RECEIPT.write_text(json.dumps(record, ensure_ascii=False, indent=2), encoding='utf-8')
manifest = ROOT / 'game/assets/asset-manifest.json'
text = manifest.read_text(encoding='utf-8')
data = json.loads(text)
old = next(x for x in data['assets'] if x['path'] == record['output']['path'])
new = {**old, 'bytes': FULL.stat().st_size, 'sha256': sha(FULL), 'source': 'docs/evidence/2026-10-20-roster-nai5-redo/baita-install-receipt.json'}
old_text = '\n'.join('    '+s for s in json.dumps(old, ensure_ascii=False, indent=2).splitlines())
new_text = '\n'.join('    '+s for s in json.dumps(new, ensure_ascii=False, indent=2).splitlines())
assert text.count(old_text) == 1
text = text.replace(old_text, new_text, 1)
json.loads(text)
manifest.write_text(text, encoding='utf-8')
print(json.dumps(record['output'], ensure_ascii=False))
