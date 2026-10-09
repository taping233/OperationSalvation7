import pathlib,json,hashlib,subprocess,xml.etree.ElementTree as ET
import numpy as np
import soundfile as sf
HERE=pathlib.Path(__file__).resolve().parent;ROOT=HERE.parents[2]
checks=[];versions={};lead_signatures=[]
for round_name in ['A','B']:
    folder=HERE/('round-'+round_name)
    reports=json.loads((folder/'render-report.json').read_text(encoding='utf-8'))
    versions[round_name]=reports
    for r in reports:
        r['common_elements']=['soft bowed strings','sparse acoustic celesta and triangle','same restrained hall']
        for file in r['files']:
            p=ROOT/file['path'];assert p.stat().st_size==file['bytes'] and hashlib.sha256(p.read_bytes()).hexdigest()==file['sha256']
        wav=ROOT/next(f['path'] for f in r['files'] if f['path'].endswith('.wav'))
        pcm,sr=sf.read(wav,always_2d=True)
        assert sr==48000 and pcm.shape[1]==2 and np.isfinite(pcm).all()
        assert abs(len(pcm)/sr-r['seconds'])<1/sr and .001<np.max(np.abs(pcm))<.99
        ogg=wav.with_suffix('.ogg');mp3=wav.with_suffix('.mp3')
        for p in [mp3,ogg]:
            result=subprocess.run(['ffmpeg','-v','error','-i',str(p),'-f','null','-'],capture_output=True)
            assert result.returncode==0
        raw=subprocess.check_output(['ffmpeg','-v','error','-i',str(ogg),'-ar',str(sr),'-ac','2','-f','f32le','-'])
        decoded=np.frombuffer(raw,dtype='<f4').reshape(-1,2)
        jump=float(np.max(np.abs(decoded[0]-decoded[-1])));normal=float(np.percentile(np.abs(np.diff(decoded,axis=0)),99))
        assert len(decoded)==len(pcm) and jump<normal
        project=wav.with_suffix('.mmp');tree=ET.parse(project).getroot()
        instruments=tree.findall('.//instrument')
        assert all(i.get('name')=='sf2player' for i in instruments)
        assert all(int(i.find('sf2player').get('patch')) in [0,8,43,45,47,48,49,60,71] for i in instruments)
        r['instrument_palette_validation']='acoustic/orchestral soundfont programs; no electronic synth or drum-machine kit'
        wav.with_name(wav.stem+'-report.json').write_text(json.dumps(r,ensure_ascii=False,indent=2),encoding='utf-8')
        dynamics=[float(20*np.log10(np.sqrt(np.mean(x*x))+1e-12)) for x in np.array_split(pcm,6)]
        checks.append({'round':round_name,'role':r['role'],'seconds':r['seconds'],'frames':len(pcm),'peak_dbfs':r['peak_dbfs'],'rms_dbfs':r['rms_dbfs'],'six_section_rms_dbfs':dynamics,'ogg_frames_match':True,'ogg_seam_jump':jump,'adjacent_step_p99':normal,'hashes_match':True,'mp3_ogg_decode':'passed'})
        if round_name=='B':
            lead=next(t for t in tree.findall('.//track') if r['groups'].get(t.get('name'))=='lead')
            sequence=[(int(p.get('pos'))+int(n.get('pos')),int(n.get('key')),int(n.get('len'))) for p in lead.findall('pattern')[:8] for n in p.findall('note')]
            lead_signatures.append(hashlib.sha256(json.dumps(sequence).encode()).hexdigest())
    (folder/'render-report.json').write_text(json.dumps(reports,ensure_ascii=False,indent=2),encoding='utf-8')
assert len(set(lead_signatures))==3
differences=[]
for a,b in zip(versions['A'],versions['B']):
    pa=ROOT/next(f['path'] for f in a['files'] if f['path'].endswith('.mmp'))
    pb=ROOT/next(f['path'] for f in b['files'] if f['path'].endswith('.mmp'))
    assert pa.read_bytes()!=pb.read_bytes()
    differences.append({'role':a['role'],'project_bytes_differ':True,'audio_sha256_differ':next(f['sha256'] for f in a['files'] if f['path'].endswith('.wav'))!=next(f['sha256'] for f in b['files'] if f['path'].endswith('.wav'))})
summary={'status':'passed','head':subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT).decode().strip(),'remote_refs_refreshed':False,'checks':checks,'actual_round_differences':differences,'distinct_written_main_score_signatures':lead_signatures,'limits':['Not a human listening verdict','Distinct score hashes are evidence of different written notes, not an aesthetic identity guarantee','No game integration, GUI test, full game test, build or remote CI in this candidate-only iteration'],'source_reference':'msr-reference-analysis.json: 3 official recordings analysed via stream; no retained source audio'}
(HERE/'validation-summary.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({'status':'passed','versions':len(checks),'checks':checks,'actual_round_differences':differences},ensure_ascii=True))
