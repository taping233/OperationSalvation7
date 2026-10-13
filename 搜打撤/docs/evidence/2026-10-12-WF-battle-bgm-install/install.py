"""Copy the approved loop byte-for-byte; patch one manifest entry only."""
import hashlib
import json
import pathlib
import shutil

OUT=pathlib.Path(__file__).resolve().parent
ROOT=OUT.parents[2]
SOURCE=ROOT/'docs/evidence/2026-10-12-WF-battle-full-loop-v2/battle-shadowtide-full-loop-v2.ogg'
TARGET=ROOT/'game/assets/music-demo/03-battle-shadowtide-full-v2.ogg'
MANIFEST=ROOT/'game/assets/asset-manifest.json'
original=MANIFEST.read_bytes()
text=original.decode('utf-8')
document=json.loads(text)
asset_path=TARGET.relative_to(ROOT/'game/assets').as_posix()
if any(row['path']==asset_path for row in document['assets']):
    raise RuntimeError('Target entry already exists; inspect rather than overwrite')
source_hash=hashlib.sha256(SOURCE.read_bytes()).hexdigest()
approved=json.loads((SOURCE.parent/'render-report.json').read_text(encoding='utf-8'))
expected=next(row for row in approved['files'] if row['path']==SOURCE.relative_to(ROOT).as_posix())
if source_hash!=expected['sha256']:
    raise RuntimeError('Approved audio fingerprint mismatch')
if TARGET.exists():
    raise RuntimeError('Runtime target already exists; inspect ownership')
shutil.copyfile(SOURCE,TARGET)
if hashlib.sha256(TARGET.read_bytes()).hexdigest()!=source_hash:
    raise RuntimeError('Runtime audio fingerprint mismatch')
entry={'path':asset_path,'ext':'ogg','bytes':TARGET.stat().st_size,'sha256':source_hash,
    'license':'Project original composition; GeneralUser GS sample license v2.0 permits music creation.',
    'source':'docs/evidence/2026-10-12-WF-battle-bgm-install/audio-package.json'}
newline='\r\n' if '\r\n' in text else '\n'
marker='  "assets": ['+newline
if text.count(marker)!=1:
    raise RuntimeError('Unexpected manifest layout')
encoded=newline.join('    '+line for line in json.dumps(entry,ensure_ascii=False,indent=2).splitlines())+','+newline
patched=text.replace(marker,marker+encoded,1)
count_marker='"count": '+str(document['count'])
header_end=patched.index(marker)
header=patched[:header_end]
if header.count(count_marker)!=1:
    raise RuntimeError('Unexpected count layout')
patched=header.replace(count_marker,'"count": '+str(document['count']+1),1)+patched[header_end:]
after=json.loads(patched)
if after['assets'][1:]!=document['assets']:
    raise RuntimeError('Other manifest entries changed')
if MANIFEST.read_bytes()!=original:
    raise RuntimeError('Manifest changed concurrently; audio copied, registration not written')
MANIFEST.write_bytes(patched.encode('utf-8'))
report={'approved_source':SOURCE.relative_to(ROOT).as_posix(),'runtime':entry,
    'seconds':120,'method':'Byte-for-byte copy of user-approved Ogg Opus loop; no re-encoding',
    'old_files_policy':'Retained inactive; no historical audio deleted',
    'other_manifest_entries_preserved':True,'battle_route':'Ordinary combat and all bosses share MUSIC_TRACKS.battle'}
(OUT/'audio-package.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({'runtime':asset_path,'bytes':entry['bytes'],'sha256':source_hash,'other_entries_preserved':True}))
