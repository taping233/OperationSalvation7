import json, hashlib
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[3]
HERE = Path(__file__).parent
manifest_path = ROOT / 'game/assets/asset-manifest.json'
before = manifest_path.read_bytes()
manifest = json.loads(before)
records = json.loads((HERE / 'local-repaint-requests.json').read_text(encoding='utf-8'))
receipt = []
for record in records:
    source = Path(record['source'])
    target = ROOT / 'game/assets' / record['asset']
    if target.exists():
        raise SystemExit(f'Refusing to overwrite existing asset: {target}')
    with Image.open(source) as image:
        image = image.convert('RGBA')
        image.thumbnail((512,512),Image.Resampling.LANCZOS)
        size = list(image.size)
        alpha = image.getchannel('A').getextrema()
        image.save(target,'WEBP',quality=94,method=6)
    data = target.read_bytes()
    entry = dict(path=record['asset'],ext='webp',bytes=len(data),sha256=hashlib.sha256(data).hexdigest(),license='项目自有（NAI5 起稿＋内置透明重绘）',source='docs/evidence/2026-10-26-layer-cinematics/local-receipt.json')
    if any(item['path']==entry['path'] for item in manifest['assets']):
        raise SystemExit('Asset already registered')
    manifest['assets'].append(entry)
    receipt.append(dict(**entry,original=str(source),original_sha256=hashlib.sha256(source.read_bytes()).hexdigest(),size=size,alpha=alpha,method='NAI5 draft then built-in transparent local-effect repaint, RGBA WebP encoding'))
if manifest_path.read_bytes()!=before:
    raise SystemExit('Manifest changed during import')
manifest['count']=len(manifest['assets'])
manifest_path.write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
(HERE/'local-receipt.json').write_text(json.dumps(receipt,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps(dict(imported=len(receipt),sizes=[item['size'] for item in receipt],alpha=[item['alpha'] for item in receipt])))
