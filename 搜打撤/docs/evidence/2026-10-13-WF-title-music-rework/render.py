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
TMP = ROOT / '.tmp/music-workstation/title-rework-1013'
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
    score['stem'] = '01-title-frostglass-v11'
    score['title'] = '霜窗回声 · 乐句与内声部修订'
    left = score['tracks']['Piano left hand']['notes']
    # The original repeats one six-event left-hand figure in every two-bar
    # unit. Retain A1 as the identity, then assign each section a separate
    # harmonic rhythm while keeping the same Cm / Ab / Fm / G roots.
    assert len(left) == 96
    chords = [(48, 51, 55, 60), (44, 48, 51, 56),
              (41, 44, 48, 53), (43, 47, 50, 55)]
    left = [n for n in left if n['beat'] < 32]
    def note(beat, pitch, length, velocity):
        left.append({'beat': beat, 'midi': pitch, 'length': length, 'velocity': velocity})
    for phrase in range(4):
        root, third, fifth, upper = chords[phrase]
        beat = 32 + phrase * 8
        note(beat, root, 2.55, 40)
        note(beat + 2.5, third, 1.65, 32)
        note(beat + 4, fifth, 2.35, 34)
        note(beat + 4, upper, 2.35, 31)
        note(beat + 6.5, (55, 51, 48, 50)[phrase], 1.35, 30)
    for phrase in range(4):
        root, third, fifth, upper = chords[phrase]
        beat = 64 + phrase * 8
        note(beat, root, 3.4, 37)
        note(beat + 4, third, 3.2, 31)
        note(beat + 4, upper, 3.2, 29)
    for phrase in range(4):
        root, third, fifth, upper = chords[phrase]
        beat = 96 + phrase * 8
        note(beat, root, 2.1, 39)
        note(beat + 2, third, 1.7, 34)
        note(beat + 2, (58, 55, 50, 53)[phrase], 1.7, 31)
        note(beat + 4, upper, 1.9, 36)
        note(beat + 6, fifth, 1.75, 30)
        note(beat + 6, upper, 1.75, 28)
    score['tracks']['Piano left hand']['notes'] = sorted(left, key=lambda n: (n['beat'], n['midi']))
    harp = score['tracks']['Harp glimmer']
    harp['target_active_rms_dbfs'] = -32
    harp['notes'].extend({'beat': beat, 'midi': pitch, 'length': 2.35, 'velocity': 34}
                         for beat, pitch in [(69, 67), (73, 75), (77, 68), (81, 72),
                                             (85, 65), (89, 72), (93, 74), (95, 71)])
    # A short climbing answer supports the return without doubling the tune.
    # Every note belongs to the local Cm / Ab / Fm / G harmony.
    inner = [
        (35.1, 55, 1.65), (37.1, 56, 1.65), (39.1, 60, 1.9),
        (43.1, 51, 1.65), (45.1, 55, 1.65), (47.1, 56, 1.9),
        (51.1, 48, 1.65), (53.1, 51, 1.65), (55.1, 53, 1.9),
        (59.1, 50, 1.65), (61.1, 53, 1.65), (63.1, 55, 1.9),
        (99.1, 55, 1.65), (101.1, 58, 1.65), (103.1, 60, 1.9),
        (107.1, 51, 1.65), (109.1, 55, 1.65), (111.1, 56, 1.9),
        (115.1, 48, 1.65), (117.1, 50, 1.65), (119.1, 53, 1.9),
        (123.1, 50, 1.65), (125.1, 53, 1.65), (127.1, 55, .8),
    ]
    score['tracks']['Clarinet inner answer'] = {
        'program': 71, 'bank': 0, 'pan': 38, 'target_active_rms_dbfs': -29,
        'gain_points': [[0, 0.75], [32, 0.75], [36, 1], [60, 1], [64, 0.75],
                        [96, 0.75], [100, 1], [120, 0.9], [128, 0.75]],
        'notes': [{'beat': beat, 'midi': pitch, 'length': length, 'velocity': 38}
                  for beat, pitch, length in inner],
    }
    score['arrangement_change'] = {
        'preserved': 'All right-hand melody notes and six old orchestral stems are byte-identical.',
        'second_statement': 'Left hand becomes a five-event upward reply; clarinet rises in four brief phrases.',
        'return': 'Six-event open voicings and a quieter clarinet answer distinguish the final A.',
        'middle': 'Eight sparse harp answers trace the B-section harmony without a new pulse.',
    }
    return score


def render():
    old_score = json.loads((OLD / 'title-score.json').read_text(encoding='utf-8'))
    old_report = json.loads((OLD / 'title-render-report.json').read_text(encoding='utf-8'))
    score = rearrange(old_score)
    old_rows = {row['name']: row for row in old_report['tracks']}
    samples = round(score['bars'] * 4 * 60 / score['bpm'] * 48000)
    mix = np.zeros((samples, 2), dtype=np.float64)
    rows = []
    for name, track in score['tracks'].items():
        if name in ('Piano left hand', 'Clarinet inner answer', 'Harp glimmer'):
            print('rendering', name, flush=True)
            audio, row = previous.base.synth(score, name, track)
        else:
            row = copy.deepcopy(old_rows[name])
            source = ROOT / row['frozen_stem']['path']
            assert previous.base.shared.fp(source) == row['frozen_stem'], name
            audio, sr = sf.read(source, dtype='float32', always_2d=True)
            assert sr == 48000 and len(audio) == samples
            row['reused_unchanged'] = True
        if name == 'Continuous strings':
            # The second A gains space for its moving inner answer. Ease out and
            # back over two beats so the retained string phrase never drops out.
            beat = np.arange(samples) / 48000 * score['bpm'] / 60
            attenuation = np.interp(beat, [0, 30, 34, 60, 64, 128],
                                    [1, 1, .48, .48, 1, 1])
            audio = audio * attenuation[:, None]
            row['reused_unchanged'] = False
            row['arrangement_gain'] = 'second A: 0.48, four-beat entry/exit ramps'
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
    result = {'source_score_sha256': hashlib.sha256((OLD / 'title-score.json').read_bytes()).hexdigest(),
              'stem': score['stem'], 'seconds': samples / 48000, 'tracks': rows,
              'slow_balance': balance, 'phrase_gain_points': [0.86, 0.96, 0.92, 1.08, 0.8, 0.66, 0.88, 1.12, 0.9],
              'side_gain_above_350hz': 1.7, 'loudness': previous.base.shared.loud(wav),
              'files': [previous.base.shared.fp(path) for path in (wav, mp3, ogg)],
              'human_listening': 'not claimed'}
    save('render-report.json', result)
    print(json.dumps({'lufs': result['loudness']['input_i'], 'files': result['files']}, ensure_ascii=False), flush=True)


if __name__ == '__main__':
    render()
