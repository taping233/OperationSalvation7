"""Prepare quiet listening reels from newly downloaded licensed source audio.

No game mapping is changed. Preserve the complete source sounds and avoid EQ,
pitch changes, layering or replacement of the already approved three UI cues.
"""
from pathlib import Path
import array
import hashlib
import json
import math
import subprocess
import wave

BASE = Path(__file__).resolve().parent
SRC = BASE / 'sources/chequered-400'
RATE = 48000
groups = {
    '01-ui-and-items': [
        ('科幻选择','UI/sci_fi_select.wav'),
        ('科幻确认','UI/sci_fi_confirm.wav'),
        ('系统完成','UI/synth_process_complete.wav'),
        ('获得物品','Items/gem_collect.wav'),
    ],
    '02-card-and-combat': [
        ('抽牌','Card and Board/card_draw_2.wav'),
        ('展牌','Card and Board/card_fan.wav'),
        ('轻斩','Weapons/sword_light.wav'),
        ('挥斩','Weapons/sword_slice.wav'),
        ('格挡','Weapons/sword_clash_2.wav'),
        ('钝击','Combat and Gore/punch_2.wav'),
    ],
}
receipt = []
for name, selections in groups.items():
    reel = array.array('h')
    timeline = []
    for label, path in selections:
        source = SRC / path
        raw = subprocess.check_output(['ffmpeg','-v','error','-i',str(source),
            '-ar',str(RATE),'-ac','2','-f','f32le','-'])
        samples = array.array('f',raw)
        rms = math.sqrt(sum(x*x for x in samples)/len(samples))
        peak = max(map(abs,samples))
        # Only attenuation: -25dBFS average ceiling and -16dBFS peak ceiling.
        gain = min(1,10**(-25/20)/max(rms,1e-9),10**(-16/20)/max(peak,1e-9))
        start = len(reel)/2/RATE
        reel.extend(int(max(-1,min(1,x*gain))*32767) for x in samples)
        duration = len(samples)/2/RATE
        reel.extend([0]*round(RATE*2*.65))
        timeline.append({'label':label,'source_relative':path,'start':start,
            'duration':duration,'gain':gain,'source_sha256':hashlib.sha256(source.read_bytes()).hexdigest()})
    wav = BASE / f'{name}.wav'
    with wave.open(str(wav),'wb') as output:
        output.setparams((2,2,RATE,0,'NONE','not compressed'))
        output.writeframes(reel.tobytes())
    mp3 = BASE / f'{name}.mp3'
    subprocess.run(['ffmpeg','-v','error','-y','-i',str(wav),
        '-c:a','libmp3lame','-q:a','2',str(mp3)],check=True)
    receipt.append({'preview':mp3.name,'sha256':hashlib.sha256(mp3.read_bytes()).hexdigest(),
        'timeline':timeline})
(BASE/'preview-receipt.json').write_text(json.dumps({'source':'Chequered Ink 400 Sounds Pack',
    'source_url':'https://ci.itch.io/400-sounds-pack','processing':'attenuation only; full source durations; 650ms separators; no EQ/pitch change',
    'game_modified':False,'tests_run':False,'listening_verified':False,'previews':receipt},ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print('Two candidate reels created from 10 source sounds. Game unchanged.')
