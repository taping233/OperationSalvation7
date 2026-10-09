"""Four score-level refinements. Render isolated parts; never add to the old mix."""
import pathlib,json,hashlib,importlib.util,subprocess
import numpy as np
import soundfile as sf
from scipy.signal import butter,sosfilt
OUT=pathlib.Path(__file__).resolve().parent;ROOT=OUT.parents[2]
SR=48000;N=SR*30
spec=importlib.util.spec_from_file_location('fluid',OUT.parent/'2026-10-05-WF-music-title-v6/fluid_engine.py')
fluid=importlib.util.module_from_spec(spec);spec.loader.exec_module(fluid)
RNG=np.random.default_rng(100911)
CORE=OUT.parent/'2026-10-05-WF-music-piano-two-hands'
HARMONY={
 'explore':[[50,57,62,65,76],[46,57,62,65,69],[41,53,57,60,67],[48,55,60,64,69],[43,55,58,62,69],[46,53,58,62,69],[45,57,61,64,67],[50,57,62,65,74]],
 'battle':[[40,52,55,59,66],[36,52,55,60,64],[38,50,54,57,64],[35,51,54,57,63],[33,52,57,60,64],[36,52,55,60,67],[38,50,55,59,64],[35,51,54,57,65]]}
NAMES={'title':'霜窗回声 · 暗流精修','explore':'灰线行军 · 动机精修','battle':'黑脉交锋 · 节奏精修','shop':'灯下交易 · 问答精修'}

def rms(x):return float(np.sqrt(np.mean(x.astype(np.float64)**2)))
def fp(p):return dict(path=p.relative_to(ROOT).as_posix(),bytes=p.stat().st_size,sha256=hashlib.sha256(p.read_bytes()).hexdigest())
def filt(x,hz,kind='lowpass'):return sosfilt(butter(2,hz,btype=kind,fs=SR,output='sos'),x,axis=0)
def space(x,wet):
    y=x.copy()
    for delay,gain in [(.031,.15),(.067,.12),(.127,.095),(.211,.07),(.347,.045),(.563,.025),(.809,.016)]:
        k=round(delay*SR);y[k:]+=filt(x[:-k,::-1],4300)*gain*wet
    return y

class Cue:
    def __init__(self,role,bpm):
        self.role=role;self.bpm=bpm;self.bs=60/bpm;self.total=30/self.bs
        self.parts={};self.notes=[];self.fixed={};self.source=[];self.shape={}
    def part(self,name,patch,db,pan=0,bank=0,wet=.45,hz=6500):
        self.parts[name]=dict(patch=patch,db=db,pan=pan,bank=bank,wet=wet,hz=hz)
    def note(self,name,b,key,d,v,human=.010):
        if b>=self.total-.1:return
        # Phrase-level timing rather than random pitch or automatic chord decoration.
        delay=float(RNG.uniform(-human,human)) if b>0 else 0
        self.notes.append(dict(part=name,beat=round(max(0,b+delay),5),key=int(key),duration=min(d,self.total+.5-b),velocity=int(np.clip(v,1,115))))
    def fixed_melody(self,name,source_name,db,pan):
        report=json.loads((CORE/(self.role+'-render-report.json')).read_text(encoding='utf-8'))
        row=next(x for x in report['tracks'] if x['name']==source_name)
        path=ROOT/row['frozen_stem']['path'];pcm,sr=sf.read(path,dtype='float32',always_2d=True,frames=N)
        if sr!=SR or len(pcm)!=N:raise ValueError('Existing melodic stem format changed')
        self.source.append(fp(path));self.part(name,0,db,pan,wet=.60,hz=7200);self.fixed[name]=pcm
    def finish(self):
        stems={};rows=[]
        for name,options in self.parts.items():
            ns=[n for n in self.notes if n['part']==name]
            if name in self.fixed:pcm=self.fixed[name].copy()
            else:
                ev=[]
                for n in ns:
                    ev += [(round(n['beat']*self.bs*SR),2,'on',n['key'],n['velocity']),
                           (round((n['beat']+n['duration'])*self.bs*SR),1,'off',n['key'],0)]
                # Give sustained wind/bow notes a breath/swell, unlike fixed velocity blocks.
                if options['patch'] in [40,41,42,60,68,71]:
                    for n in ns:
                        if n['duration']>1.2:
                            for q,value in [(0,86),(.22,104),(.72,99),(.94,78)]:
                                ev.append((round((n['beat']+n['duration']*q)*self.bs*SR),0,'cc',11,value))
                if options['patch'] in [0,4] and name not in self.fixed:
                    for b in np.arange(0,self.total,4):
                        ev.extend([(round(b*self.bs*SR),0,'cc',64,80),(round((b+3.65)*self.bs*SR),0,'cc',64,0)])
                pcm=fluid.render(ev,32,bank=options['bank'],patch=options['patch'])[:N]
            pcm=filt(pcm,options['hz'])
            pcm=filt(pcm,33 if 'bass' in name.lower() else 100,'highpass')
            if options['patch'] not in [32,43] and options['bank']!=128:
                # Keep a little room around the piano's lower midrange.
                mid=filt(pcm,[250,650],'bandpass');pcm-=mid*(.18 if self.role=='title' else .11)
            pcm=space(pcm,options['wet'])
            pcm*=np.array([np.sqrt(1-options['pan']),np.sqrt(1+options['pan'])])[None,:]
            active=np.max(np.abs(pcm),axis=1)>.00008
            pcm*=10**(options['db']/20)/max(rms(pcm[active]) if active.any() else 1,1e-9)
            if name in self.shape:
                points=self.shape[name];timeline=np.arange(N)/SR/self.bs
                pcm*=np.interp(timeline,[x[0] for x in points],[x[1] for x in points])[:,None]
            stems[name]=pcm;rows.append(dict(name=name,note_count=len(ns),retained_melodic_recording=name in self.fixed,**options))
        mix=sum(stems.values());mix=filt(mix,28,'highpass')
        mix-=mix.mean(axis=0)
        # One gentle master stage; no sidechain pumping.
        mix=np.tanh(mix*1.12)/1.12
        target={'title':-21.5,'explore':-20.5,'battle':-18.5,'shop':-20.5}[self.role]
        mix*=min(10**(target/20)/max(rms(mix),1e-9),.84/max(np.abs(mix).max(),1e-9))
        mix[:round(SR*.06)]*=np.linspace(0,1,round(SR*.06))[:,None]
        mix[-round(SR*.85):]*=np.cos(np.linspace(0,np.pi/2,round(SR*.85)))[:,None]
        wav=OUT/(self.role+'-refined-30s.wav');sf.write(wav,mix,SR,subtype='PCM_24')
        mp3=wav.with_suffix('.mp3')
        subprocess.run(['ffmpeg','-v','error','-y','-i',str(wav),'-c:a','libmp3lame','-b:a','256k','-metadata','title='+NAMES[self.role],str(mp3)],check=True)
        data=dict(role=self.role,title=NAMES[self.role],bpm=self.bpm,seconds=len(mix)/SR,parts=rows,notes=self.notes,shapes=self.shape,source=self.source,files=[fp(wav),fp(mp3)],peak_dbfs=float(20*np.log10(np.abs(mix).max())),rms_dbfs=float(20*np.log10(rms(mix))))
        (OUT/(self.role+'-score.json')).write_text(json.dumps(data,ensure_ascii=False,indent=2),encoding='utf-8')
        return data

def title():
    c=Cue('title',84)
    c.fixed_melody('Piano original melody','Piano right hand',-25,-.07)
    c.part('Piano open support',0,-35,.18,wet=.40)
    c.part('Cello undercurrent',42,-34,-.23,wet=.5,hz=4100)
    c.part('Suspended viola',41,-37,.25,wet=.6,hz=4800)
    c.part('Quiet electric colour',4,-40,.32,wet=.65,hz=4500)
    c.part('Harp punctuation',46,-43,-.36,wet=.65)
    # Bass-led harmony changes: Cm9 / Abmaj9 / Fm9 / Gsus4 -> G7 / Cm9.
    blocks=[(0,[48,55,63,74]),(8,[44,55,60,70]),(16,[41,48,56,67]),
            (24,[43,50,60,65]),(32,[48,55,63,74]),(40,[48,55,60,63])]
    for b,ch in blocks:
        for off,key,d,v in [(0,ch[0],3.5,38),(2.15,ch[1],3.6,30),(4.1,ch[0]+12,3.3,33),(6.2,ch[2],2.3,28)]:
            c.note('Piano open support',b+off,key,d,v)
        c.note('Quiet electric colour',b+.55,ch[2],7.2,27)
        # One moving line below the melody, not five simultaneous countermelodies.
        lines={0:[48,47,46,44],8:[44,43,41,40],16:[41,43,44,46],24:[43,50,53,47],32:[48,46,44,43],40:[48]}
        for j,key in enumerate(lines[b]):c.note('Cello undercurrent',b+j*2+.08,key,2.05,38 if j==0 else 33)
        if b in [8,24,32]:
            for off,key,d in [(1,ch[2]-12,3.1),(4.7,ch[1],3.0)]:c.note('Suspended viola',b+off,key,d,32)
        if b in [0,16,32]:c.note('Harp punctuation',b+6.5,ch[3],2.1,27)
    # Suspended C over G resolves to B late, then C minor returns at beat32.
    c.note('Suspended viola',27.4,60,3.0,35)
    c.note('Suspended viola',30.55,59,1.3,32)
    c.note('Suspended viola',32.05,60,5.8,31)
    return c

def explore():
    c=Cue('explore',112)
    c.part('Piano path melody',0,-25,-.08,wet=.42)
    c.part('Clarinet phrase answer',71,-27,.15,wet=.45)
    c.part('Nylon recurring cell',24,-32,-.32,wet=.22)
    c.part('Cello route',42,-36,.25,wet=.35)
    c.part('Acoustic bass foundation',32,-35,0,wet=.10,hz=2300)
    c.part('Vibraphone signpost',11,-40,.33,wet=.65)
    source=json.loads((CORE/'explore-score.json').read_text(encoding='utf-8'))
    lead=source['tracks']['Piano right hand']['notes']
    for n in lead:
        b=n['beat']
        if b>=c.total:break
        block=int(b//8)
        # Complete phrases change hands: the piano and wind never compete as leads.
        wind=block in [1,4]
        name='Clarinet phrase answer' if wind else 'Piano path melody'
        key=n['midi']+(12 if wind else 0)
        c.note(name,b+.07,key,1.65 if wind else min(1.92,n['length']),n['velocity']-5 if wind else n['velocity'],human=.006)
    for block,b in enumerate(np.arange(0,c.total,8)):
        ch=HARMONY['explore'][block%8]
        # Identifiable three-note cell, with a longer answer and one clearing.
        for j,(off,ix,d) in enumerate([(0.25,1,.8),(1.1,2,.7),(1.9,3,1.5),(4.5,1,.75),(5.4,3,1.8)]):
            if block==3 and j>1:continue
            c.note('Nylon recurring cell',b+off,ch[ix],d,42 if j==0 else 32+j)
        c.note('Acoustic bass foundation',b,ch[0]-12,3.6,45)
        c.note('Acoustic bass foundation',b+4,ch[1]-12,3.5,37)
        if block in [2,4,5]:
            c.note('Cello route',b+.2,ch[0],3.5,34)
            c.note('Cello route',b+4.4,ch[3]-12,3.1,31)
        if block in [0,3,6]:c.note('Vibraphone signpost',b+6.85,ch[-1],1.7,29)
    return c

def battle():
    c=Cue('battle',124)
    c.part('Violin retained challenge',40,-23,-.17,wet=.45)
    c.part('Horn actual reply',60,-26,.2,wet=.32)
    c.part('Cello unified motor',42,-30,-.23,wet=.18,hz=4300)
    c.part('Stable low bass',43,-32,0,wet=.15,hz=2200)
    c.part('Drum centre',0,-32,.03,bank=128,wet=.05)
    c.part('String harmony bridge',49,-36,.33,wet=.55,hz=5100)
    c.part('Timpani transitions only',47,-34,.14,wet=.22,hz=3600)
    source=json.loads((CORE/'battle-score.json').read_text(encoding='utf-8'))
    lead=source['tracks']['Violin sung challenge']['notes']
    for n in lead:
        b=n['beat']
        if b>=c.total:break
        reply=12<=b<16 or 28<=b<32 or 44<=b<48
        name='Horn actual reply' if reply else 'Violin retained challenge'
        c.note(name,b+.03,n['midi'],min(n['length'],1.76 if reply else 2.0),n['velocity']+6 if reply else n['velocity']+3,human=.004)
    for block,b in enumerate(np.arange(0,c.total,8)):
        ch=HARMONY['battle'][block%8]
        for bar in [0,4]:
            # Cello and kick share three attacks; snare stays in a clear backbeat.
            hits=[0,1.5,2.5] if block!=4 else [0,2.5]
            for j,off in enumerate(hits):
                c.note('Cello unified motor',b+bar+off,ch[0]+(12 if j==2 else 0),.62,58 if j==0 else 43)
                c.note('Drum centre',b+bar+off,36,.23,63 if j==0 else 46,human=0)
            for off in [1,3]:c.note('Drum centre',b+bar+off,38,.20,48,human=0)
            for i in range(8):
                if block==4 and i%2:continue
                c.note('Drum centre',b+bar+i*.5,42,.12,23 if i%2 else 31,human=0)
            c.note('Stable low bass',b+bar,ch[0]-12,3.6,42)
        c.note('String harmony bridge',b+.12,ch[2],7.8,35)
        if block in [2,5,7]:
            for off,key,d,v in [(6.5,ch[0],.7,35),(7.25,ch[1]-12,.55,44),(7.75,ch[0],.42,51)]:c.note('Timpani transitions only',b+off,key,d,v)
    # Brief release keeps the existing phrase moving; no additional accent layer.
    c.shape['Cello unified motor']=[(0,.85),(24,1),(32,1),(34,.62),(38,.62),(40,1.08),(62,1)]
    c.shape['Drum centre']=[(0,.9),(24,1),(32,1),(34,.72),(38,.72),(40,1.05),(62,1)]
    return c

def shop():
    c=Cue('shop',96)
    c.part('Piano short hook',0,-23.5,-.12,wet=.28)
    c.part('Muted horn takes lead',59,-25.5,.13,wet=.3)
    c.part('Guitar sparse comping',26,-34,.33,wet=.18)
    c.part('Acoustic bass coherent walk',32,-28,0,wet=.08,hz=2700)
    c.part('Brush-kit groove',40,-38,-.07,bank=128,wet=.05)
    c.part('Vibraphone rare punctuation',11,-40,-.3,wet=.5)
    previous=json.loads((OUT.parent/'2026-10-09-WF-shop-remake/score.json').read_text(encoding='utf-8'))
    # Keep the new merchant hook, but correct comping, bass range and the final cadence.
    for n in previous['events']:
        if n['track']=='piano-hook':
            b=n['beat'];d=min(n['length'],.7 if 16<=b<32 else n['length'])
            v=n['velocity']-(5 if 16<=b<32 else 0)
            c.note('Piano short hook',b,n['key'],d,v,human=.015)
        elif n['track']=='muted-horn':
            b=n['beat']
            # Remove interjections over the piano ending; horn is sole lead in B.
            if 16<=b<32:c.note('Muted horn takes lead',b,n['key'],n['length']*.92,n['velocity']+1,human=.017)
    chordlist=[(36,[51,57,62]),(36,[51,57,62]),(37,[53,59,63]),(31,[53,59,62]),
               (29,[51,55,60]),(34,[50,56,60]),(39,[50,55,58]),(31,[53,59,63]),
               (36,[51,57,62]),(32,[55,58,60]),(31,[53,56,60]),(31,[53,59,62])]
    for bar,(root,ch) in enumerate(chordlist):
        b=bar*4;nextroot=chordlist[(bar+1)%12][0]
        while nextroot-root>7:nextroot-=12
        while root-nextroot>7:nextroot+=12
        # A playable bass line: root, nearest chord tone, fifth, one approach note.
        fifth=root+7
        if fifth>43:fifth-=12
        third=root+(3 if bar in [0,1,4,8,10] else 4)
        if third>43:third-=12
        approach=nextroot+(1 if root>=nextroot else -1)
        line=[root,third,fifth,approach]
        if bar==11:line=[31,35,36,36]
        for j,key in enumerate(line):
            c.note('Acoustic bass coherent walk',b+j,key,.85 if j<3 else .66,[62,45,52,40][j],human=.008)
        comp=[(.65,36),(2.68,33)] if bar not in [3,7,11] else [(1.65,35)]
        for off,v in comp:
            for j,key in enumerate(ch):c.note('Guitar sparse comping',b+off+j*.018,key,.45,v,human=.006)
        if bar==11:
            for j,key in enumerate([51,57,62]):c.note('Guitar sparse comping',46.18+j*.018,key,1.7,36)
        for off in [0,2]:c.note('Brush-kit groove',b+off,38,.31,28,human=.005)
        for i in range(4):c.note('Brush-kit groove',b+i+.64,51,.12,20+(3 if i==2 else 0),human=.006)
    for b,key in [(7.1,79),(31.2,74),(46.7,79)]:c.note('Vibraphone rare punctuation',b,key,1.0,27)
    return c

if __name__=='__main__':
    report=[]
    for factory in [title,explore,battle,shop]:
        cue=factory();r=cue.finish();report.append({k:v for k,v in r.items() if k not in ['notes']})
        print(json.dumps(dict(role=cue.role,seconds=r['seconds'],parts=len(r['parts']),files=[x['path'] for x in r['files']]),ensure_ascii=True),flush=True)
    (OUT/'render-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
