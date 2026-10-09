"""Original calm title sketch: 64 BPM, 8 bars, 30s. No drums or pulse synth."""
import pathlib, importlib.util, json, hashlib, subprocess
import numpy as np
import soundfile as sf
from scipy.signal import butter, sosfilt

OUT=pathlib.Path(__file__).resolve().parent
ROOT=OUT.parents[2]
SR=48000
BPM=64
BEAT=60/BPM
SECONDS=30
TAIL=34
spec=importlib.util.spec_from_file_location('fluid',ROOT/'docs/evidence/2026-10-05-WF-music-title-v6/fluid_engine.py')
fluid=importlib.util.module_from_spec(spec);spec.loader.exec_module(fluid)
events={k:[] for k in ['nylon-melody','clean-guitar','electric-piano','warm-bass','upper-answer']}
notes=[]

def note(track,key,beat,length,velocity):
    events[track] += [(round(beat*BEAT*SR),2,'on',key,velocity),(round((beat+length)*BEAT*SR),1,'off',key,0)]
    notes.append(dict(track=track,key=key,beat=beat,length=length,velocity=velocity))

chords=[('Em9',40,[55,59,62,66]),('Cmaj9',36,[55,59,62,64]),
        ('Gmaj9',31,[54,57,59,62]),('Dadd9/F#',30,[54,57,62,64]),
        ('Am9',33,[55,59,60,64]),('Cmaj9',36,[55,59,62,64]),
        ('D6sus',38,[55,57,59,64]),('Emadd9',40,[54,55,59,64])]
# Slow changes with common tones, one bass attack per bar. Avoid beat-accent loops.
for bar,(symbol,root,voicing) in enumerate(chords):
    beat=bar*4
    note('warm-bass',root-12,beat,4.25,47+(bar%3))
    for i,key in enumerate(voicing):
        note('electric-piano',key,beat+.035*i,4.25,40+[0,3,-3,1][i])
    # Sparse guitar supports phrases; offsets vary with the melodic sentence.
    offsets=[[.1,1.65,3.1],[.2,2.5],[.1,1.5,3.2],[.1,2.75],
             [.25,1.8,3.0],[.15,2.4],[.2,1.75,3.0],[.1,2.1]][bar]
    for i,off in enumerate(offsets):
        note('clean-guitar',voicing[(i+bar)%4],beat+off,2.5,43 if i else 48)

# Two four-bar sentences. A recognizable opening gesture receives a longer answer.
melody=[
 (0.4,71,1.45,68),(2.0,67,1.75,63),
 (4.2,69,1.3,66),(5.7,71,2.2,69),
 (8.2,74,2.1,72),(10.5,71,1.15,62),
 (12.2,69,2.0,66),(14.5,66,1.35,61),
 (16.4,67,1.35,65),(18,71,1.6,68),
 (20.2,76,2.3,70),(22.7,74,1.0,62),
 (24.2,71,1.2,66),(25.65,69,1.55,63),
 (27.35,66,.55,57),(28.2,67,3.2,64)]
for beat,key,length,velocity in melody:
    note('nylon-melody',key,beat,length,velocity)
for beat,key in [(7.4,78),(15.5,76),(23.3,78)]:
    note('upper-answer',key,beat,2.3,29)

def lowpass(x,hz):
    return sosfilt(butter(2,hz,fs=SR,output='sos'),x,axis=0).astype(np.float32)

def pan(x,position):
    return x*np.array([np.sqrt(1-position),np.sqrt(1+position)])[None,:]

def room(x,amount):
    y=x.copy()
    # Diffuse taps, not a tempo-locked repeating delay.
    for delay,gain in [(.043,.18),(.091,.14),(.157,.13),(.263,.105),(.419,.09),(.643,.067),(.877,.048),(1.173,.029),(1.537,.019)]:
        k=round(delay*SR);y[k:]+=lowpass(x[:-k,::-1],4100)*gain*amount
    return y

settings={'nylon-melody':(24,.80,-.12,6500),
          'clean-guitar':(27,.20,.42,4200),
          'electric-piano':(4,.27,-.25,4500),
          'warm-bass':(35,.30,0,1200),
          'upper-answer':(8,.085,.35,6000)}
stems={}
for track,(patch,gain,position,hz) in settings.items():
    raw=fluid.render(events[track],TAIL,patch=patch)
    stems[track]=room(pan(lowpass(raw,hz),position),.9 if track=='nylon-melody' else 1.1)*gain

# Continuous air bed: smoothly overlapping sine harmonics, no tremolo/sidechain/arp.
bed=np.zeros((SR*TAIL,2),np.float32)
for bar,(_,root,voicing) in enumerate(chords):
    dur=5.8;t=np.arange(round(dur*SR))/SR
    env=np.minimum(t/.9,1)*np.minimum(np.maximum(dur-t,0)/1.5,1)
    for i,key in enumerate(voicing):
        freq=440*2**((key-69)/12)
        for ch in range(2):
            detune=1+(-1 if ch==0 else 1)*.0011
            wave=np.sin(2*np.pi*freq*detune*t)+.10*np.sin(2*np.pi*freq*2*t+i)
            start=round(bar*4*BEAT*SR);length=min(len(t),len(bed)-start)
            bed[start:start+length,ch]+=wave[:length]*env[:length]*.0065
stems['air-bed']=bed
mix=sum(stems.values())[:SR*SECONDS]
mix=sosfilt(butter(2,27,btype='highpass',fs=SR,output='sos'),mix,axis=0)
mix-=mix.mean(axis=0)
# Preserve natural note dynamics; target restrained integrated level with headroom.
gain=min(10**(-22/20)/(np.sqrt(np.mean(mix**2))+1e-12),.80/np.max(np.abs(mix)))
mix*=gain
mix[:round(SR*.12)]*=np.linspace(0,1,round(SR*.12))[:,None]
mix[-round(SR*1.4):]*=np.cos(np.linspace(0,np.pi/2,round(SR*1.4)))[:,None]
wav=OUT/'title-snowlight-30s.wav';sf.write(wav,mix,SR,subtype='PCM_24')
mp3=wav.with_suffix('.mp3')
subprocess.run(['ffmpeg','-v','error','-y','-i',str(wav),'-c:a','libmp3lame','-b:a','256k','-metadata','title=雪光慢行 · 平和标题30秒demo',str(mp3)],check=True)
report={'title':'雪光慢行','seconds':len(mix)/SR,'bpm':BPM,'tracks':list(stems),'drum_tracks':0,'pulse_synth_tracks':0,'peak_dbfs':float(20*np.log10(np.max(np.abs(mix)))),'rms_dbfs':float(20*np.log10(np.sqrt(np.mean(mix**2)))),'finite':bool(np.isfinite(mix).all()),'one_second_rms_dbfs':[float(20*np.log10(np.sqrt(np.mean(mix[i*SR:(i+1)*SR]**2))+1e-12)) for i in range(SECONDS)],'files':[{'path':str(p.relative_to(ROOT)).replace('\\','/'),'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in [wav,mp3]]}
assert report['seconds']==30 and report['finite'] and report['peak_dbfs']<-1.5
(OUT/'score.json').write_text(json.dumps({'title':'雪光慢行','bpm':BPM,'bars':8,'chords':[c[0] for c in chords],'events':notes},ensure_ascii=False,indent=2),encoding='utf-8')
(OUT/'render-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(report,ensure_ascii=True))
