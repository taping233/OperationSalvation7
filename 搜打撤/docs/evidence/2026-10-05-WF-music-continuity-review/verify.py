"""Delivery + continuity checks against latest old title/explore/battle audio."""
import pathlib,json,hashlib,subprocess,sys,xml.etree.ElementTree as ET
import numpy as np,soundfile as sf
OUT=pathlib.Path(__file__).resolve().parent;ROOT=OUT.parents[2];sys.stdout.reconfigure(encoding='utf-8')
report=json.loads((OUT/'rewrite-report.json').read_text(encoding='utf-8'))
old={r['role']:r for r in json.loads((OUT/'audio-diagnosis.json').read_text(encoding='utf-8'))}
checks={};summaries=[]
checks['old_source_inputs_unchanged']=all(hashlib.sha256((ROOT/f['path']).read_bytes()).hexdigest()==f['sha256'] for f in report['source_inputs_unchanged']) and all(hashlib.sha256((ROOT/f['path']).read_bytes()).hexdigest()==f['sha256'] for f in old.values())
for r in report['cues']:
    role=r['role'];x,sr=sf.read(OUT/(r['stem']+'.wav'),dtype='float32',always_2d=True)
    checks[role+'_frames_stereo']=sr==48000 and x.shape==(round(r['bars']*4*60/r['bpm']*sr),2)
    checks[role+'_finite_no_clip']=bool(np.isfinite(x).all() and np.abs(x).max()<.99)
    checks[role+'_file_stem_hashes']=all(hashlib.sha256((ROOT/f['path']).read_bytes()).hexdigest()==f['sha256'] for f in r['files']+[t['frozen_stem'] for t in r['tracks']])
    score=json.loads((OUT/(role+'-score.json')).read_text(encoding='utf-8'))
    checks[role+'_score_inside_cycle']=all(0<=n['beat']<n['beat']+n['length']<r['bars']*4 for t in score['tracks'].values() for n in t['notes'])
    checks[role+'_no_same_key_overlap_chokes']=all(not(a['midi']==b['midi'] and a['beat']+a['length']>b['beat']+.001) for t in score['tracks'].values() for a,b in zip(t['notes'],t['notes'][1:]))
    root=ET.parse(OUT/(r['stem']+'.mmp')).getroot()
    checks[role+'_mmp_stem_paths_resolve']=all(pathlib.Path(a.get('src')).exists() for a in root.findall('.//audiofileprocessor'))
    checks[role+'_mmp_loop_wrapper_correct']=all(int(p.get('len'))==r['bars']*192 for p in root.findall('.//pattern'))
    checks[role+'_loudness_target']=abs(float(r['loudness']['input_i'])+18.5)<.2
    step=sr//4;db=np.array([20*np.log10(np.sqrt(np.mean(x[i:i+step].astype(float)**2))+1e-12) for i in range(0,len(x)-step+1,step)])
    boundaries=[]
    for s in r['sections'][1:]:
        bar=s['start_bar'];sec=bar*4*60/r['bpm'];i=round(sec*4)
        change=float(np.median(db[i:i+8])-np.median(db[max(0,i-8):i]));boundaries.append({'bar':bar,'seconds':sec,'2s_median_change_db':change})
    oldmax=max(abs(b['change_db']) for b in old[role]['boundaries']);newmax=max(abs(b['2s_median_change_db']) for b in boundaries)
    checks[role+'_transition_max_below_6db']=newmax<6
    if role!='title':checks[role+'_transition_jumps_reduced']=newmax<oldmax
    main={'title':'Piano sung theme','explore':'Piano traveller','battle':'Violin sung challenge'}[role]
    ns=score['tracks'][main]['notes'];duration=[n['length']*60/r['bpm'] for n in ns]
    checks[role+'_long_lead_notes']=min(duration)>.35
    carriers=[score['tracks'][n]['notes'] for n in score['tracks'] if 'Continuous' in n or n=='Stable bass']
    checks[role+'_continuous_carrier_at_boundaries']=all(any(n['beat']<=s['start_bar']*4 and n['beat']+n['length']>=s['start_bar']*4+.5 for ns2 in carriers for n in ns2) for s in r['sections'][1:])
    for ext in ['mp3','ogg']:
        p=subprocess.run(['ffmpeg','-v','error','-i',str(OUT/(r['stem']+'.'+ext)),'-f','null','-'],capture_output=True)
        checks[role+'_'+ext+'_decode']=p.returncode==0
    p=subprocess.run(['ffmpeg','-v','error','-i',str(OUT/(r['stem']+'.ogg')),'-ar','48000','-ac','2','-f','f32le','-'],capture_output=True,check=True)
    z=np.frombuffer(p.stdout,dtype='<f4').reshape(-1,2);seam=float(np.max(np.abs(z[0]-z[-1])));normal=float(np.percentile(np.abs(np.diff(z,axis=0)),99))
    checks[role+'_ogg_loop']=len(z)==len(x) and seam<normal
    summaries.append({'role':role,'seconds':r['seconds'],'old_max_transition_change_db':oldmax,'new_max_transition_change_db':newmax,'boundaries':boundaries,
        'lead_notes':len(ns),'lead_median_duration_seconds':float(np.median(duration)),'lead_notes_under350ms':sum(v<.35 for v in duration),
        'all_note_on_events_per_second':sum(len(t['notes']) for t in score['tracks'].values())/r['seconds'],
        'new_adjacent_250ms_db_change_p95':float(np.percentile(np.abs(np.diff(db)),95)),
        'old_adjacent_250ms_db_change_p95':old[role]['adjacent_250ms_db_change_p95'],'loudness':r['loudness'],'ogg_seam':seam})
refs=json.loads((OUT/'project-audit.json').read_text(encoding='utf-8'))
checks['actual_public_classical_project_parsed']=any('Spring Wind' in r['label'] and r['tracks'] for r in refs)
checks['reference_fingerprints']=all(hashlib.sha256((ROOT/r['path']).read_bytes()).hexdigest()==r['sha256'] for r in refs)
data={'status':'passed' if all(checks.values()) else 'failed','exitCode':0 if all(checks.values()) else 1,'checks':checks,'cues':summaries,
      'scope':'Latest originals retained; three new candidates. One public classical project and three bundled projects parsed without executing them.',
      'limits':['No human listening claimed; fatigue is a user listening judgement.','2s transition diagnostic is not a universal musical standard; 6dB is this task local guard.','Single-note attack probes are not universal patch latency.','Frozen pre-master LMMS paths checked; projects not separately native-rendered.']}
(OUT/'verification.json').write_text(json.dumps(data,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({'status':data['status'],'checks':len(checks),'failed':[k for k,v in checks.items() if not v],'cues':[{k:v for k,v in r.items() if k not in ['loudness','boundaries']} for r in summaries]},ensure_ascii=False))
assert all(checks.values())
