"""Encode approved transparent outputs and register only the two effect assets."""
from pathlib import Path
from PIL import Image
import hashlib, json, shutil, sys

root = Path(__file__).resolve().parents[3]
evidence = Path(__file__).parent
backup = root / '.tmp/nai/battle-fx-20261026/backup'
backup.mkdir(parents=True, exist_ok=True)
manifest_path = root / 'game/assets/asset-manifest.json'
manifest = json.loads(manifest_path.read_text(encoding='utf-8'))
rows = []
if len(sys.argv) != 3:
    raise SystemExit('Exactly two source paths required')
for name, source in zip(('slash', 'block'), sys.argv[1:]):
    target = root / f'game/assets/battle/fx-{name}.webp'
    old = backup / target.name
    if old.exists():
        raise SystemExit('Backup already exists; inspect receipt before replaying')
    im = Image.open(source).convert('RGBA')
    alpha = im.getchannel('A')
    if alpha.getextrema()[0] != 0 or alpha.getextrema()[1] == 0:
        raise SystemExit('Output lacks transparent empty pixels or visible effect')
    shutil.copy2(target, old)
    im.thumbnail((768, 768), Image.Resampling.LANCZOS)
    im.save(target, 'WEBP', quality=94, method=6)
    raw = target.read_bytes()
    relative = target.relative_to(root / 'game/assets').as_posix()
    row = dict(path=relative, ext='webp', bytes=len(raw), sha256=hashlib.sha256(raw).hexdigest(),
               license='项目自有（NAI5起稿＋内置重绘）', source='docs/evidence/2026-10-26-battle-fit-fx/receipt.json')
    found = next((item for item in manifest['assets'] if item['path'] == relative), None)
    if found is None:
        manifest['assets'].append(row)
    else:
        found.update(row)
    rows.append(dict(**row, input=source, originalSha256=hashlib.sha256(old.read_bytes()).hexdigest(),
                     outputSize=list(im.size), alphaRange=list(alpha.getextrema())))
manifest['count'] = len(manifest['assets'])
manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
(evidence / 'receipt.json').write_text(json.dumps(rows, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps(rows, ensure_ascii=False, indent=2))
