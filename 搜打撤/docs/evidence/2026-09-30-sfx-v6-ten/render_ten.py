from pathlib import Path
import json
import subprocess
import shutil
import zipfile
import numpy as np
import soundfile as sf
from scipy import signal
from dsp import SR
from ui_material import click, confirm, card_play, chest_open
from combat_material import slash, parry, shield_break, heal
from scene_material import event_enter, boss_reveal

ROOT=Path(__file__).resolve().parent
PROJECT=ROOT.parents[2]
TARGET=PROJECT/'game/assets/sfx/winter-v6-ten'
CASES=[
    ('01-ui-click','click','按钮点击','ui',click,'短、干、贴近操作'),
    ('02-ui-confirm','confirm','操作确认','ui',confirm,'两段回应，有明确收束'),
    ('03-card-play','card','出牌','cards',card_play,'纸张滑移，再落桌'),
    ('04-blade-hit','attackSlash','斩击命中','combat',slash,'先挥刃，后命中'),
    ('05-metal-parry','parry','金属格挡','combat',parry,'截住攻击，留短余振'),
    ('06-shield-fracture','shieldBreak','护盾崩裂','combat',shield_break,'先崩裂，再散成碎片'),
    ('07-heal','heal','治疗恢复','combat',heal,'气流展开，平缓恢复'),
    ('08-event-enter','eventEnter','进入事件','nodes',event_enter,'空间打开，信息接入'),
    ('09-chest-open','chestBurst','宝箱开启','rewards',chest_open,'解锁、掀盖、奖励'),
    ('10-boss-reveal','bossReveal','首脑登场','nodes',boss_reveal,'预告、蓄势、到来'),
]


def ffmpeg(args, data=None):
    return subprocess.run(['ffmpeg','-hide_banner','-v','error',*args],input=data,check=True,capture_output=True).stdout


def main():
    masters=ROOT/'masters'; previews=ROOT/'previews'; runtime=ROOT/'runtime'
    for folder in (masters,previews,runtime,TARGET): folder.mkdir(exist_ok=True)
    records=[]; cues=[]; pieces=[np.zeros((24000,2))]; markers=[]; cursor=.5
    for name,cue,label,group,render,note in CASES:
        x=render(); wav=masters/(name+'.wav')
        sf.write(str(wav),x,SR,subtype='PCM_24')
        x,rate=sf.read(str(wav),always_2d=True)
        tp=np.max(abs(signal.resample_poly(x,4,1,axis=0)))
        assert rate==SR and x.shape[1]==2 and np.isfinite(x).all()
        assert tp<.85 and np.max(abs(x[-720:]))<.001 and abs(np.mean(x))<.001
        f,tt,z=signal.stft(x.mean(axis=1),SR,nperseg=2048,noverlap=1536)
        p=abs(z)**2; e=p.sum(axis=0); active=e>e.max()*.03
        centroid=float(np.median((p[:,active]*f[:,None]).sum(axis=0)/(e[active]+1e-20)))
        flatness=float(np.median(np.exp(np.log(p[:,active]+1e-16).mean(axis=0))/(p[:,active].mean(axis=0)+1e-16)))
        for extension,codec,quality,folder in [('mp3','libmp3lame','2',previews),('ogg','libvorbis','7',runtime)]:
            path=folder/(name+'.'+extension)
            ffmpeg(['-y','-i',str(wav),'-codec:a',codec,'-q:a',quality,str(path)])
            decoded=np.frombuffer(ffmpeg(['-i',str(path),'-ac','2','-ar',str(SR),'-f','f32le','-']),dtype='<f4')
            assert np.isfinite(decoded).all() and np.max(abs(decoded))<.93
            if extension=='ogg': shutil.copyfile(path,TARGET/path.name)
        records.append(dict(id=cue,label=label,seconds=round(len(x)/SR,3),
                            true_peak_dbfs=round(float(20*np.log10(tp)),2),
                            active_spectral_centroid_hz=round(centroid),active_spectral_flatness=round(flatness,4),
                            format='48kHz stereo PCM_24',note=note))
        cues.append(dict(id=cue,label=label,group=group,loop=False,note=note,
                         variants=[dict(src='./assets/sfx/winter-v6-ten/'+name+'.ogg',seconds=round(len(x)/SR,3))]))
        markers.append(dict(label=label,start_s=round(cursor,3)))
        # One presentation per cue: order and silence help compare the ten independent designs.
        pieces.extend([x,np.zeros((31200,2))]); cursor+=len(x)/SR+.65
    montage=np.concatenate(pieces).astype('<f4')
    ffmpeg(['-y','-f','f32le','-ar',str(SR),'-ac','2','-i','-','-codec:a','libmp3lame','-q:a','2',str(previews/'00-ten-new.mp3')],montage.tobytes())
    ffmpeg(['-i',str(previews/'00-ten-new.mp3'),'-f','null','-'])
    library=dict(name='十个独立声音试样',version='V6',featuredLabel='本轮十个',
                 featuredTitle='逐个听动作与材质的区别',featuredIds=[c['id'] for c in cues],
                 groups={'ui':'界面反馈','cards':'卡牌动作','combat':'战斗与状态','nodes':'事件与登场','rewards':'开箱奖励'},cues=cues)
    (TARGET/'library.json').write_text(json.dumps(library,ensure_ascii=False),encoding='utf-8')
    (ROOT/'checks.json').write_text(json.dumps(dict(sounds=records,preview_seconds=round(cursor,3),markers=markers,
                                              note='Technical checks only; recognition and style need user audition'),ensure_ascii=False,indent=2),encoding='utf-8')
    with zipfile.ZipFile(ROOT/'sfx-v6-ten.zip','w',zipfile.ZIP_DEFLATED) as archive:
        for folder in (masters,previews,runtime):
            for path in folder.iterdir(): archive.write(path,str(path.relative_to(ROOT)))
    print(json.dumps(dict(sounds=records,preview_seconds=round(cursor,3)),ensure_ascii=False,indent=2))


if __name__=='__main__': main()
