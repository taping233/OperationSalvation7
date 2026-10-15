import hashlib
import json
import shutil
from pathlib import Path
ROOT=Path(__file__).resolve().parents[3]
source=ROOT/'game/art-source/chests/safe-simple-v7/preview'
target=ROOT/'game/assets/scenes/chests/safe-simple-v7'
assert not target.exists(),'Do not overwrite another install.'
target.mkdir()
records=[]
for name in ['frame-00.webp','frame-01.webp','frame-02.webp','frame-03.webp','burst.webp']:
    destination=target/name
    shutil.copy2(source/name,destination)
    records.append(dict(path=str(destination.relative_to(ROOT/'game/assets')).replace('\\','/'),ext='webp',
                        license='项目原创（老板授权 NAI 草稿＋内置 imagegen 透明素材）',
                        bytes=destination.stat().st_size,sha256=hashlib.sha256(destination.read_bytes()).hexdigest(),
                        source='docs/evidence/2026-10-15-chest-repaint/simple-preview-receipt.json'))
(Path(__file__).parent/'install-receipt.json').write_text(json.dumps(dict(status='installed',owner_approval='2026-10-15 老板：实装吧',assets=records),ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({'copied':len(records)}))
