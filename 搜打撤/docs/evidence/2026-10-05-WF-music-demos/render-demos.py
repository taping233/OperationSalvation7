"""Deterministic original music: additive/FM synthesis, arrangement, circular FX.
No reference samples, melody extraction, external instruments or downloads.
Reproduce: python docs/evidence/2026-10-05-WF-music-demos/render-demos.py
"""
import hashlib, json, pathlib, subprocess
import numpy as np
from scipy.signal import butter, sosfilt
import soundfile as sf

ROOT = pathlib.Path(__file__).resolve().parents[3]
OUT = pathlib.Path(__file__).parent
ASSETS = ROOT / 'game/assets/music-demo'
SR = 48000
RNG = np.random.default_rng(10052026)

def filt(x, hz, kind='lowpass'):
    return sosfilt(butter(2, hz, btype=kind, fs=SR, output='sos'), x).astype(np.float32)

def env(t, dur, attack=.008, release=.08, decay=0):
    return np.minimum(t/attack, 1) * np.minimum(np.maximum(dur-t, 0)/release, 1) * np.exp(-decay*t)

def tone(midi, dur, voice, velocity=1):
    t = np.arange(round(dur*SR), dtype=np.float32)/SR
    f = 440*2**((midi-69)/12)
    phase = 2*np.pi*f*t
    if voice == 'keys':
        sig = np.sin(phase + 1.2*np.exp(-t*2.8)*np.sin(phase*2))
        sig += .25*np.sin(phase*3)*np.exp(-t*3.5)
        e = env(t,dur,.006,.18,1.6)
    elif voice == 'bell':
        sig = np.sin(phase) + .32*np.sin(phase*2.756)*np.exp(-t*3) + .17*np.sin(phase*5.404)*np.exp(-t*6)
        e = env(t,dur,.004,.25,2.7)
    elif voice == 'pad':
        sig = sum(np.sin(phase*detune + .8*np.sin(2*np.pi*.23*t+i)) * w for i,(detune,w) in enumerate([(1,.6),(1.003,.25),(.997,.25),(2,.1),(3,.035)]))
        e = env(t,dur,.32,.65)
    elif voice == 'bass':
        sig = np.sin(phase) + .28*np.sin(phase*2) + .12*np.sin(phase*3)*np.exp(-t*7) + .08*np.sin(phase*4)*np.exp(-t*9)
        e = env(t,dur,.005,.05,.8)
    elif voice == 'pluck':
        sig = sum(np.sin(phase*k)*np.exp(-t*(2+k*.9))/k for k in range(1,7))
        e = env(t,dur,.004,.09)
    elif voice == 'lead':
        vib = .018*np.sin(2*np.pi*5.1*t)*np.minimum(t/.18,1)
        sig = sum(np.sin(phase*k+vib*k)*np.exp(-t*k*.48)/(k**1.3) for k in range(1,9))
        e = env(t,dur,.018,.14,.45)
    elif voice == 'string':
        sig = sum((np.sin(phase*k)+.35*np.sin(phase*k*1.002))/(k**1.5) for k in range(1,9))
        e = env(t,dur,.11,.24,.2)
    else:
        raise ValueError(voice)
    return (sig*e*velocity).astype(np.float32)

def drum(kind, vel=1):
    dur = {'kick':.42,'snare':.23,'hat':.055,'open':.25,'tom':.32,'crash':1.6,'metal':.16}[kind]
    t = np.arange(round(SR*dur),dtype=np.float32)/SR
    noise = RNG.uniform(-1,1,len(t)).astype(np.float32)
    if kind == 'kick':
        phase = 2*np.pi*(48*t+95*.025*(1-np.exp(-t/.025)))
        x = np.sin(phase)*np.exp(-t*10) + .19*filt(noise,2200)*np.exp(-t*160)
    elif kind == 'snare':
        x = .67*filt(noise,1600,'highpass')*np.exp(-t*19) + .3*np.sin(2*np.pi*180*t)*np.exp(-t*27)
        x += .12*filt(noise,5500,'highpass')*np.exp(-t*70)
    elif kind in ['hat','open','crash']:
        x = filt(noise,6500,'highpass')
        x += .12*sum(np.sin(2*np.pi*f*t) for f in [4131,5279,6731,8093])
        x *= np.exp(-t*({'hat':95,'open':18,'crash':3.5}[kind]))
    elif kind == 'tom':
        x = np.sin(2*np.pi*(89*t+40*.045*(1-np.exp(-t/.045))))*np.exp(-t*13)
    else:
        x = (np.sin(2*np.pi*1347*t)+.5*np.sin(2*np.pi*2167*t))*np.exp(-t*35)
    return (x*env(t,dur,.001,.012)*vel).astype(np.float32)

def add(buf, sig, start, gain, pan=0):
    idx = (np.arange(len(sig))+round(start*SR)) % len(buf)
    angle = (pan+1)*np.pi/4
    np.add.at(buf[:,0],idx,sig*(gain*np.cos(angle)))
    np.add.at(buf[:,1],idx,sig*(gain*np.sin(angle)))

def circular_fx(x, beat):
    n = len(x)
    # Circular convolution: previous-loop delay/reverb tails already exist at sample 0.
    result = x.copy()
    for ch in range(2):
        impulse = np.zeros(n,dtype=np.float32)
        for delay, level in [(beat*.75,.16),(beat*1.5,.085),(beat*2.25,.035)]:
            impulse[round((delay+ch*.008)*SR)%n] += level
        for j,base in enumerate([.047,.071,.113,.173,.229,.307]):
            for repeat in range(1,11):
                delay = base*repeat + ch*.003 + .011*j
                impulse[round(delay*SR)%n] += .018*(.69**repeat)
        wet = np.fft.irfft(np.fft.rfft(x[:,1-ch])*np.fft.rfft(impulse),n=n).astype(np.float32)
        result[:,ch] += wet
    return result

CONFIGS = [
 {'role':'title','name':'01-title-frostglass','title':'霜窗回声','bpm':136,'root':48,'mode':'C minor','gain_db':-18,'seed':11},
 {'role':'explore','name':'02-explore-ashline','title':'灰线行军','bpm':152,'root':50,'mode':'D minor','gain_db':-16,'seed':22},
 {'role':'battle','name':'03-battle-blackpulse','title':'黑脉交锋','bpm':124,'root':52,'mode':'E minor','gain_db':-15,'seed':33},
]

def render(cfg):
    global RNG
    RNG = np.random.default_rng(cfg['seed'])
    role, root = cfg['role'],cfg['root']
    beat = 60/cfg['bpm']; bar = beat*4; duration=bar*32
    n = round(duration*SR)
    music = np.zeros((n,2),dtype=np.float32); drums = np.zeros_like(music)
    kick_duck = np.zeros(n,dtype=np.float32)
    events = []
    # i9 / VImaj7 / IIIadd9 / vsus: common functional vocabulary, new voicings.
    chords = [[0,3,7,14],[-4,0,3,7],[-9,-5,-2,5],[-5,0,2,7]]
    bass_roots = [0,-4,-9,-5]
    motif_a = [(0,7,.75),(1.5,10,.5),(2.5,14,.5),(3.25,12,.65)]
    motif_b = [(0,15,.5),(.75,14,.5),(1.5,10,.75),(2.75,7,.75)]
    def note(midi,start,length,voice,gain,pan=0):
        add(music,tone(midi,length*beat,voice),start*beat,gain,pan)
        events.append([round(start,3),midi,length,voice])
    def hit(kind,pos,gain,pan=0):
        jitter = RNG.uniform(-.003,.003) if kind in ['hat','metal'] else 0
        add(drums,drum(kind,RNG.uniform(.88,1.04)),pos*beat+jitter,gain,pan)
        if kind=='kick':
            idx=(np.arange(round(.22*SR))+round(pos*beat*SR))%n
            kick_duck[idx] = np.maximum(kick_duck[idx],np.exp(-np.arange(len(idx))/SR*18))
    for b in range(32):
        ci=(b//2)%4; chord=chords[ci]; br=root+bass_roots[ci]-12
        section=b//8; fill=b%8==7; p=b*4
        intensity = [.80,.96,.72,1.0][section]
        # Repeating eight-bar phrases with changed density and a bridge.
        if b%2==0:
            for i,offset in enumerate(chord):
                note(root+offset+12,p,7.95,'pad',(.031 if role=='title' else .022)*intensity,[-.6,-.2,.2,.6][i])
        if role=='title':
            for j,offset in enumerate([0,7,3,14]):
                note(root+chord[j]+12,p+j+.04*(j%2),1.8,'keys',.073*intensity,(-1)**j*.25)
            for q in [0,2.5]:
                note(br,p+q,1.2,'bass',.16)
            if section!=2 or b%2:
                hit('kick',p,.22); hit('kick',p+2.5,.16)
                hit('snare',p+2,.105)
            for q in [0,.5,1,1.5,2,2.5,3,3.5]:
                hit('hat',p+q,.033 if q%1 else .044,(-1)**int(q*2)*.35)
            if b%2==1:
                motif=motif_b if section==2 else motif_a
                for q,offset,length in motif:
                    note(root+24+offset,p+q,length*1.4,'bell',.047,-.16)
        elif role=='explore':
            kicks=[0,1.5,2.5,3.25] if b%2 else [0,.75,2,2.75]
            if section==2: kicks=[0,2.75]
            for q in kicks: hit('kick',p+q,.40)
            for q in [1,3]:hit('snare',p+q,.235)
            for q in np.arange(0,4,.25 if section==3 else .5):
                hit('hat',p+q,.047 if q%1 else .067,(-1)**int(q*4)*.45)
            if b%2:hit('open',p+3.5,.065,.38)
            for q,length,offset in [(0,.7,0),(.75,.4,0),(1.5,.7,7),(2.5,.45,0),(3.25,.55,10)]:
                note(br+offset,p+q,length,'bass',.26*intensity)
            pattern=[0,2,1,3,2,1,3,1]
            for j,ix in enumerate(pattern):
                if section==2 and j%2:continue
                note(root+chord[ix]+12,p+j*.5,.55,'pluck',.078*intensity,(-1)**j*.32)
            if b%2==1 and section!=0:
                for q,offset,length in (motif_b if section==2 else motif_a):
                    note(root+24+offset,p+q,length,'lead',.071,.12)
            hit('metal',p+1.75,.033,-.5)
        else:
            for q in ([0,1.5,2,3.5] if section!=2 else [0,2]):hit('kick',p+q,.46)
            for q in [1,3]:hit('snare',p+q,.24)
            for q in np.arange(0,4,.5):hit('hat',p+q,.041 if q%1 else .061,(-1)**int(q*2)*.38)
            for q in [0,.75,1.5,2,2.75,3.5]:
                note(br+(7 if q==2.75 else 0),p+q,.48,'bass',.29*intensity)
            for j in range(8):
                offset=chord[[0,2,1,2,0,3,1,2][j]]
                note(root+offset+12,p+j*.5,.39,'string',.060*intensity,(-1)**j*.22)
            if section in [1,3] or b%2==1:
                motif=motif_a if (b//2)%2==0 else motif_b
                for q,offset,length in motif:
                    note(root+12+offset,p+q,length,'lead',.078,.06)
            if b%4==2:note(root+31,p+3,1.8,'bell',.038,-.4)
        if b%8==0 and role!='title':hit('crash',p,.10,-.35)
        if fill:
            for j,q in enumerate([3,3.25,3.5,3.75]):
                hit('tom' if j%2 else 'snare',p+q,.085 if role=='title' else .17,(-1)**j*.32)
    duck = 1-kick_duck*(.22 if role=='title' else .38)
    music *= duck[:,None]
    mix = circular_fx(music,beat)+drums
    # Soft saturation catches isolated transient peaks; global gain is constant.
    mix = np.tanh(mix*1.15)/1.15
    mix -= mix.mean(axis=0)
    rms = np.sqrt(np.mean(mix**2)); target=10**(cfg['gain_db']/20)
    mix *= min(target/rms,.89/np.max(np.abs(mix)))
    # Sub-millisecond endpoint matching guards sample-rounding and PCM quantization.
    width=48
    delta=mix[-1]-mix[0]
    ramp=(.5-.5*np.cos(np.linspace(0,np.pi,width)))[:,None]
    mix[-width:] -= delta*ramp
    wav=OUT/(cfg['name']+'.wav'); ogg=ASSETS/(cfg['name']+'.ogg')
    sf.write(wav,mix,SR,subtype='PCM_24')
    subprocess.run(['ffmpeg','-v','error','-y','-i',str(wav),'-c:a','libvorbis','-q:a','5','-metadata','title='+cfg['title'],'-metadata','artist=Codename Seven / Friday procedural demo',str(ogg)],check=True)
    decoded=subprocess.check_output(['ffmpeg','-v','error','-i',str(ogg),'-f','f32le','-ac','2','-ar',str(SR),'-'])
    pcm=np.frombuffer(decoded,dtype='<f4').reshape(-1,2)
    boundary=float(np.max(np.abs(pcm[0]-pcm[-1])))
    usual=float(np.percentile(np.abs(np.diff(pcm,axis=0)),99))
    result={**cfg,'bars':32,'form':'A1(8) / A2(8) / bridge(8) / A3(8)','seconds':n/SR,'sample_rate':SR,'channels':2,'pcm_peak_dbfs':float(20*np.log10(np.max(np.abs(pcm)))),'pcm_rms_dbfs':float(20*np.log10(np.sqrt(np.mean(pcm**2)))),'decoded_frames':len(pcm),'expected_frames':n,'ogg_seam_jump':boundary,'ordinary_step_p99':usual,'ogg_bytes':ogg.stat().st_size,'ogg_sha256':hashlib.sha256(ogg.read_bytes()).hexdigest(),'wav_sha256':hashlib.sha256(wav.read_bytes()).hexdigest(),'event_count':len(events),'samples_used':'none; all instruments synthesized from equations','listening_status':'needs user listening; numerical tests do not establish musical quality'}
    (OUT/(cfg['role']+'-score.json')).write_text(json.dumps({'config':cfg,'note_events':events},ensure_ascii=False,indent=2),encoding='utf-8')
    if len(pcm)!=n or not np.isfinite(pcm).all() or np.max(np.abs(pcm))>=.999 or boundary>usual:
        raise RuntimeError('Audio validation failed: '+json.dumps(result))
    print(json.dumps(result,ensure_ascii=True),flush=True)
    return result

if __name__=='__main__':
    ASSETS.mkdir(parents=True,exist_ok=True)
    reports=[render(cfg) for cfg in CONFIGS]
    (OUT/'render-report.json').write_text(json.dumps(reports,ensure_ascii=False,indent=2),encoding='utf-8')
