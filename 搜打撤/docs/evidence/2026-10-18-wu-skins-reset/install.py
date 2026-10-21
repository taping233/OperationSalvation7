import json, hashlib, shutil, sys
from pathlib import Path
from PIL import Image

evidence=Path(__file__).resolve().parent
project=evidence.parents[2]
workspace=project.parent
local=workspace/'.tmp/nai/wu-skins-reset-1018'
delivery=workspace/'output/imagegen/wu-skins-reset-1018'
delivery.mkdir(parents=True, exist_ok=True)
face_mode=sys.argv[1:]==['--faces']
brush_mode=sys.argv[1:]==['--brush-preserve']
selected_mode=sys.argv[1:]==['--selected-casual'] or brush_mode
assert not sys.argv[1:] or face_mode or selected_mode, 'Unknown arguments'
followup=face_mode or selected_mode
stage_suffix='-brush' if brush_mode else '-selected' if selected_mode else '-face' if face_mode else ''
request=json.loads((evidence/'request.json').read_text(encoding='utf-8'))
if followup:
    previous=json.loads((evidence/('installed-selected-casual.json' if brush_mode else 'installed-faces.json' if selected_mode else 'installed.json')).read_text(encoding='utf-8'))
    request=dict(items=[dict(id=x['id'],asset=x['asset'],beforeSha256=x['entry']['sha256'],before=str((local/(x['id']+'-before'+stage_suffix+'.webp')).relative_to(workspace))) for x in previous['items'] if not selected_mode or x['id']=='casual'])
redraw=json.loads((evidence/('brush-preserve.json' if brush_mode else 'selected-casual.json' if selected_mode else 'faces.json' if face_mode else 'redraw.json')).read_text(encoding='utf-8'))
manifest=project/'game/assets/asset-manifest.json'
manifest_raw=manifest.read_bytes()
text=manifest_raw.decode('utf-8')
newline='\r\n' if '\r\n' in text else '\n'
data=json.loads(text)
receipt=evidence/('installed-brush-preserve.json' if brush_mode else 'installed-selected-casual.json' if selected_mode else 'installed-faces.json' if face_mode else 'installed.json')
assert not receipt.exists(), 'Receipt exists: do not replay installation'

def sha(path): return hashlib.sha256(path.read_bytes()).hexdigest()
def block(entry): return newline.join('    '+line for line in json.dumps(entry, ensure_ascii=False, indent=2).splitlines())
prepared=[]
for item in request['items']:
    source=Path(next(x['source'] for x in redraw['items'] if x['id']==item['id']))
    target=project/'game/assets'/item['asset']
    entry=next(x for x in data['assets'] if x['path']==item['asset'])
    assert sha(target)==item['beforeSha256']==entry['sha256'], 'Target changed since backup'
    if followup:
        backup=workspace/item['before']
        assert not backup.exists()
        shutil.copy2(target,backup)
    saved=delivery/(item['id']+('-brush-preserved.png' if brush_mode else '-selected-clean.png' if selected_mode else '-face-refined.png' if face_mode else '-arknights.png'))
    staged=local/(item['id']+stage_suffix+'-ready.webp')
    assert not saved.exists() and not staged.exists()
    with Image.open(source) as image:
        image.load()
        assert abs(image.width/image.height-(13/10 if selected_mode else 1152/896))<.005, 'Unexpected composition ratio'
        rgb=image.convert('RGB')
        dimensions=list(rgb.size)
        rgb.save(staged, 'WEBP', quality=92, method=6)
    with Image.open(staged) as decoded:
        decoded.load()
        assert list(decoded.size)==dimensions
    shutil.copy2(source,saved)
    before=dict(entry)
    after=dict(entry,bytes=staged.stat().st_size,sha256=sha(staged),source='docs/evidence/2026-10-18-wu-skins-reset/'+receipt.name)
    assert text.count(block(before))==1, 'Manifest block is not unique'
    text=text.replace(block(before),block(after),1)
    prepared.append(dict(id=item['id'],asset=item['asset'],beforeSha256=item['beforeSha256'],backup=item['before'],source=str(saved.relative_to(workspace)),sourceSha256=sha(saved),dimensions=dimensions,entry=after,status='prepared'))
assert len(json.loads(text)['assets'])==len(data['assets'])
assert manifest.read_bytes()==manifest_raw, 'Concurrent manifest write'
for item in prepared:
    assert sha(project/'game/assets'/item['asset'])==item['beforeSha256']
record=dict(status='installing',encoding='Pillow RGB WebP quality=92 method=6; no crop/resize',items=prepared)
def save(): receipt.write_text(json.dumps(record,ensure_ascii=False,indent=2),encoding='utf-8')
save()
for item in prepared:
    target=project/'game/assets'/item['asset']
    target.write_bytes((local/(item['id']+stage_suffix+'-ready.webp')).read_bytes())
    assert sha(target)==item['entry']['sha256']
    item['status']='installed'
    save()
assert manifest.read_bytes()==manifest_raw, 'Concurrent manifest write; assets installed, inspect receipt before continuing'
manifest.write_bytes(text.encode('utf-8'))
record.update(status='installed',manifestSha256=sha(manifest),countChanged=False)
save()
print(json.dumps(record,ensure_ascii=False))
