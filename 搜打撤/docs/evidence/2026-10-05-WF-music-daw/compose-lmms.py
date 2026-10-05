"""Original scores -> native LMMS projects -> LMMS/FluidSynth audio -> loop masters.
Run from the Vite project: python docs/evidence/2026-10-05-WF-music-daw/compose-lmms.py
All notes/arrangement are newly authored; reference projects contribute no notes.
"""
import copy, hashlib, json, os, pathlib, subprocess, time
import xml.etree.ElementTree as ET
import numpy as np
import soundfile as sf
from scipy.signal import butter, sosfilt

ROOT=pathlib.Path(__file__).resolve().parents[3]
OUT=pathlib.Path(__file__).resolve().parent
LMMS=ROOT/'.tmp/music-workstation/LMMS'
FONT=ROOT/'.tmp/music-workstation/GeneralUser-GS.sf2'
INTERMEDIATE=ROOT/'.tmp/music-workstation/renders'
SR=48000; TICKS=48; BARS=32
RNG=np.random.default_rng(5102026)

def elem(parent,tag,**attrs):
    return ET.SubElement(parent,tag,{k:str(v) for k,v in attrs.items()})

class Score:
    def __init__(self,name,bpm,role,title):
        self.name,self.bpm,self.role,self.title=name,bpm,role,title
        self.root=ET.Element('lmms-project',{'creator':'LMMS','version':'1.0','type':'song','creatorversion':'1.2.2'})
        elem(self.root,'head',bpm=bpm,mastervol=70,masterpitch=0,timesig_numerator=4,timesig_denominator=4)
        self.song=elem(self.root,'song')
        self.tc=elem(self.song,'trackcontainer',type='song',visible=1)
        self.tracks={};self.stats={}
    def instrument(self,label,patch,volume,pan=0,bank=0,reverb=.13,chorus=False):
        track=elem(self.tc,'track',type=0,name=label,muted=0,solo=0)
        it=elem(track,'instrumenttrack',vol=volume,pan=pan,pitch=0,basenote=57,usemasterpitch=1,pitchrange=1,fxch=0)
        ins=elem(it,'instrument',name='sf2player')
        elem(ins,'sf2player',src=FONT.as_posix(),bank=bank,patch=patch,gain=1,reverbOn=int(reverb>0),reverbRoomSize=.68,reverbDamping=.62,reverbWidth=.85,reverbLevel=reverb,chorusOn=int(chorus),chorusNum=3,chorusLevel=.28,chorusSpeed=.35,chorusDepth=5)
        elem(it,'fxchain',enabled=0,numofeffects=0)
        self.tracks[label]=track;self.stats[label]={'program':patch,'bank':bank,'volume':volume,'pan':pan,'notes':0}
    def phrase(self,label,bar,notes,bars=1,section=''):
        pattern=elem(self.tracks[label],'pattern',type=1,pos=bar*192,len=bars*192,steps=bars*16,name=section or label,muted=0)
        for beat,midi,length,velocity in notes:
            tick=max(0,round(beat*TICKS+RNG.uniform(-1.1,1.1)))
            elem(pattern,'note',key=midi-12,pos=tick,len=max(1,round(length*TICKS)),vol=round(np.clip(velocity+RNG.uniform(-4,4),1,100)),pan=0)
            self.stats[label]['notes']+=1
    def save(self):
        # Render two identical cycles so the delivered cycle includes native reverb tails.
        for track in self.tracks.values():
            for pattern in list(track.findall('pattern')):
                duplicate=copy.deepcopy(pattern);duplicate.set('pos',str(int(pattern.get('pos'))+BARS*192));track.append(duplicate)
        elem(self.song,'timelinestate',lpstate=0,lp0pos=0,lp1pos=BARS*2*192)
        elem(self.song,'projectnotes').text=f'{self.title}; original Friday score; two-cycle render; use second cycle for looping.'
        ET.indent(self.root,space='  ') if hasattr(ET,'indent') else None
        path=OUT/(self.name+'.mmp');ET.ElementTree(self.root).write(path,encoding='utf-8',xml_declaration=True)
        return path

def title_score():
    s=Score('01-title-frostglass-v2',136,'title','霜窗回声 · LMMS版')
    for args in [('Grand piano',0,105,-10,0,.21),('Warm horizon',89,30,18,0,.19),('Cello strings',49,40,-18,0,.18),('Muted bass',33,55,0,0,.02),('Glass answer',8,43,25,0,.2),('Brush drums',40,38,0,128,.04)]:s.instrument(*args)
    # C minor -> Abmaj7 -> Fm9 -> G7, with specific altered dominant at the cadence.
    chords=[[48,55,60,63,74],[44,55,60,63,67],[41,53,56,60,67],[43,53,59,62,67]]
    bass=[36,32,29,31]
    melodies=[[(0,79,1.5),(1.75,75,.5),(2.5,74,.5),(3.25,72,1.5),(5.25,75,.75),(6.5,79,1.2)],
              [(0,79,1),(1.5,75,.75),(2.75,72,1.7),(5,70,.75),(6,67,1.6)],
              [(0,72,1.5),(2,75,.75),(3.25,77,1.25),(5.25,75,.75),(6.5,72,1.1)],
              [(0,74,1.25),(1.75,72,.75),(3,71,1),(4.5,67,.75),(6,71,.5),(6.75,74,.65)]]
    for b in range(0,32,2):
        ci=(b//2)%4;sec=b//8;ch=chords[ci]
        s.phrase('Warm horizon',b,[(0,n,7.7,59) for n in ch[1:]],2,'sustained harmony')
        voicing=ch[1:]
        keys=[]
        for j,beat in enumerate([0,1.5,2.5,4,5.5,6.5]):
            keys.append((beat,voicing[[0,2,1,3,2,1][j]],1.6,64 if j%3 else 78))
        lead=[(q,n-(12 if sec==2 else 0),length,77 if sec!=3 else 84) for q,n,length in melodies[ci]]
        s.phrase('Grand piano',b,keys+lead,2,'piano theme / answer')
        if sec in [1,3]:s.phrase('Glass answer',b,[(4.75,lead[-2][1]+12,1.3,53),(6.5,lead[-1][1]+12,1.1,49)],2,'distant response')
        if sec>=1:s.phrase('Cello strings',b,[(.12,ch[0]+12,3.6,56),(4.1,ch[1],3.65,51)],2,'lower countermelody')
        for j in range(2):
            bb=b+j
            s.phrase('Muted bass',bb,[(0,bass[ci],1.6,77),(2.5,bass[ci]+7,.75,60)],section='half-time bass')
            if sec!=2 and bb>=4:
                notes=[(0,36,.18,68),(2,38,.15,42)]
                notes += [(q,42,.12,33 if q%1 else 42) for q in np.arange(.5,4,.5)]
                if bb%4==3:notes.extend([(3.25,38,.12,24),(3.75,37,.12,34)])
                s.phrase('Brush drums',bb,notes,section='soft half-time groove')
    return s

def explore_score():
    s=Score('02-explore-ashline-v2',152,'explore','灰线行军 · LMMS版')
    for args in [('Tine piano motif',4,100,-12,0,.15,True),('Picked guitar',27,85,24,0,.12),('Warm pad',89,30,-22,0,.18),('Synth bass',38,34,0,0,.0),('String response',48,58,17,0,.17),('Electronic drums',25,38,0,128,.03)]:s.instrument(*args)
    chords=[[50,57,62,65,76],[46,57,62,65,69],[41,53,57,60,67],[48,55,60,64,69]]
    roots=[38,34,29,36]
    motifs=[[(0,77,.5),(.75,74,.7),(1.75,72,.5),(2.5,69,.8),(4,74,.5),(4.75,77,.55),(5.5,81,.8),(6.75,79,.75)],
            [(0,77,.9),(1.5,74,.75),(3,69,.9),(4.5,72,.6),(5.5,74,1.35)],
            [(0,76,.6),(1,77,.6),(2,81,.9),(3.5,79,.6),(4.5,77,.6),(5.5,76,.6),(6.5,72,.8)],
            [(0,76,.6),(1,72,.9),(2.5,69,.6),(3.5,67,.9),(5,72,.75),(6.5,73,.45),(7.25,74,.55)]]
    for b in range(0,32,2):
        ci=(b//2)%4;sec=b//8;ch=chords[ci]
        s.phrase('Warm pad',b,[(.03,n,7.85,57) for n in ch[1:]],2,'harmonic space')
        motif=motifs[ci]
        if sec==2:motif=[(q,n-12,d*1.15,69) for q,n,d in motif[::2]]
        else:motif=[(q,n,d,80 if sec==3 else 74) for q,n,d in motif]
        s.phrase('Tine piano motif',b,motif,2,'eight-bar main theme')
        if sec in [1,3]:s.phrase('String response',b,[(0,ch[2]+12,3.55,52),(4,ch[3]+12,3.55,56)],2,'lyrical response')
        for j in range(2):
            bb=b+j
            bass_notes=[(0,roots[ci],.55,87),(.75,roots[ci],.42,67),(1.5,roots[ci]+7,.55,73),(2.75,roots[ci],.55,80),(3.5,roots[ci]+12,.32,53)]
            if sec==2:bass_notes=bass_notes[::2]
            s.phrase('Synth bass',bb,bass_notes,section='syncopated low end')
            guitar=[(.5,ch[1]+12,.42,58),(1.75,ch[2]+12,.35,64),(2.5,ch[3]+12,.65,52),(3.5,ch[2]+12,.35,59)]
            if sec==2:guitar=guitar[::2]
            s.phrase('Picked guitar',bb,guitar,section='offbeat pluck')
            drum=[(0,36,.15,89),(1,38,.15,81),(1.75,36,.14,62),(2.5,36,.15,77),(3,38,.15,86)]
            if sec==2:drum=[(0,36,.15,78),(2,38,.15,65)]
            hats=np.arange(0,4,.25 if sec==3 else .5)
            drum += [(float(q),42,.12,38 if q%1 else 59) for q in hats]
            if bb%4==3:drum += [(3.5,46,.2,52),(3.75,38,.12,43)]
            if bb%8==0:drum += [(0,49,.35,39)]
            s.phrase('Electronic drums',bb,drum,section='broken electronic groove')
    return s

def battle_score():
    s=Score('03-battle-blackpulse-v2',124,'battle','黑脉交锋 · LMMS版')
    for args in [('Pizzicato drive',45,48,-17,0,.12),('String theme',48,105,10,0,.16),('French horn answer',60,55,-25,0,.17),('Low strings',49,34,23,0,.12),('Synth bass',38,32,0,0,0),('Taiko',116,32,-6,0,.09),('Power drums',16,20,0,128,.035),('Saw accent',81,28,0,0,.10)]:s.instrument(*args)
    chords=[[40,52,55,59,66],[36,52,55,60,64],[38,50,54,57,64],[35,51,54,57,63]]
    roots=[28,24,26,23]
    theme=[[(0,71,.75),(1,74,.5),(1.75,76,1.1),(3.25,74,.5),(4,71,.75),(5.25,67,.5),(6,66,.55),(7,64,.6)],
           [(0,67,1.0),(1.5,71,.7),(3,72,.75),(4,71,.75),(5.5,67,.55),(6.5,64,.95)],
           [(0,69,.65),(1,74,.65),(2,78,.9),(3.5,76,.65),(4.5,74,.65),(5.5,73,.65),(6.5,69,.9)],
           [(0,71,.75),(1.25,69,.6),(2.5,66,.75),(4,63,.75),(5.25,66,.5),(6.25,71,1.15)]]
    for b in range(0,32,2):
        ci=(b//2)%4;sec=b//8;ch=chords[ci]
        s.phrase('Low strings',b,[(.05,ch[1],7.8,61),(.08,ch[2],7.75,54)],2,'orchestral floor')
        lead=[(q,n,d,77 if sec in [1,3] else 67) for q,n,d in theme[ci]]
        if sec==2:lead=[(q,n-12,d*1.15,v-6) for q,n,d,v in lead[::2]]
        s.phrase('String theme',b,lead,2,'main statement')
        if sec in [1,3]:
            s.phrase('French horn answer',b,[(4.0,ch[2]+12,1.45,65),(6,ch[3]+12,1.4,68)],2,'horn response')
        if sec==3:s.phrase('Saw accent',b,[(q,n,d,52) for q,n,d,v in lead[:4]],2,'soft electronic doubling')
        for j in range(2):
            bb=b+j
            order=[1,3,2,3,1,4,2,3]
            s.phrase('Pizzicato drive',bb,[(k*.5,ch[ix]+12,.33,66 if k%2==0 else 47) for k,ix in enumerate(order) if sec!=2 or k%2==0],section='string ostinato')
            s.phrase('Synth bass',bb,[(q,roots[ci]+(12 if q==3.5 else 0),.43,82 if q%1==0 else 63) for q in [0,.75,1.5,2,2.75,3.5]],section='low pulse')
            drum=[(0,36,.18,89),(1,38,.16,73),(1.5,36,.15,67),(2,36,.18,80),(3,38,.16,87),(3.5,36,.14,60)]
            if sec==2:drum=[(0,36,.18,75),(2,38,.16,63)]
            drum += [(q,42,.12,38 if q%1 else 53) for q in np.arange(0,4,.5)]
            if bb%8==0:drum.append((0,49,.3,45))
            if bb%8==7:drum += [(3.25,45,.18,66),(3.75,47,.16,75)]
            s.phrase('Power drums',bb,drum,section='battle backbeat')
            if sec in [1,3]:s.phrase('Taiko',bb,[(.5,48,.25,55),(2.75,43,.28,68),(3.5,48,.24,48)],section='taiko accents')
    return s

def execute(score):
    path=OUT/(score.name+'.mmp')
    prior=path.read_bytes() if path.exists() else None
    path=score.save();raw=INTERMEDIATE/(score.name+'-raw.wav')
    reuse=prior==path.read_bytes() and raw.exists() and raw.stat().st_mtime>FONT.stat().st_mtime
    args=[str(LMMS/'lmms.exe'),'-c','friday-lmmsrc.xml','render',os.path.relpath(path,LMMS),'-o',os.path.relpath(raw,LMMS),'-s',str(SR),'-a','-i','sincbest','-x','2']
    startup=subprocess.STARTUPINFO();startup.dwFlags|=subprocess.STARTF_USESHOWWINDOW;startup.wShowWindow=0
    log=OUT/(score.name+'-render.log')
    if not reuse:
        with log.open('wb') as f:
            proc=subprocess.Popen(args,cwd=LMMS,stdout=f,stderr=subprocess.STDOUT,startupinfo=startup)
            print(json.dumps({'role':score.role,'stage':'native-LMMS-render','pid':proc.pid,'tracks':len(score.tracks),'notes':sum(t['notes'] for t in score.stats.values())}),flush=True)
            result=proc.wait(timeout=420)
        if result!=0:raise RuntimeError(f'Native LMMS render failed ({result}), see {log}')
    audio,sr=sf.read(raw,dtype='float32',always_2d=True)
    period=round(BARS*4*60/score.bpm*sr)
    if sr!=SR or len(audio)<2*period:raise RuntimeError('Unexpected native audio duration/rate')
    mix=audio[period:2*period].copy()
    if not np.isfinite(mix).all() or np.max(np.abs(mix))<.001:raise RuntimeError('Native render silent/invalid')
    # Gentle mastering only; instruments, timing, reverb and arrangement are native LMMS.
    mix=sosfilt(butter(2,28,btype='highpass',fs=SR,output='sos'),np.concatenate([mix[-SR:],mix]),axis=0)[SR:].astype(np.float32)
    mix-=mix.mean(axis=0)
    rms=np.sqrt(np.mean(mix**2));target=10**({'title':-18,'explore':-16,'battle':-15.5}[score.role]/20)
    gain=min(target/rms,.87/np.max(np.abs(mix)));mix*=gain
    width=96;delta=mix[-1]-mix[0]
    mix[-width:]-=delta*(.5-.5*np.cos(np.linspace(0,np.pi,width)))[:,None]
    final=OUT/(score.name+'.wav');sf.write(final,mix,SR,subtype='PCM_24')
    mp3=OUT/(score.name+'.mp3')
    subprocess.run(['ffmpeg','-v','error','-y','-i',str(final),'-c:a','libmp3lame','-b:a','256k','-metadata','title='+score.title,str(mp3)],check=True)
    ogg=OUT/(score.name+'.ogg')
    subprocess.run(['ffmpeg','-v','error','-y','-i',str(final),'-c:a','libvorbis','-q:a','6','-metadata','title='+score.title,str(ogg)],check=True)
    report={'role':score.role,'title':score.title,'bpm':score.bpm,'seconds':period/SR,'native_engine':'LMMS 1.2.2 sf2player/FluidSynth, sinc-best, 2x oversampling, 48k float render','tracks':score.stats,'cycles_rendered':2,'delivered_cycle':2,'raw_peak':float(np.max(np.abs(audio))),'peak_dbfs':float(20*np.log10(np.max(np.abs(mix)))),'rms_dbfs':float(20*np.log10(np.sqrt(np.mean(mix**2)))),'post_master_gain_db':float(20*np.log10(gain)),'files':[{ 'path':str(p.relative_to(ROOT)).replace('\\','/'),'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in [path,final,mp3,ogg]],'listening':'user listening required; numerical checks cannot establish aesthetic improvement'}
    (OUT/(score.name+'-report.json')).write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps({'role':score.role,'stage':'complete','seconds':report['seconds'],'peak_dbfs':report['peak_dbfs'],'rms_dbfs':report['rms_dbfs']},ensure_ascii=True),flush=True)
    return report

if __name__=='__main__':
    INTERMEDIATE.mkdir(parents=True,exist_ok=True)
    scores=[title_score(),explore_score(),battle_score()]
    reports=[execute(s) for s in scores]
    (OUT/'daw-render-report.json').write_text(json.dumps(reports,ensure_ascii=False,indent=2),encoding='utf-8')
