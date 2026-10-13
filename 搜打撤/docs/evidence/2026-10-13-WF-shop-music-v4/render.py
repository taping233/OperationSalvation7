"""Render the shop cue exclusively from licensed recordings of instruments."""
import hashlib
import json
from pathlib import Path
import subprocess

import numpy as np
from scipy import signal
import soundfile as sf

from score import BPM, BARS, build

OUT = Path(__file__).absolute().parent
ROOT = OUT.parents[2]
PIANO = ROOT / '.tmp/music-workstation/salamander-mini'
VSCO = ROOT / '.tmp/music-workstation/vsco-ce/50'
SR = 48000
N = round(BARS * 4 * 60 / BPM * SR)
RNG = np.random.default_rng(20261013)

SOURCES = {
    'piano': [(45, 'A2'), (48, 'C3'), (51, 'D#3'), (54, 'F#3'),
              (57, 'A3'), (60, 'C4'), (63, 'D#4'), (66, 'F#4'),
              (69, 'A4'), (72, 'C5')],
    'oboe': [(58, 'KHOboe_stac_Bb3_ff2.wav'),
                 (62, 'KHOboe_stac_D4_ff2.wav'),
                 (68, 'KHOboe_vib_Ab4_ff1.wav'),
                 (74, 'KHOboe_vib_D5_ff1.wav'),
                 (80, 'KHOboe_vib_Ab5_ff1.wav')],
    'strings': [(57, 'LLVln_ArcoVib_A3_mf.wav'),
                (69, 'LLVln_ArcoVib_A4_mf.wav'),
                (81, 'LLVln_ArcoVib_A5_mf.wav')],
    'bass': [(34, 'PSBassoon_A#1_v2_2.wav')],
    'bell': [(84, 'glock_medium_C6_01.wav')],
}
PANS = {'piano-right': -.22, 'piano-left': -.17, 'oboe': .27,
        'strings': .43, 'bass': .04, 'bell': -.42, 'percussion': .12}
LEVELS = {'piano-right': .61, 'piano-left': .23, 'oboe': .29,
          'strings': .15, 'bass': .29, 'bell': .1, 'percussion': .075}
CACHE = {}


def source_for(part, key):
    instrument = 'piano' if part.startswith('piano') else part
    source_key, name = min(SOURCES[instrument], key=lambda item: abs(item[0] - key))
    if instrument == 'piano':
        return PIANO / f'{name}v6.flac', PIANO / f'{name}v11.flac', source_key
    return VSCO / name, None, source_key


def variant(part, key, velocity):
    main, bright, source_key = source_for(part, key)
    path = bright if bright and velocity >= 55 else main
    cache_key = (str(path), key)
    if cache_key in CACHE:
        return CACHE[cache_key]
    x, fs = sf.read(str(path), dtype='float32', always_2d=True)
    ratio = 2 ** ((key - source_key) / 12)
    size = round(len(x) * SR / (fs * ratio))
    # The recording carries its actual hammer, bow or breath attack. Resampling
    # only transposes nearby sampled notes; no oscillator synthesizes a tone.
    x = signal.resample(x, size, axis=0).astype('float32')
    x -= np.mean(x[:min(240, len(x))], axis=0)
    x /= max(float(np.max(np.abs(x))), .08)
    CACHE[cache_key] = x
    return x


def add_circular(buffer, wave, position):
    start = round(position * SR) % N
    if len(wave) >= N:
        wave = wave[:N]
    first = min(len(wave), N - start)
    buffer[start:start+first] += wave[:first]
    if first < len(wave):
        buffer[:len(wave)-first] += wave[first:]


def note_audio(event):
    part, key, length, velocity = (event[k] for k in ('part', 'key', 'length', 'velocity'))
    x = variant(part, key, velocity)
    seconds = length * 60 / BPM
    # Keep acoustic decay while giving bowed/wind notes a soft note-off.
    tail = .65 if part.startswith('piano') else (.4 if part == 'bass' else .24)
    take = min(len(x), round((seconds + tail) * SR))
    x = x[:take].copy()
    if len(x) < 32:
        return x
    attack = min(round((.009 if part.startswith('piano') else .025) * SR), len(x)//4)
    x[:attack] *= np.linspace(0, 1, attack)[:, None]
    release_at = min(round(seconds * SR), len(x)-1)
    if release_at < len(x):
        x[release_at:] *= np.linspace(1, 0, len(x)-release_at)[:, None] ** 1.4
    if part == 'bell':
        x *= .6
    return x * (velocity / 64) ** 1.4


def render():
    score = build()
    stems = {part: np.zeros((N, 2), dtype='float32') for part in LEVELS}
    sample_files = set()
    for event in score['events']:
        part = event['part']
        wave = note_audio(event)
        main, bright, _ = source_for(part, event['key'])
        sample_files.add(bright if bright and event['velocity'] >= 55 else main)
        # Repeatable performance offsets: the accompaniment follows the lead,
        # rather than every player striking one mathematically identical grid.
        offset = RNG.normal(0, .007 if part.startswith('piano') else .012)
        position = event['beat'] * 60 / BPM + offset
        pan = PANS[part]
        wave *= np.array([np.sqrt((1-pan)/2), np.sqrt((1+pan)/2)], dtype='float32')
        add_circular(stems[part], wave, position)
    snare = VSCO / 'snare3_f_1.wav'
    sn, fs = sf.read(str(snare), dtype='float32', always_2d=True)
    sn = signal.resample(sn, round(len(sn)*SR/fs), axis=0).astype('float32')
    sn /= max(float(np.max(np.abs(sn))), .08)
    sample_files.add(snare)
    for bar in range(BARS):
        for off, amount in ((1.9, .55), (3.9, .78)):
            if bar % 4 == 3 and off == 1.9:
                continue
            add_circular(stems['percussion'], sn * amount,
                         (bar * 4 + off) * 60 / BPM + RNG.normal(0, .01))
    for part, stem in stems.items():
        stem *= LEVELS[part]
    mix = sum(stems.values())
    # Shared, quiet, circular early reflections preserve tails over the loop.
    room = signal.sosfilt(signal.butter(2, 4600, fs=SR, output='sos'), mix, axis=0)
    for delay, gain in ((.031, .055), (.077, .045), (.137, .032), (.223, .018)):
        mix += np.roll(room[:, ::-1], round(delay*SR), axis=0) * gain
    mix = signal.sosfilt(signal.butter(2, 34, btype='highpass', fs=SR,
                                      output='sos'), mix, axis=0)
    peak = float(np.max(np.abs(mix)))
    mix *= min(.78 / max(peak, 1e-8), 1.0)
    # Tiny endpoint correction only; the arrangement and reverberation remain.
    mix[-256:] -= (mix[-1] - mix[0]) * np.linspace(0, 1, 256)[:, None]
    wav = OUT / '05-shop-lamplight-deal-v4.wav'
    sf.write(str(wav), mix, SR, subtype='PCM_24')
    mp3, ogg = wav.with_suffix('.mp3'), wav.with_suffix('.ogg')
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', str(wav), '-c:a',
                    'libmp3lame', '-b:a', '256k', str(mp3)], check=True)
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', str(wav), '-c:a',
                    'libopus', '-b:a', '96k', str(ogg)], check=True)
    (OUT / 'score.json').write_text(json.dumps(score, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
    def file_info(path):
        return {'path': str(path.relative_to(ROOT)).replace('\\', '/'),
                'bytes': path.stat().st_size,
                'sha256': hashlib.sha256(path.read_bytes()).hexdigest()}
    report = {'seconds': N/SR, 'bpm': BPM, 'bars': BARS,
              'peak': round(float(np.max(np.abs(mix))), 5),
              'sample_jump': round(float(np.max(np.abs(mix[0]-mix[-1]))), 7),
              'sample_sources': [file_info(p) for p in sorted(sample_files)],
              'files': [file_info(p) for p in (wav, mp3, ogg)],
              'method': 'Recorded Salamander piano and VSCO 2 CE instruments; no FluidSynth, synthesized notes or sample library in game assets.'}
    (OUT / 'render-report.json').write_text(json.dumps(report, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
    print(json.dumps({'seconds': report['seconds'], 'peak': report['peak'],
                      'samples': len(sample_files), 'ogg': report['files'][-1]}, ensure_ascii=False))


if __name__ == '__main__':
    render()
