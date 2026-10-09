"""Analyse public official references; keep descriptors, no reference audio copies."""
import json,pathlib,subprocess,hashlib,concurrent.futures
import numpy as np
import librosa
OUT=pathlib.Path(__file__).resolve().parent
def analyse(cid):
    song=json.loads((OUT/('msr-song-'+cid+'.json')).read_text(encoding='utf-8'))
    cmd=['ffmpeg','-v','error','-ss','12','-i',song['sourceUrl'],'-t','48','-ac','1','-ar','22050','-f','f32le','-']
    result=subprocess.run(cmd,capture_output=True,timeout=60)
    if result.returncode: return {'song':song['name'],'url':'https://monster-siren.hypergryph.com/music/'+cid,'error':result.stderr.decode('utf-8',errors='replace')[:300]}
    y=np.frombuffer(result.stdout,dtype='<f4');sr=22050
    S=np.abs(librosa.stft(y));onset=librosa.onset.onset_strength(S=librosa.amplitude_to_db(S),sr=sr)
    bpm,_=librosa.beat.beat_track(onset_envelope=onset,sr=sr)
    chunks=np.array_split(y,6);dynamics=[float(20*np.log10(np.sqrt(np.mean(x*x))+1e-12)) for x in chunks]
    return {'song':song['name'],'url':'https://monster-siren.hypergryph.com/music/'+cid,'segment':[12,60],'estimated_bpm':float(np.asarray(bpm).reshape(-1)[0]),'centroid_hz':float(librosa.feature.spectral_centroid(S=S,sr=sr).mean()),'rms_blocks_dbfs':dynamics,'segment_pcm_sha256':hashlib.sha256(result.stdout).hexdigest(),'limit':'Automatic tempo/dynamics/timbre descriptors, not verified instrumentation or human listening; no melody or samples reused.'}
if __name__=='__main__':
    records=list(concurrent.futures.ThreadPoolExecutor(3).map(analyse,['125099','306834','697622']))
    (OUT/'msr-reference-analysis.json').write_text(json.dumps(records,ensure_ascii=False,indent=2),encoding='utf-8');print(json.dumps(records,ensure_ascii=True))
