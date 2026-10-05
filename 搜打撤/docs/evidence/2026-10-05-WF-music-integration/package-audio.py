"""Ship fourteen compact Opus-in-Ogg runtime files; retain lossless evidence sources."""
import pathlib,json,subprocess,hashlib,shutil
OUT=pathlib.Path(__file__).resolve().parent;ROOT=OUT.parents[2]
ALBUM=OUT.parent/'2026-10-05-WF-music-anime-v2';CORE=OUT.parent/'2026-10-05-WF-music-piano-two-hands'
TARGET=ROOT/'game/assets/music-demo';TARGET.mkdir(exist_ok=True)
BACKUP=ROOT/'.tmp/music-workstation/integration-before';BACKUP.mkdir(exist_ok=True)
def fp(p):return {'path':p.relative_to(ROOT).as_posix(),'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()}
# Correct old wrapper metadata from the actual independently stored score.
album=json.loads((ALBUM/'render-report.json').read_text(encoding='utf-8'))
for r in album['cues']:
    score=json.loads((ALBUM/(r['id']+'-score.json')).read_text(encoding='utf-8'))
    r.update({'stem':score['stem'],'bpm_quarter':score['bpm'],'idea':score['idea'],'creative_revision':score['creative_revision']})
    (ALBUM/(r['id']+'-report.json')).write_text(json.dumps(r,ensure_ascii=False,indent=2),encoding='utf-8')
(ALBUM/'render-report.json').write_text(json.dumps(album,ensure_ascii=False,indent=2),encoding='utf-8')
core=json.loads((CORE/'render-report.json').read_text(encoding='utf-8'))
items=[]
for r in core['cues']:
    filename={'title':'01-title-frostglass','explore':'02-explore-ashline','battle':'03-battle-blackpulse'}[r['role']]+'.ogg'
    items.append((r['role'],r['title'],ROOT/next(f['path'] for f in r['files'] if f['path'].endswith('.wav')),filename,'approved '+r['stem']))
for r in album['cues']:
    items.append((r['id'],r['title'],ROOT/next(f['path'] for f in r['files'] if f['path'].endswith('.wav')),r['stem'].removesuffix('-v2')+'.ogg' if hasattr(str,'removesuffix') else r['stem'][:-3]+'.ogg','anime v2 '+r['stem']))
rows=[];backups=[]
for id,title,source,name,version in items:
    dst=TARGET/name
    if dst.exists():
        old=BACKUP/name
        if not old.exists():shutil.copy2(dst,old)
        backups.append(fp(old))
    subprocess.run(['ffmpeg','-v','error','-y','-i',str(source),'-c:a','libopus','-b:a','64k','-vbr','on','-application','audio','-metadata','title='+title,str(dst)],check=True)
    assert dst.stat().st_size<1000000,name+' exceeds runtime size limit'
    probe=json.loads(subprocess.check_output(['ffprobe','-v','error','-show_streams','-of','json',str(dst)]))['streams'][0]
    assert probe['codec_name']=='opus' and probe['channels']==2 and probe['sample_rate']=='48000'
    rows.append({'id':id,'title':title,'version':version,'source':fp(source),'runtime':fp(dst),'codec':'opus','container':'ogg'})
manifest=ROOT/'game/assets/asset-manifest.json';raw=manifest.read_bytes();d=json.loads(raw.decode('utf-8'));byname={a['path']:a for a in d['assets']}
for r in rows:
    file='music-demo/'+pathlib.Path(r['runtime']['path']).name
    entry={'path':file,'ext':'ogg','bytes':r['runtime']['bytes'],'sha256':r['runtime']['sha256'],
           'license':'项目原创曲目；GeneralUser GS 2.0.3 BETA 采样许可v2.0（允许音乐创作）',
           'source':'docs/evidence/2026-10-05-WF-music-integration/audio-package.json'}
    if file in byname:byname[file].update(entry)
    else:d['assets'].append(entry)
d['count']=len(d['assets']);assert manifest.read_bytes()==raw
manifest.write_text(json.dumps(d,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
(OUT/'audio-package.json').write_text(json.dumps({'status':'passed','exitCode':0,'tracks':rows,'old_runtime_backups':backups,
    'method':'Existing ffmpeg libopus 64k stereo; lossless WAV sources retained and unchanged. Runtime Opus decoded through Howler format opus.'},ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({'tracks':len(rows),'runtime_total_bytes':sum(r['runtime']['bytes'] for r in rows),'max_bytes':max(r['runtime']['bytes'] for r in rows)}))
