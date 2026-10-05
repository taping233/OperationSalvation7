import json, subprocess, pathlib
import numpy as np
import librosa

ROOT = pathlib.Path(__file__).resolve().parents[3]
OUT = pathlib.Path(__file__).parent
tracks = [('title','bgm-liejie-fuhe.mp3'),('explore','bgm-sour-orange-earth.mp3'),('battle','bgm-cisheng-yuanan.mp3')]
report = {}
for role, name in tracks:
    path = ROOT / 'game/assets' / name
    raw = subprocess.check_output(['ffmpeg','-v','error','-ss','20','-i',str(path),'-t','75','-ac','1','-ar','22050','-f','f32le','-'])
    y = np.frombuffer(raw,dtype='<f4').copy()
    sr = 22050
    S = np.abs(librosa.stft(y,n_fft=2048,hop_length=512))
    onset = librosa.onset.onset_strength(S=librosa.amplitude_to_db(S),sr=sr)
    tempo, beats = librosa.beat.beat_track(onset_envelope=onset,sr=sr,hop_length=512)
    chroma = librosa.feature.chroma_stft(S=S**2,sr=sr).mean(axis=1)
    freqs = librosa.fft_frequencies(sr=sr,n_fft=2048)
    powers = np.mean(S**2,axis=1)
    bands = {label:float(powers[(freqs>=lo)&(freqs<hi)].sum()/powers.sum()) for label,lo,hi in [('sub',20,100),('bass',100,300),('mid',300,2500),('high',2500,11025)]}
    report[role] = {'file':name,'analysis_segment_seconds':[20,95],'estimated_bpm':float(np.asarray(tempo).reshape(-1)[0]),'beat_count':len(beats),'rms_dbfs':float(20*np.log10(np.sqrt(np.mean(y*y))+1e-12)),'centroid_hz':float(librosa.feature.spectral_centroid(S=S,sr=sr).mean()),'band_energy':bands,'pitch_classes_C_to_B':np.round(chroma,3).tolist(),'note':'Automatic descriptors; tempo may be half/double time; no melody or audio samples copied.'}
    print(role,json.dumps(report[role]),flush=True)
(OUT/'reference-analysis.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
