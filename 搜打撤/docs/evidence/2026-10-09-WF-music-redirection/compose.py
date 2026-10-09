"""Three new drafts + retained merchant draft. Native samples and original scores."""
import pathlib,json,hashlib,subprocess,importlib.util,urllib.request,urllib.parse,concurrent.futures,sys
import numpy as np
import soundfile as sf
from scipy.signal import butter,sosfilt,sosfiltfilt
OUT=pathlib.Path(__file__).resolve().parent;ROOT=OUT.parents[2];SR=48000;N=SR*30
SAMPLES=ROOT/'.tmp/salamander-title-1009';SAMPLES.mkdir(exist_ok=True)
BASE='https://raw.githubusercontent.com/sfzinstruments/SalamanderGrandPiano/master/'
spec=importlib.util.spec_from_file_location('fluid',OUT.parent/'2026-10-05-WF-music-title-v6/fluid_engine.py')
fluid=importlib.util.module_from_spec(spec);spec.loader.exec_module(fluid)
RNG=np.random.default_rng(109711)
def filt(x,hz,kind='lowpass'):return sosfilt(butter(2,hz,btype=kind,fs=SR,output='sos'),x,axis=0)
def rms(x):return float(np.sqrt(np.mean(x.astype(np.float64)**2)))
def fp(p):return dict(path=p.relative_to(ROOT).as_posix(),bytes=p.stat().st_size,sha256=hashlib.sha256(p.read_bytes()).hexdigest())
def room(x,wet):
    y=x.copy()
    for delay,gain in [(.039,.16),(.083,.12),(.151,.095),(.269,.07),(.431,.05),(.683,.032),(1.019,.016)]:
        k=round(delay*SR);y[k:]+=filt(x[:-k,::-1],4600)*gain*wet
    return y
def sample_id(key,v):
    root=round((key-21)/3)*3+21;name=['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'][root%12]+str(root//12-1)
    layer=2 if v<=34 else 4 if v<=43 else 7 if v<=56 else 8
    return root,name+'v'+str(layer)+'.flac'
def get_samples(notes):
    files=sorted(set(sample_id(n['key'],n['velocity'])[1] for n in notes));records=[]
    def fetch(name):
        url=BASE+'Samples/'+urllib.parse.quote(name,safe='');p=SAMPLES/name
        if not p.exists():p.write_bytes(urllib.request.urlopen(url,timeout=45).read())
        return dict(name=name,url=url,**fp(p))
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
        for row in pool.map(fetch,files):records.append(row)
    (OUT/'piano-samples.json').write_text(json.dumps(dict(author='Alexander Holm',library='Salamander Grand Piano V3',license='CC BY 3.0',source=BASE,usage='subset custom offline playback; not a full SFZ/ARIA implementation',samples=records),ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps(dict(stage='piano-assets',samples=len(records),bytes=sum(r['bytes'] for r in records))),flush=True)
def piano_pcm(notes,seconds):
    get_samples(notes);cache={};out=np.zeros((N,2));ordered=sorted(notes,key=lambda n:n['start'])
    for n in ordered:
        root,name=sample_id(n['key'],n['velocity'])
        if name not in cache:
            x,sr=sf.read(SAMPLES/name,dtype='float32',always_2d=True)
            if sr!=SR:raise ValueError('Sample rate mismatch')
            onset=np.flatnonzero(np.max(np.abs(x[:SR//5]),axis=1)>np.max(np.abs(x))*.002)
            trim=min(int(onset[0]) if len(onset) else 0,SR//10);cache[name]=x[trim:SR*10]
        x=cache[name];speed=2**((n['key']-root)/12)
        changes=[0,4,8,12,16,20,24,28,30,36]
        next_change=next(b for b in changes if b>n['beat']+.001)
        sustain=max(n['duration'],next_change*seconds-n['start']-.075)
        # Repeated keys stop the preceding sampled voice with a short release.
        following=[q['start'] for q in ordered if q['key']==n['key'] and q['start']>n['start']+.025]
        if following:sustain=min(sustain,min(following)-n['start']+.03)
        dur=min(sustain+.42,30-n['start']);length=max(0,round(dur*SR))
        indices=np.arange(length)*speed;indices=np.minimum(indices,len(x)-1)
        y=np.stack([np.interp(indices,np.arange(len(x)),x[:,ch]) for ch in range(2)],axis=1)
        env=np.ones(length);release=round(max(0,sustain)*SR)
        if release<length:env[release:]=np.exp(-np.arange(length-release)/SR*11)
        y*=env[:,None]*(n['velocity']/64)**1.35
        start=round(n['start']*SR);l=min(length,N-start)
        if l>0:out[start:start+l]+=y[:l]
    return out

class Cue:
    def __init__(self,role,bpm):self.role=role;self.bpm=bpm;self.bs=60/bpm;self.notes=[];self.parts={};self.shapes={};self.section_edges=[]
    def part(self,name,patch,target,pan=0,kind='fluid',wet=.4):self.parts[name]=dict(patch=patch,target=target,pan=pan,kind=kind,wet=wet)
    def note(self,part,beat,key,d,v,hand=None):
        if beat*self.bs>=29.8:return
        delay=0
        if self.role=='title':delay=float(np.interp(beat,[0,4,8,12,16,20,24,28,32],[0,.035,.09,.03,.02,.095,.02,.075,.02]))
        else:delay=float(RNG.uniform(-.009,.009))
        self.notes.append(dict(part=part,beat=beat,start=max(0,beat*self.bs+delay),key=int(key),duration=d*self.bs,velocity=int(v),hand=hand))
    def native(self,notes,kind):
        pcm=np.zeros((N,2))
        for n in notes:
            dur=n['duration']+.25;t=np.arange(round(dur*SR))/SR;f=440*2**((n['key']-69)/12)
            ph=2*np.pi*f*t
            if kind=='air':
                y=sum(np.sin(ph*d+i*.4) for i,d in enumerate([.998,1.002,2.001]))/3
                env=np.minimum(t/.45,1)*np.minimum(np.maximum(dur-t,0)/.7,1)
            elif kind=='sub':
                y=np.sin(ph)+.18*np.sin(ph*2);env=np.minimum(t/.005,1)*np.minimum(np.maximum(dur-t,0)/.08,1)*np.exp(-t*.7)
            else:
                y=np.sin(ph+1.6*np.exp(-t*3)*np.sin(ph*2))+.15*np.sin(ph*3)
                env=np.minimum(t/.012,1)*np.minimum(np.maximum(dur-t,0)/.15,1)*np.exp(-t*.9)
            y=y*env*(n['velocity']/70);start=round(n['start']*SR);l=min(len(y),N-start)
            if l>0:pcm[start:start+l]+=y[:l,None]*np.array([.71,.71])[None,:]
        return pcm
    def render(self):
        stems={}
        for name,opt in self.parts.items():
            notes=[n for n in self.notes if n['part']==name]
            if opt['kind']=='piano':x=piano_pcm(notes,self.bs)
            elif opt['kind'] in ['air','sub','fm']:x=self.native(notes,opt['kind'])
            else:
                ev=[]
                for n in notes:ev += [(round(n['start']*SR),2,'on',n['key'],n['velocity']),(round((n['start']+n['duration'])*SR),1,'off',n['key'],0)]
                x=fluid.render(ev,32,bank=128 if opt['kind']=='drums' else 0,patch=opt['patch'])[:N]
            if 'guitar drive' in name:x=np.tanh(filt(x,150,'highpass')*2.7);x=filt(x,4700)
            x=room(filt(x,7600 if opt['kind']=='piano' else 6800),opt['wet'])
            x*=np.array([np.sqrt(1-opt['pan']),np.sqrt(1+opt['pan'])])[None,:]
            active=np.max(np.abs(x),axis=1)>.00006
            x*=10**(opt['target']/20)/max(rms(x[active]) if active.any() else 1,1e-9)
            if name in self.shapes:
                pts=self.shapes[name];x*=np.interp(np.arange(N)/SR,[p[0] for p in pts],[p[1] for p in pts])[:,None]
            stems[name]=x
        # Keep sub-120Hz energy mono; retain the natural width above it.
        mix=sum(stems.values())
        if self.role=='title':
            mid=mix.mean(axis=1);side=(mix[:,0]-mix[:,1])/2
            side=sosfiltfilt(butter(4,180,btype='highpass',fs=SR,output='sos'),side)
            mix=np.stack([mid+side,mid-side],axis=1)
        else:
            low=filt(mix,120);mix-=low;mix+=low.mean(axis=1)[:,None]
        mix=filt(mix,27,'highpass');mix-=mix.mean(axis=0)
        target={'title':-23,'explore':-21,'battle':-18}[self.role]
        mix*=min(10**(target/20)/max(rms(mix),1e-9),.84/max(np.abs(mix).max(),1e-9))
        mix[:round(SR*.04)]*=np.linspace(0,1,round(SR*.04))[:,None]
        mix[-round(SR*.8):]*=np.cos(np.linspace(0,np.pi/2,round(SR*.8)))[:,None]
        wav=OUT/(self.role+'-rewrite-30s.wav');sf.write(wav,mix,SR,subtype='PCM_24')
        mp3=wav.with_suffix('.mp3');subprocess.run(['ffmpeg','-v','error','-y','-i',str(wav),'-c:a','libmp3lame','-b:a','256k',str(mp3)],check=True)
        active_parts=[]
        for a,b in zip(self.section_edges[:-1],self.section_edges[1:]):
            active_parts.append(dict(start=a,end=b,parts=[name for name,x in stems.items() if rms(x[round(a*SR):round(b*SR)])>.001]))
        result=dict(role=self.role,bpm=self.bpm,notes=self.notes,parts=self.parts,sections=active_parts,files=[fp(wav),fp(mp3)],stems_rms={k:rms(v) for k,v in stems.items()})
        (OUT/(self.role+'-score.json')).write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
        print(json.dumps(dict(role=self.role,stage='rendered',parts=len(stems),notes=len(self.notes))),flush=True)
        return result

def title():
    c=Cue('title',72);c.section_edges=[0,6.7,13.3,20,29]
    c.part('Piano two hands',0,-25,kind='piano',wet=.5)
    c.part('Quiet air harmony',0,-40,kind='air',wet=.55)
    # Theme tendency is familiar; rhythm, accompaniment and performance are rewritten.
    phrase=[(0,67,1.25,58),(1.5,63,.43,48),(2.13,65,.57,52),(3,67,.84,55),
            (4.15,72,1.58,61),(6,70,.56,48),(6.88,67,1.04,52),
            (8.1,68,1.38,56),(9.63,67,.62,47),(10.55,63,1.15,49),
            (12,65,.9,53),(13.12,67,.55,55),(14,72,1.77,58),
            (16.1,75,1.2,60),(17.55,72,.5,50),(18.24,70,.55,48),(19.05,68,.85,52),
            (20.1,67,1.25,55),(21.7,65,.55,47),(22.42,63,1.23,49),
            (24.1,62,.9,51),(25.2,65,.54,53),(26.07,67,1.3,57),
            (28.15,67,.56,50),(29.12,71,.68,51),(30.25,72,5.2,56)]
    for b,key,d,v in phrase:c.note('Piano two hands',b,key,d,v,'right')
    # Rolled upper thirds/sixths, not mechanically doubled parallel thirds.
    for b,keys in [(4.18,[63,67]),(14.03,[65,68]),(16.13,[68,72]),(26.1,[59,62]),(30.3,[63,67])]:
        for j,key in enumerate(keys):c.note('Piano two hands',b+j*.042,key,.78,36+j*2,'right')
    harmonies=[(0,36,[51,55],62),(4,36,[51,55],60),(8,32,[51,55],58),(12,32,[48,55],60),
               (16,29,[48,56],60),(20,29,[48,55],56),(24,31,[53,60],62),(28,31,[53,59],62),(30,36,[51,55],60)]
    for b,root,keys,upper in harmonies:
        c.note('Piano two hands',b+.025,root,.42,36,'left')
        c.note('Piano two hands',b+.82,root+12,.5,29,'left')
        for j,key in enumerate(keys):c.note('Piano two hands',b+1.5+j*.035,key,.4 if b==28 else 1.1,31-j*2,'left')
        if b<28:c.note('Piano two hands',b+3.05,upper,.59,28,'left')
        c.note('Quiet air harmony',b+.2,keys[0],6.0 if b==30 else 3.9,35)
    return c

def explore():
    c=Cue('explore',100);c.section_edges=[0,4.8,14.4,19.2,24,29]
    for args in [('Clean guitar journey',27,-25,-.15,'fluid',.48),('Rhodes landscape',4,-33,.28,'fluid',.55),('Soft bass',33,-30,0,'fluid',.12),('Air distance',0,-39,.3,'air',.65),('Quiet beat',0,-38,0,'drums',.06)]:c.part(*args)
    chordlist=[(38,[53,57,60,64]),(34,[53,57,60,62]),(31,[53,57,58,62]),(33,[55,58,62,64]),(29,[52,55,57,60]),(28,[50,55,60,64]),(39,[55,58,62,65]),(33,[55,58,61,64]),(38,[53,57,60,64]),(34,[53,57,60,62]),(31,[53,57,58,62]),(38,[53,57,60,64])]
    melody={0:[(.25,69,1.0),(1.5,74,1.3),(3.1,72,.6)],1:[(.3,65,1.8),(2.5,69,1.2)],2:[(.2,70,1.05),(1.6,69,.65),(2.5,67,1.0)],3:[(.4,64,1.5),(2.2,61,.7),(3.1,64,.6)],4:[(.3,69,1.1),(1.8,72,1.6)],5:[(.3,67,2.1),(2.9,64,.7)],6:[(.25,70,1.1),(1.75,74,1.4)],7:[(.4,73,1.2),(2,69,1.1)],8:[(.25,69,.7),(1.3,74,1.3),(3,76,.7)],9:[(.3,77,1.6),(2.4,74,1.0)],10:[(.2,70,1.3),(1.8,69,.8),(3,67,.6)],11:[(.3,65,.8),(1.6,62,2.8)]}
    for bar,(root,ch) in enumerate(chordlist):
        b=bar*4
        for j,key in enumerate(ch):c.note('Rhodes landscape',b+.15+j*.037,key,3.9,37+j)
        c.note('Air distance',b,ch[2],4.3,31)
        for off,key,d in melody[bar]:c.note('Clean guitar journey',b+off,key,d,63 if off<1 else 53)
        if 2<=bar<8 or bar>=10:
            for off,key,d in [(0,root,.85),(1.65,root,.4),(2.75,root+7,.62)]:c.note('Soft bass',b+off,key,d,53 if off==0 else 42)
            for off,key,v in [(0,36,42),(2,38,29),(2.75,36,31),(3.5,42,21)]:c.note('Quiet beat',b+off,key,.18,v)
    return c

def battle():
    c=Cue('battle',128);c.section_edges=[0,7.5,15,18.75,22.5,29]
    for args in [('Electric guitar drive',30,-26,-.23,'fluid',.12),('Finger bass',34,-28,0,'fluid',.08),('Drum groove',0,-27,.02,'drums',.06),('FM hook',0,-24,.08,'fm',.28),('Keyboard stabs',5,-34,.3,'fluid',.24)]:c.part(*args)
    roots=[40,40,36,36,38,38,35,35,40,40,36,36,38,38,35,40]
    for bar,root in enumerate(roots):
        b=bar*4;breakdown=8<=bar<10
        riff=[(0,.45),(.75,.23),(1.5,.4),(2.5,.25),(3.25,.42)] if not breakdown else [(0,1.3),(2.5,.6)]
        for off,d in riff:
            for key in [root+12,root+19]:c.note('Electric guitar drive',b+off,key,d,68 if off==0 else 51)
            c.note('Finger bass',b+off,root-12,d+.1,74 if off==0 else 56)
        for off,key,v in [(0,36,78),(1.5,36,58),(1,38,66),(3,38,69)]:
            if breakdown and off==1.5:continue
            c.note('Drum groove',b+off,key,.2,v)
        for i in range(8):
            if breakdown and i%2:continue
            c.note('Drum groove',b+i*.5,42,.12,34 if i%2 else 44)
        if bar in [0,4,10,14]:c.note('Drum groove',b,49,1.1,51)
        if bar in [3,7,13]:
            for j,off in enumerate([3.25,3.5,3.75]):c.note('Drum groove',b+off,45 if j<2 else 38,.17,44+j*7)
        if bar in [1,3,5,7,11,13,15]:
            for key in [root+12,root+15,root+22]:c.note('Keyboard stabs',b+2.25,key,.43,51)
    motif=[(0,76,.48),( .75,79,.24),(1.3,78,.42),(2.1,74,.65),(3.2,71,.4),(4.25,74,.48),(5.2,76,.7),(6.5,71,.55)]
    for phrase,b in enumerate([0,8,16,24,40,48,56]):
        for off,key,d in motif:
            shift=0 if phrase in [0,1,4] else -4 if phrase in [2,5] else -1
            c.note('FM hook',b+off,key+shift,d,67 if off in [0,4.25] else 56)
    return c

if __name__=='__main__':
    requested=set(sys.argv[1:]) or {'title','explore','battle'}
    if not requested <= {'title','explore','battle'}:raise ValueError('Unknown cue')
    existing=json.loads((OUT/'render-report.json').read_text(encoding='utf-8')) if (OUT/'render-report.json').exists() else []
    report=[r for r in existing if r['role'] not in requested and r['role']!='shop']
    for factory in [title,explore,battle]:
        if factory.__name__ in requested:report.append(factory().render())
    previous=json.loads((OUT.parent/'2026-10-09-WF-shop-remake/render-report.json').read_text(encoding='utf-8'))
    report.append(dict(role='shop',retained_unchanged=True,files=previous['files']))
    (OUT/'render-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
