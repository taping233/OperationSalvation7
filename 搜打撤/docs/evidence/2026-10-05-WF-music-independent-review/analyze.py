"""Independent V7-only review. Reference PCM is decoded in memory, never saved.
Python 3.8+, existing numpy/scipy/librosa/soundfile/matplotlib/ffmpeg.
Run from any cwd. No imports from previous analysis/render scripts.
"""
import pathlib, json, hashlib, subprocess, re, sys, urllib.request, datetime
import xml.etree.ElementTree as ET
import numpy as np
import scipy, scipy.signal as sig
import librosa, soundfile as sf
OUT = pathlib.Path(__file__).resolve().parent
ROOT = OUT.parents[2]
IDENTITY = OUT.parent / '2026-10-05-WF-music-identity'
V7 = OUT.parent / '2026-10-05-WF-music-title-v7'
SR, AR, FFT, HOP = 48000, 24000, 2048, 256
BANDS = [(0,80),(80,250),(250,500),(500,2000),(2000,5000),(5000,10000),(10000,12001)]
sys.stdout.reconfigure(encoding='utf-8')

def dump(name, data):
    # The combined data duplicates per-record detail; compact JSON keeps it <1MB.
    (OUT/name).write_text(json.dumps(data, ensure_ascii=False, indent=None if name=='comparison.json' else 2, allow_nan=False), encoding='utf-8')

def fingerprint(p):
    p = pathlib.Path(p)
    return {'path':p.relative_to(ROOT).as_posix(),'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()}

def decode(source):
    p = subprocess.run(['ffmpeg','-v','error','-i',str(source),'-ar',str(SR),'-ac','2','-f','f32le','-'],capture_output=True,timeout=150)
    if p.returncode: raise RuntimeError(p.stderr.decode(errors='replace')[:500])
    x = np.frombuffer(p.stdout,dtype='<f4').reshape(-1,2).copy()
    assert len(x)>84*SR and np.isfinite(x).all()
    return x, hashlib.sha256(p.stdout).hexdigest()

def loudness(x):
    p = subprocess.run(['ffmpeg','-hide_banner','-nostats','-f','f32le','-ar',str(SR),'-ac','2','-i','-','-af','loudnorm=I=-23:TP=-1:LRA=11:print_format=json','-f','null','-'],input=x.astype('<f4').tobytes(),capture_output=True,timeout=120)
    assert p.returncode==0
    d=json.loads(re.findall(r'\{\s*"input_i".*?\}',p.stderr.decode(errors='replace'),re.S)[-1])
    return {k:float(d[k]) for k in ['input_i','input_tp','input_lra','input_thresh']}

def spatial(x):
    l,r = x[:,0].astype(float),x[:,1].astype(float)
    m,s=(l+r)/2,(l-r)/2
    me,se=np.mean(m*m),np.mean(s*s)
    return {'side_percent':float(100*se/(me+se+1e-30)), 'lr_correlation':float(np.corrcoef(l,r)[0,1]),
            'mono_rms_relative_stereo_db':float(10*np.log10(me/(me+se+1e-30)+1e-30))}

def spectra(x):
    stereo=librosa.resample(x.T,orig_sr=SR,target_sr=AR)
    powers=[np.abs(librosa.stft(c,n_fft=FFT,hop_length=HOP))**2 for c in stereo]
    return stereo,(powers[0]+powers[1])/2

def onset_metrics(env, seconds):
    ac=librosa.autocorrelate(env-env.mean(),max_size=round(1.6*AR/HOP))
    ac/=ac[0]+1e-30
    lo,hi=round(.25*AR/HOP),round(1.5*AR/HOP)
    peaks,_=sig.find_peaks(ac[lo:hi]);peaks=sorted(peaks+lo,key=lambda i:ac[i],reverse=True)[:3]
    counts={str(delta):len(librosa.onset.onset_detect(onset_envelope=env,sr=AR,hop_length=HOP,delta=delta)) for delta in [.05,.07,.10]}
    tempo=librosa.feature.tempo(onset_envelope=env,sr=AR,hop_length=HOP)
    return {'onsets_per_second':counts['0.07']/seconds,'onset_counts_delta':counts,
            'periodicity_peak':float(ac[lo:hi].max()),
            'periodicity_top_lags_seconds':[float(i*HOP/AR) for i in peaks],
            'estimated_bpm_diagnostic_only':float(tempo[0])}

def features(x):
    stereo,power=spectra(x);mag=np.sqrt(power);freq=librosa.fft_frequencies(sr=AR,n_fft=FFT)
    energy=power.mean(axis=1);active=power.sum(axis=0)>power.sum(axis=0).max()*1e-6
    cen=librosa.feature.spectral_centroid(S=mag,sr=AR)[0]
    bw=librosa.feature.spectral_bandwidth(S=mag,sr=AR,p=2)[0]
    mel=librosa.feature.melspectrogram(S=power,sr=AR,n_mels=32)
    env=librosa.onset.onset_strength(S=librosa.power_to_db(mel),sr=AR,hop_length=HOP)
    monoenv=librosa.onset.onset_strength(y=stereo.mean(axis=0),sr=AR,hop_length=HOP,n_fft=FFT)
    rms1=[float(20*np.log10(np.sqrt(np.mean(x[i:i+SR].astype(float)**2))+1e-30)) for i in range(0,len(x)-SR+1,SR)]
    rms=np.sqrt(np.mean(x.astype(float)**2));peak=np.abs(x).max()
    d={'centroid_mean_hz':float(cen[active].mean()),'bandwidth_mean_hz':float(bw[active].mean()),
       'bands_percent':[float(100*energy[(freq>=a)&(freq<b)].sum()/energy.sum()) for a,b in BANDS],
       'rms_dbfs':float(20*np.log10(rms)),'crest_db':float(20*np.log10(peak/rms)),
       'rms_1s_p90_p10_db':float(np.percentile(rms1,90)-np.percentile(rms1,10)),
       'onset_stereo_power':onset_metrics(env,len(x)/SR),
       'onset_mono_legacy_method':onset_metrics(monoenv,len(x)/SR)}
    d.update(spatial(x))
    return d

def full_structure(x):
    stereo,power=spectra(x);mel=librosa.feature.melspectrogram(S=power,sr=AR,n_mels=32)
    chroma=librosa.feature.chroma_stft(S=power,sr=AR,hop_length=HOP)
    n=len(x)//SR;vectors=[];cv=[];rms=[];bands=[]
    freq=librosa.fft_frequencies(sr=AR,n_fft=FFT)
    for i in range(n):
        a,b=round(i*AR/HOP),round((i+1)*AR/HOP)
        v=10*np.log10(mel[:,a:b].mean(axis=1)+1e-20);v-=v.mean();vectors.append((v/(np.linalg.norm(v)+1e-20)).tolist())
        c=chroma[:,a:b].mean(axis=1);cv.append((c/(np.linalg.norm(c)+1e-20)).tolist())
        z=x[i*SR:(i+1)*SR];rms.append(float(20*np.log10(np.sqrt(np.mean(z.astype(float)**2))+1e-30)))
        e=power[:,a:b].mean(axis=1);bands.append([float(100*e[(freq>=a0)&(freq<b0)].sum()/e.sum()) for a0,b0 in BANDS] if e.sum()>1e-25 else [0.0]*len(BANDS))
    vectors=np.array(vectors);novelty=[]
    for i in range(6,n-6):novelty.append(float(np.linalg.norm(vectors[i-6:i].mean(axis=0)-vectors[i:i+6].mean(axis=0))))
    centers=list(range(6,n-6));top=sig.find_peaks(novelty,distance=8)[0]
    top=sorted(top,key=lambda i:novelty[i],reverse=True)[:5]
    combined=np.concatenate([vectors/np.sqrt(2),np.array(cv)/np.sqrt(2)],axis=1)
    blocks=np.array([combined[i:i+4].mean(axis=0) for i in range(0,n-3,4)])
    dist=np.linalg.norm(blocks[:,None]-blocks[None,:],axis=2)
    recurrence=[]
    for i in range(len(blocks)):
        candidates=[j for j in range(len(blocks)) if abs(j-i)>=3]
        j=min(candidates,key=lambda j:dist[i,j]);recurrence.append({'at':i*4,'nearest_nonlocal_at':j*4,'distance':float(dist[i,j])})
    return {'rms_1s_dbfs':rms,'bands_1s_percent':bands,'spectral_shape_vectors':vectors.tolist(),
            'novelty_6s':novelty,'novelty_centers_seconds':centers,'novelty_median':float(np.median(novelty)),
            'novelty_peaks_seconds':[centers[i] for i in top], 'self_distance_4s':dist.tolist(),
            'nearest_nonlocal_4s':recurrence,'limitation':'Timbre+chroma similarity does not identify melodic repetition; scores available only for V7.'}

def chamber(x):
    # Independently transcribed linear V7 post-processing, never imports render.py.
    x=sig.sosfilt(sig.butter(2,28,btype='highpass',fs=SR,output='sos'),np.concatenate([x[-SR:],x]),axis=0)[SR:]
    x-=x.mean(axis=0);m=x.mean(axis=1)
    source=sig.sosfilt(sig.butter(2,[180,5600],btype='bandpass',fs=SR,output='sos'),np.concatenate([m[-SR:],m]))[SR:]
    wet=np.zeros_like(x)
    for ch in [0,1]:
        ir=np.zeros(len(x))
        for delay,w in [(.037,.12),(.079,.08),(.151,.055),(.283,.035),(.431,.020),(.691,.012),(.997,.007)]:ir[round((delay+ch*.013)*SR)]=w
        wet[:,ch]=np.fft.irfft(np.fft.rfft(source)*np.fft.rfft(ir),n=len(x))
    return x+wet*.24

def native_audit():
    root=ET.parse(V7/'01-title-frostglass-v7.mmp').getroot();tracks=[];note_rows=[]
    for t in root.findall('.//track'):
        it=t.find('instrumenttrack')
        if it is None:continue
        ins=it.find('instrument');patterns=[p for p in t.findall('pattern') if int(p.get('pos','0'))<6144]
        notes=[{'beat':(int(p.get('pos'))+int(n.get('pos')))/48,'length_beats':int(n.get('len'))/48,
                'midi':int(n.get('key'))+12,'velocity':float(n.get('vol'))} for p in patterns for n in p.findall('note')]
        audio=ins.find('audiofileprocessor');font=ins.find('sf2player')
        tracks.append({'name':t.get('name'),'pan':float(it.get('pan')),'instrument':ins.get('name'),
            'program':int(font.get('patch')) if font is not None else None,
            'first_cycle_patterns':len(patterns),'note_count':len(notes),
            'unique_patterns':len(set(tuple((n.get('key'),n.get('pos'),n.get('len')) for n in p.findall('note')) for p in patterns)),
            'midi_range':[min(n['midi'] for n in notes),max(n['midi'] for n in notes)] if audio is None else None,
            'velocity_range':[min(n['velocity'] for n in notes),max(n['velocity'] for n in notes)] if audio is None else None,
            'count_interpretation':'clip trigger count; not piano note count' if audio is not None else 'native MIDI notes',
            'frozen_audio':fingerprint(audio.get('src')) if audio is not None else None})
        if audio is None:note_rows.append({'track':t.get('name'),'notes':notes})
    old=json.loads((OUT.parent/'2026-10-05-WF-music-title-v5/render-report.json').read_text(encoding='utf-8'))
    pianos={k:v for k,v in old['authored_note_events'].items() if k in ['Piano melody','Quiet piano harmony']}
    oldroot=ET.parse(OUT.parent/'2026-10-05-WF-music-title-v6/01-title-frostglass-v6.mmp').getroot()
    unchanged={label:ET.tostring(next(t for t in root.findall('.//track') if t.get('name')==label))==ET.tostring(next(t for t in oldroot.findall('.//track') if t.get('name')==label)) for label in pianos}
    # Verify old note-event record against V5 native score, rather than trusting it.
    v5=ET.parse(OUT.parent/'2026-10-05-WF-music-title-v5/01-title-frostglass-v5.mmp').getroot()
    note_matches={}
    for label,events in pianos.items():
        t=next(t for t in v5.findall('.//track') if t.get('name')==label)
        parsed=sorted([(int(p.get('pos'))+int(n.get('pos')),int(n.get('key'))+12,int(n.get('len')),float(n.get('vol'))) for p in t.findall('pattern') if int(p.get('pos'))<6144 for n in p.findall('note')])
        recorded=sorted([(round(e['beat']*48),e['midi'],round(e['length']*48),float(e['velocity'])) for e in events])
        note_matches[label]=parsed==recorded
    piano_summary={}
    for label,events in pianos.items():
        velocity=lambda v:round(np.clip(v*.70+1,35,58)) if label=='Piano melody' else round(np.clip(v*.8,25,45))
        phrases=[]
        for start in [0,32,64,96]:
            phrases.append([(round(e['beat']-start,6),e['midi'],e['length'],velocity(e['velocity'])) for e in events if start<=e['beat']<start+32])
        piano_summary[label]={'actual_notes_per_cycle':len(events),'midi_range':[min(e['midi'] for e in events),max(e['midi'] for e in events)],
            'frozen_render_velocity_range':[min(velocity(e['velocity']) for e in events),max(velocity(e['velocity']) for e in events)],
            '8bar_phrase_note_counts':[len(v) for v in phrases],'phrases_identical_to_first':[v==phrases[0] for v in phrases]}
    v6report=json.loads((OUT.parent/'2026-10-05-WF-music-title-v6/render-report.json').read_text(encoding='utf-8'))
    frozen_matches={r['source_track']:fingerprint(ROOT/r['piano_clip_path'])['sha256']==r['piano_clip_sha256'] for r in v6report['piano_processing']}
    automation=[{'name':t.get('name'),'points':len(t.findall('.//time'))} for t in root.findall('.//track') if t.get('type')=='5']
    return {'bpm':float(root.find('head').get('bpm')),'delivered_bars':32,'tracks':tracks,'automation_tracks':automation,
        'piano_xml_same_as_v6':unchanged,'v5_note_record_matches_native_xml_after_tick_quantization':note_matches,
        'frozen_piano_matches_v6_report_sha256':frozen_matches,'piano_actual_summary':piano_summary,
        'piano_original_events':pianos,'backing_note_events':note_rows,
        'piano_performance_rule':'V6: CC64 down each 2 beats, lift at +1.92; melody note-on timing unchanged, velocity clip(round(v*0.70+1),35,58); harmony clip(round(v*0.8),25,45).',
        'reference_score_unavailable':True}

def stem_audit(final):
    n=len(final);base=ROOT/'.tmp/music-workstation/title-v7';paths=[base/'v7-full.wav',base/'v7-backing-only.wav']
    x=[]
    for p in paths:
        a,sr=sf.read(p,dtype='float32',always_2d=True);assert sr==SR and len(a)>=2*n;x.append(chamber(a[n:2*n].copy()))
    gain=float(np.sum(x[0][:-96]*final[:-96])/np.sum(x[0][:-96]**2))
    full,back=x[0]*gain,x[1]*gain;piano=full-back
    err=final[:-96]-full[:-96]
    result={'sources':[fingerprint(p) for p in paths],'fit_gain_db':float(20*np.log10(gain)),
        'reconstruction_error_relative_db':float(20*np.log10(np.sqrt(np.mean(err**2))/np.sqrt(np.mean(final[:-96]**2)))),
        'limit':'Backing is native muted-piano export. Piano is full minus backing, including render differences, not isolated dry piano. Last 96 seam samples excluded from fit.'}
    for label,(a,b) in {'opening_0_2':(0,2),'legacy_12_60':(12,60),'late_60_84':(60,84)}.items():
        p=piano[a*SR:b*SR];q=back[a*SR:b*SR];_,pp=spectra(p);_,qp=spectra(q)
        pe,qe=pp.mean(axis=1),qp.mean(axis=1);freq=librosa.fft_frequencies(sr=AR,n_fft=FFT)
        ratios=[]
        for lo,hi in BANDS:
            sel=(freq>=lo)&(freq<hi);ratios.append(float(10*np.log10((qe[sel].sum()+1e-30)/(pe[sel].sum()+1e-30))))
        result[label]={'backing_rms_relative_full':float(np.sqrt(np.mean(q*q))/np.sqrt(np.mean(final[a*SR:b*SR]**2))),
            'backing_over_piano_band_db':ratios,'normalized_spectral_overlap':float(np.minimum(pe/pe.sum(),qe/qe.sum()).sum()),
            'backing_piano_waveform_correlation':float(np.corrcoef(p.ravel(),q.ravel())[0,1])}
    return result

def main():
    meta=[];references=[]
    for cid in ['125099','306834','697622']:
        url='https://monster-siren.hypergryph.com/api/song/'+cid
        with urllib.request.urlopen(url,timeout=40) as r:raw=r.read();status=r.status
        d=json.loads(raw);song=d['data'];assert song['cid']==cid
        dump('official-song-'+cid+'.json',d)
        meta.append({'cid':cid,'api':url,'http':status,'response_sha256':hashlib.sha256(raw).hexdigest(),'song_page':'https://monster-siren.hypergryph.com/music/'+cid,'sourceUrl':song['sourceUrl']})
        references.append((cid,song['name'],song['sourceUrl']))
    dump('sources.json',meta)
    inputs=[('title-v7','霜窗回声 V7',str(V7/'01-title-frostglass-v7.wav'))]+references
    records=[];final=None
    for key,name,source in inputs:
        if '--resume' in sys.argv and (OUT/(key+'.json')).exists():
            record=json.loads((OUT/(key+'.json')).read_text(encoding='utf-8'))
            # Official signed CDN URLs rotate; the stable media filename identifies
            # the completed in-session record. Its acquisition URL and PCM hash stay intact.
            assert pathlib.Path(record['source']).name==pathlib.Path(source).name
            if key=='title-v7':
                final,sha=decode(source);assert sha==record['decoded_pcm_sha256']
            records.append(record);print('reuse completed '+key,flush=True);continue
        print('decode '+key,flush=True);x,sha=decode(source);dur=len(x)/SR
        if key=='title-v7':final=x
        segments={'legacy_12_60':(12,60),'opening_0_24':(0,24),'middle_36_60':(36,60),'late_60_84':(60,84)}
        for pct in [.1,.4,.7]:start=pct*(dur-24);segments['position_'+str(int(pct*100))]=(start,start+24)
        measurements={}
        for label,(a,b) in segments.items():
            z=x[round(a*SR):round(b*SR)];measurements[label]={'start':a,'end':b,'metrics':features(z)}
        record={'id':key,'name':name,'source':source if key!='title-v7' else pathlib.Path(source).relative_to(ROOT).as_posix(),
            'decoded_pcm_sha256':sha,'frames':len(x),'seconds':dur,'full_loudness':loudness(x),
            'full_spatial':spatial(x),'segments':measurements,'structure':full_structure(x)}
        if key=='title-v7':record['file']=fingerprint(source)
        records.append(record);dump(key+'.json',record);print('done '+key,flush=True)
    audit=native_audit();dump('native-audit.json',audit);dump('stem-audit.json',stem_audit(final))
    result={'created_at':datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=8))).isoformat(),
        'scope':'Only title V7 plus three official references; exploration/battle excluded.',
        'environment':{'python':sys.version,'numpy':np.__version__,'scipy':scipy.__version__,'librosa':librosa.__version__,'soundfile':sf.__version__,
            'ffmpeg':subprocess.run(['ffmpeg','-version'],capture_output=True,text=True,check=True).stdout.splitlines()[0]},
        'method':{'decoded_sr':SR,'channels':2,'analysis_sr':AR,'fft':FFT,'hop':HOP,'bands_hz':BANDS,
            'gain':'No source normalization. Band shares, stereo fractions, normalized log-mel structure gain-independent. LUFS uses input fields only.',
            'onset':'Primary = mean stereo power mel flux. Mono legacy computed separately. delta=.05,.07,.10 robustness; tempo diagnostic only.',
            'structure':'1s log-mel shape centered and L2 normalized; six seconds each side distance. 4s block timbre+chroma distances are not melody identity.',
            'segments':'4 fixed-time excerpts plus 3 equal-24s positions using start=p*(duration-24). No beat/semantic alignment claimed.'},
        'records':records}
    dump('comparison.json',result)
    print(json.dumps([{'id':r['id'],'loudness':r['full_loudness'],'main':r['segments']['legacy_12_60']['metrics']} for r in records],ensure_ascii=False),flush=True)

if __name__=='__main__': main()
