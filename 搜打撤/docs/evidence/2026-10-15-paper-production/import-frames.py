"""Encode approved paper frames once; switch shared mapping and register new assets."""
import hashlib
import json
import re
import shutil
from pathlib import Path
from PIL import Image

root = Path.cwd()
here = root / 'docs/evidence/2026-10-15-paper-production'
source_dir = root / 'game/art-source/card-paper-rarity-20261015'
request_path = root / json.loads((source_dir / 'current.json').read_text(encoding='utf-8'))['request']
request = json.loads(request_path.read_text(encoding='utf-8'))
geometry = json.loads((source_dir / 'geometry.json').read_text(encoding='utf-8'))
by_key = {item['key']: item for item in geometry}
mapping_path = root / 'game/data/card-frame-layout.json'
manifest_path = root / 'game/assets/asset-manifest.json'
mapping_before, manifest_before = mapping_path.read_bytes(), manifest_path.read_bytes()
old = json.loads(mapping_before)
manifest = json.loads(manifest_before)
keys = dict(initial='initial', common='common', rare='rare', epic='epic', legendary='legendary', prism='prism', token='token', wu='career-wu', xingyue='career-xingyue', changwuyu='career-changwuyu', baita='career-baita', heixiang='career-heixiang', neutral='initial')
assert set(keys) == set(old), 'Shared frame keys changed'
destination = root / 'game/assets/ui/card-frames/paper-1015'
backup = root / '.tmp/imagegen/2026-10-15-paper-production'
if destination.exists() or backup.exists():
    raise FileExistsError('Import already started; use existing receipt/backup instead of replay')
sources = {key: root / by_key[source_key]['path'] for key,source_key in keys.items()}
for source in sources.values():
    if not source.is_file(): raise FileNotFoundError(source)
interior_source = source_dir / 'interior.png'
if not interior_source.is_file(): raise FileNotFoundError(interior_source)
destination.mkdir(parents=True)
backup.mkdir(parents=True)
shutil.copy2(mapping_path, backup / 'card-frame-layout-before.json')
shutil.copy2(manifest_path, backup / 'asset-manifest-before.json')
shutil.copy2(root / 'game/css/card-layout-selected.css', backup / 'card-layout-selected-before.css')
frames, entries, provenance = {}, [], []
digest = lambda path: hashlib.sha256(path.read_bytes()).hexdigest()
for key, source in sources.items():
    spec = by_key[keys[key]]
    image = Image.open(source).convert('RGBA')
    if image.size != (1024,1536) or image.getpixel((512,768))[3] != 0:
        raise ValueError(key + ': invalid transparent frame geometry')
    output = destination / (key+'.webp')
    image.resize((512,768),Image.Resampling.LANCZOS).save(output,'WEBP',lossless=True,method=6,exact=True)
    left,top,right,bottom = spec['opening']
    relative = output.relative_to(root / 'game/assets').as_posix()
    frames[key] = dict(path=relative,width=512,height=768,opening=[left/2,top/2,(right-left)/2,(bottom-top)/2])
    entries.append(dict(path=relative,ext='webp',license='老板授权原创纸边卡框；Codex内置image_gen重绘',bytes=output.stat().st_size,sha256=digest(output),source='docs/evidence/2026-10-15-paper-production/receipt.json'))
    provenance.append(dict(key=key,raw=source.relative_to(root).as_posix(),rawSha256=digest(source)))
output=destination/'interior.webp'
Image.open(interior_source).convert('RGBA').resize((256,384),Image.Resampling.LANCZOS).save(output,'WEBP',lossless=True,method=6,exact=True)
entries.append(dict(path=output.relative_to(root/'game/assets').as_posix(),ext='webp',license='老板授权原创手绘纸面；Codex内置image_gen生成',bytes=output.stat().st_size,sha256=digest(output),source='docs/evidence/2026-10-15-paper-production/receipt.json'))
assert all(entry['bytes'] <= 1_000_000 for entry in entries), 'Runtime binary exceeds project limit'
assert not {entry['path'] for entry in entries}.intersection(entry['path'] for entry in manifest['assets']), 'Assets already registered'
if mapping_path.read_bytes()!=mapping_before or manifest_path.read_bytes()!=manifest_before:
    raise RuntimeError('Shared mapping or manifest changed during encoding')
text=manifest_before.decode('utf-8').replace('\r\n','\n')
match=re.search(r'"count":\s*\d+',text)
assert match and manifest['count']==len(manifest['assets']), 'Manifest count baseline mismatch'
text=text[:match.start()]+f'"count": {len(manifest["assets"])+len(entries)}'+text[match.end():]
end=text.rfind('\n  ]')
assert end>=0, 'Manifest tail changed'
blocks=['\n'.join('    '+line for line in json.dumps(entry,ensure_ascii=False,indent=2).splitlines()) for entry in entries]
text=text[:end]+',\n'+',\n'.join(blocks)+text[end:]
json.loads(text)
with manifest_path.open('w',encoding='utf-8',newline='') as stream:
    stream.write(text)
mapping_path.write_text(json.dumps(frames,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
receipt=dict(request=request_path.relative_to(root).as_posix(),frames=frames,assets=entries,provenance=provenance,backup=backup.relative_to(root).as_posix(),neutral='无人物职业卡复用素纸初始框，保留职业语义')
(here/'receipt.json').write_text(json.dumps(receipt,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps(dict(frames=len(frames),assets=len(entries),bytes=sum(e['bytes'] for e in entries)),ensure_ascii=False))
