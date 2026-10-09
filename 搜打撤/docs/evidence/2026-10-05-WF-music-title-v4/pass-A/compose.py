"""One title cue only: native LMMS orchestration + continuous expression automation."""
import pathlib,importlib.util,copy,xml.etree.ElementTree as ET,json,os,subprocess,sys
import numpy as np
import soundfile as sf
from scipy.signal import butter,sosfilt
OUT=pathlib.Path(__file__).resolve().parent;ROOT=OUT.parents[2]
spec=importlib.util.spec_from_file_location('native',OUT.parent/'2026-10-05-WF-music-daw/compose-lmms.py')
engine=importlib.util.module_from_spec(spec);spec.loader.exec_module(engine)
engine.BARS=56;engine.OUT=OUT;engine.INTERMEDIATE=ROOT/'.tmp/music-workstation/title-v4/render';engine.INTERMEDIATE.mkdir(parents=True,exist_ok=True)
engine.RNG=np.random.default_rng(510204)
sys.stdout.reconfigure(encoding='utf-8')
SECTIONS=[(0,6,'Solo introduction'),(6,14,'Cello conversation'),(14,19,'Woodwind crossing'),(19,31,'Growing inner voices'),(31,38,'Single sustained summit'),(38,42,'Afterglow'),(42,52,'Intimate thematic return'),(52,56,'Unresolved loop cadence')]

class Score(engine.Score):
    def __init__(self):
        super().__init__('01-title-frostglass-v4',112,'title','霜窗回声 · 第四版')
        self.expressions={};self.instrument_roles={}
    def sf(self,label,patch,vol,pan,group,verb=.1,bank=0):
        self.instrument(label,patch,vol,pan,bank,verb)
        self.instrument_roles[label]=group
        f=self.tracks[label].find('instrumenttrack/instrument/sf2player')
        f.set('reverbRoomSize','.65');f.set('reverbDamping','.62')
    def expression(self,label,points):
        model_id=740100+len(self.expressions)
        it=self.tracks[label].find('instrumenttrack');base=float(it.get('vol'))
        engine.elem(it,'vol',id=model_id,value=base*points[0][1],scale_type='linear')
        track=engine.elem(self.tc,'track',type=5,name=label+' expression',muted=0,solo=0)
        engine.elem(track,'automationtrack')
        pat=engine.elem(track,'automationpattern',name=label+' continuous expression',pos=0,len=2*56*192,prog=1,tens=1,mute=0)
        for cycle in [0,1]:
            for beat,factor in points:
                engine.elem(pat,'time',pos=round((beat+cycle*224)*48),value=round(base*factor,4))
        engine.elem(pat,'object',id=model_id)
        self.expressions[label]={'target_model':model_id,'base_volume':base,'points_beats_factor':points}
    def save(self):
        path=super().save()
        # Add useful native project notes without rewriting the rest of the score.
        self.song.find('projectnotes').text='Title only. 56 bars / 120 seconds / 112 BPM. Eight unequal sections. Continuous string/cello/woodwind expression; score written for native LMMS. Render second cycle for loop.'
        ET.ElementTree(self.root).write(path,encoding='utf-8',xml_declaration=True)
        return path

def compose():
    s=Score()
    for row in [('Piano theme',0,110,-8,'lead',.11),('Piano inner voice',0,62,-24,'accompaniment',.08),('Violin I',48,64,-58,'strings',.16),('Violin II',48,53,48,'strings',.16),('Cello',42,65,25,'counter',.12),('Clarinet',71,72,-29,'counter',.13),('Double bass',43,54,0,'bass',.035),('String pizzicato',45,75,36,'pulse',.08),('Concert percussion',48,20,10,'percussion',.09,128),('Celesta detail',8,48,31,'detail',.15)]:s.sf(*row)
    chords=[[48,55,60,63,74],[44,55,60,63,67],[41,53,56,60,67],[43,53,59,62,69],
            [48,55,60,63,69],[46,53,58,62,65],[41,53,56,60,67],[43,53,59,62,68]]
    themes=[[(.5,79,1.25),(2.25,72,.75),(3.25,75,1.2),(5,74,2),(7.1,72,.55)],
            [(0,67,1),(1.75,70,.55),(3,68,1),(4.75,67,1.4),(6.5,63,1)],
            [(.5,72,1.5),(2.5,75,.65),(3.5,77,.85),(5.25,79,1.15),(6.75,77,.8)],
            [(0,74,1.2),(2,71,.8),(3.5,67,1.4),(5.75,68,.55),(6.75,71,.65)],
            [(0,75,1),(1.5,79,.5),(2.5,81,1.1),(4.25,79,1.25),(6.25,74,1.2)],
            [(.5,77,1),(2,74,.8),(3.5,70,1.25),(5.5,72,.6),(6.5,74,.7)],
            [(0,75,1.5),(2,72,1),(3.75,68,.75),(5,67,1.7)],
            [(.5,74,.75),(1.75,72,.7),(3,71,1.35),(5.5,67,1),(7,71,.5)]]
    counters=[[(.25,55,2.2),(3.25,60,1.4),(5.25,58,1.4)],[(1,55,1.7),(3.5,56,1.4),(6,55,1.6)],[(.5,53,2.0),(3,56,1.8),(6,60,1.5)],[(.5,55,2.1),(3.5,53,1.5),(5.75,50,1.7)]]
    for chapter,(start,end,name) in enumerate(SECTIONS):
        b=start
        while b<end:
            bars=min(2,end-b);length=bars*4
            ix=((b-start)//2+chapter*2)%8;ch=chords[ix]
            if chapter==0:ix=((b-start)//2)%4;ch=chords[ix]
            if chapter==6:ix=((b-start)//2)%8;ch=chords[ix]
            if chapter==7:ix=6 if b==52 else 7;ch=chords[ix]
            melody=[(q,n,d,79) for q,n,d in themes[ix] if q<length-.2]
            if chapter==2:melody=[(q,n-12,min(d,1.0),64) for q,n,d,v in melody[::2]]
            elif chapter==3:
                melody=[(q,n+(12 if b in [25,27] and q<2 else 0),d*.92,76) for q,n,d,v in melody]
            elif chapter==4:melody=[(q,n,d*1.05,84) for q,n,d,v in melody]
            elif chapter==5:melody=[(q,n-12,d*1.3,61) for q,n,d,v in melody[::2]]
            elif chapter==6:melody=[(q,n,d*1.2,72) for q,n,d,v in melody]
            elif chapter==7:melody=[(q,n-12,d*1.4,57) for q,n,d,v in melody[:2]]
            for index,(q,n,d,v) in enumerate(melody):
                # Intentional phrase delay/anticipation, consistent for a gesture rather than random jitter only.
                q=max(0,q+(.07 if index==len(melody)-1 else -.025 if index==1 else 0))
                melody[index]=(q,n,min(d,length-q+.06),v-4 if index==len(melody)-1 else v)
            s.phrase('Piano theme',b,melody,bars,name+' / piano statement')
            inner=[]
            for j in range(bars):
                root=ch[0]-12
                inner.extend([(j*4,root,1.9,67),(j*4+1,ch[1],.70,43),(j*4+2,ch[2],.8,48),(j*4+3,ch[3],.78,39)])
            if chapter in [0,5,7]:inner=inner[::2]
            if chapter==2:inner=inner[:2]
            s.phrase('Piano inner voice',b,inner,bars,name+' / left-hand anchor')
            if chapter in [1,3,4,6]:
                cello=[(q,n,d,61) for q,n,d in counters[ix%4] if q<length-.25]
                if chapter==4:cello=[(q,n+7,d*.9,67) for q,n,d,v in cello]
                if chapter==6:cello=cello[::2]
                s.phrase('Cello',b,cello,bars,name+' / cello reply')
            if chapter in [2,3] or (chapter==6 and b in [44,50]):
                wind=[(.2,ch[2]+12,1.6,61),(2.4,ch[3]+12,1.25,58),(4.3,ch[-1],1.35,66),(6.0,ch[2]+12,1.4,56)]
                wind=[(q,n,min(d,length-q),v) for q,n,d,v in wind if q<length-.3]
                if chapter==3:wind=wind[2:] if bars==2 else wind[-1:]
                s.phrase('Clarinet',b,wind,bars,name+' / independent woodwind answer')
            if chapter in [1,2,3,4,6] and not(chapter==6 and b>=48):
                v1=[(.15,ch[3]+12,length*.45,55),(length*.53,ch[-1],length*.46,62)]
                v2=[(.28,ch[2],length*.6,49),(length*.64,ch[1],length*.34,54)]
                if chapter==4:v1=[(.12,ch[-1]+12,length*.46,64),(length*.52,ch[3]+12,length*.46,68)]
                s.phrase('Violin I',b,v1,bars,name+' / upper string arc')
                s.phrase('Violin II',b,v2,bars,name+' / inner contrary motion')
            if chapter in [3,4]:
                pulse=[]
                for j in range(bars):pulse.extend([(j*4+.5,ch[1]+12,.34,46),(j*4+1.5,ch[2]+12,.32,39),(j*4+2.5,ch[3]+12,.34,43),(j*4+3.5,ch[2]+12,.31,36)])
                s.phrase('String pizzicato',b,pulse,bars,name+' / light moving pulse')
            if chapter>0 and chapter not in [2,5,7]:
                s.phrase('Double bass',b,[(j*4,ch[0]-12,3.4,58) for j in range(bars)],bars,name+' / bass foundation')
            if chapter in [3,4] and b%3==1:
                hits=[(0,36,.45,43),(2.5,45,.3,28)]
                if chapter==4:hits.append((3.5,38,.12,24))
                s.phrase('Concert percussion',b,hits,bars,name+' / restrained concert drum')
            if b in [4,12,18,29,37,45,54]:
                q=min(length-1,2.8);s.phrase('Celesta detail',b,[(q,ch[-1]+12,1.2,43)],bars,name+' / distant celesta')
            b+=bars
    # Through-composed envelopes across eight unequal sections, plus phrase swells.
    contour=[(0,.22),(20,.25),(24,.38),(45,.65),(56,.47),(70,.50),(76,.50),(96,.65),(112,.96),(128,1.12),(144,1.05),(152,.4),(166,.22),(172,.44),(186,.62),(198,.44),(208,.24),(224,.22)]
    for label,phase in [('Violin I',0),('Violin II',2.2),('Cello',1.0),('Clarinet',.6)]:
        points=[]
        xp=np.array([x for x,y in contour]);yp=np.array([y for x,y in contour])
        for beat in np.arange(0,224.001,.5):
            base=np.interp(beat,xp,yp)
            wave=.78+.22*np.sin(np.pi*((beat+phase)%8)/8)**2
            points.append((float(beat),float(base*wave)))
        points[-1]=(224,points[0][1]);s.expression(label,points)
    # Piano narrative also changes continuously, without cutting all parts together.
    s.expression('Piano theme',[(0,.60),(12,.64),(24,.78),(48,.84),(56,.58),(76,.72),(100,.90),(120,1.0),(142,1.06),(152,.68),(168,.63),(185,.8),(204,.60),(212,.52),(224,.60)])
    return s

def master(report):
    wav=OUT/'01-title-frostglass-v4.wav';pcm,sr=sf.read(wav,dtype='float32',always_2d=True);n=len(pcm)
    # A small coherent chamber. Bass stays central; reflected material is high-passed.
    reflections=np.zeros_like(pcm)
    mono=pcm.mean(axis=1)
    source=sosfilt(butter(2,[180,6500],btype='bandpass',fs=sr,output='sos'),np.concatenate([mono[-sr:],mono]))[sr:]
    rng=np.random.default_rng(204)
    for ch in [0,1]:
        impulse=np.zeros(n,dtype=np.float32)
        delays=[.031,.047,.083,.127,.191,.283,.417,.603,.851,1.173,1.57]
        for i,delay in enumerate(delays):impulse[round((delay+(ch*.011 if i%2==0 else ch*.019))*sr)]+=.12*np.exp(-delay*1.7)
        reflections[:,ch]=np.fft.irfft(np.fft.rfft(source)*np.fft.rfft(impulse),n=n)
    mix=pcm+reflections*.35
    mix-=mix.mean(axis=0);mix*=min(1,.86/np.max(np.abs(mix)))
    mix[-96:]-=(mix[-1]-mix[0])*(.5-.5*np.cos(np.linspace(0,np.pi,96)))[:,None]
    sf.write(wav,mix,sr,subtype='PCM_24')
    for ext in ['mp3','ogg']:
        args=['ffmpeg','-v','error','-y','-i',str(wav)]
        args+=['-c:a','libmp3lame','-b:a','256k'] if ext=='mp3' else ['-c:a','libvorbis','-q:a','6']
        subprocess.run(args+['-metadata','title=霜窗回声 · 第四版',str(wav.with_suffix('.'+ext))],check=True)
    import hashlib
    for f in report['files']:
        p=ROOT/f['path'];f.update({'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()})
    report.update({'bars':56,'sections':SECTIONS,'expression_automation':s.expressions,'instrument_roles':s.instrument_roles,'peak_dbfs':float(20*np.log10(np.max(np.abs(mix)))),'rms_dbfs':float(20*np.log10(np.sqrt(np.mean(mix*mix)))),'scope':'Only first/title candidate. Other two cues and game untouched.'})
    (OUT/'render-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
    return report

if __name__=='__main__':
    s=compose();report=engine.execute(s);report=master(report)
    print(json.dumps({'seconds':report['seconds'],'automation_tracks':len(s.expressions),'sections':SECTIONS,'scope':'first title cue only'},ensure_ascii=True),flush=True)
