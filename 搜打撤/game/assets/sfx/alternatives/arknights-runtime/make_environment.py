"""Use the approved small source edits for node sounds and seamless ambience."""
import json, sys, urllib.request, concurrent.futures
from pathlib import Path
import numpy as np
import soundfile as sf

ROOT = Path(__file__).resolve().parents[5]
sys.path.insert(0, str(ROOT/'docs/evidence/2026-09-30-sfx-arknights-thirty'))
from process_common import process, ff, SR
OUT = Path(__file__).parent/'environment'
WORK = ROOT/'.sfx-work/arknights-runtime/environment'
WORK.mkdir(parents=True, exist_ok=True)
inventory = json.loads((ROOT/'docs/evidence/2026-09-30-sfx-arknights-thirty/ui-bag/upstream-inventory.json').read_text(encoding='utf-8'))
items = {x['name']: x for group in inventory.values() for x in group}
SPECS = [
 ('altarOffer','祭坛献祭','d_avg_glassclink.wav'),
 ('altarReward','祭坛回赠','d_avg_magic_3.wav'),
 ('eggHatch','宠物孵化','d_avg_icebrk.wav'),
 ('petRescue','救援生物','d_avg_catsmell.wav'),
 ('eventClue','发现线索','d_avg_magicwrite.wav'),
 ('eventComplete','事件完成','d_avg_magic_2.wav'),
 ('eventDanger','危险事件','d_avg_airdefensealert.wav'),
 ('eventSafe','安全事件','d_avg_magic_1.wav'),
 ('extractionConfirm','确认撤离','d_avg_devicebeep.wav'),
 ('layerEnter','进入环层','d_avg_machineactive.wav'),
 ('searchStart','搜索物资','d_avg_scan.wav'),
 ('searchReveal','搜索揭晓','b_char_radar.wav'),
 ('storyClue','故事线索','d_avg_book_close.wav'),
 ('storyComplete','故事完成','d_avg_piano_start.wav'),
 ('windSnowLoop','风雪环境','d_amb_blizzard.wav'),
 ('wastelandWindLoop','荒野风声','d_avg_wind.wav'),
 ('ruinsAirLoop','废墟气流','d_avg_darkforest.wav'),
 ('pollutionDroneLoop','污染区环境','d_avg_drone.wav'),
 ('fireLoop','营火环境','d_avg_woodcracle.wav'),
 ('altarHumLoop','祭坛环境','d_avg_beamamb.wav'),
 ('extractionBeaconLoop','撤离信标环境','d_avg_labamb.wav'),
]

def make(spec):
    cue, label, filename = spec
    item = items[filename]
    source = WORK/filename
    if not source.exists():
        for attempt in range(4):
            try:
                with urllib.request.urlopen(item['download_url'], timeout=20) as response:
                    chunks=[]
                    while True:
                        chunk=response.read(65536)
                        if not chunk: break
                        chunks.append(chunk)
                payload=b''.join(chunks)
                if len(payload)!=item['size']: raise ValueError('Incomplete '+filename)
                source.write_bytes(payload)
                break
            except Exception:
                if attempt==3: raise
    loop = cue.endswith('Loop')
    result = process(source, cue, OUT, WORK, pitch=-.35 if loop else -.55,
                     tempo=1.02 if loop else 1.05, shelf=-.8, peak_db=-17 if loop else -12,
                     segment=(0, 12 if loop else 2.6), percussive=not loop)
    if loop:
        x, sr = sf.read(str(WORK/(cue+'.wav')), always_2d=True)
        # 头尾交叉衔接，整段仍来自同一源，不另铺噪声。
        n = min(round(.35*sr),len(x)//4)
        blend = x[-n:]*np.linspace(1,0,n)[:,None]+x[:n]*np.linspace(0,1,n)[:,None]
        x = np.concatenate((blend,x[n:-n]))
        x *= 10**(-17/20)/max(np.max(abs(x)),1e-12)
        wav=WORK/(cue+'-loop.wav');sf.write(str(wav),x,sr,subtype='PCM_24')
        ff(['-y','-i',str(wav),'-codec:a','libvorbis','-q:a','6',str(OUT/(cue+'.ogg'))])
        seconds=len(x)/sr
    else: seconds=result['checks']['adjusted']['seconds']
    return dict(id=cue,label=label,group='ambient' if loop else 'nodes',loop=loop,
                source_url=item['download_url'],gain=.14 if loop else .5,
                variants=[dict(src='./assets/sfx/alternatives/arknights-runtime/environment/'+cue+'.ogg',seconds=round(seconds,4))])

if __name__ == '__main__':
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
        cues=list(pool.map(make,SPECS))
    (OUT/'fragment.json').write_text(json.dumps(dict(groups=dict(ambient='场景环境',nodes='节点与探索'),cues=cues),ensure_ascii=False,indent=2),encoding='utf-8')
    print('environment: '+str(len(cues))+' effects ready')
