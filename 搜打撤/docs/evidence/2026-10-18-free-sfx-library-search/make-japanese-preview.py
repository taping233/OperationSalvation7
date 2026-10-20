"""Private candidate reels for the game; no game files are changed."""
from pathlib import Path
import array
import hashlib
import json
import math
import subprocess
import wave

BASE = Path(__file__).resolve().parent
RATE = 48000
lab = json.loads((BASE/'japanese-lab-receipt.json').read_text(encoding='utf-8'))['files']
oto = []
for pack, filename, label, group in [
    ('Assorted_SE01','Assorted_SE01-01.mp3','短点击01','ui'),
    ('Assorted_SE01','Assorted_SE01-02.mp3','短点击02','ui'),
    ('Cyber14','Cyber14-1.mp3','系统确认','ui'),
    ('Cyber14','Cyber14-2.mp3','系统取消','ui'),
    ('Assorted_SE08','Assorted_SE08-01.mp3','合成铃01','reward'),
    ('Assorted_SE08','Assorted_SE08-04.mp3','合成铃04','reward'),
]:
    path = 'sources/japanese/otologic/'+pack+'/'+pack+'/'+filename
    oto.append({'provider':'OtoLogic','label':label,'group':group,'local_file':path,'sha256':hashlib.sha256((BASE/path).read_bytes()).hexdigest(),'source_pack':pack,'license':'CC BY 4.0','credit':'OtoLogic (https://otologic.jp), CC BY 4.0'})

receipt = []
for name, files in [('06-japanese-lab',lab),('07-japanese-otologic',oto)]:
    reel = array.array('h')
    timeline = []
    for item in files:
        source = BASE/item['local_file']
        raw = subprocess.check_output(['ffmpeg','-v','error','-i',str(source),'-ar',str(RATE),'-ac','2','-f','f32le','-'])
        samples = array.array('f',raw)
        rms = math.sqrt(sum(x*x for x in samples)/len(samples))
        peak = max(map(abs,samples))
        gain = min(1,10**(-27/20)/max(rms,1e-9),10**(-18/20)/max(peak,1e-9))
        start = len(reel)/2/RATE
        reel.extend(int(max(-1,min(1,x*gain))*32767) for x in samples)
        duration = len(samples)/2/RATE
        reel.extend([0]*round(RATE*2*.8))
        timeline.append({**item,'start':round(start,3),'duration':round(duration,3),'gain':gain})
    wav = BASE/(name+'.wav')
    with wave.open(str(wav),'wb') as output:
        output.setparams((2,2,RATE,0,'NONE','not compressed'))
        output.writeframes(reel.tobytes())
    mp3 = BASE/(name+'.mp3')
    subprocess.run(['ffmpeg','-v','error','-y','-i',str(wav),'-c:a','libmp3lame','-q:a','2',str(mp3)],check=True)
    receipt.append({'preview':mp3.name,'bytes':mp3.stat().st_size,'sha256':hashlib.sha256(mp3.read_bytes()).hexdigest(),'duration':round(len(reel)/2/RATE,3),'timeline':timeline})
    print(mp3.name,round(len(reel)/2/RATE,2),'seconds')
(BASE/'japanese-preview-receipt.json').write_text(json.dumps({'use':'private project selection','processing':'attenuation only; full source durations; 800ms separators; no EQ, pitch shift, layering, or AI generation','previews':receipt,'game_modified':False,'tests_run':False,'listening_verified':False},ensure_ascii=False,indent=2)+'\n',encoding='utf-8')

lines=['# 日本音效站第二轮候选','', '老板否定Sonniss本轮试听，继续限定免费、可商用；不替换游戏，由老板验证听感。', '', '効果音ラボ：官网按钮/系统页 https://soundeffect-lab.info/sound/button/ ；许可 https://soundeffect-lab.info/agreement/ ，允许商用和修改、不强制署名。选样仅本地项目内部使用，未对外发布音效素材或介绍视频。', '', 'OtoLogic：音效提供 OtoLogic (https://otologic.jp)，CC BY 4.0；发布游戏时需保留署名。许可 https://otologic.jp/free/license ，允许商用、修改和带署名再分发。素材页为 https://otologic.jp/free/se/assorted-se01.html 及 https://otologic.jp/free/se/cyber02.html 。', '', '两段均保留原始时长，只降低响度，每样之间800ms停顿；未EQ、变调、叠层，未进行游戏、构建、测试或耳听验收。分组及标签描述选样用途，不代表主观质量已通过。', '']
for preview in receipt:
    lines += ['## '+preview['preview']+'（'+str(preview['duration'])+'秒）','','| 开始秒 | 名称 | 类型 | 原件 |','| --- | --- | --- | --- |']
    for item in preview['timeline']:
        lines += [f"| {item['start']:.2f} | {item['label']} | {item['group']} | [{Path(item['local_file']).name}]({item['local_file']}) |"]
    lines += ['']
lines += ['原始来源URL、相对路径与SHA256见`japanese-lab-receipt.json`、`japanese-otologic-archives.json`、`japanese-preview-receipt.json`。音频和ZIP只在本地保留，不进Git。下载方式：効果音ラボ官方页面的下载链接，OtoLogic官方页面经Codex内置浏览器downloadMedia领取；未注册或付款。','']
(BASE/'JAPANESE-AUDITION.md').write_text('\n'.join(lines),encoding='utf-8')
