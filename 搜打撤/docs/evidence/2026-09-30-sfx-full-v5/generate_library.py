"""Build masters, encoded assets, cue mapping and listening previews for the approved style."""
from pathlib import Path
from collections import Counter
import concurrent.futures
import csv
import hashlib
import json
import re
import shutil
import subprocess
import zipfile
import numpy as np
import soundfile as sf
from scipy import signal
from engine import SR, Synth

ROOT = Path(__file__).resolve().parent
PROJECT = ROOT.parents[2]
ACCEPTED = ROOT.parent / '2026-09-30-sfx-audition-v5'
ANCHORS = {'click':'03-ui-click.wav','card':'04-card-play.wav','hit':'02-attack-impact.wav',
           'eventEnter':'01-event-enter.wav','bossReveal':'05-boss-reveal.wav'}
EXPECTED = {'click':'fd74fd1597ad971275fa199ec5ed2a741bf7b105ce0d4561bec3e00028f04e3c',
            'card':'16d406f379ff88d4c5ea9002f665e1d7240203c3710f29e7e8f3bf84b526ad8b',
            'hit':'aad3e1b47aeee10060de7a80b32af8618958b5f906a0ace987a50e62a135c8f7',
            'eventEnter':'3c636caf3b97f64670350c232db86d4654e5d58bffffb1c94af4ef51215d4a89',
            'bossReveal':'639d9916027a38e42818cf73662211aee036f5e0b5d78322fecdb25a5f289075'}
GROUP_LABELS={'ui':'操作与界面','cards':'卡牌','combat':'战斗状态与反馈','rewards':'宝箱与结果',
              'nodes':'节点进入与转场','exploration':'探索与结算','growth':'局外成长',
              'attacks':'攻击类型','ambient':'环境循环'}


def dump(path, value):
    path.write_text(json.dumps(value,ensure_ascii=False,indent=2),encoding='utf-8')


def run(args, data=None):
    return subprocess.run(['ffmpeg','-hide_banner','-v','error',*args],input=data,
                          capture_output=True,check=True).stdout


def seed_for(name,index):
    return int.from_bytes(hashlib.blake2s(f'winter-v5:{name}:{index}'.encode(),digest_size=8).digest(),'little')


def coverage(rows):
    text=(PROJECT/'game/src/audio/sound.js').read_text(encoding='utf-8')
    legacy=set()
    for start,end in [('  const SFX = {','  /* ---------- jsfxr'),
                      ('  const JSFX_URLS = {','  let jsfxBuffers'),
                      ('  const BATTLE_URLS = {','  // 采样峰值')]:
        part=text[text.index(start):text.index(end,text.index(start))]
        legacy.update(re.findall(r'^    ([A-Za-z]+):',part,re.M))
    ids={r['id'] for r in rows}; aliases={key:key for key in legacy if key in ids}
    aliases.update(scene='eventEnter',turnSelf='phaseSelf',turnFoe='phaseFoe',
                   phase={'self':'phaseSelf','foe':'phaseFoe','default':'phaseSelf'})
    assert len(legacy)==50, f'Runtime registry changed: {len(legacy)}'
    assert legacy==set(aliases), f'Uncovered legacy cues: {legacy-set(aliases)}'
    return aliases


def analyze(path,row,anchor=False):
    x,rate=sf.read(str(path),always_2d=True)
    assert rate==SR and x.shape[1]==2 and np.isfinite(x).all()
    assert len(x)>0 and np.max(abs(x))>.0001
    peak=np.max(abs(x)); rms=np.sqrt(np.mean(x*x))
    tp=np.max(abs(signal.resample_poly(x,4,1,axis=0)))
    assert tp<10**(-3/20), f'True peak too high: {path.name}'
    assert abs(np.mean(x))<.001, f'DC offset: {path.name}'
    loop=row['recipe']=='loop'; tail=np.max(abs(x[-720:]))
    if not loop: assert tail<.001, f'Unfinished tail: {path.name}'
    seam=None
    if loop:
        typical=np.sqrt(np.mean(np.diff(x,axis=0)**2))
        seam=float(np.max(abs(x[0]-x[-1]))/max(typical,1e-12))
        assert seam<7, f'Loop seam outlier: {path.name}'
    return dict(seconds=round(len(x)/SR,3),sample_rate=SR,channels=2,format='PCM_24',
                peak_dbfs=round(float(20*np.log10(peak)),2),rms_dbfs=round(float(20*np.log10(rms)),2),
                true_peak_dbfs=round(float(20*np.log10(tp)),2),tail_peak_dbfs=round(float(20*np.log10(max(tail,1e-12))),2),
                loop=loop,seam_delta_over_typical=seam,accepted_anchor=anchor), x


def encode(record):
    wav=ROOT/record['master']; ogg=ROOT/record['runtime']; ogg.parent.mkdir(parents=True,exist_ok=True)
    run(['-y','-i',str(wav),'-codec:a','libvorbis','-q:a','5',str(ogg)])
    raw=run(['-i',str(ogg),'-ar',str(SR),'-ac','2','-f','f32le','-'])
    x=np.frombuffer(raw,dtype='<f4').reshape(-1,2)
    assert np.isfinite(x).all() and len(x)>0
    assert abs(len(x)/SR-record['seconds'])<.035
    assert np.max(abs(x))<.9, f'Encoded peak overflow: {ogg.name}'
    return dict(file=record['runtime'],decoded_seconds=round(len(x)/SR,4),
                decoded_peak_dbfs=round(float(20*np.log10(np.max(abs(x)))),2),decode='pass')


def preview(filename, selected, cap=None):
    pieces=[np.zeros((24000,2))]; markers=[]; cursor=.5
    for row,path in selected:
        x,rate=sf.read(str(path),always_2d=True); assert rate==SR
        if cap is not None and len(x)>cap*SR:
            x=x[:round(cap*SR)].copy(); x[-2400:]*=np.linspace(1,0,2400)[:,None]
        if row['recipe']=='loop': x=x*2 # Preview-only lift; originals remain quiet.
        markers.append(dict(id=row['id'],label=row['label'],start_s=round(cursor,3),seconds=round(len(x)/SR,3)))
        pieces.extend([x,np.zeros((16800,2))]); cursor+=len(x)/SR+.35
    audio=np.concatenate(pieces).astype('<f4'); path=ROOT/'previews'/filename
    path.parent.mkdir(exist_ok=True)
    run(['-y','-f','f32le','-ar',str(SR),'-ac','2','-i','-','-codec:a','libmp3lame','-q:a','2',str(path)],audio.tobytes())
    run(['-i',str(path),'-f','null','-'])
    return dict(file=str(path.relative_to(ROOT)).replace('\\','/'),seconds=round(cursor,3),markers=markers)


def make_zip(path, paths):
    with zipfile.ZipFile(path,'w',zipfile.ZIP_DEFLATED,compresslevel=6) as archive:
        for item in paths: archive.write(item,str(item.relative_to(ROOT)))


def main():
    rows=list(csv.DictReader((ROOT/'catalog.tsv').open(encoding='utf-8'),delimiter='\t'))
    assert len({r['id'] for r in rows})==len(rows)
    aliases=coverage(rows); records=[]; cue_map={}; firsts={}; groups=Counter()
    for row in rows:
        cue=row['id']; group=row['group']; waveforms=[]; cue_variants=[]
        for index in range(int(row['variants'])):
            path=ROOT/'masters'/group/f'{cue}-{index+1:02}.wav'; path.parent.mkdir(parents=True,exist_ok=True)
            anchor=cue in ANCHORS and index==0
            if anchor:
                source=ACCEPTED/ANCHORS[cue]
                assert hashlib.sha256(source.read_bytes()).hexdigest()==EXPECTED[cue]
                shutil.copyfile(source,path)
                assert path.read_bytes()==source.read_bytes()
            else:
                sf.write(str(path),Synth(row,seed_for(cue,index),index).render(),SR,subtype='PCM_24')
            metrics,x=analyze(path,row,anchor)
            adjustment=0.0
            if index:
                target=np.sqrt(np.mean(waveforms[0]**2)); current=np.sqrt(np.mean(x**2))
                wanted=target/max(current,1e-12)
                true_peak=np.max(abs(signal.resample_poly(x,4,1,axis=0)))
                gain=min(wanted,10**(-3.4/20)/true_peak)
                adjustment=round(float(20*np.log10(gain)),3)
                sf.write(str(path),x*gain,SR,subtype='PCM_24')
                metrics,x=analyze(path,row,anchor)
            waveforms.append(x)
            master=str(path.relative_to(ROOT)).replace('\\','/')
            runtime=f'runtime/{group}/{cue}-{index+1:02}.ogg'
            record=dict(id=cue,variant=index+1,label=row['label'],group=group,master=master,runtime=runtime,
                        variant_rms_adjustment_db=adjustment,**metrics)
            records.append(record); cue_variants.append(dict(master=master,runtime=runtime))
            if index==0: firsts[cue]=(row,path)
        # Variants must be new waveforms, not identical duplicates.
        correlations=[]
        for i in range(1,len(waveforms)):
            n=min(len(waveforms[0]),len(waveforms[i])); a=waveforms[0][:n].mean(axis=1); b=waveforms[i][:n].mean(axis=1)
            corr=float(np.corrcoef(a,b)[0,1]); assert abs(corr)<.97
            correlations.append(round(corr,4))
        cue_map[cue]=dict(label=row['label'],group=group,loop=row['recipe']=='loop',variants=cue_variants,
                          variation_correlations=correlations,calibration='Preserve file gain; do not peak-normalize again')
        groups[group]+=1
        if row==rows[-1] or rows[rows.index(row)+1]['group']!=group:
            print(f'Masters: {group} {groups[group]} cues complete',flush=True)
    print(f'Encoding and decoding {len(records)} OGG files...',flush=True)
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool: encoded=list(pool.map(encode,records))
    manifest=dict(name='冬境原创音效 v5',version=1,sample_rate=SR,cue_count=len(rows),file_count=len(records),
                  legacy_key_count=len(aliases),legacy_aliases=aliases,cues=cue_map,
                  scope='Assets prepared; runtime hooks not modified',
                  source='New independent synthesis using abstract broad-band statistics; no imported Arknights audio samples')
    dump(ROOT/'manifest.json',manifest)
    previews=[]
    for group in groups:
        previews.append(preview(group+'.mp3',[firsts[r['id']] for r in rows if r['group']==group],3 if group=='ambient' else None))
    showcase=['click','hover','card','draw','hit','hurt','parry','shieldBreak','heal','danger','chestBurst',
              'legend','eventEnter','fireEnter','altarActivate','extractionSuccess','bossReveal','bossVictory']
    previews.insert(0,preview('00-showcase.mp3',[firsts[c] for c in showcase],1.98))
    dump(ROOT/'preview-index.json',previews)
    dump(ROOT/'quality-report.json',dict(cue_count=len(rows),master_count=len(records),encoded_count=len(encoded),
                                       legacy_covered=50,anchors_preserved=list(ANCHORS),groups=dict(groups),files=records,encoded=encoded))
    lines=['# 音效清单与接入映射','',f'共 {len(rows)} 种音效、{len(records)} 个版本。现有 50 个名称全部有映射；新增声音需要在对应触发点接线。',
           '', 'phase 按 opts.side 选择敌我；turnSelf/turnFoe 复用对应回合音。scene 映射到已认可的 eventEnter。',
           '这些文件已按使用场景校准，接入时保留文件响度；旧采样的峰值归一化不能直接套用。运行时变体可随机选择，循环 cue 按进入/离开场景启停。',
           '', '| 分类 | ID | 用途 | 版本数 | 现有名称/新触发点 |','|---|---|---|---|---|']
    for row in rows:
        names=[key for key,value in aliases.items() if value==row['id'] or isinstance(value,dict) and row['id'] in value.values()]
        lines.append(f"| {GROUP_LABELS[row['group']]} | {row['id']} | {row['label']} | {row['variants']} | {', '.join(names) if names else '新增触发点'} |")
    (ROOT/'音效清单与接入映射.md').write_text('\n'.join(lines)+'\n',encoding='utf-8')
    shared=[ROOT/'manifest.json',ROOT/'catalog.tsv',ROOT/'音效清单与接入映射.md',ROOT/'README.md']
    make_zip(ROOT/'winter-sfx-v5-runtime.zip',list((ROOT/'runtime').rglob('*.ogg'))+shared)
    sources=[ROOT/'engine.py',ROOT/'generate_library.py',ROOT/'spectrum_profiles.json',ROOT/'quality-report.json']
    make_zip(ROOT/'winter-sfx-v5-masters.zip',list((ROOT/'masters').rglob('*.wav'))+shared+sources)
    print(json.dumps(dict(cues=len(rows),masters=len(records),ogg=len(encoded),groups=dict(groups),
                          anchors_preserved=5,legacy_covered=50,showcase_seconds=previews[0]['seconds']),ensure_ascii=False),flush=True)


if __name__=='__main__': main()
