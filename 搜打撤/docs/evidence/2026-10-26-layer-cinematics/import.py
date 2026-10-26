import json, hashlib
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[3]
HERE = Path(__file__).parent
manifest_path = ROOT / 'game/assets/asset-manifest.json'
before = manifest_path.read_bytes()
manifest = json.loads(before)
records = json.loads((HERE / 'repaint-requests.json').read_text(encoding='utf-8'))
receipt = []
for record in records:
    source = Path(record['source'])
    relative = f"scenes/cinematic/layer-{record['key']}-v2.webp"
    target = ROOT / 'game/assets' / relative
    assert not target.exists(), target
    with Image.open(source) as image:
        image.convert('RGB').resize((1344,768),Image.Resampling.LANCZOS).save(target,'WEBP',quality=94,method=6)
    data = target.read_bytes()
    entry = dict(path=relative, ext='webp', bytes=len(data), sha256=hashlib.sha256(data).hexdigest(), license='项目自有（NAI5 起稿＋内置重绘）', source='docs/evidence/2026-10-26-layer-cinematics/receipt.json')
    assert not any(item['path']==relative for item in manifest['assets'])
    manifest['assets'].append(entry)
    receipt.append(dict(**entry,original=str(source),original_sha256=hashlib.sha256(source.read_bytes()).hexdigest(),size=[1344,768],method='NAI5 draft then built-in imagegen repaint; RGB WebP encoding'))
assert manifest_path.read_bytes()==before, 'Manifest changed during import'
manifest['count']=len(manifest['assets'])
manifest_path.write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
(HERE / 'receipt.json').write_text(json.dumps(receipt,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps(dict(imported=len(receipt),count=manifest['count'])))
