import hashlib,json,pathlib,subprocess
import numpy as np
import soundfile as sf
OUT=pathlib.Path(__file__).resolve().parent
ROOT=OUT.parents[2]
reports=json.loads((OUT/'daw-render-report.json').read_text(encoding='utf-8'))
checks=[]
for report in reports:
    files=report['files']
    wav=next(ROOT/f['path'] for f in files if f['path'].endswith('.wav'))
    pcm,sr=sf.read(wav,always_2d=True)
    assert sr==48000 and pcm.shape[1]==2 and np.isfinite(pcm).all()
    assert abs(len(pcm)/sr-report['seconds'])<1/sr and .001<np.max(np.abs(pcm))<.99
    for file in files:
        p=ROOT/file['path'];assert p.stat().st_size==file['bytes'] and hashlib.sha256(p.read_bytes()).hexdigest()==file['sha256']
        if p.suffix in ['.mp3','.ogg']:
            result=subprocess.run(['ffmpeg','-v','error','-i',str(p),'-f','null','-'],capture_output=True)
            assert result.returncode==0,result.stderr
    ogg=next(ROOT/f['path'] for f in files if f['path'].endswith('.ogg'))
    raw=subprocess.check_output(['ffmpeg','-v','error','-i',str(ogg),'-f','f32le','-ac','2','-ar','48000','-'])
    decoded=np.frombuffer(raw,dtype='<f4').reshape(-1,2)
    jump=float(np.max(np.abs(decoded[0]-decoded[-1])));normal=float(np.percentile(np.abs(np.diff(decoded,axis=0)),99))
    assert len(decoded)==len(pcm) and jump<normal
    checks.append({'role':report['role'],'frames':len(pcm),'seconds':report['seconds'],'sample_rate':sr,'channels':2,'ogg_frames_match':True,'ogg_boundary_jump':jump,'adjacent_step_p99':normal,'sha256_match':True,'mp3_and_ogg_decode':'passed','peak_dbfs':report['peak_dbfs'],'rms_dbfs':report['rms_dbfs']})
head=subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT).decode().strip()
remote=subprocess.run(['git','rev-list','--left-right','--count','HEAD...@{upstream}'],cwd=ROOT,capture_output=True,text=True)
summary={'status':'passed','head':head,'cached_upstream_difference':remote.stdout.strip() if remote.returncode==0 else 'unavailable','remote_refs_refreshed':False,'checks':checks,'native_render_processes':'completed; no persistent DAW service needed','game_changes_this_round':False,'full_game_tests_build_remote_ci':'not run; this round only produces candidate audio','unverified':['subjective quality and style similarity','long listening fatigue','native GUI editing interactions']}
(OUT/'validation-summary.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({'status':'passed','tracks':checks},ensure_ascii=True))
