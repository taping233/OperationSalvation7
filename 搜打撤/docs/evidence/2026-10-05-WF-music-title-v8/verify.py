"""Necessary delivery checks and one matched V7/V8 excerpt, no game checks."""
import pathlib,json,subprocess,hashlib,runpy,sys
import numpy as np,soundfile as sf
OUT=pathlib.Path(__file__).resolve().parent;ROOT=OUT.parents[2]
sys.stdout.reconfigure(encoding='utf-8')
report=json.loads((OUT/'render-report.json').read_text(encoding='utf-8'))
score=json.loads((OUT/'score.json').read_text(encoding='utf-8'))
x,sr=sf.read(OUT/'01-title-frostglass-v8.wav',dtype='float32',always_2d=True)
checks={'48k_stereo_32bars':sr==48000 and x.shape==(4388571,2),'finite_no_clipping':bool(np.isfinite(x).all() and np.abs(x).max()<.99),
    'matched_loudness':abs(float(report['final_loudness']['input_i'])-float(report['previous_loudness']['input_i']))<.2,
    'opening_backing_present':report['opening_backing_rms_ratio']>.12 and report['opening_backing_first_200ms_rms']>.0005,
    'piano_velocity_varies':all(r['velocity_range'][0]<r['velocity_range'][1] for r in report['piano_processing']),
    'pedal_spans_varied':len(set(round(score['cc64_per_cycle'][i+1]['beat']-score['cc64_per_cycle'][i]['beat'],3) for i in range(0,64,2)))>6}
all_inputs=report['source_inputs_unchanged']+report['files']+[r['clip'] for r in report['piano_processing']]
checks['input_and_delivery_hashes']=all(hashlib.sha256((ROOT/f['path']).read_bytes()).hexdigest()==f['sha256'] for f in all_inputs)
for ext in ['mp3','ogg']:
    p=subprocess.run(['ffmpeg','-v','error','-i',str(OUT/('01-title-frostglass-v8.'+ext)),'-f','null','-'],capture_output=True)
    checks[ext+'_decodes']=p.returncode==0
p=subprocess.run(['ffmpeg','-v','error','-i',str(OUT/'01-title-frostglass-v8.ogg'),'-ar','48000','-ac','2','-f','f32le','-'],capture_output=True,check=True)
ogg=np.frombuffer(p.stdout,dtype='<f4').reshape(-1,2)
seam=float(np.max(np.abs(ogg[0]-ogg[-1])));usual=float(np.percentile(np.abs(np.diff(ogg,axis=0)),99))
checks['ogg_frames_and_seam']=len(ogg)==len(x) and seam<usual
review=OUT.parent/'2026-10-05-WF-music-independent-review'
analysis=runpy.run_path(str(review/'analyze.py'));current=analysis['features'](x[12*sr:60*sr])
previous=json.loads((review/'title-v7.json').read_text(encoding='utf-8'))['segments']['legacy_12_60']['metrics']
comparison={'segment':[12,60],'method':'same independent review features(); V7 prior exact WAV hash verified; V8 freshly calculated',
    'V7':{k:previous[k] for k in ['side_percent','centroid_mean_hz','bands_percent','rms_1s_p90_p10_db']},
    'V8':{k:current[k] for k in ['side_percent','centroid_mean_hz','bands_percent','rms_1s_p90_p10_db']}}
old=json.loads((OUT.parent/'2026-10-05-WF-music-title-v5/render-report.json').read_text(encoding='utf-8'))['authored_note_events']['Piano melody']
signature=lambda ns,start:[(round(n['beat']-start,5),n['midi']) for n in ns if start<=n['beat']<start+32]
melody=score['piano']['Piano melody']
checks['opening_theme_pitches_and_onsets_preserved']=signature(melody,0)==signature(old,0)
checks['second_and_return_A_changed']=signature(melody,32)!=signature(melody,0) and signature(melody,96)!=signature(melody,0)
result={'status':'passed' if all(checks.values()) else 'failed','exitCode':0 if all(checks.values()) else 1,'checks':checks,
    'ogg_seam_jump':seam,'ordinary_step_p99':usual,'matched_excerpt':comparison,
    'loudness_difference_lu':float(report['final_loudness']['input_i'])-float(report['previous_loudness']['input_i']),
    'limit':'No human audition claimed. Metrics diagnose changes, not musical quality. No game integration or build.'}
(OUT/'verification.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({'status':result['status'],'checks':len(checks),'comparison':comparison,'loudness_difference_lu':result['loudness_difference_lu']},ensure_ascii=False))
assert all(checks.values())
