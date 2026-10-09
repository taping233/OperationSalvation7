"""Continuity diagnostics + read-only audits of actual public/bundled projects."""
import pathlib,json,zlib,xml.etree.ElementTree as ET,hashlib,urllib.request,urllib.parse,re,sys,importlib.util,html
import numpy as np,soundfile as sf
OUT=pathlib.Path(__file__).resolve().parent;ROOT=OUT.parents[2]
sys.stdout.reconfigure(encoding='utf-8')
def save(n,d):(OUT/n).write_text(json.dumps(d,ensure_ascii=False,indent=2),encoding='utf-8')
def project_audit(path,label):
    b=path.read_bytes();x=zlib.decompress(b[4:]) if path.suffix=='.mmpz' else b;r=ET.fromstring(x);rows=[]
    for t in r.findall('.//track'):
        ps=t.findall('pattern');ap=t.findall('automationpattern');ns=[n for p in ps for n in p.findall('note')]
        if not ps and not ap:continue
        rows.append({'name':t.get('name'),'patterns':len(ps),'notes':len(ns),
            'start_bars':[int(p.get('pos','0'))/192 for p in ps][:80],
            'note_length_ticks_range':[min(int(n.get('len','0')) for n in ns),max(int(n.get('len','0')) for n in ns)] if ns else None,
            'automation_patterns':len(ap),'automation_points':sum(len(p.findall('time')) for p in ap)})
    notes=r.find('song/projectnotes');head=r.find('head')
    return {'label':label,'path':path.relative_to(ROOT).as_posix(),'sha256':hashlib.sha256(b).hexdigest(),
            'bpm':head.get('bpm') if head is not None else None,'project_notes':''.join(notes.itertext())[:1800] if notes is not None else '', 'tracks':rows}

def projects():
    rows=[];base=ROOT/'.tmp/music-workstation/LMMS/data/projects/demos'
    for name in ['Ashore.mmpz','Impulslogik-Zen.mmpz','Skiessi/Skiessi-TurningPoint.mmpz']:
        rows.append(project_audit(base/name,'LMMS bundled '+name))
    try:
        url='https://lmms.io/lsp/?action=show&file=9365'
        request=urllib.request.Request(url,headers={'User-Agent':'Mozilla/5.0'})
        body=urllib.request.urlopen(request,timeout=25).read().decode()
        links=re.findall('href=["\x27]([^"\x27]+)',body)
        choices=[s for s in links if 'download' in s and ('file=9365' in s or 'file=' in s)]
        print('public project download links: '+str(choices),flush=True)
        save('public-project-page.json',{'page':url,'download_links':choices,'html_sha256':hashlib.sha256(body.encode()).hexdigest()})
        if choices:
            download=urllib.parse.urljoin(url,html.unescape(choices[0]))
            req=urllib.request.Request(download,headers={'User-Agent':'Mozilla/5.0','Referer':url})
            data=urllib.request.urlopen(req,timeout=25).read()
            dest=OUT/'reference-SpringWind.mmpz';dest.write_bytes(data)
            row=project_audit(dest,'Spring Wind / VortexSupernova on LMMS Sharing Platform');row.update({'page':url,'download':download});rows.append(row)
    except Exception as e:save('public-project-error.json',{'error':type(e).__name__+': '+str(e)})
    save('project-audit.json',rows)
    print('projects: '+str([(r['label'],len(r['tracks'])) for r in rows]),flush=True)

def audio():
    specs=[('title','2026-10-05-WF-music-title-v8','01-title-frostglass-v8',84,[8,16,24]),
           ('explore','2026-10-05-WF-music-explore-battle-v4','02-explore-ashline-v4',116,[8,20,28,40]),
           ('battle','2026-10-05-WF-music-explore-battle-v4','03-battle-blackpulse-v4',132,[6,18,26,30,42])]
    rows=[]
    for role,folder,stem,bpm,bars in specs:
        p=OUT.parent/folder/(stem+'.wav');x,sr=sf.read(p,dtype='float32',always_2d=True)
        step=sr//4;db=np.array([20*np.log10(np.sqrt(np.mean(x[i:i+step].astype(float)**2))+1e-12) for i in range(0,len(x)-step+1,step)])
        boundaries=[]
        for bar in bars:
            t=bar*4*60/bpm;a=round(t*4);before=np.median(db[max(0,a-8):a]);after=np.median(db[a:a+8])
            boundaries.append({'bar':bar,'seconds':t,'before_2s_median_dbfs':float(before),'after_2s_median_dbfs':float(after),'change_db':float(after-before)})
        rows.append({'role':role,'path':p.relative_to(ROOT).as_posix(),'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'boundaries':boundaries,
            'rms_250ms_p90_p10_db':float(np.percentile(db,90)-np.percentile(db,10)),'adjacent_250ms_db_change_p95':float(np.percentile(np.abs(np.diff(db)),95)),
            'rms_250ms_dbfs':db.tolist()})
    save('audio-diagnosis.json',rows);print(json.dumps([{k:v for k,v in r.items() if k!='rms_250ms_dbfs'} for r in rows],ensure_ascii=False),flush=True)
    specs=[('explore','Piano traveller'),('battle','Violin challenge')];notes=[]
    for role,label in specs:
        d=json.loads((OUT.parent/'2026-10-05-WF-music-explore-battle-v4'/(role+'-score.json')).read_text(encoding='utf-8'));tr=d['tracks'][label]['notes']
        leaps=[abs(a['midi']-b['midi']) for a,b in zip(tr,tr[1:])];onsets=[n['beat'] for t in d['tracks'].values() for n in t['notes']]
        lengths=[n['length']*60/d['bpm'] for n in tr]
        notes.append({'role':role,'lead':label,'lead_notes':len(tr),'lead_note_duration_median_seconds':float(np.median(lengths)),
            'lead_note_duration_below_350ms':sum(v<.35 for v in lengths),'successive_leaps_7_or_more':sum(v>=7 for v in leaps),
            'all_note_on_events_per_second':len(onsets)/(192*60/d['bpm']),
            'CC11_implementation':'integer step each beat; no interpolation across section changes',
            'max_note_on_events_in_1beat':max(sum(b<=n<b+1 for n in onsets) for b in range(192))})
    save('score-diagnosis.json',notes);print(json.dumps(notes,ensure_ascii=False),flush=True)

if __name__=='__main__':projects();audio()
