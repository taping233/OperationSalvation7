"""Necessary delivery checks for two cues; no games/builds or long comparisons."""
import pathlib,json,subprocess,hashlib,sys,xml.etree.ElementTree as ET
import numpy as np,soundfile as sf
OUT=pathlib.Path(__file__).resolve().parent;ROOT=OUT.parents[2];sys.stdout.reconfigure(encoding='utf-8')
report=json.loads((OUT/'render-report.json').read_text(encoding='utf-8'));checks={};details=[]
checks['old_audio_scores_and_font_unchanged']=all(hashlib.sha256((ROOT/f['path']).read_bytes()).hexdigest()==f['sha256'] for f in report['source_inputs_unchanged'])
for r in report['tracks']:
    name=r['role'];wav=OUT/(r['stem']+'.wav');x,sr=sf.read(wav,dtype='float32',always_2d=True)
    checks[name+'_48k_stereo_duration']=sr==48000 and x.shape==(round(192*60/r['bpm']*sr),2)
    checks[name+'_finite_no_clipping']=bool(np.isfinite(x).all() and np.abs(x).max()<.99)
    checks[name+'_hashes_and_stems']=all(hashlib.sha256((ROOT/f['path']).read_bytes()).hexdigest()==f['sha256'] for f in r['files']+[t['frozen_stem'] for t in r['tracks']])
    score=json.loads((OUT/(name+'-score.json')).read_text(encoding='utf-8'))
    checks[name+'_sections_cover_cycle']=score['sections'][0]['start_bar']==0 and score['sections'][-1]['end_bar']==48 and all(a['end_bar']==b['start_bar'] for a,b in zip(score['sections'],score['sections'][1:]))
    checks[name+'_performed_cc11_and_piano_cc64']=all(t['cc11_expression_used'] for t in r['tracks']) and any(t['piano_cc64'] for t in r['tracks'])
    checks[name+'_notes_inside_cycle']=all(0<=n['beat']<n['beat']+n['length']<192 for t in score['tracks'].values() for n in t['notes'])
    root=ET.parse(wav.with_suffix('.mmp')).getroot()
    checks[name+'_native_frozen_stems_resolve']=all(pathlib.Path(a.get('src')).exists() for a in root.findall('.//audiofileprocessor')) and len(root.findall('.//audiofileprocessor'))==len(r['tracks'])
    checks[name+'_richer_orchestral_palette']=len(set((t['program'],t['bank']) for t in r['tracks']))>=12
    if name=='battle':
        checks['battle_low_instrument_ranges']=min(n['midi'] for n in score['tracks']['Cello ostinato']['notes'])>=36 and min(n['midi'] for n in score['tracks']['Double bass']['notes'])>=28 and all(38<=n['midi']<=57 for n in score['tracks']['Timpani']['notes'])
    for ext in ['mp3','ogg']:
        p=subprocess.run(['ffmpeg','-v','error','-i',str(wav.with_suffix('.'+ext)),'-f','null','-'],capture_output=True)
        checks[name+'_'+ext+'_decodes']=p.returncode==0
    p=subprocess.run(['ffmpeg','-v','error','-i',str(wav.with_suffix('.ogg')),'-ar','48000','-ac','2','-f','f32le','-'],capture_output=True,check=True)
    z=np.frombuffer(p.stdout,dtype='<f4').reshape(-1,2);seam=float(np.max(np.abs(z[0]-z[-1])));normal=float(np.percentile(np.abs(np.diff(z,axis=0)),99))
    checks[name+'_ogg_loop']=len(z)==len(x) and seam<normal
    m=x.mean(axis=1);s=(x[:,0]-x[:,1])/2;side=float(100*np.mean(s*s)/(np.mean(m*m)+np.mean(s*s)))
    details.append({'role':name,'seconds':len(x)/sr,'tracks':len(r['tracks']),'unique_programs':len(set((t['program'],t['bank']) for t in r['tracks'])),
        'side_energy_full_percent':side,'lufs':r['final_loudness']['input_i'],'lra':r['final_loudness']['input_lra'],
        'ogg_seam_jump':seam,'normal_step_p99':normal,'loudness_delta_from_old':float(r['final_loudness']['input_i'])-float(r['old_loudness']['input_i'])})
checks['different_section_scripts']=[s['start_bar'] for s in report['tracks'][0]['sections']]!=[s['start_bar'] for s in report['tracks'][1]['sections']]
data={'status':'passed' if all(checks.values()) else 'failed','exitCode':0 if all(checks.values()) else 1,'checks':checks,'cues':details,
      'scope':'Two V4 candidates; new stems directly mixed. Frozen LMMS pre-master project paths validated, not separately native-rendered. No human audition claimed.'}
(OUT/'verification.json').write_text(json.dumps(data,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({'status':data['status'],'checks':len(checks),'cues':details},ensure_ascii=False));assert all(checks.values())
