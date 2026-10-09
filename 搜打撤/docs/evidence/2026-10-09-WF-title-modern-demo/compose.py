"""Original 30-second title cue. Existing FluidSynth + custom electronic voices.
Reference transcriptions inform texture/form only; no imported melody or audio.
"""
import pathlib, sys, json, hashlib, subprocess, importlib.util
import numpy as np
import soundfile as sf
from scipy.signal import butter, sosfilt, sawtooth

OUT = pathlib.Path(__file__).resolve().parent
ROOT = OUT.parents[2]
SR = 48000
BPM = 112
BEAT = 60 / BPM
SECONDS = 30
N = SR * SECONDS
RNG = np.random.default_rng(10092026)
spec = importlib.util.spec_from_file_location('fluid', ROOT / 'docs/evidence/2026-10-05-WF-music-title-v6/fluid_engine.py')
fluid = importlib.util.module_from_spec(spec)
spec.loader.exec_module(fluid)
stems = {}
score = []

def filt(x, hz, kind='lowpass'):
    return sosfilt(butter(2, hz, btype=kind, fs=SR, output='sos'), x, axis=0).astype(np.float32)

def envelope(t, dur, attack=.01, release=.12, decay=0):
    return np.minimum(t/attack, 1) * np.minimum(np.maximum(dur-t, 0)/release, 1) * np.exp(-t*decay)

def add(name, x, beat, gain=1, pan=0):
    if name not in stems: stems[name] = np.zeros((N,2), np.float32)
    start = round(beat*BEAT*SR)
    if start >= N: return
    x = x[:N-start]
    if x.ndim == 1:
        angle = (pan+1)*np.pi/4
        x = x[:,None] * np.array([np.cos(angle),np.sin(angle)])[None,:]
    stems[name][start:start+len(x)] += x*gain

def synth(key, beats, voice):
    dur = beats*BEAT
    t = np.arange(round(dur*SR))/SR
    f = 440*2**((key-69)/12)
    ph = 2*np.pi*f*t
    if voice == 'bass':
        x = .74*np.sin(ph) + .23*filt(sawtooth(ph+.18*np.sin(ph/2)),750) + .08*np.sin(ph*2)
        return (x*envelope(t,dur,.007,.07,.65)).astype(np.float32)
    if voice == 'pluck':
        x = np.sin(ph+2.4*np.exp(-t*9)*np.sin(ph*2)) + .2*np.sin(ph*3)*np.exp(-t*9)
        return (x*envelope(t,dur,.003,.1,4.8)).astype(np.float32)
    if voice == 'lead':
        vib = .003*np.sin(2*np.pi*5*t)*np.minimum(t/.18,1)
        x = sum(sawtooth(ph*(1+d+vib)+i*.6) for i,d in enumerate([-.004,0,.004]))/3
        x = filt(x,2900) + .22*np.sin(ph)
        return (x*envelope(t,dur,.025,.17,.24)).astype(np.float32)
    if voice == 'pad':
        x = sum(sawtooth(ph*d+i) for i,d in enumerate([.998,1.002,1,2.001]))/4
        x = filt(x,1050)*(1+.10*np.sin(2*np.pi*.3*t))
        return (x*envelope(t,dur,.22,.5)).astype(np.float32)
    if voice == 'glass':
        x = np.sin(ph) + .23*np.sin(ph*2.003)*np.exp(-t*3) + .09*np.sin(ph*4.01)*np.exp(-t*4)
        return (x*envelope(t,dur,.006,.2,1.8)).astype(np.float32)
    raise ValueError(voice)

def note(name, key, beat, length, gain, pan=0, voice=None):
    score.append(dict(track=name,note=key,beat=beat,length=length,gain=gain,pan=pan))
    add(name,synth(key,length,voice or name),beat,gain,pan)

def drum(kind):
    dur = dict(kick=.5,snare=.28,hat=.07,openhat=.24,clap=.22,rim=.1,crash=1.7)[kind]
    t = np.arange(round(dur*SR))/SR
    noise = RNG.normal(0,.5,len(t)).astype(np.float32)
    if kind=='kick':
        ph = 2*np.pi*(47*t+105*.028*(1-np.exp(-t/.028)))
        x = np.sin(ph)*np.exp(-t*9) + .09*filt(noise,2200)*np.exp(-t*150)
    elif kind=='snare':
        x = .58*filt(noise,[1000,9500],'bandpass')*np.exp(-t*19)+.25*np.sin(2*np.pi*185*t)*np.exp(-t*24)
    elif kind=='clap':
        bursts = sum(np.exp(-np.maximum(t-d,0)*45)*(t>=d) for d in [0,.012,.024])
        x = filt(noise,[1200,7000],'bandpass')*bursts*.32
    elif kind=='rim':
        x = (np.sin(2*np.pi*1760*t)+.5*np.sin(2*np.pi*2320*t))*np.exp(-t*85)
    else:
        x = filt(noise,6500,'highpass')*np.exp(-t*dict(hat=90,openhat=17,crash=3.7)[kind])
    return (x*envelope(t,dur,.001,.018)).astype(np.float32)

# Rootless, closely voiced harmony. A recurring four-note hook has changing answers.
chords = [
    ('Dm9',38,[53,57,60,64]), ('Bbmaj9',34,[53,57,60,62]),
    ('Dm9',38,[53,57,60,64]), ('Bbmaj9',34,[53,57,60,62]),
    ('Gm9',31,[53,57,58,62]), ('A7sus-A7',33,[55,58,62,64]),
    ('Fmaj9',29,[52,55,57,60]), ('Cadd9/E',28,[50,55,60,64]),
    ('Dm9',38,[53,57,60,64]), ('Bbmaj9',34,[53,57,60,62]),
    ('Gm9',31,[53,57,58,62]), ('A7',33,[55,58,61,64]),
    ('Bbmaj9',34,[53,57,60,62]), ('Dm6/9',38,[53,57,59,64])
]
ep_events = []
guitar_events = []
def sample_note(events,name,key,beat,length,velocity):
    events += [(round(beat*BEAT*SR),2,'on',key,velocity),
               (round((beat+length)*BEAT*SR),1,'off',key,0)]
    score.append(dict(track=name,note=key,beat=beat,length=length,velocity=velocity))

for bar,(symbol,root,chord) in enumerate(chords):
    b = bar*4
    intensity = .70 if bar<2 else (1 if bar<6 else (.76 if bar<8 else 1.14))
    if bar>=12: intensity=.82
    for i,key in enumerate(chord):
        note('pad',key,b,4.7,.065*intensity,(-.65,.65,-.3,.3)[i])
    # E-piano only punctuates syncopated gaps, not a classical arpeggio.
    for off,dur in [(0,1.55),(2.75,.75)]:
        for i,key in enumerate(chord):
            sample_note(ep_events,'electric-piano',key,b+off+i*.012,dur,55 if bar<2 else 67)
    steps = [(0,root,.78),(1.5,root,.34),(2.25,root+12,.40),(3.5,root+7,.32)]
    if bar<2: steps=[(0,root,2.3),(3.25,root+12,.4)]
    if bar in [6,7]: steps=[(0,root,1.3),(2.75,root+7,.55)]
    if bar==13: steps=[(0,root,3.3)]
    for off,key,dur in steps: note('bass',key,b+off,dur,.32*intensity)
    # A 3+3+2 pulse, with omissions and octave response after the main entrance.
    pattern=[0,.75,1.5,2,2.75,3.5] if bar not in [6,7,13] else [0,1.5,3]
    for i,off in enumerate(pattern):
        key = chord[[0,2,1,3,2,1][i%6]]+12
        note('pluck',key,b+off,.62,.085*intensity,(-.35 if i%2 else .35))
    if bar>=2:
        for off,key in [(1.75,chord[1]+12),(3.25,chord[3]+12)]:
            sample_note(guitar_events,'delay-guitar',key,b+off,1.2,65 if bar<8 else 77)
    kicks=[0,1.75,2.5] if bar%2==0 else [0,1.5,2.75,3.5]
    if bar<2: kicks=[0]
    if bar in [6,7]: kicks=[0,2.75]
    if bar==13: kicks=[0]
    for off in kicks: add('kick',drum('kick'),b+off,.62*intensity)
    if bar<2: add('rim',drum('rim'),b+2,.1)
    else:
        for off in ([2] if bar in [6,7,13] else [1,3]):
            add('snare',drum('snare'),b+off,.42*intensity)
            add('clap',drum('clap'),b+off+.016,.16*intensity,.2)
    for i in range(8 if bar<8 else 16):
        off=i*(.5 if bar<8 else .25)
        if bar==13 and off>1: continue
        if bar<2 and i%2: continue
        add('hat',drum('hat'),b+off+(.022 if i%2 else 0),(.045 if i%2 else .072)*intensity, .33 if i%2 else -.33)
    if bar in [3,5,9,11]: add('openhat',drum('openhat'),b+3.5,.11,.4)
    if bar in [2,8,12]: add('crash',drum('crash'),b,.14,-.4)
    if bar in [5,11]:
        for i,off in enumerate([3.25,3.5,3.75]): add('snare',drum('snare'),b+off,.09+i*.035,-.2+i*.2)

phrases = {
    2:[(0,74,.7),(.75,69,.45),(1.5,72,1.1),(3,76,.8)],
    3:[(.25,77,.7),(1,76,.5),(1.75,72,.7),(2.75,69,1.0)],
    4:[(0,74,1.15),(1.5,77,.65),(2.25,79,.45),(3,81,.75)],
    5:[(0,76,.9),(1.25,73,.65),(2.25,71,.4),(3,69,.8)],
    6:[(.5,72,1.25),(2.25,69,1.25)],
    7:[(.75,67,.8),(2,64,.6),(3.25,69,.5)],
    8:[(0,74,.7),(.75,69,.45),(1.5,72,.9),(2.75,76,.4),(3.25,81,.65)],
    9:[(.25,77,.65),(1,76,.45),(1.75,72,.65),(2.75,74,.4),(3.25,77,.65)],
    10:[(0,79,.9),(1.25,77,.45),(2,74,.6),(2.75,72,.4),(3.25,69,.6)],
    11:[(0,73,.7),(1,76,.6),(2,81,.9),(3.25,76,.5)],
    12:[(0,77,.85),(1.25,76,.6),(2.25,72,1.2)],
    13:[(0,74,3.5)]
}
for bar,phrase in phrases.items():
    for off,key,dur in phrase:
        note('lead',key,bar*4+off,dur+.14,.20 if bar<8 else .24,-.06)
        if bar>=8: note('glass',key+12,bar*4+off,dur+.65,.055,.32)
# Counterline responds in spaces instead of doubling the entire theme.
for b,key in [(11.75,65),(15.5,69),(19,67),(23,64),(35.5,69),(39.5,65),(43.25,67),(47,64),(51.5,69)]:
    note('answer',key,b,.85,.07,-.5,voice='glass')

stems['electric-piano'] = fluid.render(ep_events,SECONDS,patch=4)*.20
stems['delay-guitar'] = filt(fluid.render(guitar_events,SECONDS,patch=27),5200)*.25

def echoes(x,taps):
    y=x.copy()
    for seconds,gain in taps:
        k=round(seconds*SR)
        delayed=filt(x[:-k],4200)
        y[k:] += delayed[:,::-1]*gain
    return y
stems['pluck']=echoes(stems['pluck'],[(BEAT*.75,.32),(BEAT*1.5,.15)])
stems['delay-guitar']=echoes(stems['delay-guitar'],[(BEAT*.75,.42),(BEAT*1.5,.24),(BEAT*2.25,.12)])
stems['lead']=echoes(stems['lead'],[(BEAT*.75,.18),(BEAT*1.5,.09)])
stems['pad']=echoes(stems['pad'],[(.073,.15),(.131,.12),(.227,.10),(.389,.08)])
timeline=np.arange(N)/SR
sidechain=1-.23*np.exp(-(timeline%BEAT)/.11)
for name in ['bass','pad','electric-piano','pluck']:
    stems[name]*=sidechain[:,None]
mix=sum(stems.values())
mix=filt(mix,28,'highpass')
mix=np.tanh(mix*1.15)/1.15
mix*=.86/max(np.abs(mix).max(),1e-6)
mix[:960]*=np.linspace(0,1,960)[:,None]
mix[-round(SR*.8):]*=np.linspace(1,0,round(SR*.8))[:,None]
wav=OUT/'title-underice-signal-30s.wav'
sf.write(wav,mix,SR,subtype='PCM_24')
mp3=wav.with_suffix('.mp3')
subprocess.run(['ffmpeg','-v','error','-y','-i',str(wav),'-c:a','libmp3lame','-b:a','256k','-metadata','title=冰下信号 · 标题30秒demo',str(mp3)],check=True)
(OUT/'score.json').write_text(json.dumps({'title':'冰下信号','bpm':BPM,'time_signature':'4/4','seconds':SECONDS,'chords':[x[0] for x in chords],'events':score},ensure_ascii=False,indent=2),encoding='utf-8')
windows=[float(20*np.log10(np.sqrt(np.mean(mix[i*SR:(i+1)*SR]**2))+1e-12)) for i in range(SECONDS)]
report={'seconds':len(mix)/SR,'sample_rate':SR,'bpm':BPM,'tracks':list(stems),'peak_dbfs':float(20*np.log10(np.abs(mix).max())),'rms_dbfs':float(20*np.log10(np.sqrt(np.mean(mix**2)))),'one_second_rms_dbfs':windows,'finite':bool(np.isfinite(mix).all()),'source_audio_samples':'existing GeneralUser-GS.sf2 only; no reference-game recordings','files':[{'path':str(p.relative_to(ROOT)).replace('\\','/'),'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in [wav,mp3]]}
assert report['finite'] and report['seconds']==30 and report['peak_dbfs']<-1
assert min(windows[1:-1])>-38
(OUT/'render-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(report,ensure_ascii=True),flush=True)
