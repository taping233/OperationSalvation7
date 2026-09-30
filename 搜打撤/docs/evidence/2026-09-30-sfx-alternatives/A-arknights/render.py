"""Arknights source editing only: no synthesis, layering, pitch shift or added reverb."""
from pathlib import Path
import json, hashlib, subprocess
import numpy as np
from scipy.signal import butter, sosfilt
import soundfile as sf

HERE = Path(__file__).resolve().parent
PROJECT = HERE.parents[3]
OUT = PROJECT / 'game/assets/sfx/alternatives/arknights'
WAV = HERE / 'processed-wav'
OUT.mkdir(parents=True, exist_ok=True)
WAV.mkdir(parents=True, exist_ok=True)
SR = 48000
REFERENCE = PROJECT / 'docs/evidence/2026-09-30-arknights-sfx-reference'
COMBAT = PROJECT / 'docs/evidence/2026-09-30-sfx-v6-ten/references'
RAW = HERE / 'originals'

def ff(args, data=None):
    return subprocess.run(['ffmpeg','-hide_banner','-v','error',*args], input=data,
                          capture_output=True, check=True).stdout

def read(path):
    return np.frombuffer(ff(['-i',str(path),'-ac','2','-ar',str(SR),'-f','f32le','-']),
                         dtype='<f4').reshape(-1,2).copy()

items = [
    ('click','点击','ui',RAW/'ui-recorded-click.wav',-14.0,None,
     '复刻站明确注明来自游戏录制的按键点击音；轻配平。'),
    ('confirm','确认候选','ui',RAW/'ui-home-button.wav',-11.5,None,
     '主界面复刻站的第二种按钮短音，映射确认候选；原游戏确认触发未核验。'),
    ('card','出牌','cards',REFERENCE/'d_avg_shufflecards.wav',-12.0,'card-packet',
     '原方舟剧情洗牌录音截取一个动作段；纸牌原质感，不追加合成层。'),
    ('attackSlash','刀刃攻击','combat',COMBAT/'p_atk_blade_n.mp3',-8.5,None,
     'player/p_atk 的刀刃攻击素材，保留原挥击结构。'),
    ('parry','格挡候选','combat',COMBAT/'p_imp_blackshield_n.mp3',-9.5,None,
     'player/p_imp 的 blackshield 命中素材映射格挡；具体角色与原触发未核验。'),
    ('shieldBreak','破盾候选','combat',RAW/'d_avg_glass_break.wav',-9.0,None,
     '原方舟玻璃破裂剧情素材映射屏障碎裂候选；并非已核实原版破盾声。'),
    ('heal','治疗','combat',COMBAT/'p_atk_heal_n.mp3',-11.0,None,
     'player/p_atk 的 heal 治疗动作素材，保留原提示与尾音。'),
    ('eventEnter','事件进入','nodes',REFERENCE/'b_ui_whoosh.wav',-11.0,None,
     'battle/b_ui 的 whoosh 界面过渡素材，仅在事件进入使用。'),
    ('chestBurst','开箱奖励候选','rewards',REFERENCE/'b_ui_rewardappear.wav',-10.0,None,
     'battle/b_ui 的 rewardappear 奖励出现素材映射开箱反馈；无新增爆炸层。'),
    ('bossReveal','Boss 登场候选','nodes',REFERENCE/'b_ui_alarmenter.wav',-10.0,None,
     'battle/b_ui 的 alarmenter 警报进入素材映射 Boss 预警；原登场触发未核验。'),
]

new = json.loads((HERE/'new-source-metadata.json').read_text(encoding='utf-8'))['files']
source_by_name = {x['file']:x for x in new}
old = json.loads((REFERENCE/'sources-and-checks.json').read_text(encoding='utf-8'))['files']
source_by_name.update({x['file']:x for x in old})
for x in json.loads((PROJECT/'docs/evidence/2026-09-30-sfx-v6-ten/reference-sources.json').read_text(encoding='utf-8')):
    name = x.get('file') or Path(x.get('url','')).name
    source_by_name[name] = x

checks=[]
cues=[]
montage=[]
markers=[]
cursor=.35
montage.append(np.zeros((int(cursor*SR),2),dtype='<f4'))
for cue_id,label,group,path,target,segment,note in items:
    a=read(path)
    assert len(a)>0 and np.isfinite(a).all()
    source_seconds=len(a)/SR
    amplitude=np.max(np.abs(a),axis=1)
    active=np.flatnonzero(amplitude>max(float(amplitude.max())*10**(-58/20),1e-7))
    start=max(0,int(active[0])-int(.002*SR))
    end=min(len(a),int(active[-1])+int(.020*SR)+1)
    if segment=='card-packet':
        # One recorded packet, chosen by its source energy envelope. No material layers.
        window=int(.75*SR)
        energy=np.convolve(np.mean(a*a,axis=1),np.ones(int(.02*SR))/int(.02*SR),'same')
        peak=int(np.argmax(energy))
        start=max(start,peak-int(.24*SR))
        end=min(end,start+window)
    a=a[start:end]
    # First-order 25 Hz DC/rumble reduction and 17.5 kHz ultrasonic rolloff only.
    a=sosfilt(butter(1,25,btype='highpass',fs=SR,output='sos'),a,axis=0)
    a=sosfilt(butter(1,17500,btype='lowpass',fs=SR,output='sos'),a,axis=0)
    head=min(int(.002*SR),len(a)//4)
    tail=min(int(.008*SR),len(a)//4)
    a[:head]*=np.linspace(0,1,head)[:,None]
    a[-tail:]*=np.linspace(1,0,tail)[:,None]
    peak=float(np.max(np.abs(a)))
    gain=10**(target/20)/peak
    a=(a*gain).astype('<f4')
    wav=WAV/f'{cue_id}.wav'
    ogg=OUT/f'{cue_id}.ogg'
    sf.write(wav,a,SR,subtype='PCM_24')
    ff(['-y','-i',str(wav),'-codec:a','libvorbis','-q:a','6','-ar',str(SR),'-ac','2',str(ogg)])
    decoded=read(ogg)
    decoded_peak=float(np.max(np.abs(decoded)))
    assert decoded_peak<1 and np.isfinite(decoded).all()
    probe=json.loads(subprocess.run(['ffprobe','-v','error','-show_streams','-of','json',str(ogg)],capture_output=True,check=True).stdout)
    stream=probe['streams'][0]
    assert stream['codec_name']=='vorbis' and int(stream['sample_rate'])==SR and stream['channels']==2
    seconds=round(len(decoded)/SR,6)
    cues.append(dict(id=cue_id,label=label,group=group,loop=False,note=note,
                     variants=[dict(src=f'./assets/sfx/alternatives/arknights/{cue_id}.ogg',seconds=seconds)]))
    source=dict(source_by_name.get(path.name,{}))
    source['local_source_file']=str(path.relative_to(PROJECT)).replace('\\','/')
    checks.append(dict(id=cue_id,source=source,source_seconds=round(source_seconds,6),
                       source_file_sha256=hashlib.sha256(path.read_bytes()).hexdigest(),
                       processing=dict(trim_start_s=round(start/SR,6),trim_end_s=round(end/SR,6),
                                       filters='1st-order highpass 25 Hz; 1st-order lowpass 17500 Hz',
                                       gain_db=round(20*np.log10(gain),4),peak_target_dbfs=target,
                                       fade_in_ms=2,fade_out_ms=8,resample_hz=SR,channels=2,
                                       pitch_change=False,synthetic_layers=False,reverb_added=False),
                       ogg=dict(path=str(ogg.relative_to(PROJECT)).replace('\\','/'),seconds=seconds,
                                sample_rate=SR,channels=2,codec='vorbis',quality=6,
                                sha256=hashlib.sha256(ogg.read_bytes()).hexdigest(),
                                decoded_peak_dbfs=round(20*np.log10(decoded_peak),4),
                                finite=True,clipped_samples=int(np.sum(abs(decoded)>=1)),decode='pass')))
    markers.append(dict(id=cue_id,label=label,start_s=round(cursor,6),seconds=seconds))
    montage.extend([decoded,np.zeros((int(.55*SR),2),dtype='<f4')])
    cursor+=seconds+.55
    print(cue_id,seconds,'s',round(20*np.log10(decoded_peak),2),'dBFS')

library=dict(name='方舟轻调试听库',version='A',featuredLabel='方舟轻调 · 十个',
             featuredTitle='保留原录音质感，只做轻剪辑与配平；确认、格挡、破盾和登场为候选用途。',
             featuredIds=[x[0] for x in items],
             groups=dict(ui='界面反馈',cards='卡牌动作',combat='战斗与状态',nodes='事件与登场',rewards='开箱奖励'),cues=cues)
(OUT/'library.json').write_text(json.dumps(library,ensure_ascii=False,indent=2),encoding='utf-8')
(HERE/'checks-and-processing.json').write_text(json.dumps(dict(version='A',source_derivative=True,
    license_fact='Arknights audio/recordings; no project-use authorization established. Repository code licenses do not establish rights to game audio.',
    listening='No human listening verification claimed; technical format/decode/finite/clipping checks only.',
    files=checks,preview_markers=markers),ensure_ascii=False,indent=2),encoding='utf-8')
preview=HERE/'00-A-arknights-ten.mp3'
ff(['-y','-f','f32le','-ar',str(SR),'-ac','2','-i','-','-codec:a','libmp3lame','-q:a','2',str(preview)],np.concatenate(montage).tobytes())
ff(['-i',str(preview),'-f','null','-'])
print('done',str(OUT/'library.json'))
