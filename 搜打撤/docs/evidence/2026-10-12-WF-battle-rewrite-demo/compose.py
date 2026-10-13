"""Original 16-bar battle demo, rendered by the installed native LMMS engine."""
import copy
import hashlib
import importlib.util
import json
import os
import pathlib
import re
import subprocess
import xml.etree.ElementTree as ET

import numpy as np
import soundfile as sf
from scipy.signal import butter, sosfilt

OUT = pathlib.Path(__file__).resolve().parent
ROOT = OUT.parents[2]
SPEC = importlib.util.spec_from_file_location('existing_lmms', ROOT / 'docs/evidence/2026-10-05-WF-music-daw/compose-lmms.py')
DAW = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(DAW)
DAW.OUT, DAW.BARS = OUT, 16
DAW.RNG = np.random.default_rng(20261012)
SR, BPM, SECONDS = 48000, 128, 30
NAME = 'battle-shadowtide-30s'
TITLE = '影潮交锋'

def write_json(name, value):
    (OUT / name).write_text(json.dumps(value, ensure_ascii=False, indent=2), encoding='utf-8')

def measure(path):
    result = subprocess.run(['ffmpeg', '-hide_banner', '-nostats', '-i', str(path), '-af',
        'loudnorm=I=-19:TP=-1.5:LRA=11:print_format=json', '-f', 'null', '-'], capture_output=True, check=True)
    matches = re.findall(r'\{\s*"input_i".*?\}', result.stderr.decode(errors='replace'), re.S)
    if not matches:
        raise RuntimeError('Missing loudness measurement')
    return {k: float(v) for k, v in json.loads(matches[-1]).items() if k.startswith('input_')}

def make_score():
    s = DAW.Score(NAME, BPM, 'battle', TITLE)
    instruments = [
        ('Pizzicato engine', 45, 48, -18, 0, .06),
        ('Violin motif', 40, 61, 12, 0, .13),
        ('Viola reply', 41, 43, -22, 0, .10),
        ('Cello tension', 42, 38, 15, 0, .10),
        ('Tine piano', 4, 38, -12, 0, .12),
        ('Muted brass answer', 59, 30, 22, 0, .09),
        ('Harp transition', 46, 33, -28, 0, .12),
        ('Synth bass pulse', 38, 40, 0, 0, 0),
        ('Dark glass', 8, 25, 30, 0, .15),
        ('Air pad', 89, 17, 0, 0, .07),
        ('Electronic broken beat', 25, 39, 0, 128, .015),
        ('Low percussion', 116, 23, 0, 0, .035),
    ]
    for args in instruments:
        s.instrument(*args)
    # Close inner voices and stable bass preserve harmonic clarity through changes.
    chords = {
        'Dm': (38, [57, 62, 65, 69]),
        'Bb': (34, [58, 62, 65, 69]),
        'Gm': (31, [58, 62, 67, 69]),
        'A7': (33, [55, 61, 64, 70]),
    }
    progression = ['Dm', 'Dm', 'Bb', 'Bb', 'Gm', 'Gm', 'A7', 'A7',
                   'Dm', 'Bb', 'Dm', 'Bb', 'Gm', 'A7', 'A7', 'Dm']
    sections = ['Entrance']*2 + ['Statement']*4 + ['Continuation']*2 + ['Breathing']*2 + ['Return']*4 + ['Cadence']*2
    # Newly written two-bar theme and answers. No reference audio/MIDI is loaded.
    melodies = {
        2: [(0, 74, .65, 78), (.75, 77, .43, 70), (1.5, 76, .40, 66), (2.25, 81, .92, 81), (3.5, 79, .35, 69)],
        3: [(.25, 77, .72, 75), (1.25, 74, .64, 71), (2.25, 72, .42, 62), (3, 74, .81, 77)],
        4: [(0, 74, .65, 78), (.75, 77, .43, 72), (1.5, 79, .40, 69), (2.25, 82, .92, 80), (3.5, 81, .35, 68)],
        5: [(.25, 79, .70, 76), (1.25, 77, .65, 68), (2.25, 74, .42, 63), (3, 76, .80, 73)],
        6: [(0, 76, .42, 76), (.75, 73, .43, 70), (1.5, 76, .43, 73), (2.25, 79, .43, 79), (3, 77, .65, 69)],
        7: [(0, 76, .40, 75), (.75, 73, .40, 70), (1.5, 70, .40, 65), (2.25, 69, 1.25, 68)],
        10: [(0, 74, .65, 83), (.75, 77, .43, 76), (1.5, 76, .40, 71), (2.25, 81, .92, 85), (3.5, 79, .35, 73)],
        11: [(.25, 77, .70, 80), (1.25, 74, .62, 73), (2.25, 72, .40, 68), (3, 74, .80, 80)],
        12: [(0, 79, .64, 82), (.75, 82, .43, 78), (1.5, 81, .40, 72), (2.25, 86, .88, 85), (3.5, 84, .35, 72)],
        13: [(0, 85, .42, 81), (.75, 82, .42, 74), (1.5, 81, .64, 76), (2.5, 79, .43, 70), (3.25, 76, .55, 74)],
        14: [(0, 77, .64, 74), (.75, 76, .65, 72), (1.5, 73, .66, 69), (2.5, 69, .9, 65)],
        15: [(0, 74, 3.2, 72)],
    }
    for bar, chord in enumerate(progression):
        root, voices = chords[chord]
        section = sections[bar]
        quiet = bar in (8, 9)
        tail = bar == 15
        # 3+3+2 accent groupings inside 4/4, with a different second-bar answer.
        ost = [0, .5, 1.25, 1.75, 2.5, 3, 3.5]
        if quiet:
            ost = [0, 1.5, 3]
        if tail:
            ost = [0]
        order = [0, 2, 1, 3, 0, 2, 1]
        s.phrase('Pizzicato engine', bar, [(t, voices[order[i]] + (12 if bar >= 10 else 0),
            .24 if not quiet else .45, (72 if i in (0, 2, 4) else 49) - (12 if quiet else 0))
            for i, t in enumerate(ost)], section=section)
        bass_times = [.0, .75, 1.5, 2.75, 3.5] if bar % 2 == 0 else [.0, 1.25, 2.5, 3.25]
        if quiet:
            bass_times = [0, 2.5]
        if tail:
            bass_times = [0]
        s.phrase('Synth bass pulse', bar, [(t, root + (12 if t == 3.5 else 0),
            .37 if not quiet else .85, 81 if i == 0 else 60) for i, t in enumerate(bass_times)], section=section)
        s.phrase('Cello tension', bar, [(0, root + 12, 1.6, 58), (2.1, root + 19, 1.5, 45)]
            if not tail else [(0, 50, 3.1, 53)], section=section)
        if bar in melodies:
            s.phrase('Violin motif', bar, melodies[bar], section=section)
        if bar in (1, 3, 5, 9, 11, 13):
            s.phrase('Viola reply', bar, [(2, voices[1], .65, 58), (2.75, voices[2], .55, 63),
                (3.5, voices[1], .4, 52)], section='Contrary-register response')
        if bar in (0, 1, 8, 9, 14, 15):
            s.phrase('Tine piano', bar, [(t, n, 1.1, 57 if t == 0 else 43)
                for t, n in zip([0, .75, 1.75, 2.5], voices)], section=section)
        if bar in (5, 7, 11, 13):
            s.phrase('Muted brass answer', bar, [(2.25, voices[2] + 12, .55, 56),
                (3, voices[1] + 12, .7, 49)], section='Short offbeat brass reply')
        if bar in (1, 7, 9, 13):
            s.phrase('Harp transition', bar, [(2.75 + i*.18, n + 12, .6, 47 + i*3)
                for i, n in enumerate(voices)], section='Harmonic pickup')
        if bar in (1, 5, 9, 11):
            s.phrase('Dark glass', bar, [(1.75, voices[2]+24, .8, 51), (3.25, voices[1]+24, .7, 44)], section='Distant point accents')
        if bar in (0, 4, 8, 10, 14):
            s.phrase('Air pad', bar, [(0, n, 7.7 if bar < 14 else 7.1, 45) for n in voices[1:]],
                bars=2, section='Quiet harmonic air')
        # Broken beat: straight backbeat anchors, syncopated kicks and low ghost snares.
        kicks = [0, 1.75, 2.5] if bar % 2 == 0 else [0, .75, 2.25, 3.5]
        snares = [1, 3]
        hats = list(np.arange(0, 4, .5))
        if bar == 0:
            snares, hats = [], [0, 1, 2, 3]
        if quiet:
            kicks, snares, hats = [0, 2.75], [2], [0, 1.5, 3]
        if tail:
            kicks, snares, hats = [0], [], [0]
        drums = [(t, 36, .12, 85 if i == 0 else 67) for i, t in enumerate(kicks)]
        drums += [(t, 38, .12, 77 if not quiet else 49) for t in snares]
        drums += [(float(t), 42, .09, 48 if t % 1 == 0 else 30) for t in hats]
        if bar in (3, 5, 11, 13):
            drums += [(2.75, 38, .09, 27), (3.75, 42, .09, 30)]
        if bar in (2, 10):
            drums += [(0, 49, .35, 36)]
        if bar in (7, 9, 14):
            drums += [(3.25, 45, .15, 45), (3.5, 47, .15, 52), (3.75, 38, .13, 61)]
        s.phrase('Electronic broken beat', bar, drums, section=section)
        if bar in (1, 3, 5, 7, 11, 13, 14):
            s.phrase('Low percussion', bar, [(2.5, 43, .22, 51), (3.5, 48, .20, 43)], section='Sparse transition weight')
    events = []
    for label, track in s.tracks.items():
        for pattern in track.findall('pattern'):
            for note in pattern.findall('note'):
                events.append({'track': label, 'start_beats': (int(pattern.get('pos')) + int(note.get('pos'))) / 48,
                    'midi': int(note.get('key')) + 12, 'length_beats': int(note.get('len')) / 48,
                    'velocity': int(note.get('vol')), 'section': pattern.get('name')})
    write_json('score.json', {'title': TITLE, 'bpm': BPM, 'bars': 16, 'seconds': SECONDS,
        'progression': progression, 'sections': sections, 'tracks': s.stats, 'events': events})
    project = s.save()
    # Deliver one editable 16-bar take, not the legacy helper's duplicated loop.
    tree = ET.parse(project)
    for track in tree.findall('.//track'):
        for pattern in list(track.findall('pattern')):
            if int(pattern.get('pos')) >= 16*192:
                track.remove(pattern)
    tree.find('.//timelinestate').set('lp1pos', str(16*192))
    tree.find('.//projectnotes').text = TITLE + '; original 16-bar demo. Reference recordings are not imported.'
    tree.write(project, encoding='utf-8', xml_declaration=True)
    return project

def render(project):
    lmms = DAW.LMMS
    # Minimal project-local config; shared workstation/global preferences remain read-only.
    config = OUT / 'lmms-local.xml'
    config.write_text('<lmms version="1.2.2"><mixer audiodev="Dummy"/><paths plugins="plugins/" laddir="plugins/ladspa/" factorysamples="data/samples/" factorypresets="data/presets/"/></lmms>', encoding='utf-8')
    raw = OUT / (NAME + '-native.wav')
    args = [str(lmms/'lmms.exe'), '-c', str(config), 'render', os.path.relpath(project, lmms),
        '-o', os.path.relpath(raw, lmms), '-s', str(SR), '-a', '-i', 'sincbest', '-x', '2']
    startup = subprocess.STARTUPINFO()
    startup.dwFlags |= subprocess.STARTF_USESHOWWINDOW
    startup.wShowWindow = 0
    with (OUT/'native-render.log').open('wb') as log:
        process = subprocess.Popen(args, cwd=lmms, stdout=log, stderr=subprocess.STDOUT, startupinfo=startup)
        write_json('render-process.json', {'pid': process.pid, 'cwd': str(lmms), 'command': args})
        print('Native LMMS rendering, PID ' + str(process.pid), flush=True)
        if process.wait(timeout=300) != 0:
            raise RuntimeError('LMMS render failed; see native-render.log')
    x, sr = sf.read(raw, dtype='float32', always_2d=True)
    if sr != SR or len(x) < SECONDS*SR or not np.isfinite(x).all() or np.max(np.abs(x)) < .001:
        raise RuntimeError('Invalid/silent/short native render')
    x = x[:SECONDS*SR].copy()
    x = sosfilt(butter(2, 28, 'highpass', fs=SR, output='sos'), x, axis=0)
    # Preserve stereo above 140 Hz while centring the low band.
    mid = x.mean(axis=1)
    side = sosfilt(butter(4, 140, 'highpass', fs=SR, output='sos'), (x[:, 0]-x[:, 1])/2)
    x = np.column_stack([mid+side, mid-side])
    x -= x.mean(axis=0)
    x[:480] *= np.linspace(0, 1, 480)[:, None]
    x[-16800:] *= np.cos(np.linspace(0, np.pi/2, 16800))[:, None]**2
    wav = OUT/(NAME+'.wav')
    sf.write(wav, x, SR, subtype='PCM_24')
    before = measure(wav)
    gain_db = min(-19.5-before['input_i'], -2-before['input_tp'])
    x *= 10**(gain_db/20)
    sf.write(wav, x, SR, subtype='PCM_24')
    mp3 = OUT/(NAME+'.mp3')
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', str(wav), '-c:a', 'libmp3lame',
        '-b:a', '256k', '-metadata', 'title='+TITLE, str(mp3)], check=True)
    subprocess.run(['ffmpeg', '-v', 'error', '-i', str(mp3), '-f', 'null', '-'], check=True)
    final = measure(mp3)
    windows = [float(np.sqrt(np.mean(x[i:i+SR//2]**2))) for i in range(SR//2, len(x)-SR, SR//2)]
    checks = {'exact_30s_wav': len(x) == 30*SR, 'finite_pcm': bool(np.isfinite(x).all()),
        'no_pcm_clipping': bool(np.max(np.abs(x)) < 1), 'mp3_true_peak_below_minus_1': final['input_tp'] <= -1,
        'lufs_internal_target': -22 <= final['input_i'] <= -18,
        'no_unplanned_internal_silence': all(v > 10**(-45/20) for v in windows),
        'native_process_exited': process.poll() == 0}
    report = {'native_engine': 'LMMS 1.2.2 / sf2player / FluidSynth', 'bpm': BPM, 'bars': 16,
        'seconds_pcm': len(x)/SR, 'gain_db': gain_db, 'mp3_measurement': final, 'checks': checks,
        'section_rms_dbfs': [float(20*np.log10(np.sqrt(np.mean(x[a*SR:b*SR]**2))+1e-12))
            for a, b in [(0, 4), (4, 11), (11, 15), (15, 19), (19, 26), (26, 29)]],
        'files': [{'path': p.relative_to(ROOT).as_posix(), 'bytes': p.stat().st_size, 'sha256': hashlib.sha256(p.read_bytes()).hexdigest()}
            for p in [project, wav, mp3, raw, DAW.FONT]],
        'reference_recordings_used_as_samples': False, 'aesthetic_acceptance': 'Pending user listening'}
    write_json('render-report.json', report)
    if not all(checks.values()):
        raise RuntimeError('Production check failed: ' + str(checks))
    print(json.dumps({'complete': True, 'seconds': 30, 'lufs': final['input_i'],
        'true_peak': final['input_tp'], 'lra': final['input_lra']}, ensure_ascii=True), flush=True)

if __name__ == '__main__':
    render(make_score())
