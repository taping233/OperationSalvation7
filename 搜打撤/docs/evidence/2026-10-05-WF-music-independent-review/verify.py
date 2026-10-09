"""Targeted evidence checks; no source rendering, game build, or source mutations."""
import pathlib,json,hashlib,runpy,sys
import numpy as np
import soundfile as sf
OUT=pathlib.Path(__file__).resolve().parent;ROOT=OUT.parents[2]
sys.stdout.reconfigure(encoding='utf-8')
data=json.loads((OUT/'comparison.json').read_text(encoding='utf-8'))
audit=json.loads((OUT/'native-audit.json').read_text(encoding='utf-8'))
stem=json.loads((OUT/'stem-audit.json').read_text(encoding='utf-8'))
checks={};rr=data['records']
checks['only_v7_and_three_references']=set(r['id'] for r in rr)=={'title-v7','125099','306834','697622'}
for r in rr:
    checks[r['id']+'_7_windows']=len(r['segments'])==7
    checks[r['id']+'_windows_inside_audio']=all(0<=v['start']<v['end']<=r['seconds'] for v in r['segments'].values())
    checks[r['id']+'_finite']=np.isfinite([n for v in r['segments'].values() for n in v['metrics']['bands_percent']]).all().item()
    checks[r['id']+'_bands_sum_100']=all(abs(sum(v['metrics']['bands_percent'])-100)<.001 for v in r['segments'].values())
    checks[r['id']+'_self_distance_symmetric']=np.allclose(r['structure']['self_distance_4s'],np.array(r['structure']['self_distance_4s']).T)
checks['piano_xml_preserved']=all(audit['piano_xml_same_as_v6'].values())
checks['piano_note_record_quantized_matches_v5_xml']=all(audit['v5_note_record_matches_native_xml_after_tick_quantization'].values())
checks['frozen_piano_sha_matches_v6']=all(audit['frozen_piano_matches_v6_report_sha256'].values())
checks['native_full_reconstructs_final']=stem['reconstruction_error_relative_db'] < -100
checks['backing_opening_ratio_reproduces_render_report']=abs(stem['opening_0_2']['backing_rms_relative_full']-.2963408986892617)<1e-6
inputs=[OUT.parent/'2026-10-05-WF-music-title-v7'/n for n in ['01-title-frostglass-v7.wav','01-title-frostglass-v7.mmp','render.py','render-report.json','verification.json']]
for version,names in [('v5',['01-title-frostglass-v5.mmp','render-report.json']),('v6',['01-title-frostglass-v6.mmp','render-report.json','render.py','fluid_engine.py'])]:
    inputs.extend(OUT.parent/('2026-10-05-WF-music-title-'+version)/n for n in names)
inputs.extend(ROOT/r['path'] for r in stem['sources'])
inputs.extend(ROOT/r['frozen_audio']['path'] for r in audit['tracks'] if r['frozen_audio'])
manifest=[]
for p in inputs:
    manifest.append({'path':p.relative_to(ROOT).as_posix(),'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()})
checks['title_hash_matches_render_report']=rr[0]['file']['sha256']==next(r['sha256'] for r in json.loads((inputs[3]).read_text(encoding='utf-8'))['files'] if r['path'].endswith('.wav'))
oldpath=OUT.parent/'2026-10-05-WF-music-gap/comparison.json'
old=json.loads(oldpath.read_text(encoding='utf-8'))
# Legacy container layout is recorded, never used as a replacement for new data.
oldrows=old.get('tracks',old.get('records',old.get('results',[]))) if isinstance(old,dict) else old
legacy=[]
if isinstance(oldrows,list):
    for r in rr[1:]:
        matches=[v for v in oldrows if v.get('name')==r['name']]
        if matches:
            v=matches[0];m=v['matched_metrics'];new=r['segments']['legacy_12_60']['metrics']
            legacy.append({'name':r['name'],'centroid_abs_delta_hz':abs(new['centroid_mean_hz']-m['spectral_centroid_mean_hz']),
                'mono_onset_rate_abs_delta':abs(new['onset_mono_legacy_method']['onsets_per_second']-m['onsets_per_second']),
                'mono_periodicity_abs_delta':abs(new['onset_mono_legacy_method']['periodicity_peak']-m['onset_autocorrelation_peak']),
                'lufs_abs_delta':abs(r['full_loudness']['input_i']-v['full_track']['loudness']['input_i'])})
module=runpy.run_path(str(OUT/'analyze.py'))
x,sr=sf.read(ROOT/rr[0]['source'],start=12*48000,frames=12*48000,dtype='float32',always_2d=True)
a=module['features'](x);b=module['features'](x*.5)
invariance={'centroid_delta_hz':abs(a['centroid_mean_hz']-b['centroid_mean_hz']),
    'band_percent_max_delta':max(abs(np.array(a['bands_percent'])-b['bands_percent'])),
    'side_percent_delta':abs(a['side_percent']-b['side_percent']),
    'rms_gain_delta_db':b['rms_dbfs']-a['rms_dbfs'],
    'onset_count_equal':a['onset_stereo_power']['onset_counts_delta']==b['onset_stereo_power']['onset_counts_delta']}
checks['constant_gain_invariance']=invariance['centroid_delta_hz']<.01 and invariance['band_percent_max_delta']<.01 and invariance['side_percent_delta']<.01 and invariance['onset_count_equal']
result={'status':'passed' if all(checks.values()) else 'failed','exitCode':0 if all(checks.values()) else 1,'checks':checks,
    'input_manifest':manifest,'gain_probe':invariance,'old_reference_method_reproduction':legacy,
    'recovered_runs':'Initial calculation stopped on zero-energy trailing seconds in reference. Fixed explicit zero-energy band handling. Signed URL rotation prevented first resume; stable media filename checked on next resume. Failed runs are not marked passed.',
    'limits':['No human listening or reference scores/stems available.','Only existing title/backing native exports; residual piano not a dry isolated track.','Final plot appearance inspected separately; no game/build/full suite needed.']}
(OUT/'verification.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({'status':result['status'],'checks':len(checks),'old_reference_method_reproduction':legacy,'gain_probe':invariance},ensure_ascii=False))
assert all(checks.values())
