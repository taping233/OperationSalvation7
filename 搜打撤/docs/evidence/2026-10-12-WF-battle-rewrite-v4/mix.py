"""v4 mix-only revision; v3 pitch, onset, duration and velocity preserved."""
import concurrent.futures
import hashlib
import importlib.util
import json
import pathlib
import shutil
import subprocess
import xml.etree.ElementTree as ET
import numpy as np
import soundfile as sf
from scipy.signal import butter, sosfilt
from scipy.ndimage import uniform_filter1d

OUT=pathlib.Path(__file__).resolve().parent
ROOT=OUT.parents[2]
V3=ROOT/'docs/evidence/2026-10-12-WF-battle-rewrite-v3'
SPEC=importlib.util.spec_from_file_location('renderer',ROOT/'docs/evidence/2026-10-12-WF-battle-rewrite-v2/compose.py')
ENGINE=importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(ENGINE)
ENGINE.OUT=OUT
ENGINE.GROUPS={'bass':['Synth bass pulse','Cello floor'],'kick':['Kick'],
    'beat':['Snare and ghosts','Hats','Low percussion'],
    'theme':['Ensemble theme','Muted brass answer','Viola response'],
    'detail':['Pizzicato motor','Electric piano','Harp turn','Dark glass','Air pad']}
SR=48000
NAME='battle-shadowtide-v4-30s'
ACTIVE=[(3.75,15),(18.75,26.25)]

def dump(name,value):
    (OUT/name).write_text(json.dumps(value,ensure_ascii=False,indent=2),encoding='utf-8')

def preserve_project():
    source=V3/'battle-shadowtide-v3-30s.mmp'
    tree=ET.parse(source)
    previous=[ET.tostring(t) for t in tree.findall('.//track')]
    tree.find('.//projectnotes').text='Shadowtide v4 mix revision; all v3 notes/velocities preserved. Bus gains and slow level control in mix.py.'
    project=OUT/(NAME+'.mmp')
    tree.write(project,encoding='utf-8',xml_declaration=True)
    if previous!=[ET.tostring(t) for t in ET.parse(project).findall('.//track')]:
        raise RuntimeError('Score preservation failed')
    shutil.copyfile(V3/'score.json',OUT/'score.json')
    return project

def level_bus(x,window,amount,max_db,label):
    # Slow gain correction, not transient compression; the kick never enters it.
    power=np.mean(x*x,axis=1)
    rms=np.sqrt(np.maximum(uniform_filter1d(power,size=round(window*SR),mode='nearest'),1e-18))
    db=20*np.log10(rms+1e-12)
    mask=np.zeros(len(x),bool)
    for a,b in ACTIVE:
        mask[round(a*SR):round(b*SR)]=True
    target=float(np.median(db[mask]))
    gains=np.clip((target-db)*amount,-max_db,max_db)
    gains=uniform_filter1d(gains,size=round(.25*SR),mode='nearest')
    # Fade correction out around the intentional breathing/cadence sections.
    weight=uniform_filter1d(mask.astype(float),size=round(.35*SR),mode='nearest')
    gains*=weight
    knots=np.arange(0,len(x),SR//20)
    dump(label+'-gain-curve.json',{'window_seconds':window,'amount':amount,'limit_db':max_db,
        'active_sections':ACTIVE,'times_seconds':(knots/SR).tolist(),'gain_db':gains[knots].tolist(),
        'active_gain_min_db':float(gains[mask].min()),'active_gain_max_db':float(gains[mask].max())})
    return x*10**(gains[:,None]/20)

def envelope_span(x,active=False):
    mono=x.mean(axis=1)
    values=[]
    for i in range(0,len(x)-SR//2+1,SR//2):
        t=(i+SR/4)/SR
        if active and not any(a<=t<b for a,b in ACTIVE):
            continue
        values.append(20*np.log10(np.sqrt(np.mean(mono[i:i+SR//2]**2))+1e-12))
    return float(np.percentile(values,90)-np.percentile(values,10))

def run():
    project=preserve_project()
    stems={}
    provenance=[]
    for group in ['beat','theme','detail']:
        source=V3/(group+'-native.wav')
        target=OUT/source.name
        shutil.copyfile(source,target)
        if hashlib.sha256(source.read_bytes()).digest()!=hashlib.sha256(target.read_bytes()).digest():
            raise RuntimeError('Stem copy mismatch')
        data,sr=sf.read(target,always_2d=True)
        if sr!=SR:
            raise RuntimeError('Unexpected sample rate')
        stems[group]=data[:SR*30]
        provenance.append({'file':target.relative_to(ROOT).as_posix(),'source':source.relative_to(ROOT).as_posix(),
            'method':'Byte-identical v3 native stem reuse'})
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
        futures={g:pool.submit(ENGINE.render_stem,g,project) for g in ['bass','kick']}
        for group,future in futures.items():
            stems[group]=future.result()
            provenance.append({'file':(OUT/(group+'-native.wav')).relative_to(ROOT).as_posix(),
                'method':'Native LMMS isolated render of unchanged v3 bass/cello or kick track'})
    bass=sosfilt(butter(2,28,'highpass',fs=SR,output='sos'),stems['bass'],axis=0)
    bass=sosfilt(butter(2,2200,'lowpass',fs=SR,output='sos'),bass,axis=0)
    bass=np.repeat(bass.mean(axis=1)[:,None],2,axis=1)*.65*10**(-.5/20)
    bass=level_bus(bass,.75,.5,2.0,'bass')
    kick=sosfilt(butter(2,28,'highpass',fs=SR,output='sos'),stems['kick'],axis=0)
    kick=sosfilt(butter(2,2200,'lowpass',fs=SR,output='sos'),kick,axis=0)
    kick=np.repeat(kick.mean(axis=1)[:,None],2,axis=1)*.65*10**(.8/20)
    beat=sosfilt(butter(2,180,'highpass',fs=SR,output='sos'),stems['beat'],axis=0)*10**(2/20)
    theme=sosfilt(butter(2,[190,3300],'bandpass',fs=SR,output='sos'),stems['theme'],axis=0)*1.1
    theme=level_bus(theme,.65,.4,1.8,'theme')
    detail=sosfilt(butter(2,[220,4500],'bandpass',fs=SR,output='sos'),stems['detail'],axis=0)
    room=sosfilt(butter(2,[400,2400],'bandpass',fs=SR,output='sos'),(theme+detail).mean(axis=1))
    left=sum(g*ENGINE.delay(room,d) for d,g in [(19,.24),(43,.14),(79,.09),(127,.05)])
    right=sum(g*ENGINE.delay(room,d) for d,g in [(31,.24),(59,.14),(97,.09),(149,.05)])
    x=bass+kick+beat+theme+detail+np.column_stack([left,right])
    # A gentle section-aware correction of remaining slow balance variation.
    x=level_bus(x,.8,.35,1.3,'support')
    mid=x.mean(axis=1)
    side=sosfilt(butter(4,160,'highpass',fs=SR,output='sos'),(x[:,0]-x[:,1])/2)*2
    x=np.column_stack([mid+side,mid-side])
    x-=x.mean(axis=0)
    x[:480]*=np.linspace(0,1,480)[:,None]
    x[-19200:]*=np.cos(np.linspace(0,np.pi/2,19200))[:,None]**2
    wav,mp3=OUT/(NAME+'.wav'),OUT/(NAME+'.mp3')
    sf.write(wav,x,SR,subtype='PCM_24')
    before=ENGINE.BASE.measure(wav)
    gain=min(-19.5-before['input_i'],-2-before['input_tp'])
    x*=10**(gain/20)
    sf.write(wav,x,SR,subtype='PCM_24')
    subprocess.run(['ffmpeg','-v','error','-y','-i',str(wav),'-c:a','libmp3lame','-b:a','256k',
        '-metadata','title=Shadowtide v4',str(mp3)],check=True)
    subprocess.run(['ffmpeg','-v','error','-i',str(mp3),'-f','null','-'],check=True)
    final=ENGINE.BASE.measure(mp3)
    old,sr=sf.read(V3/'battle-shadowtide-v3-30s.wav',always_2d=True)
    old_active,new_active=envelope_span(old,True),envelope_span(x,True)
    notes_preserved=(OUT/'score.json').read_bytes()==(V3/'score.json').read_bytes()
    checks={'all_v3_score_events_preserved':notes_preserved,'exact_30s':len(x)==SR*30,
        'finite_pcm':bool(np.isfinite(x).all()),'no_clipping':bool(np.max(np.abs(x))<1),
        'true_peak_below_minus_1':final['input_tp']<=-1,'matched_loudness':abs(final['input_i']+19.5)<.15,
        'active_section_energy_variation_reduced':new_active<old_active}
    files=[project,wav,mp3,OUT/'score.json']+[OUT/(g+'-native.wav') for g in ENGINE.GROUPS]
    report={'bpm':128,'seconds':30,'mp3_measurement':final,'master_gain_db':gain,'checks':checks,
        'v3_envelope_span_db':{'full':envelope_span(old),'active':old_active},
        'v4_envelope_span_db':{'full':envelope_span(x),'active':new_active},
        'bus_adjustments_db':{'bass_static':-.5,'kick_static':.8,'snare_hats_percussion_static':2},
        'provenance':provenance,'files':[{'path':p.relative_to(ROOT).as_posix(),'bytes':p.stat().st_size,
            'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in files],
        'listening':'No actual listening; mix revision assessed with scope checks and audio measurements, pending user audition.'}
    dump('render-report.json',report)
    if not all(checks.values()):
        raise RuntimeError('Verification failed: '+str(checks))
    print(json.dumps({'complete':True,'v3_active_span':old_active,'v4_active_span':new_active,**final}),flush=True)

if __name__=='__main__':
    run()
