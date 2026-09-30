from pathlib import Path
import sys
sys.dont_write_bytecode=True
sys.path.insert(0,str(Path(__file__).resolve().parent.parent))
import concurrent.futures
import hashlib
import json
import subprocess
import urllib.request
import numpy as np
from process_common import process

HERE=Path(__file__).resolve().parent
ROOT=HERE.parent
PROJECT=ROOT.parents[2]
OUT=PROJECT/'game/assets/sfx/alternatives/arknights-expansion/exploration'
RAW=HERE/'originals'
RAW.mkdir(exist_ok=True)
inventory=json.loads((ROOT/'ui-bag/upstream-inventory.json').read_text(encoding='utf-8'))
FILES={part:{v['name']:v for v in values} for part,values in inventory.items()}
ITEMS=[
    ('danger','危险预警','combat','battle/b_ui','b_ui_dooralarm.wav','门禁式警报短响',-.45,1.04,-.8,40,-12),
    ('fireEnter','进入营火','nodes','avg','d_avg_woodcracle.wav','木柴短裂响，营火进入候选',-.25,1.02,-.5,35,-14),
    ('altarEnter','进入祭坛','nodes','avg','d_avg_slbellbtl.wav','短钟鸣，祭坛进入候选',-.55,1.03,-.8,55,-12),
    ('altarActivate','祭坛激活','nodes','avg','d_avg_activation.wav','装置启动与响应',-.60,1.04,-.7,50,-11),
    ('doorEnter','抵达层间门','nodes','avg','d_gen_dooropenquite.wav','轻门轴与开启动作',-.30,1.05,-.5,35,-13),
    ('shopEnter','进入补给站','nodes','avg','d_avg_doorbell.wav','门铃式交易提示',.30,1.05,-.6,35,-13),
    ('extractionEnter','撤离信标接通','exploration','avg','d_gen_transmissionget.wav','通信接通的短响应',-.45,1.04,-.6,45,-12),
    ('extractionSuccess','成功撤离','rewards','battle/b_ui','b_ui_act3funwin.wav','胜利式结果收束',.25,1.02,-.4,50,-11),
    ('extractionFail','撤离失败','rewards','battle/b_ui','b_ui_act3funfail.wav','失败式结果提示',-.35,1.02,-.7,50,-12),
    ('levelup','熟练度提升','growth','battle/b_char','b_char_tactboost.wav','战术增幅式成长反馈',.35,1.03,-.5,45,-11.5),
]


def fetch(row):
    _,_,_,part,name,*_=row
    item=FILES[part][name]; path=RAW/name
    if not path.exists():
        for attempt in range(3):
            try:
                request=urllib.request.Request(item['download_url'],headers={'User-Agent':'Codex-Audio-Selection'})
                with urllib.request.urlopen(request,timeout=25) as response: data=response.read()
                assert len(data)==item['size']
                blob=hashlib.sha1(b'blob '+str(len(data)).encode()+b'\0'+data).hexdigest()
                assert blob==item['sha']
                path.write_bytes(data); break
            except Exception:
                if attempt==2: raise
    data=path.read_bytes(); assert len(data)==item['size']
    return dict(file=name,source_path=item['path'],source_url=item['download_url'],git_blob_sha=item['sha'],
                source_sha256=hashlib.sha256(data).hexdigest(),bytes=len(data))


def main():
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool: sources=list(pool.map(fetch,ITEMS))
    source_map={r['file']:r for r in sources}
    cues=[]; checks=[]
    for row in ITEMS:
        key,label,group,part,name,note,pitch,tempo,shelf,release,peak=row
        segment=None
        if key=='fireEnter':
            raw=subprocess.run(['ffmpeg','-v','error','-i',str(RAW/name),'-ac','1','-ar','48000','-f','f32le','-'],
                               check=True,capture_output=True).stdout
            x=np.frombuffer(raw,dtype='<f4')
            energy=np.convolve(x*x,np.ones(960)/960,'same')
            center=int(np.argmax(energy))/48000
            segment=(max(0,center-.18),min(len(x)/48000,center+.98))
        record=process(RAW/name,key,OUT,HERE/'processed',pitch=pitch,tempo=tempo,shelf=shelf,
                       release_ms=release,peak_db=peak,segment=segment,
                       percussive=key in ('fireEnter','altarEnter','doorEnter','shopEnter','levelup'))
        record['source']=source_map[name]
        checks.append(record)
        prefix='./assets/sfx/alternatives/arknights-expansion/exploration/'
        cues.append(dict(id=key,label=label,group=group,note=note,
                         source_url=source_map[name]['source_url'],source_sha256=record['source_sha256'],
                         base=dict(src=prefix+key+'-base.ogg',seconds=record['checks']['base']['seconds']),
                         adjusted=dict(src=prefix+key+'.ogg',seconds=record['checks']['adjusted']['seconds'])))
        print(key,record['checks']['adjusted']['seconds'],flush=True)
    (HERE/'cues.json').write_text(json.dumps(cues,ensure_ascii=False,indent=2),encoding='utf-8')
    (HERE/'sources-and-processing.json').write_text(json.dumps(checks,ensure_ascii=False,indent=2),encoding='utf-8')
    print('Exploration: 10 sources, 20 OGG complete',flush=True)


if __name__=='__main__': main()
