"""Focused piano continuity and quieter battle; retain initial exploration/shop."""
import pathlib,importlib.util,json,subprocess
import numpy as np
import soundfile as sf
from scipy.signal import butter,sosfilt,sosfiltfilt
OUT=pathlib.Path(__file__).resolve().parent;ROOT=OUT.parents[2];SR=48000;N=SR*30
PREV=OUT.parent/'2026-10-09-WF-music-redirection'
spec=importlib.util.spec_from_file_location('previous',PREV/'compose.py');base=importlib.util.module_from_spec(spec);spec.loader.exec_module(base);base.OUT=OUT

def piano_connected(notes,seconds):
    base.get_samples(notes);cache={};out=np.zeros((N,2));ordered=sorted(notes,key=lambda n:n['start'])
    changes=[0,4,8,12,16,20,24,28,30,36]
    for n in ordered:
        root,name=base.sample_id(n['key'],n['velocity'])
        if name not in cache:
            x,sr=sf.read(base.SAMPLES/name,dtype='float32',always_2d=True)
            if sr!=SR:raise ValueError('Sample-rate change')
            onset=np.flatnonzero(np.max(np.abs(x[:SR//5]),axis=1)>np.max(np.abs(x))*.002)
            trim=min(int(onset[0]) if len(onset) else 0,SR//10);x=x[trim:SR*10]
            # Balance sampled key attacks within ±6dB instead of compounding layer gain.
            attack=base.rms(x[SR//100:round(.42*SR)])
            x*=np.clip(.085/max(attack,1e-8),.5,2)
            cache[name]=x
        x=cache[name];speed=2**((n['key']-root)/12)
        lift=next(b for b in changes if b>n['beat']+.001)*seconds-.035
        sustain=max(n['duration'],lift-n['start'])
        following=[q['start'] for q in ordered if q['key']==n['key'] and q['start']>n['start']+.025]
        if following:sustain=min(sustain,min(following)-n['start']+.025)
        dur=min(sustain+.85,30-n['start']);length=max(0,round(dur*SR))
        indices=np.minimum(np.arange(length)*speed,len(x)-1)
        y=np.stack([np.interp(indices,np.arange(len(x)),x[:,ch]) for ch in range(2)],axis=1)
        release=round(max(0,sustain)*SR);env=np.ones(length)
        if release<length:env[release:]=np.exp(-np.arange(length-release)/SR*5.5)
        y*=env[:,None]*(n['velocity']/64)**.9
        start=round(n['start']*SR);l=min(length,N-start)
        if l>0:out[start:start+l]+=y[:l]
    return out

def master(role,result,attenuation_db=0):
    wav=OUT/(role+'-rewrite-30s.wav');mp3=wav.with_suffix('.mp3');x,sr=sf.read(wav,dtype='float32',always_2d=True)
    if role=='battle':
        bright=sosfilt(butter(2,3800,btype='highpass',fs=SR,output='sos'),x,axis=0)
        x-=bright*.32
    x*=10**(attenuation_db/20)
    sf.write(wav,x,sr,subtype='PCM_24')
    subprocess.run(['ffmpeg','-v','error','-y','-i',str(wav),'-c:a','libmp3lame','-b:a','256k',str(mp3)],check=True)
    result['files']=[base.fp(wav),base.fp(mp3)];result['master_attenuation_db']=attenuation_db
    (OUT/(role+'-score.json')).write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
    return result

base.piano_pcm=piano_connected
title=base.title()
lead=sorted([n for n in title.notes if n['hand']=='right' and n['velocity']>=45],key=lambda n:n['start'])
before_gaps=[];after_gaps=[]
for i,n in enumerate(lead[:-1]):
    following=lead[i+1];gap=following['start']-(n['start']+n['duration']);before_gaps.append(gap)
    boundary=following['beat'] in [8.1,16.1,24.1,30.25]
    # Hold until the next attack, except for a small breath at a real phrase boundary.
    n['duration']=following['start']-n['start']+(-.085 if boundary else .065 if n['key']!=following['key'] else -.015)
    after_gaps.append(following['start']-(n['start']+n['duration']))
    n['velocity']=int(np.clip(n['velocity'],49,57))
title_result=title.render();title_result['legato_key_gap_before_seconds']=before_gaps;title_result['legato_key_gap_after_seconds']=after_gaps
title_result=master('title',title_result)

battle=base.battle();original_note_count=len(battle.notes)
battle.parts['Electric guitar drive'].update(patch=29,target=-31)
battle.parts['FM hook'].update(target=-28)
battle.parts['Finger bass'].update(target=-30)
battle.parts['Drum groove'].update(target=-31)
kept=[]
for n in battle.notes:
    part,key,beat=n['part'],n['key'],n['beat'];bar=int(beat//4);off=round(beat%4,2)
    if part=='Drum groove':
        if key==42 and off%1!=0:continue
        if key==49 and bar not in [0,10]:continue
        if key==45:continue
        if key==38:n['velocity']=max(26,n['velocity']-12)
    if part=='Electric guitar drive' and off in [.75,3.25]:continue
    kept.append(n)
battle.notes=kept
battle_result=battle.render();battle_result['note_count_before']=original_note_count;battle_result['note_count_after']=len(kept)
battle_result=master('battle',battle_result,-4)

original=ROOT/'game/assets/music-demo/02-explore-ashline.ogg'
shop=OUT.parent/'2026-10-09-WF-shop-remake/shop-lamplight-deal-30s.mp3'
report=[title_result,battle_result,dict(role='explore',retained_initial_version=True,files=[base.fp(original)]),dict(role='shop',retained_unchanged=True,files=[base.fp(shop)])]
(OUT/'render-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(dict(legato_max_gap_before=max(before_gaps),legato_max_gap_after=max(after_gaps),battle_notes_before=original_note_count,battle_notes_after=len(kept)),ensure_ascii=True))
