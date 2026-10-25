import hashlib
import json
import shutil
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[3]
EVIDENCE = Path(__file__).resolve().parent
REQUEST = json.loads((EVIDENCE / 'request.json').read_text(encoding='utf-8'))
if REQUEST['portrait'].get('selection') != 'User selected preceding version':
    portrait = REQUEST['portrait']
    portrait['discarded_clothing_correction'] = {k: portrait[k] for k in ('source', 'prompt', 'references')}
    portrait['source'] = 'C:/Users/太平/.codex/generated_images/01a16e6f-fb4d-7340-ad3d-6655366550f7/exec-39c7a839-f9a3-4388-bde7-c5a6d1335690.png'
    portrait['prompt'] = portrait['initial_redraw']['prompt']
    portrait['references'] = portrait['initial_redraw']['references']
    portrait['selection'] = 'User selected preceding version'
    (EVIDENCE / 'request.json').write_text(json.dumps(REQUEST, ensure_ascii=False, indent=2), encoding='utf-8')
RECEIPT = EVIDENCE / 'portrait-receipt.json'
assert not RECEIPT.exists(), 'Portrait receipt already exists'
target = ROOT / 'game/assets/portraits/full/xingyue.webp'
ref = ROOT / 'docs/character-bible/ref-images/xingyue.webp'
source = Path(REQUEST['portrait']['source'])
local = ROOT / '.tmp/imagegen/2026-10-24-xingyue-card-roster'
local.mkdir(parents=True, exist_ok=True)
def record(p):
    return {'path': p.relative_to(ROOT).as_posix(), 'bytes': p.stat().st_size,
            'sha256': hashlib.sha256(p.read_bytes()).hexdigest()}
backups = []
for p, name in [(target, 'xingyue-before.webp'), (ref, 'xingyue-ref-before.webp')]:
    backup = local / name
    if not backup.exists():
        shutil.copy2(p, backup)
    backups.append(record(backup))
raw = local / 'xingyue-selected-source.png'
assert not raw.exists(), 'Source exists'
shutil.copy2(source, raw)
with Image.open(source) as im:
    image = im.convert('RGB')
    image.save(target, 'WEBP', quality=90, method=6)
    size = list(image.size)
shutil.copy2(target, ref)
manifest = json.loads((ROOT / 'game/assets/asset-manifest.json').read_text(encoding='utf-8-sig'))
entry = next(e for e in manifest['assets'] if e['path'] == 'portraits/full/xingyue.webp')
after = dict(entry, bytes=target.stat().st_size, sha256=hashlib.sha256(target.read_bytes()).hexdigest(),
             source='docs/evidence/2026-10-24-xingyue-card-roster/portrait-receipt.json')
receipt = {'method':'Built-in ImageGen redraw using existing Xingyue cards; user selected version before clothing/boots correction',
           'source':str(source), 'raw':record(raw), 'backups':backups,
           'outputs':[dict(record(target), size=size), record(ref)],
           'manifest_patch':{'before':entry,'after':after},
           'verification':'Not run: user requested no tests/audits/browser/build'}
RECEIPT.write_text(json.dumps(receipt, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps({'receipt':RECEIPT.relative_to(ROOT).as_posix(), 'size':size,
                  'manifest_patch':receipt['manifest_patch']}, ensure_ascii=False, indent=2))
