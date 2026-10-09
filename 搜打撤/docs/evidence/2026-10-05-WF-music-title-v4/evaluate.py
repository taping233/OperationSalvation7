import pathlib,importlib.util,json,hashlib,subprocess,xml.etree.ElementTree as ET
import numpy as np,soundfile as sf
from scipy.ndimage import gaussian_filter1d
OUT=pathlib.Path(__file__).resolve().parent;ROOT=OUT.parents[2]
path=OUT/'01-title-frostglass-v4.wav'
spec=importlib.util.spec_from_file_location('audio_measure',OUT.parent/'2026-10-05-WF-music-gap/analyze.py');measure=importlib.util.module_from_spec(spec);spec.loader.exec_module(measure)
pcm,sr=sf.read(path,dtype='float32',always_2d=True)
assert sr==48000 and pcm.shape==(5760000,2) and np.isfinite(pcm).all() and np.max(np.abs(pcm))<.99
data=measure.metrics(pcm[12*sr:60*sr],112);loudness=measure.loudness(pcm)
previous=json.loads((OUT.parent/'2026-10-05-WF-music-gap/comparison.json').read_text(encoding='utf-8'))['tracks'][0]
old=previous['matched_metrics'];old_loudness=previous['full_track']['loudness']
rms=[float(20*np.log10(np.sqrt(np.mean(pcm[i:i+sr]**2))+1e-12)) for i in range(0,len(pcm),sr)]
grid=np.linspace(.1,.9,200);a=np.array(previous['full_track']['rms_1s_dbfs']);b=np.array(rms)
a=np.interp(grid,(np.arange(len(a))+.5)/previous['full_track']['seconds'],gaussian_filter1d(a,1.3));b=np.interp(grid,(np.arange(len(b))+.5)/120,gaussian_filter1d(b,1.3))
correlation=float(np.corrcoef(a,b)[0,1])
comparison={}
for k in ['spectral_centroid_mean_hz','onsets_per_second','onset_autocorrelation_peak','spectral_shape_novelty_median','side_mid_energy_db','lr_correlation']:
    comparison[k]={'v3':old[k],'v4':data[k]}
side=lambda m:float(100/(1+10**(-m['side_mid_energy_db']/10)))
comparison['side_share_percent']={'v3':side(old),'v4':side(data)}
comparison['full_lra_lu']={'v3':old_loudness['input_lra'],'v4':loudness['input_lra']}
comparison['full_lufs']={'v3':old_loudness['input_i'],'v4':loudness['input_i']}
tree=ET.parse(path.with_suffix('.mmp')).getroot();automations=tree.findall('.//automationpattern')
assert len(automations)==5 and all(p.get('prog')=='1' for p in automations)
assert len({o.get('id') for p in automations for o in p.findall('object')})==5
assert all(i.get('name')=='sf2player' for i in tree.findall('.//instrument'))
checks=[]
for ext in ['mp3','ogg']:
    p=path.with_suffix('.'+ext);result=subprocess.run(['ffmpeg','-v','error','-i',str(p),'-f','null','-'],capture_output=True);assert result.returncode==0
    checks.append({'path':str(p.relative_to(ROOT)).replace('\\','/'),'decode':'passed','bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()})
raw=subprocess.check_output(['ffmpeg','-v','error','-i',str(path.with_suffix('.ogg')),'-ar',str(sr),'-ac','2','-f','f32le','-']);decoded=np.frombuffer(raw,dtype='<f4').reshape(-1,2)
jump=float(np.max(np.abs(decoded[0]-decoded[-1])));normal=float(np.percentile(np.abs(np.diff(decoded,axis=0)),99));assert len(decoded)==len(pcm) and jump<normal
report=json.loads((OUT/'render-report.json').read_text(encoding='utf-8'))
for f in report['files']:
    p=ROOT/f['path'];assert p.stat().st_size==f['bytes'] and hashlib.sha256(p.read_bytes()).hexdigest()==f['sha256']
report_data={'status':'passed','seconds':120,'sample_rate':sr,'frames':len(pcm),'native_linear_automation_tracks':len(automations),'comparison':comparison,'old_new_loudness_contour_correlation':correlation,'matched_segment_seconds':[12,60],'ogg_seam_jump':jump,'adjacent_step_p99':normal,'ogg_frames_match':True,'formats':checks,'full_rms_1s_dbfs':rms,'metrics':data,'loudness':loudness,'limits':['Single title candidate; quality requires user listening','Metric changes are not a musical-quality score','Volume automation changes amplitude; it does not provide a new high-end string articulation sample library']}
(OUT/'evaluation.json').write_text(json.dumps(report_data,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({'status':'passed','seconds':120,'comparison':comparison,'contour_correlation':correlation,'automation_tracks':5,'loop_decode':'passed'},ensure_ascii=True))
