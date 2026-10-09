import pathlib,json,re,subprocess,hashlib,xml.etree.ElementTree as ET
import numpy as np,soundfile as sf
from render import strings_fingerprint
OUT=pathlib.Path(__file__).resolve().parent;ROOT=OUT.parents[2]
PREV=OUT.parent/'2026-10-05-WF-music-title-v5'
report=json.loads((OUT/'render-report.json').read_text(encoding='utf-8'))
wav=OUT/'01-title-frostglass-v6.wav'
def lufs(path):
    p=subprocess.run(['ffmpeg','-hide_banner','-nostats','-i',str(path),'-af','loudnorm=I=-23:TP=-1:LRA=11:print_format=json','-f','null','-'],capture_output=True)
    assert p.returncode==0
    return json.loads(re.findall(r'\{\s*"input_i".*?\}',p.stderr.decode(errors='replace'),re.S)[-1])
old_loudness=lufs(PREV/'01-title-frostglass-v5.wav')
if not report.get('loudness_matched'):
    before=lufs(wav);pcm,sr=sf.read(wav,dtype='float32',always_2d=True)
    gain=min(10**((float(old_loudness['input_i'])-float(before['input_i']))/20),.86/np.max(np.abs(pcm)))
    pcm*=gain;sf.write(wav,pcm,sr,subtype='PCM_24')
    for ext in ['mp3','ogg']:
        args=['ffmpeg','-v','error','-y','-i',str(wav)]
        args+=['-c:a','libmp3lame','-b:a','256k'] if ext=='mp3' else ['-c:a','libvorbis','-q:a','6']
        subprocess.run(args+['-metadata','title=霜窗回声 · 第六版',str(wav.with_suffix('.'+ext))],check=True)
    report.update({'loudness_matched':True,'old_loudness':old_loudness,'unmatched_v6_loudness':before,'final_common_gain_db':float(20*np.log10(gain)),'loudness_note':'Overall level aligned for audition. Piano remains -3/-4dB relative to the unchanged string performance.'})
    for f in report['files']:
        p=ROOT/f['path'];f.update({'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()})
pcm,sr=sf.read(wav,dtype='float32',always_2d=True)
assert sr==48000 and pcm.shape==(4388571,2) and np.isfinite(pcm).all() and np.max(np.abs(pcm))<.99
before_tree=ET.parse(PREV/'01-title-frostglass-v5.mmp').getroot();after_tree=ET.parse(wav.with_suffix('.mmp')).getroot()
assert strings_fingerprint(before_tree)==strings_fingerprint(after_tree)==report['strings_score_and_automation_exactly_preserved']
for f in report['files']:
    p=ROOT/f['path'];assert p.stat().st_size==f['bytes'] and hashlib.sha256(p.read_bytes()).hexdigest()==f['sha256']
for ext in ['mp3','ogg']:
    result=subprocess.run(['ffmpeg','-v','error','-i',str(wav.with_suffix('.'+ext)),'-f','null','-'],capture_output=True);assert result.returncode==0
raw=subprocess.check_output(['ffmpeg','-v','error','-i',str(wav.with_suffix('.ogg')),'-ar','48000','-ac','2','-f','f32le','-']);decoded=np.frombuffer(raw,dtype='<f4').reshape(-1,2)
seam=float(np.max(np.abs(decoded[0]-decoded[-1])));normal=float(np.percentile(np.abs(np.diff(decoded,axis=0)),99));assert len(decoded)==len(pcm) and seam<normal
after=lufs(wav);assert abs(float(after['input_i'])-float(old_loudness['input_i']))<.2
pedal=json.loads((OUT/'pedal-probe.json').read_text(encoding='utf-8'));assert pedal['pedal_tail_gain_db']>6
for p in report['piano_processing']:
    clip=ROOT/'.tmp/music-workstation/title-v6'/(p['source_track'].replace(' ','-')+'-pedalled.wav')
    assert hashlib.sha256(clip.read_bytes()).hexdigest()==p['piano_clip_sha256']
    p['piano_clip_path']=str(clip.relative_to(ROOT)).replace('\\','/');p['piano_clip_bytes']=clip.stat().st_size
report.update({'final_loudness':after,'peak_dbfs':float(20*np.log10(np.max(np.abs(pcm)))),'rms_dbfs':float(20*np.log10(np.sqrt(np.mean(pcm*pcm))))})
(OUT/'render-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
verification={'status':'passed','seconds':len(pcm)/sr,'strings_and_three_expression_curves_exactly_preserved':True,'real_cc64_pedal_probe':pedal,'overall_loudness_difference_lu':float(after['input_i'])-float(old_loudness['input_i']),'ogg_frames_match':True,'ogg_seam_jump':seam,'ordinary_step_p99':normal,'hashes_and_decode':'passed','pcm_clipping':False,'subjective_quality':'Requires user listening; pedal tail test does not guarantee better musical phrasing'}
(OUT/'verification.json').write_text(json.dumps(verification,ensure_ascii=False,indent=2),encoding='utf-8');print(json.dumps(verification,ensure_ascii=True))
