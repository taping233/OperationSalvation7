"""Rearrange the shipped title cue while retaining its melody and frozen foundation."""
import copy
import hashlib
import importlib.util
import json
import pathlib
import subprocess
import sys

import numpy as np
import soundfile as sf

OUT = pathlib.Path(__file__).resolve().parent
ROOT = OUT.parents[2]
OLD = OUT.parent / '2026-10-05-WF-music-piano-two-hands'
SOURCE = OUT.parent / '2026-10-13-WF-title-music-rework'
TMP = ROOT / '.tmp/music-workstation/title-v12-1013'
TMP.mkdir(parents=True, exist_ok=True)
spec = importlib.util.spec_from_file_location('previous_title_render', OLD / 'render.py')
previous = importlib.util.module_from_spec(spec)
spec.loader.exec_module(previous)
previous.OUT = OUT
previous.TMP = TMP
previous.base.OUT = OUT
previous.base.TMP = TMP
previous.base.shared.OUT = OUT
previous.base.shared.TMP = TMP
sys.stdout.reconfigure(encoding='utf-8')


def save(name, value):
    (OUT / name).write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')


def rearrange(score):
    score = copy.deepcopy(score)
    score['stem'] = '01-title-frostglass-v12'
    score['title'] = '霜窗回声 · 织体轮替修订'
    strings = score['tracks']['Continuous strings']
    cello = score['tracks']['Cello bridge']
    assert len(strings['notes']) == 12 and len(cello['notes']) == 16
    # A1 stays as the cue's anchor. Later repeats move through the chord tones
    # instead of holding the same 8/16-beat notes throughout the whole cue.
    strings['notes'] = [n for n in strings['notes'] if n['beat'] < 32]
    cello['notes'] = [n for n in cello['notes'] if n['beat'] < 32]
    def add(track, beat, pitch, length, velocity):
        track['notes'].append({'beat': beat, 'midi': pitch,
                               'length': length, 'velocity': velocity})
    for base, root, upper in [(32, 60, 63), (40, 56, 60), (48, 53, 56), (56, 55, 59)]:
        add(strings, base, root, 5.95, 42)
        add(strings, base + 6, upper, 1.95, 38)
    for base, root, answer in [(32, 48, 55), (40, 44, 51), (48, 41, 48), (56, 43, 50)]:
        add(cello, base, root, 4.0, 43)
        add(cello, base + 4, answer, 3.92, 40)
    for base, pitch in [(64, 60), (72, 56), (80, 53), (88, 55)]:
        add(strings, base, pitch, 7.95, 39)
    for base, pitch in [(64, 48), (72, 44), (80, 41), (88, 43)]:
        add(cello, base, pitch, 7.92, 40)
    for base, root, upper in [(96, 60, 63), (104, 56, 60), (112, 53, 56), (120, 55, 59)]:
        add(strings, base, root, 3.92, 43)
        add(strings, base + 4, upper, 3.92, 40)
    for base, root, answer in [(96, 48, 55), (104, 44, 51), (112, 41, 48), (120, 43, 50)]:
        add(cello, base, root, 5.0, 43)
        add(cello, base + 5, answer, 2.92, 40)
    strings['target_active_rms_dbfs'] = -32
    strings['gain_points'] = [[0, 1], [32, 1], [36, .82], [64, .76],
                              [96, .82], [112, 1], [128, 1]]
    cello['target_active_rms_dbfs'] = -33
    cello['gain_points'] = [[0, 1], [32, 1], [64, 1], [80, .8],
                            [96, 1], [128, 1]]
    clarinet = score['tracks']['Clarinet inner answer']
    clarinet['notes'] = [n for n in clarinet['notes']
                         if any(start <= n['beat'] < start + 8 for start in (32, 48, 96, 112))]
    viola = score['tracks']['Viola gentle reply']
    viola['target_active_rms_dbfs'] = -32
    viola['notes'] = [n for n in viola['notes'] if n['beat'] < 32]
    for base, phrase in [(40, (51, 56, 60)), (56, (50, 55, 59)),
                         (104, (51, 56, 60)), (120, (50, 55, 59))]:
        for offset, pitch in zip((1, 3.5, 6), phrase):
            add(viola, base + offset, pitch, 1.95, 39)
    score['arrangement_change'] = {
        'preserved': 'V11 piano hands, harp and clarinet score; original 52-note right-hand theme.',
        'second_statement': 'Clarinet and viola alternate two-bar answers; strings and cello move through chord tones.',
        'middle': 'Harp remains sparse while strings and cello hold an even carrier.',
        'return': 'Strings and cello each move to an upper chord tone before the next root.',
    }
    return score


def render():
    old_score = json.loads((SOURCE / 'score.json').read_text(encoding='utf-8'))
    old_report = json.loads((SOURCE / 'render-report.json').read_text(encoding='utf-8'))
    score = rearrange(old_score)
    old_rows = {row['name']: row for row in old_report['tracks']}
    samples = round(score['bars'] * 4 * 60 / score['bpm'] * 48000)
    mix = np.zeros((samples, 2), dtype=np.float64)
    rows = []
    for name, track in score['tracks'].items():
        if name in ('Continuous strings', 'Cello bridge', 'Clarinet inner answer', 'Viola gentle reply'):
            print('rendering', name, flush=True)
            audio, row = previous.base.synth(score, name, track)
        else:
            row = copy.deepcopy(old_rows[name])
            source = ROOT / row['frozen_stem']['path']
            assert previous.base.shared.fp(source) == row['frozen_stem'], name
            audio, sr = sf.read(source, dtype='float32', always_2d=True)
            assert sr == 48000 and len(audio) == samples
            row['reused_unchanged'] = True
        if name == 'Piano right hand':
            # During the answer phrases the unchanged theme yields foreground
            # space to the moving string and wind lines, then returns.
            beat = np.arange(samples) / 48000 * score['bpm'] / 60
            attenuation = np.interp(beat, [0, 31, 35, 60, 66, 92, 97, 128],
                                    [1, 1, .72, .72, .67, .67, 1, 1])
            audio = audio * attenuation[:, None]
            row['reused_unchanged'] = False
            row['arrangement_gain'] = 'A2: 0.72; B: 0.67; smooth phrase ramps'
        if name == 'Continuous strings':
            beat = np.arange(samples) / 48000 * score['bpm'] / 60
            attenuation = np.interp(beat, [0, 30, 34, 60, 66, 92, 97, 128],
                                    [1, 1, .56, .56, .56, .56, 1, 1])
            audio *= attenuation[:, None]
            row['arrangement_gain'] = 'A2/B: 0.56; smooth phrase ramps'
        if name == 'Harp glimmer':
            beat = np.arange(samples) / 48000 * score['bpm'] / 60
            lift = np.interp(beat, [0, 64, 68, 92, 96, 128],
                             [1, 1, 1.45, 1.45, 1, 1])
            audio *= lift[:, None]
            row['reused_unchanged'] = False
            row['arrangement_gain'] = 'B: 1.45, four-beat entry/exit ramps'
        mix += audio
        rows.append(row)
    mix = previous.base.shared.room(mix, 48000)
    mix, balance = previous.base.macro_balance(mix, 48000)
    beat = np.arange(samples) / 48000 * score['bpm'] / 60
    # Phrase-scale dynamics are deliberate and smoothly interpolated, not
    # per-beat random velocity. The soft B leaves room for the final return.
    phrase_gain = np.interp(beat, [0, 16, 32, 48, 64, 80, 96, 112, 128],
                            [.86, .96, .92, 1.08, .8, .66, .88, 1.12, .9])
    mix *= phrase_gain[:, None]
    # Widen only the existing stereo difference above the bass range. FFT
    # shaping is periodic, so it does not introduce a filter reset at the loop.
    mid = (mix[:, 0] + mix[:, 1]) * .5
    side = (mix[:, 0] - mix[:, 1]) * .5
    spectrum = np.fft.rfft(side)
    frequencies = np.fft.rfftfreq(samples, 1 / 48000)
    x = np.clip((frequencies - 120) / 230, 0, 1)
    side = np.fft.irfft(spectrum * (1 + .7 * (x * x * (3 - 2 * x))), n=samples)
    mix[:, 0], mix[:, 1] = mid + side, mid - side
    premaster = TMP / (score['stem'] + '-premaster.wav')
    sf.write(premaster, mix, 48000, subtype='FLOAT')
    loud = previous.base.shared.loud(premaster)
    gain = min(10 ** ((-18.5 - float(loud['input_i'])) / 20), .9 / np.abs(mix).max())
    mix *= gain
    mix[-192:] -= (mix[-1] - mix[0]) * (.5 - .5 * np.cos(np.linspace(0, np.pi, 192)))[:, None]
    wav = OUT / (score['stem'] + '.wav')
    sf.write(wav, mix, 48000, subtype='PCM_24')
    mp3, ogg = wav.with_suffix('.mp3'), wav.with_suffix('.ogg')
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', str(wav), '-c:a', 'libmp3lame', '-b:a', '256k', str(mp3)], check=True)
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', str(wav), '-c:a', 'libopus', '-b:a', '76k', str(ogg)], check=True)
    save('score.json', score)
    result = {'source_score_sha256': hashlib.sha256((SOURCE / 'score.json').read_bytes()).hexdigest(),
              'stem': score['stem'], 'seconds': samples / 48000, 'tracks': rows,
              'slow_balance': balance, 'phrase_gain_points': [0.86, 0.96, 0.92, 1.08, 0.8, 0.66, 0.88, 1.12, 0.9],
              'side_gain_above_350hz': 1.7, 'loudness': previous.base.shared.loud(wav),
              'files': [previous.base.shared.fp(path) for path in (wav, mp3, ogg)],
              'human_listening': 'not claimed'}
    save('render-report.json', result)
    print(json.dumps({'lufs': result['loudness']['input_i'], 'files': result['files']}, ensure_ascii=False), flush=True)


if __name__ == '__main__':
    render()
