"""Extend the approved shop motif into a 60-second, small-ensemble loop.

The game reference is measured for arrangement only; no reference samples or
notes are used in this score.
"""
import hashlib
import importlib.util
import json
import pathlib
import re
import subprocess

import numpy as np
import soundfile as sf
from scipy.signal import butter, sosfilt

OUT = pathlib.Path(__file__).resolve().parent
ROOT = OUT.parents[2]
BASE = OUT.parent / '2026-10-09-WF-shop-remake'
TMP = ROOT / '.tmp/music-workstation/shop-v2-1013'
TMP.mkdir(parents=True, exist_ok=True)
SR, BPM, BARS = 48000, 96, 24
BEAT = 60 / BPM
N = round(BARS * 4 * BEAT * SR)
RNG = np.random.default_rng(20261013)
spec = importlib.util.spec_from_file_location('fluid',
    OUT.parent / '2026-10-05-WF-music-title-v6/fluid_engine.py')
fluid = importlib.util.module_from_spec(spec)
spec.loader.exec_module(fluid)
TRACKS = ('piano-hook', 'muted-horn', 'jazz-guitar', 'upright-bass', 'vibraphone')
events = []


def note(track, beat, key, length, velocity):
    assert track in TRACKS and 0 <= beat < BARS * 4 and 0 < length <= 4
    assert beat + length <= BARS * 4 + .01
    events.append({'track': track, 'beat': round(float(beat), 4), 'key': int(key),
                   'length': float(length), 'velocity': int(velocity)})


def retain_first_half():
    old = json.loads((BASE / 'score.json').read_text(encoding='utf-8'))
    for item in old['events']:
        track, beat = item['track'], item['beat']
        bar = int(beat // 4)
        # The original middle has guitar, piano comp and horn all speaking.
        # Let the horn own bars 4–7, with only one short piano support per pair.
        if track == 'piano-hook' and 4 <= bar < 8:
            if not (bar in (4, 6) and beat - bar * 4 < 1):
                continue
        if track == 'jazz-guitar':
            if beat - bar * 4 > 2:
                continue
            if 4 <= bar < 8 and bar % 2 == 1:
                continue
            if beat >= 46:  # old 30-second terminal chord was written for fade
                continue
        if track == 'upright-bass' and beat == 46.05:
            continue  # old resolved terminal note; bar 12 supplies the root
        if track == 'upright-bass' and 4 <= bar < 8 and int(beat - bar * 4) % 2:
            continue
        note(track, beat, item['key'], item['length'], item['velocity'])
    return old['chords']


def extend_second_half():
    # An independent return, reduction and loop pickup over the cue's own
    # Cm / Ab / Fm / G colour. Bass and guitar do not duplicate the lead rhythm.
    chords = [
        ('Cm6/9', 36, (51, 57, 62)), ('Abmaj9', 32, (55, 58, 60)),
        ('Fm9', 29, (51, 55, 60)), ('G7b9', 31, (53, 59, 62)),
        ('Ebmaj9', 39, (50, 55, 58)), ('Bb13', 34, (50, 56, 60)),
        ('Fm9', 29, (51, 55, 60)), ('G7alt', 31, (53, 59, 63)),
        ('Cm6/9', 36, (51, 57, 62)), ('Abmaj9', 32, (55, 58, 60)),
        ('Dm7b5/G', 31, (53, 56, 60)), ('G7b9', 31, (53, 59, 62)),
    ]
    for index, (_, root, voicing) in enumerate(chords):
        bar = index + 12
        beat = bar * 4
        next_root = chords[(index + 1) % len(chords)][1] if bar != 23 else 36
        if 16 <= bar < 20:  # quieter horn-led middle: broad bass, one guitar reply
            for off, pitch, length, velocity in [(0, root, 1.8, 63),
                                                 (2, root + 7, 1.7, 49)]:
                note('upright-bass', beat + off, pitch, length, velocity)
        else:
            bass = [root, root + 7, root + 12,
                    next_root + (-1 if root > next_root else 1)]
            for off, pitch, velocity in zip((0, 1, 2, 3), bass, (64, 48, 55, 43)):
                note('upright-bass', beat + off, pitch, .8, velocity)
        guitar_offsets = () if 16 <= bar < 20 and bar % 2 else (.62,)
        for off in guitar_offsets:
            for i, pitch in enumerate(voicing):
                note('jazz-guitar', beat + off + i * .018, pitch, .58, 36 + i)

    # Two related but non-identical piano statements (bars 12–15 and 20–23).
    piano = {
        12: [(0.15, 67, .45, 68), (1.05, 70, .63, 64), (2.65, 62, .4, 57)],
        13: [(0.3, 67, .56, 64), (1.5, 63, .48, 57), (2.5, 60, .95, 61)],
        14: [(0.2, 68, .46, 65), (1.2, 65, .67, 60), (2.7, 63, .56, 55)],
        15: [(0.2, 62, .54, 62), (1.3, 59, .52, 57), (2.65, 60, .78, 59)],
        20: [(0.15, 67, .4, 71), (0.63, 69, .25, 52), (1.15, 70, .64, 67),
             (2.68, 62, .38, 58), (3.2, 63, .5, 61)],
        21: [(0.28, 70, .52, 65), (1.65, 67, .36, 55), (2.25, 63, .92, 62)],
        22: [(0.2, 65, .54, 65), (1.2, 62, .55, 56), (2.68, 60, .5, 59)],
        23: [(0.2, 59, .54, 62), (1.18, 62, .51, 55), (2.65, 59, .52, 59),
             (3.55, 62, .34, 55)],
    }
    for bar, phrase in piano.items():
        for off, pitch, length, velocity in phrase:
            note('piano-hook', bar * 4 + off, pitch, length, velocity)
    # Horn owns bars 16–19. Piano responds only in the gaps, in low register.
    horn = {
        16: [(0.25, 67, .78, 55), (1.7, 65, .58, 49), (2.85, 63, .82, 52)],
        17: [(0.28, 62, .65, 54), (1.65, 60, .62, 48), (2.85, 58, .83, 51)],
        18: [(0.25, 65, .92, 55), (1.85, 63, .55, 48), (2.9, 60, .78, 52)],
        19: [(0.25, 63, .69, 54), (1.72, 62, .57, 48), (2.78, 59, .93, 53)],
        21: [(3.25, 60, .48, 42)],
    }
    for bar, phrase in horn.items():
        for off, pitch, length, velocity in phrase:
            note('muted-horn', bar * 4 + off, pitch, length, velocity)
    for bar, pitches in {16: (55, 60), 18: (53, 58)}.items():
        for index, pitch in enumerate(pitches):
            note('piano-hook', bar * 4 + .23 + index * .03, pitch, .7, 33)
    for beat, pitch in [(50.65, 79), (62.7, 75), (78.65, 80), (90.7, 74)]:
        note('vibraphone', beat, pitch, 1.1, 30)
    return [name for name, _, _ in chords]


def lowpass(x, hz):
    return sosfilt(butter(2, hz, fs=SR, output='sos'), x, axis=0)


def circular_room(x):
    dry = lowpass(x, 4400)
    y = x.copy()
    for seconds, gain in ((.027, .11), (.061, .09), (.111, .07), (.203, .045), (.337, .03)):
        y += np.roll(dry[:, ::-1], round(seconds * SR), axis=0) * gain
    return y


def render_stem(track, patch, target_db, pan):
    one = []
    for item in events:
        if item['track'] != track:
            continue
        start = round(item['beat'] * BEAT * SR)
        stop = round((item['beat'] + item['length']) * BEAT * SR)
        one.extend(((start, 2, 'on', item['key'], item['velocity']),
                    (stop, 1, 'off', item['key'], 0)))
    both = one + [(frame + N, priority, kind, key, value)
                  for frame, priority, kind, key, value in one]
    x = fluid.render(both, 2 * N / SR, patch=patch)[N:]
    x = lowpass(x, 6400 if track == 'piano-hook' else 5200)
    if track != 'upright-bass':
        x = circular_room(x)
    x *= np.array([np.sqrt(1 - pan), np.sqrt(1 + pan)])[None, :]
    active = np.max(np.abs(x), axis=1) > .0001
    level = np.sqrt(np.mean(x[active] ** 2)) if active.any() else 1
    x *= 10 ** (target_db / 20) / max(level, 1e-9)
    return x


def percussion():
    brush = np.zeros((N, 2))
    rim = np.zeros((N, 2))
    def hit(buffer, wave, beat, level, pan):
        start = round(beat * BEAT * SR)
        if start >= N:
            return
        length = min(len(wave), N - start)
        buffer[start:start + length] += wave[:length, None] * np.array(
            [np.sqrt((1 - pan) / 2), np.sqrt((1 + pan) / 2)])[None, :] * level
    t = np.arange(round(.43 * SR)) / SR
    noise = RNG.normal(0, .45, len(t))
    brush_wave = sosfilt(butter(2, (1800, 8500), btype='bandpass', fs=SR, output='sos'), noise)
    brush_wave *= (np.sin(np.pi * np.minimum(t / .43, 1)) ** 1.4) * np.exp(-t * 4)
    rt = np.arange(round(.1 * SR)) / SR
    rim_wave = (np.sin(2 * np.pi * 1270 * rt) + .35 * np.sin(2 * np.pi * 1830 * rt)) * np.exp(-rt * 75)
    for bar in range(BARS):
        for off in ((0,) if 16 <= bar < 20 else (0, 2)):
            hit(brush, brush_wave, bar * 4 + off, .064, .25)
        for off in (3,):
            hit(rim, rim_wave, bar * 4 + off, .022, -.3)
    return brush, rim


def loudness(path):
    result = subprocess.run(['ffmpeg', '-hide_banner', '-i', str(path),
        '-af', 'loudnorm=I=-18:TP=-1:LRA=7:print_format=json', '-f', 'null', '-'],
        capture_output=True, check=True)
    matches = re.findall(r'\{\s*"input_i".*?\}', result.stderr.decode('utf-8', errors='replace'), re.S)
    return json.loads(matches[-1])


def fingerprint(path):
    return {'path': path.relative_to(ROOT).as_posix(), 'bytes': path.stat().st_size,
            'sha256': hashlib.sha256(path.read_bytes()).hexdigest()}


def main():
    first = retain_first_half()
    second = extend_second_half()
    settings = {
        'piano-hook': (0, -23.5, -.55), 'muted-horn': (59, -26, .58),
        'jazz-guitar': (26, -32, -.66), 'upright-bass': (32, -27, 0),
        'vibraphone': (11, -36, .65),
    }
    stems = {}
    for track, (patch, level, pan) in settings.items():
        print('rendering', track, flush=True)
        stems[track] = render_stem(track, patch, level, pan)
    stems['brushes'], stems['rim'] = percussion()
    mix = sum(stems.values())
    mix = sosfilt(butter(2, 28, btype='highpass', fs=SR, output='sos'), mix, axis=0)
    mix = np.tanh(mix * 1.04) / 1.04
    # Keep bass centred while allowing independent mid/high ensemble parts to
    # occupy their assigned sides. Smooth FFT shelf is periodic at loop edge.
    mid = (mix[:, 0] + mix[:, 1]) * .5
    side = (mix[:, 0] - mix[:, 1]) * .5
    bins = np.fft.rfftfreq(N, 1 / SR)
    ramp = np.clip((bins - 120) / 230, 0, 1)
    side = np.fft.irfft(np.fft.rfft(side) * (1 + .55 * ramp * ramp * (3 - 2 * ramp)), n=N)
    mix[:, 0], mix[:, 1] = mid + side, mid - side
    premaster = TMP / 'shop-v2-premaster.wav'
    sf.write(premaster, mix, SR, subtype='FLOAT')
    measurement = loudness(premaster)
    gain = min(10 ** ((-18 - float(measurement['input_i'])) / 20), .83 / np.max(np.abs(mix)))
    mix *= gain
    # Preserve the cadence/reverb across the repeat, correcting only a tiny
    # residual sample discontinuity. No 30-second fade or inserted silence.
    mix[-192:] -= (mix[-1] - mix[0]) * (.5 - .5 * np.cos(np.linspace(0, np.pi, 192)))[:, None]
    wav = OUT / '05-shop-lamplight-deal-v2.wav'
    sf.write(wav, mix, SR, subtype='PCM_24')
    mp3, ogg = wav.with_suffix('.mp3'), wav.with_suffix('.ogg')
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', str(wav), '-c:a', 'libmp3lame', '-b:a', '256k', str(mp3)], check=True)
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', str(wav), '-c:a', 'libopus', '-b:a', '88k', str(ogg)], check=True)
    (OUT / 'score.json').write_text(json.dumps({'title': '灯下交易 V2', 'bpm': BPM,
        'meter': '4/4', 'bars': BARS, 'chords': first + second,
        'sections': ['0–10s piano hook', '10–20s horn takes lead', '20–30s varied hook',
                     '30–40s piano develops', '40–50s horn and sparse rhythm',
                     '50–60s return and G7 pickup into Cm'],
        'events': sorted(events, key=lambda item: (item['beat'], item['track'])),
        'reference': 'Local Cannot the Trader recording used for arrangement analysis only; no samples or notes imported.'},
        ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    report = {'seconds': N / SR, 'bpm': BPM, 'bars': BARS,
              'source_score': fingerprint(BASE / 'score.json'),
              'loudness_wav': loudness(wav), 'tracks': list(stems),
              'files': [fingerprint(path) for path in (wav, mp3, ogg)],
              'method': 'Two continuous FluidSynth cycles; use second cycle. Circular room delays. No fade.'}
    (OUT / 'render-report.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(json.dumps({'seconds': report['seconds'], 'loudness': report['loudness_wav']['input_i'],
                      'files': report['files']}, ensure_ascii=False), flush=True)


if __name__ == '__main__':
    main()
