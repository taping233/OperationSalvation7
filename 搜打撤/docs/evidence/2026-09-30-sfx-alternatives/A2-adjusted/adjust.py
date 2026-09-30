"""Subtle edits to the approved Arknights bed, retaining A unchanged for comparison."""
from pathlib import Path
import json
import subprocess
import numpy as np
import soundfile as sf
from scipy import signal

HERE=Path(__file__).resolve().parent
PROJECT=HERE.parents[3]
BASE=HERE.parent/'A-arknights'
OUT=PROJECT/'game/assets/sfx/alternatives/arknights-adjusted'
WAV=HERE/'wav'
PARAMS={
    # id: pitch semitones, tempo factor, upper shelf dB, tail release ms
    'click':(-.65,1.08,-.6,18),
    'confirm':(.45,1.05,-.3,24),
    'card':(-.40,1.09,-.7,34),
    'attackSlash':(-.80,1.04,-.8,40),
    'parry':(-.90,1.05,-1.0,50),
    'shieldBreak':(-.45,1.08,-1.3,54),
    'heal':(.50,.98,-.4,44),
    'eventEnter':(-.55,1.04,-.6,60),
    'chestBurst':(.35,1.08,-.4,42),
    'bossReveal':(-.80,.97,-.9,65),
}
NOTES={
    'click':'音色略沉，点击更紧凑', 'confirm':'确认候选，音高略升、收束更短',
    'card':'纸牌滑动略快，尾音稍短', 'attackSlash':'挥击更紧，音色略沉',
    'parry':'格挡候选，降低音高与尾音亮度', 'shieldBreak':'碎裂略快，减少尖亮',
    'heal':'治疗提示略升，展开稍缓', 'eventEnter':'保留吸入与展开，节奏更紧',
    'chestBurst':'奖励反馈略快，收尾更短', 'bossReveal':'警报预告略沉、稍缓',
}


def ff(args,data=None):
    return subprocess.run(['ffmpeg','-v','error',*args],input=data,check=True,capture_output=True).stdout


def main():
    OUT.mkdir(exist_ok=True); WAV.mkdir(exist_ok=True)
    source_library=json.loads((PROJECT/'game/assets/sfx/alternatives/arknights/library.json').read_text(encoding='utf-8'))
    cues=[]; records=[]; pieces=[np.zeros((24000,2))]; markers=[]; cursor=.5
    for cue in source_library['cues']:
        key=cue['id']; semi,tempo,shelf_db,release=PARAMS[key]
        source=BASE/'processed-wav'/(key+'.wav')
        original,rate=sf.read(str(source),always_2d=True); assert rate==48000
        percussive=key in ('click','confirm','card','attackSlash','parry','shieldBreak','chestBurst')
        pitch=2**(semi/12)
        settings=(f'rubberband=tempo={tempo}:pitch={pitch:.9f}:transients={"crisp" if percussive else "mixed"}'
                  f':detector={"percussive" if percussive else "compound"}:phase=laminar:window=short'
                  ':smoothing=off:formant=preserved:pitchq=quality:channels=together')
        raw=ff(['-i',str(source),'-af',settings,'-ac','2','-ar','48000','-f','f32le','-'])
        x=np.frombuffer(raw,dtype='<f4').reshape(-1,2).copy()
        assert len(x)>0 and np.isfinite(x).all()
        # Gentle complementary shelf; never replaces or adds a material layer.
        low=signal.sosfilt(signal.butter(1,5600,fs=48000,output='sos'),x,axis=0)
        x=low+(x-low)*10**(shelf_db/20)
        n=min(round(release*.001*48000),len(x)//5)
        x[-n:]*=np.linspace(1,.55,n)[:,None]
        head=min(48,len(x)//4); end=min(240,len(x)//4)
        x[:head]*=np.linspace(0,1,head)[:,None]; x[-end:]*=np.linspace(1,0,end)[:,None]
        # Keep the same A peak so the comparison is not dominated by loudness.
        x*=np.max(abs(original))/max(np.max(abs(x)),1e-12)
        path=WAV/(key+'.wav'); sf.write(str(path),x,48000,subtype='PCM_24')
        ogg=OUT/(key+'.ogg')
        ff(['-y','-i',str(path),'-codec:a','libvorbis','-q:a','6',str(ogg)])
        decoded=np.frombuffer(ff(['-i',str(ogg),'-ac','2','-ar','48000','-f','f32le','-']),dtype='<f4').reshape(-1,2)
        assert np.isfinite(decoded).all() and np.max(abs(decoded))<.85
        assert np.max(abs(decoded[-240:]))<.004
        true_peak=np.max(abs(signal.resample_poly(decoded,4,1,axis=0)))
        assert true_peak<.9
        seconds=round(len(decoded)/48000,6)
        records.append(dict(id=key,base=str(source.relative_to(PROJECT)),pitch_semitones=semi,tempo=tempo,
                            high_shelf_db=shelf_db,release_ms=release,ffmpeg_filter=settings,
                            source_seconds=round(len(original)/48000,6),seconds=seconds,
                            decoded_peak_dbfs=round(float(20*np.log10(np.max(abs(decoded)))),3),
                            true_peak_dbfs=round(float(20*np.log10(true_peak)),3),decode='pass'))
        item={**cue,'note':NOTES[key],'variants':[dict(src=f'./assets/sfx/alternatives/arknights-adjusted/{key}.ogg',seconds=seconds)]}
        cues.append(item); markers.append(dict(id=key,start_s=round(cursor,3)))
        pieces.extend([decoded,np.zeros((26400,2))]); cursor+=seconds+.55
    library={**source_library,'name':'方舟微改试听库','version':'A2','featuredLabel':'方舟微改 · 十个',
             'featuredTitle':'保留主体质感，轻调音色、节奏与尾音','cues':cues}
    (OUT/'library.json').write_text(json.dumps(library,ensure_ascii=False,indent=2),encoding='utf-8')
    (HERE/'checks-and-processing.json').write_text(json.dumps(dict(source_derivative=True,changes=records,
        preview_markers=markers,synthetic_layers=False,added_reverb=False),ensure_ascii=False,indent=2),encoding='utf-8')
    preview=HERE/'00-A2-ten.mp3'
    ff(['-y','-f','f32le','-ar','48000','-ac','2','-i','-','-codec:a','libmp3lame','-q:a','2',str(preview)],np.concatenate(pieces).astype('<f4').tobytes())
    ff(['-i',str(preview),'-f','null','-'])
    print(json.dumps(dict(count=len(cues),changes=records,preview_seconds=round(cursor,3)),ensure_ascii=False))


if __name__=='__main__': main()
