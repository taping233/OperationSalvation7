"""Measurable draft-production checks. Not an automatic musical-quality score."""
import pathlib,json,subprocess,re,hashlib
import numpy as np
import soundfile as sf
from scipy.signal import butter,sosfilt
OUT=pathlib.Path(__file__).resolve().parent;ROOT=OUT.parents[2];SR=48000
RANGES={'title':(-22,-18),'explore':(-20,-16),'battle':(-18,-14),'shop':(-22,-17)}
def loud(path):
    p=subprocess.run(['ffmpeg','-hide_banner','-nostats','-i',str(path),'-af','loudnorm=I=-20:TP=-1.5:LRA=11:print_format=json','-f','null','-'],capture_output=True,check=True)
    m=re.findall(r'\{\s*"input_i".*?\}',p.stderr.decode(errors='replace'),re.S)
    if not m:raise ValueError('No loudness measurement')
    return {k:float(v) for k,v in json.loads(m[-1]).items() if k.startswith('input_')}
def metrics(path):
    p=subprocess.run(['ffmpeg','-v','error','-i',str(path),'-f','f32le','-ac','2','-ar',str(SR),'-'],capture_output=True,check=True)
    x=np.frombuffer(p.stdout,dtype=np.float32).reshape(-1,2).astype(np.float64)
    rms=lambda y:float(np.sqrt(np.mean(y*y)))
    low=sosfilt(butter(2,120,fs=SR,output='sos'),x,axis=0)
    mid=low.mean(axis=1);side=(low[:,0]-low[:,1])/2
    frequencies=np.fft.rfftfreq(len(x),1/SR);band=(frequencies>=20)&(frequencies<=120)
    mid_spectrum=np.fft.rfft(x.mean(axis=1));side_spectrum=np.fft.rfft((x[:,0]-x[:,1])/2)
    strict_low_ratio=float(np.sqrt(np.sum(np.abs(side_spectrum[band])**2)/max(np.sum(np.abs(mid_spectrum[band])**2),1e-20)))
    windows=[20*np.log10(rms(x[i:i+SR//2])+1e-12) for i in range(SR//2,len(x)-SR,SR//2)]
    return dict(seconds=len(x)/SR,finite=bool(np.isfinite(x).all()),clipped_samples=int(np.sum(np.abs(x)>=1)),interior_silent_halfseconds=int(sum(v<-45 for v in windows)),interior_halfseconds=len(windows),low_side_mid_ratio=strict_low_ratio,low_side_mid_measurement='FFT RMS ratio in exact 20-120Hz band',legacy_lowpass_weighted_side_mid_ratio=rms(side)/max(rms(mid),1e-12),stereo_correlation=float(np.corrcoef(x.T)[0,1]),crest_db=float(20*np.log10(np.max(np.abs(x))/max(rms(x),1e-12))),section_rms_dbfs=[float(20*np.log10(rms(x[a*SR:b*SR])+1e-12)) for a,b in [(0,8),(8,16),(16,24),(24,29)]],**loud(path))
def hand_check(score):
    result={}
    for hand in ['left','right']:
        ns=[n for n in score['notes'] if n.get('hand')==hand];span=poly=0
        # Count depressed keys, not pedal-held resonance. Allow rolled bass leaps.
        for n in ns:
            t=n['start']+.0001;active=[q['key'] for q in ns if q['start']<=t<q['start']+q['duration']]
            if active:span=max(span,max(active)-min(active));poly=max(poly,len(set(active)))
        result[hand]=dict(max_simultaneous_key_span_semitones=span,max_depressed_keys=poly)
    return result
def decide(role,m,hands=None):
    lo,hi=RANGES[role]
    hard={
      'duration_30s':abs(m['seconds']-30)<.05,
      'finite_audio':m['finite'],
      'no_clipped_samples':m['clipped_samples']==0,
      'lossy_true_peak_below_minus_1':m['input_tp']<=-1.0,
      'role_loudness_window':lo<=m['input_i']<=hi,
      'no_unintended_interior_silence':m['interior_silent_halfseconds']==0,
      'mono_low_end':m['low_side_mid_ratio']<=.15,
      'stereo_correlation_nonnegative':m['stereo_correlation']>=0}
    if hands:
        hard['piano_hand_spans']=all(r['max_simultaneous_key_span_semitones']<=12 for r in hands.values())
        hard['piano_depressed_keys']=all(r['max_depressed_keys']<=5 for r in hands.values())
    review=[]
    if m['crest_db']<7:review.append('Low crest factor: inspect transient/arrangement density; not automatic proof of overcompression')
    if m['input_lra']<1.5:review.append('Small 30s LRA: inspect phrase contrast; short excerpts make LRA uncertain')
    return hard,review

rows=[]
for role in ['title','explore','battle','shop']:
    retained=role=='shop'
    p=OUT/(role+'-rewrite-30s.mp3') if not retained else OUT.parent/'2026-10-09-WF-shop-remake/shop-lamplight-deal-30s.mp3'
    m=metrics(p);hands=hand_check(json.loads((OUT/'title-score.json').read_text(encoding='utf-8'))) if role=='title' else None
    checks,review=decide(role,m,hands);before=m.copy();repairs=[]
    # Only a numerical loudness/peak problem authorizes a master-level repair here.
    # The user-preferred shop file is always measured, never changed.
    if not retained and (not checks['role_loudness_window'] or not checks['lossy_true_peak_below_minus_1']):
        wav=p.with_suffix('.wav');x,sr=sf.read(wav,dtype='float32',always_2d=True)
        desired=sum(RANGES[role])/2
        gain_db=min(desired-m['input_i'],-1.5-m['input_tp'])
        if abs(gain_db)>.05:
            x*=10**(gain_db/20);sf.write(wav,x,sr,subtype='PCM_24')
            subprocess.run(['ffmpeg','-v','error','-y','-i',str(wav),'-c:a','libmp3lame','-b:a','256k',str(p)],check=True)
            repairs.append(dict(action='gain_only_master_revision',gain_db=gain_db,reason='measured loudness/true-peak outside declared internal range'))
            m=metrics(p);checks,review=decide(role,m,hands)
    rows.append(dict(role=role,retained_unchanged=retained,initial=before,final=m,hand_check=hands,checks=checks,review_flags=review,repairs=repairs,production_checks_passed=all(checks.values()),file=dict(path=p.relative_to(ROOT).as_posix(),sha256=hashlib.sha256(p.read_bytes()).hexdigest())))
    print(json.dumps(dict(role=role,lufs=m['input_i'],true_peak=m['input_tp'],lra=m['input_lra'],crest=m['crest_db'],low_side=m['low_side_mid_ratio'],passed=all(checks.values()),failed=[k for k,v in checks.items() if not v],review=review,repairs=repairs),ensure_ascii=True),flush=True)
result=dict(internal_targets=RANGES,scope='30-second MP3 production checks; not a commercial certification or aesthetic score',peak_ceiling_dbTP=-1,checks=rows,interpretation=['LUFS ranges are role-specific internal draft targets, not a universal game-audio standard.','LRA and crest flags are review prompts, not forced artistic failures.','Hand-span measurements count held keys; pedalled resonance is excluded.','Numerical checks cannot certify melody, timbre, groove or emotional fit.'])
(OUT/'evaluation.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
# Refresh fingerprints after any measured master correction.
report=json.loads((OUT/'render-report.json').read_text(encoding='utf-8'))
for item in report:
    for entry in item['files']:
        f=ROOT/entry['path'];entry.update(bytes=f.stat().st_size,sha256=hashlib.sha256(f.read_bytes()).hexdigest())
(OUT/'render-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
