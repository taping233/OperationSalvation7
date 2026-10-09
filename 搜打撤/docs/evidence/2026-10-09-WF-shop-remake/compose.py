"""Entirely new 30s merchant cue: compact noir jazz, original melody and harmony.
No old shop recording or reference-game samples/notes are imported.
"""
import pathlib,json,hashlib,importlib.util,subprocess
import numpy as np
import soundfile as sf
from scipy.signal import butter,sosfilt
OUT=pathlib.Path(__file__).resolve().parent;ROOT=OUT.parents[2]
SR=48000;BPM=96;BEAT=60/BPM;N=SR*30
RNG=np.random.default_rng(109880)
spec=importlib.util.spec_from_file_location('fluid',OUT.parent/'2026-10-05-WF-music-title-v6/fluid_engine.py')
fluid=importlib.util.module_from_spec(spec);spec.loader.exec_module(fluid)
events={name:[] for name in ['piano-hook','muted-horn','jazz-guitar','upright-bass','vibraphone']};score=[]

def note(track,beat,key,length,velocity):
    if beat>=48:return
    events[track]+=[(round(beat*BEAT*SR),2,'on',key,velocity),(round((beat+length)*BEAT*SR),1,'off',key,0)]
    score.append(dict(track=track,beat=round(beat,3),key=key,length=length,velocity=velocity))

chords=[('Cm6/9',36,[51,57,62,67]),('Cm6/9',36,[51,57,62,67]),
        ('Db9#11',37,[53,59,63,67]),('G7b9',31,[53,59,62,68]),
        ('Fm9',29,[51,55,56,60]),('Bb13',34,[50,56,60,67]),
        ('Ebmaj9',39,[50,55,58,65]),('G7alt',31,[53,59,63,68]),
        ('Cm6/9',36,[51,57,62,67]),('Abmaj9',32,[55,58,60,63]),
        ('Dm7b5/G',31,[53,56,60,62]),('G7b9 - Cm6/9',31,[53,59,62,68])]
for bar,(name,root,c) in enumerate(chords):
    b=bar*4
    # A quiet swung rhythm section. Every part has an independent register/role.
    nextroot=chords[(bar+1)%12][1]
    bassline=[root,root+7,root+12,nextroot+(1 if root>nextroot else -1)]
    if bar in [3,7]:bassline=[root,root+7,root+10,root+11]
    for j,key in enumerate(bassline):note('upright-bass',b+j+.012*(j%2),key,.82,[66,49,57,44][j])
    for off,vel in [(.62,40),(2.62,36)]:
        for j,key in enumerate(c[:3]):note('jazz-guitar',b+off+j*.018,key,.60,vel+j)
    # Piano's first four bars state the hook, then get out of the horn's way.
    if 4<=bar<8:
        for off in [.16,2.55]:
            for j,key in enumerate(c[1:]):note('piano-hook',b+off+j*.025,key,.68,34)

# Compact, crooked two-bar hook; repeat identity and vary the response/endings.
piano_phrases={
 0:[(.15,67,.40,72),(.63,69,.24,54),(1.15,70,.64,69),(2.65,62,.44,62),(3.2,63,.54,64)],
 1:[(.25,67,.61,68),(1.65,62,.40,57),(2.25,60,1.10,65)],
 2:[(.15,68,.43,69),(.65,67,.29,53),(1.2,65,.73,65),(2.7,63,.60,60)],
 3:[(.2,62,.50,67),(1.15,59,.60,60),(2.65,60,.73,62)],
 8:[(.15,67,.40,72),(.63,69,.24,54),(1.15,70,.64,69),(2.65,62,.30,60),(3.12,63,.24,59),(3.65,67,.32,64)],
 9:[(.25,70,.56,68),(1.65,67,.39,57),(2.25,63,1.18,65)],
 10:[(.2,65,.50,68),(1.15,62,.61,60),(2.65,60,.45,62),(3.22,62,.46,58)],
 11:[(.2,59,.53,65),(1.15,62,.55,59),(2.25,60,1.7,65)]}
for bar,phrase in piano_phrases.items():
    for off,key,dur,vel in phrase:note('piano-hook',bar*4+off,key,dur,vel)
horn_phrases={
 1:[(3.35,63,.46,43)],3:[(3.1,59,.66,44)],
 4:[(.3,68,.68,53),(1.65,67,.55,47),(2.7,65,.92,51)],
 5:[(.25,62,.73,53),(1.6,60,.42,46),(2.65,67,.94,54)],
 6:[(.3,65,1.09,52),(1.7,62,.63,46),(2.8,58,.92,49)],
 7:[(.25,63,.53,54),(1.15,62,.57,49),(2.6,59,1.10,52)],
 9:[(3.25,60,.54,43)]}
for bar,phrase in horn_phrases.items():
    for off,key,dur,vel in phrase:note('muted-horn',bar*4+off,key,dur,vel)
for beat,key in [(6.6,79),(14.65,74),(30.8,80),(38.75,75),(46.5,79)]:note('vibraphone',beat,key,1.15,31)
# Resolve the last bar, instead of fading on an arbitrary dominant attack.
for key in [51,57,62,67]:note('jazz-guitar',46.1,key,2.5,37)
note('upright-bass',46.05,36,2.0,57)

def low(x,hz):return sosfilt(butter(2,hz,fs=SR,output='sos'),x,axis=0)
def chamber(x):
    y=x.copy()
    for delay,gain in [(.027,.12),(.059,.11),(.103,.085),(.179,.060),(.283,.045),(.431,.022)]:
        k=round(delay*SR);y[k:]+=low(x[:-k,::-1],4400)*gain
    return y
stems={}
settings={'piano-hook':(0,-23.5,-.13),'muted-horn':(59,-26.0,.15),'jazz-guitar':(26,-32,.4),'upright-bass':(32,-27,0),'vibraphone':(11,-37,-.4)}
for name,(patch,target,pan) in settings.items():
    x=fluid.render(events[name],32,patch=patch)[:N]
    x=low(x,6400 if name=='piano-hook' else 5200)
    x=chamber(x) if name!='upright-bass' else x
    x*=np.array([np.sqrt(1-pan),np.sqrt(1+pan)])[None,:]
    active=np.max(np.abs(x),axis=1)>.0001
    energy=np.sqrt(np.mean(x[active]**2)) if active.any() else 1
    x*=10**(target/20)/max(energy,1e-9)
    stems[name]=x

brush=np.zeros((N,2));rim=np.zeros((N,2))
def hit(buffer,x,beat,level,pan=0):
    start=round(beat*BEAT*SR);l=min(len(x),N-start)
    if l>0:buffer[start:start+l]+=x[:l,None]*np.array([np.sqrt((1-pan)/2),np.sqrt((1+pan)/2)])[None,:]*level
for bar in range(12):
    for off in [0,2]:
        dur=.46;t=np.arange(round(dur*SR))/SR
        noise=RNG.normal(0,.45,len(t))
        shaped=sosfilt(butter(2,[1800,8500],btype='bandpass',fs=SR,output='sos'),noise)
        wave=shaped*(np.sin(np.pi*np.minimum(t/dur,1))**1.4)*np.exp(-t*4)
        hit(brush,wave,bar*4+off,.065,.15)
    for off in [1,3]:
        t=np.arange(round(.1*SR))/SR
        wave=(np.sin(2*np.pi*1270*t)+.35*np.sin(2*np.pi*1830*t))*np.exp(-t*75)
        hit(rim,wave,bar*4+off,.024,-.2)
stems['brushes']=brush;stems['rim']=rim
mix=sum(stems.values())
mix=sosfilt(butter(2,28,btype='highpass',fs=SR,output='sos'),mix,axis=0)
# Mild saturation binds rhythm/foreground without tempo pumping.
mix=np.tanh(mix*1.05)/1.05
mix*=min(10**(-20/20)/np.sqrt(np.mean(mix**2)),.82/np.max(np.abs(mix)))
mix[:round(SR*.035)]*=np.linspace(0,1,round(SR*.035))[:,None]
mix[-round(SR*.75):]*=np.cos(np.linspace(0,np.pi/2,round(SR*.75)))[:,None]
wav=OUT/'shop-lamplight-deal-30s.wav';sf.write(wav,mix,SR,subtype='PCM_24')
mp3=wav.with_suffix('.mp3');subprocess.run(['ffmpeg','-v','error','-y','-i',str(wav),'-c:a','libmp3lame','-b:a','256k','-metadata','title=灯下交易 · 商店重做30秒',str(mp3)],check=True)
(OUT/'score.json').write_text(json.dumps({'title':'灯下交易','bpm':BPM,'meter':'4/4','bars':12,'chords':[c[0] for c in chords],'events':score,'sections':{'0-10s':'piano hook','10-20s':'muted horn reply, piano moves to support','20-30s':'varied hook return and cadence'},'reference':'商人坎诺特 official MSR song 880369; atmospheric reference only, no samples or imported notes'},ensure_ascii=False,indent=2),encoding='utf-8')
report={'title':'灯下交易','seconds':len(mix)/SR,'bpm':BPM,'tracks':list(stems),'peak_dbfs':float(20*np.log10(np.max(np.abs(mix)))),'rms_dbfs':float(20*np.log10(np.sqrt(np.mean(mix**2)))),'files':[{'path':p.relative_to(ROOT).as_posix(),'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in [wav,mp3]],'limits':['SoundFont rendering and procedural brushes; not a live studio performance.','30-second sketch has a brief fade; not a final seamless game loop.']}
(OUT/'render-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(report,ensure_ascii=True))
