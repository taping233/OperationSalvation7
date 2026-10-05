"""Add only owned audio entries; preserve every existing manifest entry bytewise."""
import hashlib,json,pathlib
ROOT=pathlib.Path(__file__).resolve().parents[3]
OUT=pathlib.Path(__file__).parent
path=ROOT/'game/assets/asset-manifest.json'
before=path.read_bytes(); text=before.decode('utf-8'); data=json.loads(text)
reports=json.loads((OUT/'render-report.json').read_text(encoding='utf-8'))
entries=[{'path':'music-demo/'+r['name']+'.ogg','ext':'ogg','bytes':r['ogg_bytes'],'sha256':r['ogg_sha256'],'license':'项目自有（原创程序合成，无外部采样）','source':'docs/evidence/2026-10-05-WF-music-demos/render-report.json'} for r in reports]
if any(e['path'] in {a['path'] for a in data['assets']} for e in entries):
    raise RuntimeError('Owned entry already exists; inspect before changing')
newline='\r\n' if '\r\n' in text else '\n'
chunk=','.join(newline+'    '+json.dumps(e,ensure_ascii=False,indent=2).replace('\n',newline+'    ') for e in entries)+','
marker='"assets": ['
assert text.count(marker)==1
updated=text.replace(marker,marker+chunk,1)
oldcount='"count": '+str(data['count']); newcount='"count": '+str(len(data['assets'])+len(entries))
assert updated.count(oldcount)==1
updated=updated.replace(oldcount,newcount,1)
after=json.loads(updated)
assert after['assets'][len(entries):]==data['assets']
assert {k:v for k,v in after.items() if k not in ['assets','count']}=={k:v for k,v in data.items() if k not in ['assets','count']}
if path.read_bytes()!=before:raise RuntimeError('Concurrent manifest edit: stopped')
path.write_bytes(updated.encode('utf-8'))
report={'before_sha256':hashlib.sha256(before).hexdigest(),'after_sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'existing_entries_preserved':len(data['assets']),'added':entries}
(OUT/'asset-registration.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
print('Registered 3 demo files; all '+str(len(data['assets']))+' existing entries preserved.')
