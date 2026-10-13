"""Periodic v4-style mixing and sample-accurate loop validation."""
import hashlib
import importlib.util
import json
import pathlib
import subprocess
import numpy as np
import soundfile as sf
from scipy.signal import butter,sosfilt
from scipy.ndimage import uniform_filter1d

OUT=pathlib.Path(__file__).resolve().parent
ROOT=OUT.parents[2]
SR=48000
SECONDS=120
FRAMES=SR*SECONDS
NAME='battle-shadowtide-full-loop'
ACTIVE=[(3.75,60),(75,112.5)]
SPEC=importlib.util.spec_from_file_location('prior_mix',ROOT/'docs/evidence/2026-10-12-WF-battle-rewrite-v4/mix.py')
OLD=importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(OLD)

def dump(name,value):
    (OUT/name).write_text(json.dumps(value,ensure_ascii=False,indent=2),encoding='utf-8')

def native(group):
    x,sr=sf.read(OUT/(group+'-loop-native.wav'),dtype='float32',always_2d=True)
    if sr!=SR or len(x)!=FRAMES or not np.isfinite(x).all():
        raise RuntimeError('Invalid loop stem: '+group)
    return x

def filt(x,cutoff,kind,order=2):
    # Warm filters with the previous period's tail instead of resetting at zero.
    sos=butter(order,cutoff,kind,fs=SR,output='sos').astype(np.float32)
    padded=np.concatenate([x[-2*SR:],x],axis=0)
    return sosfilt(sos,padded,axis=0)[2*SR:].copy()

def level(x,window,amount,limit,label):
    power=np.mean(x*x,axis=1)
    rms=np.sqrt(np.maximum(uniform_filter1d(power,size=round(window*SR),mode='wrap'),1e-18))
    db=20*np.log10(rms+1e-12)
    mask=np.zeros(FRAMES,bool)
    for a,b in ACTIVE:
        mask[round(a*SR):round(b*SR)]=True
    gains=np.clip((float(np.median(db[mask]))-db)*amount,-limit,limit)
    gains=uniform_filter1d(gains,size=round(.25*SR),mode='wrap')
    gains*=uniform_filter1d(mask.astype(np.float32),size=round(.35*SR),mode='wrap')
    knots=np.arange(0,FRAMES,SR//20)
    dump(label+'-gain-curve.json',{'window_seconds':window,'amount':amount,'limit_db':limit,
        'active_seconds':ACTIVE,'time_seconds':(knots/SR).tolist(),'gain_db':gains[knots].tolist()})
    return x*np.power(10,gains[:,None]/20).astype(np.float32)

def decode_stats(path):
    process=subprocess.run(['ffmpeg','-v','error','-i',str(path),'-ac','2','-ar',str(SR),
        '-f','f32le','-'],capture_output=True,check=True)
    x=np.frombuffer(process.stdout,dtype=np.float32).reshape(-1,2)
    return {'frames':len(x),'seconds':len(x)/SR,'finite':bool(np.isfinite(x).all()),
        'decoded_endpoint_step':float(np.max(np.abs(x[-1]-x[0]))),
        'decoded_seam_second_difference':float(np.max(np.abs((x[1]-x[0])-(x[0]-x[-2]))))}

def run():
    bass=filt(filt(native('bass'),28,'highpass'),2200,'lowpass')
    bass=np.repeat(bass.mean(axis=1)[:,None],2,axis=1)*.65*10**(-.5/20)
    bass=level(bass,.75,.5,2,'bass')
    kick=filt(filt(native('kick'),28,'highpass'),2200,'lowpass')
    kick=np.repeat(kick.mean(axis=1)[:,None],2,axis=1)*.65*10**(.8/20)
    beat=filt(native('beat'),180,'highpass')*10**(2/20)
    theme=level(filt(native('theme'),[190,3300],'bandpass')*1.1,.65,.4,1.8,'theme')
    detail=filt(native('detail'),[220,4500],'bandpass')
    room=filt((theme+detail).mean(axis=1),[400,2400],'bandpass')
    left=sum(g*np.roll(room,round(d*SR/1000)) for d,g in [(19,.24),(43,.14),(79,.09),(127,.05)])
    right=sum(g*np.roll(room,round(d*SR/1000)) for d,g in [(31,.24),(59,.14),(97,.09),(149,.05)])
    x=bass+kick+beat+theme+detail+np.column_stack([left,right])
    del bass,kick,beat,theme,detail,room,left,right
    x=level(x,.8,.35,1.3,'support')
    mid=x.mean(axis=1)
    side=filt((x[:,0]-x[:,1])/2,160,'highpass',4)*2
    x=np.column_stack([mid+side,mid-side]).astype(np.float32)
    x-=x.mean(axis=0,dtype=np.float64).astype(np.float32)
    # No fade-in/out. Correct only 2ms of endpoint DC/phase residual if necessary.
    delta=x[-1]-x[0]
    curve=(.5-.5*np.cos(np.linspace(0,np.pi,96))).astype(np.float32)
    x[-96:]-=curve[:,None]*delta
    wav=OUT/(NAME+'.wav')
    sf.write(wav,x,SR,subtype='PCM_24')
    before=OLD.ENGINE.BASE.measure(wav)
    gain=min(-19.5-before['input_i'],-2-before['input_tp'])
    x*=10**(gain/20)
    sf.write(wav,x,SR,subtype='PCM_24')
    opus=OUT/(NAME+'.ogg')
    mp3=OUT/(NAME+'.mp3')
    twice=OUT/(NAME+'-two-cycles.mp3')
    for target,codec in [(opus,['-c:a','libopus','-b:a','160k','-vbr','on','-application','audio']),
                         (mp3,['-c:a','libmp3lame','-b:a','256k'])]:
        subprocess.run(['ffmpeg','-v','error','-y','-i',str(wav),*codec,
            '-metadata','title=Shadowtide full loop',str(target)],check=True)
    subprocess.run(['ffmpeg','-v','error','-y','-stream_loop','1','-i',str(wav),'-t',str(SECONDS*2),
        '-c:a','libmp3lame','-b:a','256k',str(twice)],check=True)
    final=OLD.ENGINE.BASE.measure(opus)
    decoded={p.name:decode_stats(p) for p in [opus,mp3,twice]}
    pcm,sr=sf.read(wav,dtype='float32',always_2d=True)
    ordinary=np.abs(np.diff(pcm,axis=0))
    p99=float(np.percentile(ordinary,99))
    boundary=float(np.max(np.abs(pcm[0]-pcm[-1])))
    seam_curvature=float(np.max(np.abs((pcm[1]-pcm[0])-(pcm[0]-pcm[-2]))))
    rms=lambda y:float(np.sqrt(np.mean(y.astype(np.float64)**2)))
    edge_level_db=float(20*np.log10((rms(pcm[:SR//10])+1e-12)/(rms(pcm[-SR//10:])+1e-12)))
    halfseconds=[rms(pcm[i:i+SR//2]) for i in range(0,FRAMES,SR//2)]
    score=json.loads((OUT/'score.json').read_text(encoding='utf-8'))
    checks={'exact_120s_48k_pcm':len(pcm)==FRAMES and sr==SR,'finite_pcm':bool(np.isfinite(pcm).all()),
        'no_clipping':bool(np.max(np.abs(pcm))<1),'no_halfsecond_silence':all(v>10**(-45/20) for v in halfseconds),
        'sample_boundary_below_normal_p99':boundary<=p99,
        'seam_curvature_below_normal_p99':seam_curvature<=p99,
        'opus_sample_accurate_length':decoded[opus.name]['frames']==FRAMES,
        'two_cycles_exact_duration':decoded[twice.name]['frames']==2*FRAMES,
        'opus_boundary_below_normal_p99':decoded[opus.name]['decoded_endpoint_step']<=p99,
        'true_peak_below_minus_1':final['input_tp']<=-1,
        'matched_approved_loudness':abs(final['input_i']+19.5)<.2,
        'no_large_100ms_boundary_energy_drop':abs(edge_level_db)<=9,
        'harmonic_turnaround_A7_to_Dm':score['progression'][-1]=='A7' and score['progression'][0]=='Dm'}
    files=[OUT/(NAME+'.mmp'),opus,mp3,twice,OUT/'score.json',
        ROOT/'.tmp/music-workstation/GeneralUser-GS.sf2']+sorted(OUT.glob('*.wav'))
    dump('render-report.json',{'bpm':128,'bars':64,'seconds':120,'sections':score['sections'],
        'master_gain_db':gain,'opus_measurement':final,'checks':checks,'decoded_formats':decoded,
        'seam':{'pcm_endpoint_step':boundary,'ordinary_adjacent_step_p99':p99,
            'pcm_seam_second_difference':seam_curvature,'first_vs_last_100ms_rms_db':edge_level_db,
            'endpoint_correction_ms':2,'endpoint_correction_pre_master_amplitude':delta.tolist(),
            'fade_in_or_out':False,'note':'Acoustic sample continuity checks do not constitute human listening.'},
        'files':[{'path':p.relative_to(ROOT).as_posix(),'bytes':p.stat().st_size,
            'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in files],
        'method':'Five LMMS stems rendered for two native cycles; second cycle retained; periodic filters/gain/reflections and 2ms endpoint correction; no zero padding or demo fades.',
        'listening':'User audition pending; Ogg Opus and WAV preserve the verified loop frame count. MP3 player looping depends on gapless support.'})
    print(json.dumps({'checks':checks,'seam_step':boundary,'seam_curvature':seam_curvature,'ordinary_step_p99':p99,
        'edge_level_db':edge_level_db,**final}),flush=True)
    if not all(checks.values()):
        raise RuntimeError('Loop verification failed')

if __name__=='__main__':
    run()
