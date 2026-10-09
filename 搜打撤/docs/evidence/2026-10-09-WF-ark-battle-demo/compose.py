"""New cold electronic tactical cue. No copied game audio/melody."""
import pathlib,json,hashlib,subprocess
import numpy as np
import soundfile as sf
from scipy.signal import butter,sosfilt,sosfiltfilt
OUT=pathlib.Path(__file__).resolve().parent;ROOT=OUT.parents[2]
SR=48000;BPM=120;BEAT=60/BPM;N=SR*30;RNG=np.random.default_rng(109697658)
stems={};notes=[]
def filt(x,hz,kind='lowpass'):return sosfilt(butter(2,hz,btype=kind,fs=SR,output='sos'),x,axis=0)
def env(t,d,a=.008,r=.08):return np.minimum(t/a,1)*np.minimum(np.maximum(d-t,0)/r,1)
def add(name,x,b,gain=1,pan=0):
    if name not in stems:stems[name]=np.zeros((N,2),np.float32)
    start=round(b*BEAT*SR);length=min(len(x),N-start)
    if length<=0:return
    if x.ndim==1:x=x[:,None]*np.array([np.sqrt((1-pan)/2),np.sqrt((1+pan)/2)])[None,:]
    stems[name][start:start+length]+=x[:length]*gain
def tone(key,d,kind):
    seconds=d*BEAT;t=np.arange(round(seconds*SR))/SR;f=440*2**((key-69)/12);ph=2*np.pi*f*t
    if kind=='pressure':
        harmonics=sum(np.sin(ph*k)/(k**1.25) for k in range(1,9))
        y=np.tanh(filt(harmonics,1000)*1.7)*.42+.48*np.sin(ph/2)
        return y*env(t,seconds,.007,.09)*np.exp(-t*.7)
    if kind=='signal':
        y=np.sin(ph+.9*np.exp(-t*4)*np.sin(ph*2))
        y+=.16*np.sin(ph*1.003)+.16*np.sin(ph*.997)+.10*np.sin(ph*3)*np.exp(-t*8)
        return filt(y,2700)*env(t,seconds,.014,.15)*np.exp(-t*.8)
    if kind=='mechanical':
        y=np.sin(ph+1.8*np.exp(-t*12)*np.sin(ph*1.997))+.11*np.sin(ph*3.008)
        return filt(y,2200)*env(t,seconds,.003,.08)*np.exp(-t*5)
    y=sum(np.sin(ph*d+i*.4)*w for i,(d,w) in enumerate([(1,.5),(.998,.25),(1.002,.25),(2,.06)]))
    return filt(y,1000)*env(t,seconds,.35,.7)
def note(name,key,b,d,gain,pan=0,kind=None):
    notes.append(dict(track=name,key=key,beat=b,length=d,gain=gain,voice=kind or name))
    add(name,tone(key,d,kind or name),b,gain,pan)
def drum(kind):
    dur={'kick':.42,'snare':.19,'hat':.055,'metal':.16,'impact':1.15}[kind]
    t=np.arange(round(dur*SR))/SR;noise=RNG.normal(0,.4,len(t))
    if kind=='kick':
        ph=2*np.pi*(48*t+80*.028*(1-np.exp(-t/.028)))
        x=np.sin(ph)*np.exp(-t*10)+.05*filt(noise,2000)*np.exp(-t*160)
    elif kind=='snare':
        x=.55*filt(noise,[1100,5200],'bandpass')*np.exp(-t*25)+.3*np.sin(2*np.pi*185*t)*np.exp(-t*31)
    elif kind=='hat':x=filt(noise,[4200,8500],'bandpass')*np.exp(-t*95)
    elif kind=='metal':x=(np.sin(2*np.pi*932*t)+.34*np.sin(2*np.pi*1493*t)+.12*noise)*np.exp(-t*34)
    else:
        x=np.sin(2*np.pi*(39*t+30*.06*(1-np.exp(-t/.06))))*np.exp(-t*4)
        x+=.12*filt(noise,[300,1900],'bandpass')*np.exp(-t*8)
    return x*env(t,dur,.001,.013)

roots=[40,40,40,40,40,36,38,35,40,40,40,36,38,35,40]
chords={40:[52,55,59,66],36:[48,55,59,64],38:[50,57,62,64],35:[47,54,57,63]}
for bar,root in enumerate(roots):
    b=bar*4;prelude=bar<4;breakdown=bar in [8,9]
    basspattern=[(0,1.1),(1.5,.55),(3,.55)] if prelude else [(0,.7),(.75,.4),(2.5,.6),(3.5,.35)]
    if breakdown:basspattern=[(0,2.6)]
    for j,(off,d) in enumerate(basspattern):
        key=root+(7 if j==2 and bar%2 else 12 if j==3 else 0)
        note('pressure',key,b+off,d,.24 if not breakdown else .17)
    # Dark sustained harmony stays behind the rhythm, not an orchestral tune.
    for j,key in enumerate(chords[root][:3]):note('haze',key,b,4.35,.038,[-.55,.55,.15][j])
    motor=[.25,1.75,3.25] if prelude else [.25,1.0,1.75,3.25]
    if breakdown:motor=[.5,3]
    for j,off in enumerate(motor):
        key=chords[root][[1,2,0,1][j%4]]
        note('mechanical',key,b+off,.64,.070 if not breakdown else .035,-.35 if j%2 else .35)
    kicks=[0,2.5] if prelude else [0,.75,2.5]
    if bar%2==1 and not prelude:kicks=[0,1.75,2.5]
    if breakdown:kicks=[0]
    for off in kicks:add('kick',drum('kick'),b+off,.32)
    if not prelude and not breakdown:
        for off in [1,3]:add('snare',drum('snare'),b+off,.24)
    elif prelude and bar>=2:add('snare',drum('snare'),b+3,.16)
    if not breakdown:
        for i in range(4):add('hat',drum('hat'),b+i+.5,.032 if i%2 else .042,.3)
    if bar in [3,7,9,13]:
        for off,v in [(3.2,.055),(3.65,.07)]:add('metal',drum('metal'),b+off,v,-.28)
    if bar in [0,4,10]:add('impact',drum('impact'),b,.12,-.1)

# One recognisable original signal, heard first as fragments, then as full phrases.
motif=[(0,64,.68),(.9,67,.34),(1.6,66,.52),(2.65,62,.88),(4.3,64,1.0),(5.65,59,.58),(6.55,62,.76)]
for block,b in enumerate([8,16,24,40,48]):
    phrase=motif[:3] if b==8 else motif
    shift=0 if b in [8,16,40] else -2 if b==24 else 1
    for j,(off,key,d) in enumerate(phrase):
        note('signal',key+shift,b+off,d,.135 if b!=8 else .082,-.06)
# Return resolves on the tonic instead of pushing a louder peak.
for b,key,d in [(56.2,67,.62),(57.2,66,.52),(58.1,64,1.85)]:note('signal',key,b,d,.128,-.06)
note('pressure',40,58,1.9,.19)

def echoes(x):
    y=x.copy()
    for delay,gain in [(BEAT*.75,.14),(BEAT*1.5,.06)]:
        k=round(delay*SR);y[k:]+=filt(x[:-k,::-1],2800)*gain
    return y
stems['signal']=echoes(stems['signal']);stems['mechanical']=echoes(stems['mechanical'])
mix=sum(stems.values()).astype(np.float64)
mid=mix.mean(axis=1);side=(mix[:,0]-mix[:,1])/2
side=sosfiltfilt(butter(4,160,btype='highpass',fs=SR,output='sos'),side)
mix=np.stack([mid+side,mid-side],axis=1);mix=filt(mix,27,'highpass');mix-=mix.mean(axis=0)
mix=np.tanh(mix*1.15)/1.15
rms=lambda x:float(np.sqrt(np.mean(x*x)))
mix*=min(10**(-22/20)/rms(mix),.79/np.abs(mix).max())
mix[:round(SR*.045)]*=np.linspace(0,1,round(SR*.045))[:,None]
mix[-round(SR*.8):]*=np.cos(np.linspace(0,np.pi/2,round(SR*.8)))[:,None]
wav=OUT/'battle-coldfront-30s.wav';sf.write(wav,mix,SR,subtype='PCM_24')
mp3=wav.with_suffix('.mp3');subprocess.run(['ffmpeg','-v','error','-y','-i',str(wav),'-c:a','libmp3lame','-b:a','256k','-metadata','title=冷线交锋 · 电子作战30秒',str(mp3)],check=True)
def fp(p):return dict(path=p.relative_to(ROOT).as_posix(),bytes=p.stat().st_size,sha256=hashlib.sha256(p.read_bytes()).hexdigest())
(OUT/'score.json').write_text(json.dumps(dict(title='冷线交锋',bpm=BPM,notes=notes,sections=[dict(start=0,end=8,role='pressure and fragmented signal'),dict(start=8,end=16,role='full motif and breakbeat'),dict(start=16,end=20,role='bass hold and sparse mechanical reply'),dict(start=20,end=30,role='motif return and tonic ending')]),ensure_ascii=False,indent=2),encoding='utf-8')
(OUT/'render-report.json').write_text(json.dumps(dict(title='冷线交锋',seconds=len(mix)/SR,bpm=BPM,tracks=list(stems),files=[fp(wav),fp(mp3)],retained_files=[fp(ROOT/'game/assets/music-demo/01-title-frostglass.ogg'),fp(ROOT/'game/assets/music-demo/02-explore-ashline.ogg'),fp(OUT.parent/'2026-10-09-WF-shop-remake/shop-lamplight-deal-30s.mp3')],scope='Entirely new electronic battle composition; original title/exploration and previous shop directly referenced. No Arknights recording or melody imported.'),ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(dict(seconds=30,bpm=BPM,tracks=list(stems),sample_peak_dbfs=20*np.log10(np.abs(mix).max())),ensure_ascii=True))
