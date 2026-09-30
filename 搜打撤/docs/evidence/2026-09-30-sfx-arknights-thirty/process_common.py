"""A2 editing standard for newly selected source effects, with a paired dry reference."""
from pathlib import Path
import hashlib
import subprocess
import numpy as np
import soundfile as sf
from scipy import signal

SR=48000


def ff(args,data=None):
    return subprocess.run(['ffmpeg','-v','error',*args],input=data,check=True,capture_output=True).stdout


def process(source, cue_id, output, evidence, *, pitch=-.5, tempo=1.04, shelf=-.6,
            release_ms=40, peak_db=-11, segment=None, percussive=True):
    source=Path(source); output=Path(output); evidence=Path(evidence)
    assert -.95<=pitch<=.95 and .97<=tempo<=1.09 and -1.5<=shelf<=0
    output.mkdir(parents=True,exist_ok=True); evidence.mkdir(parents=True,exist_ok=True)
    x=np.frombuffer(ff(['-i',str(source),'-ac','2','-ar',str(SR),'-f','f32le','-']),dtype='<f4').reshape(-1,2).copy()
    assert len(x)>0 and np.isfinite(x).all()
    source_seconds=len(x)/SR
    activity=np.max(abs(x),axis=1); active=np.flatnonzero(activity>max(activity.max()*10**(-58/20),1e-7))
    assert len(active)>0
    start=max(0,int(active[0])-round(.003*SR)); end=min(len(x),int(active[-1])+round(.03*SR)+1)
    if segment is not None:
        start=max(start,round(segment[0]*SR)); end=min(end,round(segment[1]*SR))
    assert end>start
    dry=x[start:end].copy()
    dry=signal.sosfilt(signal.butter(1,25,fs=SR,btype='highpass',output='sos'),dry,axis=0)
    dry=signal.sosfilt(signal.butter(1,17500,fs=SR,output='sos'),dry,axis=0)
    head=min(96,len(dry)//5); tail=min(384,len(dry)//5)
    dry[:head]*=np.linspace(0,1,head)[:,None]; dry[-tail:]*=np.linspace(1,0,tail)[:,None]
    dry*=10**(peak_db/20)/max(np.max(abs(dry)),1e-12)
    base_wav=evidence/(cue_id+'-base.wav'); sf.write(str(base_wav),dry,SR,subtype='PCM_24')
    base_ogg=output/(cue_id+'-base.ogg')
    ff(['-y','-i',str(base_wav),'-codec:a','libvorbis','-q:a','6',str(base_ogg)])
    filt=(f'rubberband=tempo={tempo}:pitch={2**(pitch/12):.9f}'
          f':transients={"crisp" if percussive else "mixed"}:detector={"percussive" if percussive else "compound"}'
          ':phase=laminar:window=short:smoothing=off:formant=preserved:pitchq=quality:channels=together')
    adjusted=np.frombuffer(ff(['-i',str(base_wav),'-af',filt,'-ac','2','-ar',str(SR),'-f','f32le','-']),dtype='<f4').reshape(-1,2).copy()
    low=signal.sosfilt(signal.butter(1,5600,fs=SR,output='sos'),adjusted,axis=0)
    adjusted=low+(adjusted-low)*10**(shelf/20)
    n=min(round(release_ms*.001*SR),len(adjusted)//5)
    adjusted[-n:]*=np.linspace(1,.55,n)[:,None]
    edge=min(240,len(adjusted)//5); adjusted[-edge:]*=np.linspace(1,0,edge)[:,None]
    adjusted*=10**(peak_db/20)/max(np.max(abs(adjusted)),1e-12)
    wav=evidence/(cue_id+'.wav'); sf.write(str(wav),adjusted,SR,subtype='PCM_24')
    ogg=output/(cue_id+'.ogg'); ff(['-y','-i',str(wav),'-codec:a','libvorbis','-q:a','6',str(ogg)])
    checks={}
    for key,path in [('base',base_ogg),('adjusted',ogg)]:
        decoded=np.frombuffer(ff(['-i',str(path),'-ac','2','-ar',str(SR),'-f','f32le','-']),dtype='<f4').reshape(-1,2)
        assert len(decoded)>0 and np.isfinite(decoded).all() and np.max(abs(decoded))<.9
        tp=np.max(abs(signal.resample_poly(decoded,4,1,axis=0))); assert tp<.95
        checks[key]=dict(seconds=round(len(decoded)/SR,6),peak_dbfs=round(float(20*np.log10(np.max(abs(decoded)))),3),
                         true_peak_dbfs=round(float(20*np.log10(tp)),3),decode='pass')
    return dict(id=cue_id,source_seconds=round(source_seconds,6),source_sha256=hashlib.sha256(source.read_bytes()).hexdigest(),
                crop_seconds=[round(start/SR,6),round(end/SR,6)],pitch_semitones=pitch,tempo=tempo,upper_shelf_db=shelf,
                release_ms=release_ms,peak_target_dbfs=peak_db,filter=filt,checks=checks)
