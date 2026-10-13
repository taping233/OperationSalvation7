"""Second original take: native LMMS stems, explicit phrase and mix revision."""
import concurrent.futures
import copy
import hashlib
import importlib.util
import json
import os
import pathlib
import subprocess
import sys
import xml.etree.ElementTree as ET
import numpy as np
import soundfile as sf
from scipy.signal import butter, sosfilt

OUT = pathlib.Path(__file__).resolve().parent
ROOT = OUT.parents[2]
SPEC = importlib.util.spec_from_file_location('v1', ROOT/'docs/evidence/2026-10-12-WF-battle-rewrite-demo/compose.py')
BASE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(BASE)
DAW = BASE.DAW
DAW.OUT = OUT
DAW.RNG = np.random.default_rng(202610122)
NAME = 'battle-shadowtide-v2-30s'
SR, BPM = 48000, 128
GROUPS = {
    'low': ['Synth bass pulse', 'Cello floor', 'Kick'],
    'beat': ['Snare and ghosts', 'Hats', 'Low percussion'],
    'theme': ['Ensemble theme', 'Muted brass answer', 'Viola response'],
    'detail': ['Pizzicato motor', 'Electric piano', 'Harp turn', 'Dark glass', 'Air pad'],
}

def dump(name, data):
    (OUT/name).write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding='utf-8')

def score():
    s = DAW.Score(NAME, BPM, 'battle', '影潮交锋 · 第二版')
    for args in [
        ('Synth bass pulse', 38, 57, 0, 0, 0), ('Cello floor', 42, 21, 0, 0, .025),
        ('Kick', 25, 58, 0, 128, 0), ('Snare and ghosts', 25, 47, 0, 128, .015),
        ('Hats', 25, 20, 35, 128, .02), ('Low percussion', 116, 22, -10, 0, .03),
        ('Ensemble theme', 48, 54, -38, 0, .08), ('Muted brass answer', 59, 43, 48, 0, .055),
        ('Viola response', 41, 34, 45, 0, .055), ('Pizzicato motor', 45, 32, -58, 0, .045),
        ('Electric piano', 4, 32, 52, 0, .07), ('Harp turn', 46, 21, -42, 0, .08),
        ('Dark glass', 8, 14, 62, 0, .10), ('Air pad', 89, 15, -25, 0, .05),
    ]:
        s.instrument(*args)
    chords = {'Dm': (38, [57, 62, 65, 69]), 'Bb': (34, [58, 62, 65, 69]),
              'Gm': (31, [58, 62, 67, 69]), 'A7': (33, [55, 61, 64, 70])}
    progression = ['Dm', 'Dm', 'Dm', 'Dm', 'Bb', 'Bb', 'Gm', 'A7',
                   'Dm', 'A7', 'Dm', 'Bb', 'Gm', 'A7', 'A7', 'Dm']
    themes = {
        2: [(.25, 74, .76, 77), (1.0, 77, .98, 70), (2.0, 81, 1.74, 80)],
        3: [(0, 79, 1.04, 75), (1, 76, .76, 68), (1.75, 77, 1.02, 73), (2.75, 74, .94, 69)],
        4: [(.25, 74, .76, 77), (1, 77, .98, 71), (2, 81, 1.74, 80)],
        5: [(0, 79, 1.04, 75), (1, 77, .76, 71), (1.75, 74, .78, 68), (2.75, 72, .85, 63)],
        6: [(.25, 74, .78, 76), (1, 77, .74, 71), (2, 79, 1.55, 79)],
        7: [(0, 76, .73, 73), (.75, 73, .74, 68), (1.5, 70, .72, 64), (2.5, 69, 1.05, 66)],
        10: [(.25, 74, .78, 81), (1, 77, .99, 76), (2, 81, 1.76, 83)],
        11: [(0, 79, 1.05, 79), (1, 77, .77, 73), (1.75, 74, 1.01, 72), (2.75, 77, .93, 77)],
        12: [(.25, 79, .78, 80), (1, 81, .74, 76), (1.75, 82, 1.57, 83), (3.5, 81, .38, 71)],
        13: [(0, 79, .78, 78), (.75, 76, 1.0, 72), (1.75, 73, .76, 69), (2.75, 69, .94, 64)],
        14: [(.25, 76, .95, 72), (1.25, 73, 1.1, 69), (2.5, 69, 1.1, 64)],
        15: [(0, 74, 3.35, 73)],
    }
    for bar, chord in enumerate(progression):
        root, voices = chords[chord]
        breath, tail = bar in (8, 9), bar == 15
        section = 'Breathing' if breath else ('Return' if 10 <= bar < 14 else 'Theme' if 2 <= bar < 8 else 'Cadence' if bar >= 14 else 'Entrance')
        bass = [(0, root, .65, 84), (1.25, root, .3, 62), (2.0, root+7, .45, 65), (3.25, root, .38, 72)]
        if bar % 2:
            bass = [(.0, root, .7, 83), (1.75, root+12, .28, 58), (2.5, root, .62, 72)]
        if breath:
            bass = [(0, root, 1.1, 64), (2.5, root+7, .6, 55)]
        if tail:
            bass = [(0, root, 2.3, 75)]
        s.phrase('Synth bass pulse', bar, bass, section=section)
        s.phrase('Cello floor', bar, [(0, root+12, 3.55, 48 if not breath else 38)], section=section)
        if bar in themes:
            s.phrase('Ensemble theme', bar, themes[bar], section=section)
        # Quiet accompaniment in the main statement; the motif remains the foreground.
        ost = [.5, 1.25, 2.75] if bar % 2 == 0 else [.25, 1.5, 3.25]
        if bar in (0, 1, 10, 11, 12):
            ost = [0, .75, 1.5, 2.5, 3.25]
        if breath:
            ost = [.5, 2.5]
        if tail:
            ost = [0]
        s.phrase('Pizzicato motor', bar, [(t, voices[[0,2,1,3,1][i % 5]], .34,
            59 if i % 2 == 0 else 42) for i,t in enumerate(ost)], section=section)
        if bar in (1, 5, 8, 9, 11):
            s.phrase('Electric piano', bar, [(1.5, voices[2]+12, .7, 53), (2.25, voices[1]+12, .8, 50),
                (3.25, voices[0]+12, .6, 44)], section='Piano answer')
        if bar in (5, 7, 11, 13):
            s.phrase('Viola response', bar, [(2, voices[1], 1.15, 54), (3.25, voices[2], .62, 49)], section='Inner-voice reply')
        if bar in (7, 9, 13):
            s.phrase('Muted brass answer', bar, [(.5, voices[2]+12, .9, 63), (1.5, voices[1]+12, 1.2, 57)], section='Brass counterphrase')
        if bar in (1, 9, 14):
            s.phrase('Harp turn', bar, [(3+i*.22, n+12, .65, 39+i*3) for i,n in enumerate(voices)], section='Pickup')
        if bar in (1, 9, 13):
            s.phrase('Dark glass', bar, [(2.75, voices[1]+24, 1.0, 45)], section='Single distant accent')
        if bar in (0, 4, 8, 10, 14):
            s.phrase('Air pad', bar, [(0, n, 7.75 if bar < 14 else 7.1, 39) for n in voices[1:]], bars=2, section='Harmonic air')
        kick = [0, 1.5, 2.75] if bar % 2 == 0 else [0, .75, 2.5]
        snare = [(1, 38, .12, 74), (3, 38, .12, 80)]
        hats = [.5, 1.5, 2.5, 3.5]
        if bar in (3, 5, 11):
            snare.append((2.75, 38, .12, 28))
        if breath:
            kick, snare, hats = [0], [(2.5, 37, .15, 49)], [1, 3]
        if bar == 0:
            snare, hats = [], [1, 3]
        if bar == 14:
            kick, hats = [0, 2.5], [.5, 1.5]
            snare += [(3.25, 38, .13, 43), (3.75, 38, .13, 58)]
        if tail:
            kick, snare, hats = [0], [], []
        s.phrase('Kick', bar, [(t, 36, .15, 83 if i == 0 else 66) for i,t in enumerate(kick)], section=section)
        s.phrase('Snare and ghosts', bar, snare, section=section)
        s.phrase('Hats', bar, [(t, 42, .1, 46 if i % 2 == 0 else 31) for i,t in enumerate(hats)], section=section)
        if bar in (7, 9, 14):
            s.phrase('Low percussion', bar, [(3.0, 43, .2, 53), (3.5, 48, .22, 47)], section='Sparse fill')
    events = []
    for label, track in s.tracks.items():
        for pattern in track.findall('pattern'):
            for note in pattern.findall('note'):
                events.append({'track': label, 'start_beats': (int(pattern.get('pos'))+int(note.get('pos')))/48,
                    'midi': int(note.get('key'))+12, 'length_beats': int(note.get('len'))/48,
                    'velocity': int(note.get('vol'))})
    dump('score.json', {'bpm': BPM, 'bars':16, 'progression':progression, 'groups':GROUPS, 'events':events})
    project = s.save()
    tree = ET.parse(project)
    for track in tree.findall('.//track'):
        for pattern in list(track.findall('pattern')):
            if int(pattern.get('pos')) >= 3072:
                track.remove(pattern)
    tree.find('.//timelinestate').set('lp1pos', '3072')
    tree.find('.//projectnotes').text = 'Original shadowtide v2; 16 bars. Native stems and mastering in compose.py. No reference samples.'
    tree.write(project, encoding='utf-8', xml_declaration=True)
    return project

def render_stem(group, project):
    tree = ET.parse(project)
    container = tree.find('.//trackcontainer')
    for track in list(container.findall('track')):
        if track.get('name') not in GROUPS[group]:
            container.remove(track)
    stem_project, wav = OUT/(group+'.mmp'), OUT/(group+'-native.wav')
    tree.write(stem_project, encoding='utf-8', xml_declaration=True)
    config = OUT/(group+'-lmms.xml')
    config.write_text('<lmms version="1.2.2"><mixer audiodev="Dummy"/><paths plugins="plugins/" laddir="plugins/ladspa/"/></lmms>', encoding='utf-8')
    startup = subprocess.STARTUPINFO()
    startup.dwFlags |= subprocess.STARTF_USESHOWWINDOW
    startup.wShowWindow = 0
    with (OUT/(group+'-render.log')).open('wb') as log:
        subprocess.run([str(DAW.LMMS/'lmms.exe'), '-c', str(config), 'render',
            os.path.relpath(stem_project, DAW.LMMS), '-o', os.path.relpath(wav, DAW.LMMS),
            '-s', str(SR), '-a', '-i', 'sincbest', '-x', '2'], cwd=DAW.LMMS,
            startupinfo=startup, stdout=log, stderr=subprocess.STDOUT, check=True, timeout=300)
    x, sr = sf.read(wav, dtype='float32', always_2d=True)
    if sr != SR or len(x) < 30*SR or np.max(np.abs(x)) < 1e-6 or not np.isfinite(x).all():
        raise RuntimeError('Invalid native stem: '+group)
    print('Native stem complete: '+group, flush=True)
    return x[:30*SR].astype(np.float64)

def delay(x, milliseconds):
    shift = round(milliseconds*SR/1000)
    return np.concatenate([np.zeros(shift),x[:-shift]])

def master(project, stems):
    low = sosfilt(butter(2, 28, 'highpass', fs=SR, output='sos'), stems['low'], axis=0)
    low = sosfilt(butter(2, 2200, 'lowpass', fs=SR, output='sos'), low, axis=0)
    low = np.repeat(low.mean(axis=1)[:,None],2,axis=1)*.65
    beat = sosfilt(butter(2, 180, 'highpass', fs=SR, output='sos'), stems['beat'], axis=0)
    theme = sosfilt(butter(2, [190, 3300], 'bandpass', fs=SR, output='sos'), stems['theme'], axis=0)*1.1
    detail = sosfilt(butter(2, [220, 4500], 'bandpass', fs=SR, output='sos'), stems['detail'], axis=0)
    # Local stereo early reflections are fed by orchestral/detail buses only.
    room = sosfilt(butter(2, [400, 2400], 'bandpass', fs=SR, output='sos'),
        (theme+detail).mean(axis=1))
    left = sum(g*delay(room,d) for d,g in [(19,.24),(43,.14),(79,.09),(127,.05)])
    right = sum(g*delay(room,d) for d,g in [(31,.24),(59,.14),(97,.09),(149,.05)])
    x = low + beat + theme + detail + np.column_stack([left,right])
    # Preserve phase-safe mono bass; widen independent upper voices gently.
    mid = x.mean(axis=1)
    side = sosfilt(butter(4, 160, 'highpass', fs=SR, output='sos'), (x[:,0]-x[:,1])/2)*2
    x = np.column_stack([mid+side,mid-side])
    x -= x.mean(axis=0)
    x[:480] *= np.linspace(0,1,480)[:,None]
    x[-19200:] *= np.cos(np.linspace(0,np.pi/2,19200))[:,None]**2
    wav, mp3 = OUT/(NAME+'.wav'), OUT/(NAME+'.mp3')
    sf.write(wav,x,SR,subtype='PCM_24')
    before = BASE.measure(wav)
    gain = min(-19.5-before['input_i'],-2-before['input_tp'])
    x *= 10**(gain/20)
    sf.write(wav,x,SR,subtype='PCM_24')
    subprocess.run(['ffmpeg','-v','error','-y','-i',str(wav),'-c:a','libmp3lame','-b:a','256k',
        '-metadata','title=Shadowtide v2',str(mp3)],check=True)
    subprocess.run(['ffmpeg','-v','error','-i',str(mp3),'-f','null','-'],check=True)
    final = BASE.measure(mp3)
    checks = {'exact_30s':len(x)==SR*30,'finite':bool(np.isfinite(x).all()),'no_clipping':bool(np.max(np.abs(x))<1),
        'true_peak_below_minus_1':final['input_tp']<=-1,'target_lufs':-22<=final['input_i']<=-18,
        'all_native_stems_non_silent':all(np.max(np.abs(v))>1e-6 for v in stems.values())}
    files=[project,wav,mp3,DAW.FONT]+[OUT/(g+'-native.wav') for g in GROUPS]
    dump('render-report.json', {'bpm':BPM,'seconds':30,'engine':'LMMS 1.2.2 / FluidSynth, four native stems, 48kHz sinc-best 2x',
        'master_gain_db':gain,'mp3_measurement':final,'checks':checks,
        'stem_rms_dbfs':{g:float(20*np.log10(np.sqrt(np.mean(v*v)))) for g,v in stems.items()},
        'files':[{'path':p.relative_to(ROOT).as_posix(),'bytes':p.stat().st_size,
            'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in files],
        'reference_samples_used':False,'listening':'Pending user audition; comparison uses audio measurements and editable score, not human listening.'})
    if not all(checks.values()):
        raise RuntimeError('Production check failure: '+str(checks))
    print(json.dumps({'complete':True,**final}),flush=True)

if __name__ == '__main__':
    if '--remaster' in sys.argv:
        project=OUT/(NAME+'.mmp')
        stems={g:sf.read(OUT/(g+'-native.wav'),dtype='float32',always_2d=True)[0][:SR*30].astype(np.float64) for g in GROUPS}
    else:
        project=score()
        with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
            futures={g:pool.submit(render_stem,g,project) for g in GROUPS}
            stems={g:f.result() for g,f in futures.items()}
    master(project,stems)
