import hashlib
import json
import shutil
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[3]
HERE = Path(__file__).resolve().parent
SOURCE = Path('C:/Users/太平/.codex/generated_images/01a14ee5-8fba-78f0-8634-b4baedf558db')
OUT = ROOT / 'game/art-source/pets/redesign-20261018'
MAPPING = {
 'dog-redraw-v1.png': 'exec-fb8b295f-256d-4c56-a7fa-aac1df86916e.png',
 'dog-redraw-v2.png': 'exec-24f0a339-568e-498a-87ad-d3ac7223865a.png',
 'falcon-redraw-v1.png': 'exec-ddcdba41-382d-406a-bf96-4e32776b7c5c.png',
 'cat-redraw-v1.png': 'exec-cf4b7957-c53c-41bc-985c-032803a2fad6.png',
 'robot-redraw-v1.png': 'exec-fc742d90-924f-4598-96f4-0c3809cd911d.png',
 'fire-redraw-v1.png': 'exec-e60bf7e2-98e3-4b8f-bd7d-17deb61deff1.png',
 'penguin-redraw-v1.png': 'exec-97239ca9-7e1d-4de1-9f65-e1b7091671f5.png',
}
extra = HERE / 'revision-sources.json'
if extra.exists():
    MAPPING.update(json.loads(extra.read_text(encoding='utf-8')))
records = []
for name, source in MAPPING.items():
    origin = SOURCE / source
    target = OUT / name
    if target.exists():
        assert target.read_bytes() == origin.read_bytes(), name
    else:
        shutil.copy2(origin, target)
    with Image.open(target) as im:
        assert im.mode == 'RGBA', (name, im.mode)
        alpha = im.getchannel('A')
        assert alpha.getextrema() == (0, 255), name
        record = dict(path=str(target.relative_to(ROOT)), source=str(origin), size=im.size,
                      mode=im.mode, alpha_range=alpha.getextrema(), subject_bounds=alpha.getbbox(),
                      bytes=target.stat().st_size, sha256=hashlib.sha256(target.read_bytes()).hexdigest())
        records.append(record)
(HERE / 'receipts.json').write_text(json.dumps(records, ensure_ascii=False, indent=2), encoding='utf-8')
print('Verified and preserved %d transparent candidate images.' % len(records))
