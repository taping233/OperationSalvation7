"""Eleven independently authored missing scene cues. No runtime/game writes."""
import pathlib,json,copy,sys,importlib.util,subprocess,hashlib,struct
import xml.etree.ElementTree as ET
import numpy as np,soundfile as sf
from catalog import CUES
OUT=pathlib.Path(__file__).resolve().parent;ROOT=OUT.parents[2]
TMP=ROOT/'.tmp/music-workstation/missing-bgm';TMP.mkdir(exist_ok=True)
spec=importlib.util.spec_from_file_location('continuity',OUT.parent/'2026-10-05-WF-music-continuity-review/rewrite.py')
base=importlib.util.module_from_spec(spec);spec.loader.exec_module(base)
sys.stdout.reconfigure(encoding='utf-8')
SR=48000
def save(n,d):(OUT/n).write_text(json.dumps(d,ensure_ascii=False,indent=2),encoding='utf-8')
def fp(p):return {'path':p.relative_to(ROOT).as_posix(),'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()}
def volume_points(cue,mode):
    total=cue['bars']*cue['meter'][0]*4/cue['meter'][1];bpb=cue['meter'][0]*4/cue['meter'][1]
    values={'lead':[.97,1,1.04,.94],'body':[.83,.92,.98,.85],'answer':[.35,.80,.92,.48],'pulse':[.80,.88,.93,.81],'detail':[.68,.72,.84,.58]}[mode]
    points=[(0,values[0])]
    for i,bar in enumerate(cue['sections'][1:],1):
        points.extend([(max(0,(bar-2)*bpb),values[i-1]),(min(total,(bar+2)*bpb),values[i])])
    points.extend([(total-2*bpb,values[-1]),(total,values[0])]);return sorted(points)

def compose(cue):
    bpb=cue['meter'][0]*4/cue['meter'][1];total=cue['bars']*bpb;pair=2*bpb;tracks={}
    def track(name,patch,target,pan,mode='body',bank=0):
        tracks[name]={'program':patch,'bank':bank,'target_active_rms_dbfs':target,'pan':pan,'mode':mode,'gain_points':volume_points(cue,mode),'notes':[]}
    def note(name,beat,key,length,velocity):
        if beat>=total:return
        tracks[name]['notes'].append({'beat':round(beat,5),'midi':int(key),'length':round(min(length,total-beat-.025),5),'velocity':int(velocity)})
    leadpatch,leadname=cue['lead'];track(leadname,leadpatch,-25,7 if leadpatch==0 else -17,'lead')
    if cue['piano']:
        if leadpatch!=0:track('Piano right hand',0,-32,8,'body')
        track('Piano left hand',0,-28.5 if leadpatch==0 else -35,-17,'body')
        tracks['Piano right hand']['hand']='right';tracks['Piano left hand']['hand']='left'
    for voice in cue['voices']:
        name,patch,target,pan=voice[:4];bank=voice[4] if len(voice)>4 else 0
        mode='detail' if patch in [8,11,12,46] else 'pulse' if patch in [6,45,47] or bank==128 else 'answer' if patch in [40,68,70,71,73,56,57,60] else 'body'
        track(name,patch,target,pan,mode,bank)
    track('Steady low foundation',43,-35 if cue['id'] not in ['boss-governor','extraction'] else -33,0,'body')
    for bar in range(0,cue['bars'],2):
        at=bar*bpb;index=(bar//2)%4;c=cue['chords'][index];stage=max(i for i,s in enumerate(cue['sections']) if s<=bar)
        melody=cue['phrases'][index].copy()
        if stage==2 and cue['id'] in ['event','boss-psionic','altar']:melody[-2],melody[-1]=melody[-1],melody[-2]
        if stage==2 and cue['id'] in ['base','fire','success']:melody[1]=cue['phrases'][(index+1)%4][1]
        if stage==3 and bar>=cue['bars']-4:melody[-1]=cue['phrases'][0][0] if cue['id'] in ['base','success'] else cue['phrases'][index][-1]
        for i,(q,key) in enumerate(zip(cue['rhythm'],melody)):
            nextq=cue['rhythm'][i+1] if i<3 else pair
            length=nextq-q-(.04 if leadpatch!=0 else .09)
            note(leadname,at+q,key,length,54+(3 if i==0 else -2 if i==3 else 0))
        bass=c[0]-24
        while bass<28:bass+=12
        note('Steady low foundation',at,bass,pair-.025,44)
        if cue['piano']:
            rhname='Piano right hand';rhnotes=tracks[rhname]['notes']
            if leadpatch!=0:
                note(rhname,at+pair*.25,c[1]+12,pair*.22,37)
                note(rhname,at+pair*.75,c[2]+12,pair*.20,33)
            current=[n['midi'] for n in rhnotes if at<=n['beat']<at+pair];floor=min(current)-2
            root=c[0]-12;third=c[1]-12;fifth=c[2]-12;upperroot=c[0]
            # Keep chord bodies out of the sub-bass while preserving hand separation.
            if third<43:third+=12
            if fifth<43:fifth+=12
            while third>floor:third-=12
            while fifth>floor:fifth-=12
            while upperroot>floor:upperroot-=12
            for q,keys,v in [(0,[root],39),(pair*.25,[third,fifth],33),(pair*.5,[upperroot],35),(pair*.75,[third,fifth],29)]:
                for key in keys:note('Piano left hand',at+q,key,pair*.225,v)
        for name,tr in tracks.items():
            if name in [leadname,'Piano right hand','Piano left hand','Steady low foundation']:continue
            patch,mode,bank=tr['program'],tr['mode'],tr['bank']
            if bank==128:
                for q,key,v in [(0,36,37),(bpb,38,32)]:note(name,at+q,key,.18,v)
                continue
            if patch==47:
                timpkey=c[0]
                while timpkey<38:timpkey+=12
                while timpkey>57:timpkey-=12
                note(name,at,timpkey,.75,41)
                if stage==2:note(name,at+bpb,timpkey,.6,34)
            elif patch in [45,6,24,12]:
                # Different meters have different groupings and rest patterns.
                taps=([0,1.5,3,4.5] if cue['meter']==(6,8) else [0,2,3.5,5.5,8] if cue['meter']==(5,4) else [0,1,2,3.5,4.5,5.5] if cue['meter']==(7,8) else [pair*.12,pair*.42,pair*.72])
                for j,q in enumerate(taps):
                    if q<pair-.1:note(name,at+q,c[1+(j%2)],.48 if patch!=24 else .85,39 if j%2==0 else 31)
            elif patch in [46,8,11]:
                if bar%4==0 or stage==2:
                    note(name,at+pair*.23,c[1]+12,1.1,34);note(name,at+pair*.69,c[2]+12,1.2,30)
            elif patch in [49,44,41,19,58]:
                pitch=c[1] if patch not in [19,58] else c[0]
                if patch==41 and pitch<48:pitch+=12
                if patch==58 and pitch<28:pitch+=12
                note(name,at,pitch,pair-.02,43 if patch!=44 else 35)
                if patch==19:note(name,at+.15,c[2],pair-.18,35)
            elif patch==42:
                pitch=c[0]
                while pitch<36:pitch+=12
                note(name,at+.06,pitch,pair*.65,42);note(name,at+pair*.72,c[1],pair*.24,36)
            else:
                # Replies are sparse, staggered and already present before changes.
                if bar%4==2 or stage==2:
                    key=c[1]+12 if patch in [40,56,60,68,71,73] else c[2]
                    if patch==73 and key<60:key+=12
                    if patch==40 and key<55:key+=12
                    note(name,at+pair*.59,key,pair*.35,43)
    # Tie repeated long common tones and prevent same-key release chokes.
    for name,tr in tracks.items():
        tr['notes'].sort(key=lambda n:n['beat'])
        if tr['program'] in [19,41,44,49,58] and len({n['midi'] for n in tr['notes']})>0 and tr['program']!=19:
            merged=[]
            for n in tr['notes']:
                if merged and n['midi']==merged[-1]['midi'] and merged[-1]['beat']+merged[-1]['length']>=n['beat']-.05:merged[-1]['length']=round(n['beat']+n['length']-merged[-1]['beat'],5)
                else:merged.append(copy.deepcopy(n))
            tr['notes']=merged
        # Pitched chimes can repeat before decay, but their MIDI note lengths do not overlap.
        bykey={}
        for n in tr['notes']:bykey.setdefault(n['midi'],[]).append(n)
        for ns in bykey.values():
            for a,b in zip(ns,ns[1:]):a['length']=min(a['length'],max(.08,b['beat']-a['beat']-.025))
    return {**cue,'beats_per_bar':bpb,'total_beats':total,'tracks':tracks,'sections':[{'start_bar':b,'name':name} for b,name in zip(cue['sections'],['opening','first development','contrast','connected return'])]}

def synth(score,name,tr):
    total=score['total_beats'];bs=60/score['bpm'];frames=round(total*bs*SR);events=[]
    events.append((0,0,'cc',10,int(np.clip(round(64+tr['pan']*.55),0,127))))
    pedal_step=score['beats_per_bar']
    for cycle in [0,1]:
        shift=cycle*total;events.append((round(shift*bs*SR),0,'cc',11,100))
        if tr['program']==0 and tr['bank']==0:
            for bar in range(score['bars']):
                beat=bar*pedal_step;span=pedal_step*.81 if bar%2 else pedal_step*.90
                events.extend([(round((shift+beat+.02)*bs*SR),0,'cc',64,127),(round((shift+beat+span)*bs*SR),0,'cc',64,0)])
        for n in tr['notes']:
            start=(shift+n['beat'])*bs-(.04 if tr['program'] in [40,41,42] else 0)
            stop=(shift+n['beat']+n['length'])*bs
            events.extend([(round(max(0,start)*SR),2,'on',n['midi'],n['velocity']),(round(stop*SR),1,'off',n['midi'],0)])
    raw=base.shared.engine.render(events,2*frames/SR,SR,bank=tr['bank'],patch=tr['program'])[frames:2*frames]
    energies=np.array([base.shared.rms(raw[i:i+12000])**2 for i in range(0,len(raw)-12000+1,12000)])
    mask=energies>max(energies.max()*1e-3,1e-16);assert mask.any(),name
    gain=10**(tr['target_active_rms_dbfs']/20)/np.sqrt(energies[mask].mean())
    beats=np.arange(frames)/SR/bs;curve=base.lerp_cycle(tr['gain_points'],beats,total)*(.97+.03*np.sin(2*np.pi*beats/(8*score['beats_per_bar'])-np.pi/2))
    audio=raw*gain*curve[:,None]
    path=TMP/(score['stem']+'-'+name.replace(' ','-')+'.wav');sf.write(path,audio,SR,subtype='FLOAT')
    return audio,{'name':name,'program':tr['program'],'bank':tr['bank'],'hand':tr.get('hand'),'notes':len(tr['notes']),'pan':tr['pan'],
                 'frozen_stem':fp(path),'target_active_rms_dbfs':tr['target_active_rms_dbfs'],'continuous_gain_points':tr['gain_points'],'cc64_used':tr['program']==0 and tr['bank']==0}

def project(score,rows):
    numerator,denominator=score['meter'];ticks=round(score['total_beats']*48)
    root=ET.Element('lmms-project',creator='LMMS',version='1.0',type='song',creatorversion='1.2.2')
    base.shared.elem(root,'head',bpm=score['bpm'],mastervol=100,masterpitch=0,timesig_numerator=numerator,timesig_denominator=denominator)
    song=base.shared.elem(root,'song');tc=base.shared.elem(song,'trackcontainer',type='song',visible=1)
    for row in rows:
        t=base.shared.elem(tc,'track',type=0,name=row['name'],muted=0,solo=0)
        it=base.shared.elem(t,'instrumenttrack',vol=100,pan=0,pitch=0,basenote=57,usemasterpitch=1,pitchrange=1,fxch=0)
        ins=base.shared.elem(it,'instrument',name='audiofileprocessor');base.shared.elem(ins,'audiofileprocessor',src=(ROOT/row['frozen_stem']['path']).as_posix(),amp=100,interp=1,sframe=0,eframe=1,lframe=0,looped=0,reversed=0,stutter=0)
        base.shared.elem(it,'fxchain',enabled=0,numofeffects=0)
        for cycle in [0,1]:
            p=base.shared.elem(t,'pattern',type=1,pos=cycle*ticks,len=ticks,steps=round(ticks/12),name='Frozen performed stem, editable source in score.json',muted=0)
            base.shared.elem(p,'note',key=57,pos=0,len=ticks,vol=100,pan=0)
    base.shared.elem(song,'timelinestate',lpstate=0,lp0pos=0,lp1pos=ticks*2)
    base.shared.elem(song,'projectnotes').text=score['idea']+' | Frozen pre-master mix; final room, balance and gain are in render.py. Not separately native-rendered.'
    path=OUT/(score['stem']+'.mmp');ET.ElementTree(root).write(path,encoding='utf-8',xml_declaration=True);return path

def vlq(n):
    out=[n&127];n>>=7
    while n:out.insert(0,(n&127)|128);n>>=7
    return bytes(out)

def piano_midi(score):
    numerator,denominator=score['meter'];total=score['total_beats'];tempo=round(60000000/score['bpm'])
    chunks=[b'\x00\xff\x51\x03'+tempo.to_bytes(3,'big')+b'\x00\xff\x58\x04'+bytes([numerator,int(np.log2(denominator)),24,8])+b'\x00\xff\x2f\x00']
    for ch,name in enumerate(['Piano right hand','Piano left hand']):
        tr=score['tracks'][name];events=[(0,0,bytes([0xc0+ch,0])),(0,0,b'\xff\x03'+vlq(len(name))+name.encode('ascii'))]
        for bar in range(score['bars']):
            beat=bar*score['beats_per_bar'];span=score['beats_per_bar']*(.81 if bar%2 else .9)
            events.extend([(round((beat+.02)*480),0,bytes([0xb0+ch,64,127])),(round((beat+span)*480),0,bytes([0xb0+ch,64,0]))])
        for n in tr['notes']:events.extend([(round(n['beat']*480),2,bytes([0x90+ch,n['midi'],n['velocity']])),(round((n['beat']+n['length'])*480),1,bytes([0x80+ch,n['midi'],0]))])
        buf=b'';tick=0
        for t,_,msg in sorted(events):buf+=vlq(t-tick)+msg;tick=t
        buf+=vlq(round(total*480)-tick)+b'\xff\x2f\x00';chunks.append(buf)
    path=OUT/(score['stem']+'-piano.mid');path.write_bytes(b'MThd'+struct.pack('>IHHH',6,1,3,480)+b''.join(b'MTrk'+struct.pack('>I',len(c))+c for c in chunks));return path

def render(cue):
    score=compose(cue);frames=round(score['total_beats']*60/score['bpm']*SR);mix=np.zeros((frames,2),dtype=np.float64);rows=[]
    print('compose '+cue['id']+' / '+cue['title'],flush=True)
    for name,tr in score['tracks'].items():
        audio,row=synth(score,name,tr);mix+=audio;rows.append(row)
    native=project(score,rows);mix=base.shared.room(mix,SR);mix,balance=base.macro_balance(mix,SR)
    raw=TMP/(score['stem']+'-premaster.wav');sf.write(raw,mix,SR,subtype='FLOAT');before=base.shared.loud(raw)
    gain=min(10**((-18.5-float(before['input_i']))/20),.90/np.abs(mix).max());mix*=gain
    mix[-192:]-=(mix[-1]-mix[0])*(.5-.5*np.cos(np.linspace(0,np.pi,192)))[:,None]
    wav=OUT/(score['stem']+'.wav');sf.write(wav,mix,SR,subtype='PCM_24')
    for ext in ['mp3','ogg']:
        opt=['-c:a','libmp3lame','-b:a','256k'] if ext=='mp3' else ['-c:a','libvorbis','-q:a','6']
        subprocess.run(['ffmpeg','-v','error','-y','-i',str(wav)]+opt+['-metadata','title='+score['title'],str(wav.with_suffix('.'+ext))],check=True)
    files=[native,wav,wav.with_suffix('.mp3'),wav.with_suffix('.ogg')]
    if cue['piano']:files.append(piano_midi(score))
    save(cue['id']+'-score.json',score)
    result={'id':cue['id'],'title':cue['title'],'stem':cue['stem'],'idea':cue['idea'],'key':cue['key'],'meter':cue['meter'],'bpm_quarter':cue['bpm'],
            'bars':cue['bars'],'total_beats':score['total_beats'],'seconds':frames/SR,'tracks':rows,'loudness':base.shared.loud(wav),'slow_balance':balance,
            'files':[fp(p) for p in files],'sections':score['sections'],'native_project':'frozen pre-master stems, not separately native-rendered','human_listening':'not claimed'}
    save(cue['id']+'-report.json',result);print(json.dumps({'done':cue['id'],'seconds':result['seconds'],'lufs':result['loudness']['input_i'],'tracks':len(rows)},ensure_ascii=False),flush=True);return result

def main():
    sources=[ROOT/'game/src/audio/sound.js',ROOT/'game/src/audio/sound.scape.js',ROOT/'game/data/scenes.json',ROOT/'docs/rules.md',base.shared.FONT]
    prior=OUT.parent/'2026-10-05-WF-music-piano-two-hands'
    sources.extend(prior/(s+'.wav') for s in ['01-title-frostglass-v10','02-explore-ashline-v6','03-battle-blackpulse-v6'])
    before=[fp(p) for p in sources];reports=[]
    for cue in CUES:
        existing=OUT/(cue['id']+'-report.json')
        if '--resume' in sys.argv and existing.exists():
            r=json.loads(existing.read_text(encoding='utf-8'));assert all(fp(ROOT/f['path'])==f for f in r['files']);reports.append(r);print('reuse '+cue['id'],flush=True)
        else:reports.append(render(cue))
    assert before==[fp(p) for p in sources]
    save('render-report.json',{'source_inputs_unchanged':before,'cues':reports,'scope':'11 scene-specific candidates; all existing game and audio untouched'})
    print('eleven cues complete',flush=True)

if __name__=='__main__':main()
