"""Reproduce runtime cuts from the newly downloaded, locally retained source packs."""
import array
import hashlib
import json
import math
from pathlib import Path
import subprocess

BASE = Path(__file__).resolve().parent
ROOT = BASE.parents[2]
SRC = BASE / 'sources'
OUT = ROOT / 'game/assets/sfx/web-foley-1018'
OUT.mkdir(parents=True, exist_ok=True)
packs = {
    'buttons': ('Independent.nu / qubodup', 'https://opengameart.org/content/16-button-clicks'),
    'rpg': ('Kenney', 'https://opengameart.org/content/50-rpg-sound-effects'),
    'weapons': ('Vehicle / Jan Schupke', 'https://opengameart.org/content/fantasy-weapons-and-apparel-sfx-library'),
    'bells': ('PWL', 'https://opengameart.org/content/bell-dingschimes'),
    'completion': ('Brandon Morris / HaelDB', 'https://opengameart.org/node/5095'),
    'magic': ('JaggedStone', 'https://opengameart.org/content/magic-spell-sfx'),
}
specs = []
def add(name, pack, original, seconds, cutoff=6000, target=-22):
    specs.append((name, pack, original, seconds, cutoff, target))

# UI: short mechanical contacts; no musical confirmation motif on routine actions.
add('click', 'buttons', 'buttons_and_clicks/Clic07.mp3.flac', .095, 3800, -25)
add('select', 'buttons', 'buttons_and_clicks/Clic06.mp3.flac', .12, 4200, -25)
add('confirm', 'buttons', 'buttons_and_clicks/button02.mp3.flac', .18, 4200, -23)
add('back', 'buttons', 'buttons_and_clicks/button04.mp3.flac', .17, 3800, -25)
add('switch', 'buttons', 'buttons_and_clicks/Clic03.mp3.flac', .14, 4200, -25)
add('deny', 'buttons', 'buttons_and_clicks/button06.mp3.flac', .24, 3200, -24)
for name, original, duration in [
    ('page-short','bookFlip3',.23), ('page-long','bookFlip2',.4),
    ('paper-place','bookPlace1',.25), ('paper-place-2','bookPlace2',.3),
    ('book-open','bookOpen',.15), ('book-close','bookClose',.22),
    ('leather-pick','handleSmallLeather',.32), ('leather-drop','dropLeather',.35),
    ('coin-one','handleCoins2',.32), ('coin-many','handleCoins',.6),
    ('latch','metalLatch',.24), ('metal-click','metalClick',.28),
    ('cloth','cloth3',.4), ('door','doorOpen_1',.65),
    ('blunt','chop',.23), ('knife-cut','knifeSlice',.4), ('knife-cut-2','knifeSlice2',.38),
    ('knife-draw','drawKnife2',.35), ('wood-creak','creak3',.3),
]:
    add(name,'rpg',f'rpg/OGG/{original}.ogg',duration,5500,-22 if name not in ['blunt','knife-cut','knife-cut-2'] else -19)
for name, original, duration in [
    ('parry','sword-knife-clash-01',.36), ('parry-2','sword-knife-clash-03',.34),
    ('pierce','knife-unsheathe-02',.35), ('arrow','arrow-feathers-03',.25),
    ('buckle','belt-buckle-01',.19), ('unbuckle','sheath-unbuckle-01',.32),
    ('shield-break','sword-knife-clash-02',.5), ('heavy','sword-thermos-hit-01',.48),
    ('lunge','arrow-feathers-01',.2), ('leather','quiver-leather-squeeze-03',.32),
]:
    add(name,'weapons',f'weapons/sfx/{original}.wav',duration,6200,-20)
add('reward-small','bells','bell_ding2.wav',.48,3300,-25)
add('reward-rare','completion','completetask_0.mp3',.62,4000,-23)
add('reward-complete','completion','gmae.wav',.9,4000,-23)
for i, seconds in [(1,.65),(2,.5),(3,.5),(4,.9),(5,.5),(6,.55),(7,.7)]:
    original = 'magical_1_0.ogg' if i == 1 else f'magical_{i}.ogg'
    add(f'magic-{i}','magic',original,seconds,5500,-22)

receipt = []
for name, pack, original, limit, cutoff, target in specs:
    source = SRC / original
    raw = subprocess.check_output(['ffmpeg','-v','error','-i',str(source),'-ac','1','-ar','44100','-f','f32le','-'])
    a = array.array('f',raw)
    peak = max(map(abs,a))
    # Keep 3ms before the first significant transient, then fade both cut boundaries.
    onset = next(i for i,x in enumerate(a) if abs(x) >= peak * .035)
    start = max(0,onset/44100-.003)
    duration = min(limit,len(a)/44100-start)
    part = a[int(start*44100):int((start+duration)*44100)]
    rms = math.sqrt(sum(x*x for x in part)/len(part))
    volume = min(10**(target/20)/rms,10**(-9/20)/max(map(abs,part)),2)
    fade = min(.055,duration*.28)
    filters = f'atrim=start={start:.6f}:duration={duration:.6f},asetpts=PTS-STARTPTS,highpass=f=70,lowpass=f={cutoff},volume={volume:.6f},afade=t=in:d=0.003,afade=t=out:st={duration-fade:.6f}:d={fade:.6f}'
    output = OUT / f'{name}.ogg'
    subprocess.run(['ffmpeg','-v','error','-y','-i',str(source),'-af',filters,'-ac','1','-ar','44100','-c:a','libvorbis','-q:a','5',str(output)],check=True)
    decoded = array.array('f',subprocess.check_output(['ffmpeg','-v','error','-i',str(output),'-f','f32le','-ac','1','-']))
    receipt.append({'path':f'sfx/web-foley-1018/{name}.ogg','ext':'ogg','license':f'CC0 1.0 — {packs[pack][0]}',
        'bytes':output.stat().st_size,'sha256':hashlib.sha256(output.read_bytes()).hexdigest(),
        'source':packs[pack][1],'original_path':original,'source_sha256':hashlib.sha256(source.read_bytes()).hexdigest(),
        'processing':filters+'; mono 44100Hz Vorbis q5','duration':len(decoded)/44100,
        'peak_dbfs':20*math.log10(max(map(abs,decoded))),
        'rms_dbfs':20*math.log10(math.sqrt(sum(x*x for x in decoded)/len(decoded)))})
archives = [{'path':str(p.relative_to(ROOT)).replace('\\','/'),'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in SRC.glob('*') if p.suffix in ['.zip','.7z']]
(BASE/'receipt.json').write_text(json.dumps({'listening_verified':False,'archives_local_only':archives,'files':receipt},ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps({'files':len(receipt),'total_bytes':sum(x['bytes'] for x in receipt),'max_peak_dbfs':max(x['peak_dbfs'] for x in receipt)},indent=2))
