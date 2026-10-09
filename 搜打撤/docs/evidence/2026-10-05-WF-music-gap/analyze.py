"""Matched audio measurements, plus full-recording loudness and authored score audit.
References: official MSR song API. Reference PCM stays in memory, no audio saved.
"""
import pathlib,json,hashlib,subprocess,re,concurrent.futures,time,xml.etree.ElementTree as ET,sys
import numpy as np
import librosa
from scipy.signal import butter,sosfilt
ROOT=pathlib.Path(__file__).resolve().parents[3];OUT=pathlib.Path(__file__).resolve().parent
IDENTITY=OUT.parent/'2026-10-05-WF-music-identity'
SR=48000; ANALYSIS_SR=24000;HOP=256;NFFT=2048
sys.stdout.reconfigure(encoding='utf-8')
BANDS=[('20–80 Hz',20,80),('80–250 Hz',80,250),('250–500 Hz',250,500),('500–2000 Hz',500,2000),('2–5 kHz',2000,5000),('5–10 kHz',5000,10000),('10–12 kHz',10000,12001)]

def load(item):
    name,source,group,bpm=item
    result=subprocess.run(['ffmpeg','-v','error','-i',source,'-ar',str(SR),'-ac','2','-f','f32le','-'],capture_output=True,timeout=100)
    if result.returncode:raise RuntimeError(name+': '+result.stderr.decode(errors='replace')[:200])
    pcm=np.frombuffer(result.stdout,dtype='<f4').reshape(-1,2).copy()
    if len(pcm)<60*SR:raise RuntimeError(name+' too short for matched 12–60s analysis')
    return {'name':name,'source':source,'group':group,'authored_bpm':bpm,'pcm':pcm,'sha':hashlib.sha256(result.stdout).hexdigest()}

def loudness(pcm):
    result=subprocess.run(['ffmpeg','-hide_banner','-nostats','-f','f32le','-ar',str(SR),'-ac','2','-i','-','-af','loudnorm=I=-23:TP=-1:LRA=11:print_format=json','-f','null','-'],input=pcm.astype('<f4').tobytes(),capture_output=True,timeout=90)
    if result.returncode:raise RuntimeError('Loudness analysis failed')
    match=re.findall(r'\{\s*"input_i".*?\}',result.stderr.decode(errors='replace'),re.S)
    if not match:raise RuntimeError('Missing loudnorm summary')
    data=json.loads(match[-1]);return {k:float(data[k]) for k in ['input_i','input_tp','input_lra','input_thresh']}

def width(pcm):
    l,r=pcm[:,0],pcm[:,1];mid=(l+r)*.5;side=(l-r)*.5
    return {'side_mid_energy_db':float(10*np.log10((np.mean(side*side)+1e-15)/(np.mean(mid*mid)+1e-15))),'lr_correlation':float(np.corrcoef(l,r)[0,1])}

def score_audit(path):
    tree=ET.parse(path).getroot();bpm=float(tree.find('head').get('bpm'));rows=[]
    for track in tree.findall('.//track'):
        patterns=[p for p in track.findall('pattern') if int(p.get('pos'))<48*192]
        if not patterns:continue
        signatures=[tuple((n.get('key'),round(int(n.get('pos'))/6),int(n.get('len'))) for n in p.findall('note')) for p in patterns]
        pitches=[tuple(n.get('key') for n in p.findall('note')) for p in patterns]
        velocities=np.array([float(n.get('vol')) for p in patterns for n in p.findall('note')])
        ins=track.find('instrumenttrack/instrument/sf2player')
        rows.append({'track':track.get('name'),'patterns':len(patterns),'unique_pitch_sequences':len(set(pitches)),'unique_pitch_rhythm_sequences':len(set(signatures)),'notes':sum(len(p.findall('note')) for p in patterns),'velocity_min':float(velocities.min()),'velocity_max':float(velocities.max()),'program':int(ins.get('patch')),'bank':int(ins.get('bank'))})
    return {'bpm_constant':bpm,'tempo_automation_present':bool(tree.findall('.//automationpattern')),'bars_per_delivered_cycle':48,'tracks':rows,'limit':'Only our native score is available. No reference score or note-level performance comparison inferred.'}

def metrics(pcm,bpm=None):
    # Stereo power spectra avoid cancelling wide material when estimating frequency balance.
    stereo=librosa.resample(pcm.T,orig_sr=SR,target_sr=ANALYSIS_SR)
    stfts=[librosa.stft(stereo[ch],n_fft=NFFT,hop_length=HOP) for ch in range(2)]
    power=(np.abs(stfts[0])**2+np.abs(stfts[1])**2)*.5
    magnitude=np.sqrt(power);freq=librosa.fft_frequencies(sr=ANALYSIS_SR,n_fft=NFFT)
    energy=power.mean(axis=1);active=magnitude.sum(axis=0)>1e-4
    band={label:float(100*energy[(freq>=lo)&(freq<hi)].sum()/energy.sum()) for label,lo,hi in BANDS}
    centroid=librosa.feature.spectral_centroid(S=magnitude,sr=ANALYSIS_SR)[0,active]
    rolloff=librosa.feature.spectral_rolloff(S=magnitude,sr=ANALYSIS_SR,roll_percent=.85)[0,active]
    flatness=librosa.feature.spectral_flatness(S=magnitude,power=2)[0,active]
    mono=stereo.mean(axis=0)
    onset=librosa.onset.onset_strength(y=mono,sr=ANALYSIS_SR,hop_length=HOP,n_fft=NFFT)
    tempo,beats=librosa.beat.beat_track(onset_envelope=onset,sr=ANALYSIS_SR,hop_length=HOP)
    peaks=librosa.onset.onset_detect(onset_envelope=onset,sr=ANALYSIS_SR,hop_length=HOP,backtrack=False)
    peak_times=librosa.frames_to_time(peaks,sr=ANALYSIS_SR,hop_length=HOP)
    bpm_est=float(np.asarray(tempo).reshape(-1)[0]);used=bpm or bpm_est
    norm=onset/(np.percentile(onset,95)+1e-12)
    ac=librosa.autocorrelate(norm-norm.mean(),max_size=round(2*ANALYSIS_SR/HOP));ac=ac/(ac[0]+1e-12)
    lo=round(.25*ANALYSIS_SR/HOP);hi=round(1.5*ANALYSIS_SR/HOP)
    regularity=float(ac[lo:hi].max())
    intervals=np.diff(peak_times)
    rms=np.sqrt(np.mean(pcm.astype(np.float64)**2));peak=np.max(np.abs(pcm))
    # Beat-grid residual is diagnostic; mixed-instrument latency and tempo errors affect it.
    step=60/used/2 if used>0 else 1
    residuals=[]
    for phase in np.linspace(0,step,80,endpoint=False):
        dist=np.abs((peak_times-phase+step/2)%step-step/2);residuals.append((np.median(dist),dist))
    residual=min(residuals,key=lambda x:x[0])[1]
    block=ANALYSIS_SR//HOP;features=[];chroma=librosa.feature.chroma_stft(S=power,sr=ANALYSIS_SR,hop_length=HOP)
    mel=librosa.feature.melspectrogram(S=power,sr=ANALYSIS_SR,n_mels=32)
    db=librosa.power_to_db(mel,ref=np.max)
    for start in range(0,db.shape[1],block):
        stop=min(db.shape[1],start+block)
        v=db[:,start:stop].mean(axis=1);v-=v.mean();features.append(v/(np.linalg.norm(v)+1e-12))
    features=np.array(features)
    # Mean spectral-shape distance over 6-second windows, independent of output gain.
    novelty=[]
    for i in range(6,len(features)-6):
        a=features[i-6:i].mean(axis=0);b=features[i:i+6].mean(axis=0)
        novelty.append(float(np.linalg.norm(a-b)))
    one_second_rms=[]
    for start in range(0,len(pcm)-SR+1,SR):one_second_rms.append(float(20*np.log10(np.sqrt(np.mean(pcm[start:start+SR]**2))+1e-12)))
    # Log-power curves normalized to equal total energy for honest timbre comparison.
    curve=10*np.log10(energy/(energy.sum()+1e-15)+1e-15)
    return {'seconds':len(pcm)/SR,'estimated_bpm':bpm_est,'authored_bpm':bpm,'onsets_per_second':len(peaks)/(len(pcm)/SR),'onsets_count':len(peaks),'onset_interval_cv':float(intervals.std()/intervals.mean()) if len(intervals)>1 else 0,'onset_autocorrelation_peak':regularity,'grid_residual_median_ms':float(np.median(residual)*1000),'grid_residual_p90_ms':float(np.percentile(residual,90)*1000),'spectral_centroid_mean_hz':float(centroid.mean()),'spectral_centroid_median_hz':float(np.median(centroid)),'rolloff85_median_hz':float(np.median(rolloff)),'spectral_flatness_median':float(np.median(flatness)),'band_power_percent':band,'rms_dbfs':float(20*np.log10(rms)),'sample_peak_dbfs':float(20*np.log10(peak)),'crest_db':float(20*np.log10(peak/rms)),'spectral_shape_novelty_median':float(np.median(novelty)),'spectral_shape_novelty_p90':float(np.percentile(novelty,90)),'second_rms_p90_minus_p10_db':float(np.percentile(one_second_rms,90)-np.percentile(one_second_rms,10)),**width(pcm),'plot':{'frequency_hz':freq.tolist(),'normalized_power_db':curve.tolist(),'rms_1s_dbfs':one_second_rms,'spectral_shape_vectors':features.tolist(),'onset_times_seconds':peak_times.tolist(),'novelty_6s':novelty}}

def run(item):
    data=load(item);pcm=data.pop('pcm');print('loaded '+data['name'],flush=True)
    measured=metrics(pcm[12*SR:60*SR],data['authored_bpm'])
    full_loudness=loudness(pcm)
    # Full-track structure and spatial measurements; matched excerpt remains the main comparison.
    second_rms=[float(20*np.log10(np.sqrt(np.mean(pcm[i:i+SR]**2))+1e-12)) for i in range(0,len(pcm)-SR+1,SR)]
    full={'seconds':len(pcm)/SR,'loudness':full_loudness,**width(pcm),'rms_1s_dbfs':second_rms}
    record={**data,'matched_segment':[12,60],'matched_metrics':measured,'full_track':full,'score':None}
    if data['group']=='demo':record['score']=score_audit(pathlib.Path(data['source']).with_suffix('.mmp'))
    filename=('demo-' if data['group']=='demo' else 'reference-')+str(item[-1] if data['group']=='demo' else pathlib.Path(data['source']).stem)
    # Stable numeric index avoids long remote basenames in evidence.
    filename=hashlib.sha256(data['name'].encode()).hexdigest()[:10]
    (OUT/(filename+'.json')).write_text(json.dumps(record,ensure_ascii=False,indent=2),encoding='utf-8')
    print('analysed '+data['name'],flush=True);return record

if __name__=='__main__':
    OUT.mkdir(exist_ok=True)
    reports=json.loads((IDENTITY/'round-B/render-report.json').read_text(encoding='utf-8'))
    items=[]
    for r in reports:
        path=ROOT/next(f['path'] for f in r['files'] if f['path'].endswith('.wav'));items.append((r['title'],str(path),'demo',r['bpm']))
    for cid in ['125099','306834','697622']:
        song=json.loads((IDENTITY/('msr-song-'+cid+'.json')).read_text(encoding='utf-8'));items.append((song['name'],song['sourceUrl'],'reference',None))
    # Two workers keep RAM/CPU contained while independent recordings are analysed.
    records=list(concurrent.futures.ThreadPoolExecutor(2).map(run,items))
    report={'method':{'matched_segment_seconds':[12,60],'original_pcm_sr':SR,'frequency_analysis_sr':ANALYSIS_SR,'n_fft':NFFT,'hop':HOP,'band_energy':'two-channel mean power; normalized total energy','tempo':'librosa estimate, except known MIDI BPM used only for own grid residual','loudness':'FFmpeg loudnorm input metrics on full recording; no normalization applied to files','limitations':['Three selected official tracks, not all Arknights music','Equal time offsets do not imply equal functional sections','Onsets are acoustic transients, not a count of notes or instruments','Grid residual affected by instrument envelopes and tempo detection; cannot rank groove','Spectral metrics cannot establish musical quality or identify true instrument/sample fidelity']},'tracks':records}
    (OUT/'comparison.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps([{**{k:r[k] for k in ['name','group']},'loudness':r['full_track']['loudness'],'metrics':{k:v for k,v in r['matched_metrics'].items() if k!='plot'},'score':r['score']} for r in records],ensure_ascii=True),flush=True)
