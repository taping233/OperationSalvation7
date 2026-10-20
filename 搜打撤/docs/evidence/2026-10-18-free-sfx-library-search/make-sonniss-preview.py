"""Prepare three quiet audition reels; source recordings and game stay intact."""
from pathlib import Path
import array
import hashlib
import json
import math
import subprocess
import wave

BASE = Path(__file__).resolve().parent
RATE = 48000
files = json.loads((BASE/'sonniss-receipt.json').read_text(encoding='utf-8'))['files']
groups = [('03-sonniss-ui',['ui']),('04-sonniss-rewards',['reward']),('05-sonniss-card-combat',['cards','combat'])]
receipt = []
for name, categories in groups:
    reel = array.array('h')
    timeline = []
    for item in files:
        if item['group'] not in categories:
            continue
        source = BASE/item['local_file']
        raw = subprocess.check_output(['ffmpeg','-v','error','-i',str(source),'-ar',str(RATE),'-ac','2','-f','f32le','-'])
        samples = array.array('f',raw)
        rms = math.sqrt(sum(x*x for x in samples)/len(samples))
        peak = max(map(abs,samples))
        gain = min(1,10**(-25/20)/max(rms,1e-9),10**(-16/20)/max(peak,1e-9))
        start = len(reel)/2/RATE
        reel.extend(int(max(-1,min(1,x*gain))*32767) for x in samples)
        duration = len(samples)/2/RATE
        reel.extend([0]*round(RATE*2*.8))
        timeline.append({'label':item['label'],'source_relative':item['local_file'],'source_filename':item['source_filename'],'source_sha256':item['sha256'],'start':round(start,3),'duration':round(duration,3),'gain':gain})
    wav = BASE/(name+'.wav')
    with wave.open(str(wav),'wb') as output:
        output.setparams((2,2,RATE,0,'NONE','not compressed'))
        output.writeframes(reel.tobytes())
    mp3 = BASE/(name+'.mp3')
    subprocess.run(['ffmpeg','-v','error','-y','-i',str(wav),'-c:a','libmp3lame','-q:a','2',str(mp3)],check=True)
    receipt.append({'preview':mp3.name,'sha256':hashlib.sha256(mp3.read_bytes()).hexdigest(),'duration':round(len(reel)/2/RATE,3),'timeline':timeline})
    print(mp3.name,round(len(reel)/2/RATE,2),'seconds')
(BASE/'sonniss-preview-receipt.json').write_text(json.dumps({'source_url':'https://gdc.sonniss.com/','license_url':'https://sonniss.com/gdc-bundle-license/','processing':'Attenuation only; full source durations; 800ms separators; no EQ, pitch shift, or layering','previews':receipt,'game_modified':False,'tests_run':False,'listening_verified':False},ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
