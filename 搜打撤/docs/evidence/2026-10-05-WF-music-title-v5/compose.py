"""A clear piano line: complete eight-bar phrases, quiet harmonic accompaniment."""
import pathlib,importlib.util,json,xml.etree.ElementTree as ET,subprocess,hashlib,sys
import numpy as np,soundfile as sf
from scipy.signal import butter,sosfilt
OUT=pathlib.Path(__file__).resolve().parent;ROOT=OUT.parents[2]
spec=importlib.util.spec_from_file_location('native',OUT.parent/'2026-10-05-WF-music-daw/compose-lmms.py')
engine=importlib.util.module_from_spec(spec);spec.loader.exec_module(engine)
engine.BARS=32;engine.OUT=OUT;engine.INTERMEDIATE=ROOT/'.tmp/music-workstation/title-v5';engine.INTERMEDIATE.mkdir(parents=True,exist_ok=True)
SR=48000;BPM=84;sys.stdout.reconfigure(encoding='utf-8')

class Score(engine.Score):
    def __init__(self):
        super().__init__('01-title-frostglass-v5',BPM,'title','霜窗回声 · 第五版')
        self.expression_curves={};self.note_events={}
    def phrase(self,label,bar,notes,bars=1,section=''):
        # Keep a readable metric line; no random offsets, late pickups, or phrase truncation.
        p=engine.elem(self.tracks[label],'pattern',type=1,pos=bar*192,len=bars*192,steps=bars*16,name=section or label,muted=0)
        for beat,midi,length,velocity in notes:
            engine.elem(p,'note',key=midi-12,pos=round(beat*48),len=max(1,round(length*48)),vol=round(velocity),pan=0)
            self.stats[label]['notes']+=1
            self.note_events.setdefault(label,[]).append({'beat':bar*4+beat,'midi':midi,'length':length,'velocity':velocity})
    def expression(self,label,points):
        it=self.tracks[label].find('instrumenttrack');base=float(it.get('vol'));model=790001+len(self.expression_curves)
        engine.elem(it,'vol',id=model,value=base*points[0][1],scale_type='linear')
        track=engine.elem(self.tc,'track',type=5,name=label+' long-phrase expression',muted=0,solo=0);engine.elem(track,'automationtrack')
        p=engine.elem(track,'automationpattern',pos=0,len=2*128*48,prog=1,tens=1,mute=0,name=label+' expression')
        for cycle in [0,1]:
            for beat,factor in points:engine.elem(p,'time',pos=round((beat+cycle*128)*48),value=round(base*factor,4))
        engine.elem(p,'object',id=model);self.expression_curves[label]=points

def compose():
    s=Score()
    for label,patch,vol,pan,verb in [('Piano melody',0,110,3,.10),('Quiet piano harmony',0,35,-18,.09),('Strings left',49,35,-39,.15),('Strings right',49,31,36,.15),('Cello foundation',42,38,15,.10)]:
        s.instrument(label,patch,vol,pan,0,verb)
    # Each line is one bar: all onsets lie on quarter/half-note beats.
    A=[[(67,1),(63,1),(65,1),(67,1)],[(72,2),(70,1),(67,1)],
       [(68,1),(67,1),(63,2)],[(65,1),(67,1),(72,2)],
       [(70,1),(68,1),(67,1),(65,1)],[(63,2),(65,1),(68,1)],
       [(67,1),(65,1),(62,2)],[(59,1),(62,1),(67,2)]]
    B=[[(75,1),(74,1),(72,2)],[(67,2),(70,1),(72,1)],
       [(75,2),(74,1),(70,1)],[(67,4)],
       [(68,1),(72,1),(70,1),(68,1)],[(67,2),(65,1),(63,1)],
       [(62,2),(65,1),(67,1)],[(71,2),(67,2)]]
    # Functional harmony supports the melody without unrelated ornamental notes.
    CA=[[48,55,60,63],[44,51,56,60],[41,48,53,56],[43,50,53,59]]
    CB=[[48,55,60,63],[39,46,55,58],[41,48,53,56],[43,50,53,59]]
    forms=[(0,A,CA,'A / piano statement'),(8,A,CA,'A / strings enter'),(16,B,CB,'B / one contrasting sentence'),(24,A,CA,'A / remembered return')]
    for start,theme,chords,name in forms:
        for j,line in enumerate(theme):
            notes=[];beat=0
            for index,(midi,dur) in enumerate(line):
                velocity=69+(4 if index==0 else 0)+(3 if start==16 else 0)-(2 if j in [3,7] else 0)
                # Near-contiguous note lengths. Only complete phrase cadences breathe briefly.
                gap=.09 if j in [3,7] and index==len(line)-1 else .015
                notes.append((beat,midi,dur-gap,velocity));beat+=dur
            assert beat==4
            s.phrase('Piano melody',start+j,notes,1,name)
        for j in range(0,8,2):
            bar=start+j;ch=chords[j//2]
            harmony=[(0,n,6.8,45) for n in [ch[0],ch[1],ch[3]]]
            s.phrase('Quiet piano harmony',bar,harmony,2,name+' / one quiet chord')
            if start>0:
                # Sustained harmonic voices, no independent counter-melody against the piano.
                s.phrase('Strings left',bar,[(0,ch[3],7.96,52)],2,name+' / held harmony')
                s.phrase('Strings right',bar,[(0,ch[1],7.96,49)],2,name+' / held harmony')
                if start in [8,16]:s.phrase('Cello foundation',bar,[(0,ch[0],7.9,48)],2,name+' / held bass')
    contour=[(0,.15),(28,.15),(32,.40),(44,.57),(60,.62),(64,.65),(76,.82),(90,.86),(96,.68),(110,.5),(124,.22),(128,.15)]
    for label,shift in [('Strings left',0),('Strings right',1.0),('Cello foundation',.5)]:
        xp=np.array([a for a,b in contour]);yp=np.array([b for a,b in contour]);points=[]
        for beat in np.arange(0,128.01,.5):
            base=np.interp(beat,xp,yp);swell=.88+.12*np.sin(np.pi*((beat+shift)%16)/16)**2
            points.append((float(beat),float(base*swell)))
        points[-1]=(128,points[0][1]);s.expression(label,points)
    return s

def master(report):
    wav=OUT/'01-title-frostglass-v5.wav';pcm,sr=sf.read(wav,dtype='float32',always_2d=True);n=len(pcm)
    wet=np.zeros_like(pcm);mono=pcm.mean(axis=1)
    source=sosfilt(butter(2,[180,5600],btype='bandpass',fs=sr,output='sos'),np.concatenate([mono[-sr:],mono]))[sr:]
    for ch in [0,1]:
        impulse=np.zeros(n,dtype=np.float32)
        for delay,weight in [(.037,.12),(.079,.08),(.151,.055),(.283,.035),(.431,.020),(.691,.012),(.997,.007)]:
            impulse[round((delay+ch*.013)*sr)]=weight
        wet[:,ch]=np.fft.irfft(np.fft.rfft(source)*np.fft.rfft(impulse),n=n)
    mix=pcm+wet*.24;mix-=mix.mean(axis=0);mix*=min(1,.86/np.max(np.abs(mix)))
    mix[-96:]-=(mix[-1]-mix[0])*(.5-.5*np.cos(np.linspace(0,np.pi,96)))[:,None]
    sf.write(wav,mix,sr,subtype='PCM_24')
    for ext in ['mp3','ogg']:
        args=['ffmpeg','-v','error','-y','-i',str(wav)]
        args+=['-c:a','libmp3lame','-b:a','256k'] if ext=='mp3' else ['-c:a','libvorbis','-q:a','6']
        subprocess.run(args+['-metadata','title=霜窗回声 · 第五版',str(wav.with_suffix('.'+ext))],check=True)
    for f in report['files']:
        p=ROOT/f['path'];f.update({'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()})
    report.update({'scope':'Only first/title audition candidate','bars':32,'bpm':84,'form':'8-bar A / same A with soft strings / 8-bar B / clear A return','authored_note_events':s.note_events,'native_expression_tracks':s.expression_curves,'peak_dbfs':float(20*np.log10(np.max(np.abs(mix)))),'rms_dbfs':float(20*np.log10(np.sqrt(np.mean(mix*mix)))),'listener_status':'Needs user listening; no musical-quality score claim'})
    for name in ['render-report.json','01-title-frostglass-v5-report.json']:(OUT/name).write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')

if __name__=='__main__':
    s=compose();report=engine.execute(s);master(report)
    print(json.dumps({'seconds':report['seconds'],'musical_goal':'one continuous intelligible piano melody, quiet accompaniment'},ensure_ascii=True),flush=True)
