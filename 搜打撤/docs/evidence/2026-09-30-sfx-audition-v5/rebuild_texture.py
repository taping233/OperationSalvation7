"""New noise sources shaped by broad reference-band statistics, not audio samples."""
from pathlib import Path
import json
import subprocess
import numpy as np
import soundfile as sf
from scipy import signal

OUT = Path(__file__).resolve().parent
REF = OUT.parent / '2026-09-30-arknights-sfx-reference'
SR = 48000
RNG = np.random.default_rng(9301905)
EDGES = np.array([45, 65, 90, 125, 180, 260, 380, 560, 820, 1200, 1800, 2800, 4500, 7000, 10500])


def profile(name):
    x, fs = sf.read(str(REF / name), always_2d=True)
    x = np.mean(x, axis=1)
    f, psd = signal.welch(x, fs, nperseg=min(len(x), 8192))
    weights = np.array([np.sum(psd[(f >= lo) & (f < hi)]) for lo, hi in zip(EDGES[:-1], EDGES[1:])])
    weights /= np.sum(weights)
    return weights


def band(t, lo, hi):
    sos = signal.butter(2, [lo, hi], fs=SR, btype='bandpass', output='sos')
    x = signal.sosfilt(sos, RNG.normal(size=len(t)))
    return x / max(np.std(x), 1e-12)


def texture(t, weights, stretch=1, rough=.12):
    x = np.zeros_like(t)
    for index, (lo, hi, power) in enumerate(zip(EDGES[:-1], EDGES[1:], weights)):
        x += band(t, lo * stretch, hi * stretch) * np.sqrt(power) * (
            1 + rough * np.sin(2 * np.pi * (8.3 + index * 2.71) * t + index * .71))
    return x


def pulse(t, at, attack, release):
    u = np.maximum(t - at, 0)
    return (t >= at) * (1 - np.exp(-u / attack)) * np.exp(-u / release)


def bump(t, at, duration, strength=1):
    u = (t - at) / duration
    return np.sin(np.pi * np.clip(u, 0, 1)) ** 2 * strength


def delay_room(x, seconds, strength):
    stereo = np.column_stack([x, x])
    for channel, times in enumerate([(.019, .043, .071, .109), (.023, .052, .081, .117)]):
        for index, at in enumerate(times):
            d = int(at * SR)
            filtered = signal.sosfilt(signal.butter(2, 2900 / (1 + index * .4), fs=SR, output='sos'), x)
            stereo[d:, channel] += filtered[:-d] * strength / (index + 1) * (-1 if index == 1 else 1)
    # Broad diffuse texture generated from scratch, with limited stereo width.
    return stereo


def master(x, target_db):
    x = signal.sosfilt(signal.butter(2, 48, fs=SR, btype='highpass', output='sos'), x, axis=0)
    x = np.tanh(x * 1.1)
    x *= 10 ** (target_db / 20) / max(np.max(np.abs(x)), 1e-12)
    lead, tail = int(.001 * SR), int(.08 * SR)
    x[:lead] *= np.linspace(0, 1, lead)[:, None]
    x[-tail:] *= np.cos(np.linspace(0, np.pi / 2, tail))[:, None] ** 2
    return x


def event():
    t = np.arange(int(1.52 * SR)) / SR
    original = profile('b_ui_whoosh.wav')
    # Temper the bass, raise the quiet middle texture and shift its entire register.
    w = original ** .65
    w *= np.array([.22, .45, .85, 1.05, 1.2, 1.45, 1.5, 1.1, .7, .55, .4, .28, .15, .08])
    w /= w.sum()
    foundation = texture(t, w, 1.19, .18)
    inner = texture(t, w, 1.43, .09)
    # New phrasing: compact inhale, two staggered pulses, softer release.
    shape = bump(t, .012, .29, .26) + pulse(t, .205, .025, .12) * .54
    shape += pulse(t, .39, .055, .16) * .40
    grain = band(t, 350, 1850) * bump(t, .12, .36, .034)
    x = foundation * shape * .15 + inner * pulse(t, .34, .065, .11) * .026 + grain
    return master(delay_room(x, .16, .14), -6.5), original, w


def impact():
    t = np.arange(int(.64 * SR)) / SR
    original = profile('b_ui_mark.wav')
    w = original ** .62
    w *= np.array([.10, .28, .75, 1.15, 1.4, 1.75, 1.7, 1.35, .85, .6, .4, .25, .15, .08])
    w /= w.sum()
    weight = texture(t, w, 1.36, .10)
    crunch = band(t, 580, 3300)
    # Dense synthetic body and a fast return, not a realistic recorded collision.
    body_env = pulse(t, .018, .0035, .029) + pulse(t, .063, .004, .025) * .27
    body = weight * body_env * .21
    detail = crunch * pulse(t, .015, .0009, .0055) * .036
    sweep_phase = 2 * np.pi * (206 * t - 82 * .055 * (1 - np.exp(-t / .055)))
    anchor = np.sin(sweep_phase) * pulse(t, .018, .003, .034) * .027
    x = body + detail + anchor
    return master(delay_room(x, .12, .09), -5.5), original, w


def main():
    records, sounds = [], []
    for name, label, reference, make in [
        ('01-event-enter', '进入事件', 'b_ui_whoosh.wav', event),
        ('02-attack-impact', '攻击命中', 'b_ui_mark.wav', impact),
    ]:
        x, original_profile, new_profile = make()
        sf.write(str(OUT / (name + '.wav')), x, SR, subtype='PCM_24')
        actual, fs = sf.read(str(OUT / (name + '.wav')), always_2d=True)
        true_peak = np.max(np.abs(signal.resample_poly(actual, 4, 1, axis=0)))
        assert fs == SR and actual.shape[1] == 2 and np.isfinite(actual).all()
        assert true_peak < .9 and np.max(np.abs(actual[-720:])) < .001 and abs(np.mean(actual)) < .001
        records.append(dict(file=name+'.wav', label=label, seconds=round(len(x)/SR, 3),
                            reference_statistic_source=reference,
                            edges_hz=EDGES.tolist(), source_broad_band_energy=original_profile.tolist(),
                            redesigned_band_energy=new_profile.tolist(), peak_dbfs=round(float(20*np.log10(np.max(abs(actual)))), 2),
                            true_peak_dbfs=round(float(20*np.log10(true_peak)),2),
                            rms_dbfs=round(float(20*np.log10(np.sqrt(np.mean(actual**2)))),2)))
        sounds.append(actual)
        subprocess.run(['ffmpeg','-v','error','-y','-i',str(OUT/(name+'.wav')),
                        '-codec:a','libmp3lame','-q:a','2',str(OUT/(name+'.mp3'))],check=True,capture_output=True)
    pieces = [np.zeros((24000,2))]
    for x in sounds:
        for _ in range(3):
            pieces.extend([x, np.zeros((24000,2))])
        pieces.append(np.zeros((36000,2)))
    montage = np.concatenate(pieces).astype('<f4')
    path = OUT / '00-two-new-samples.mp3'
    subprocess.run(['ffmpeg','-v','error','-y','-f','f32le','-ar',str(SR),'-ac','2','-i','-',
                    '-codec:a','libmp3lame','-q:a','2',str(path)],input=montage.tobytes(),check=True,capture_output=True)
    for file in OUT.glob('*.mp3'):
        subprocess.run(['ffmpeg','-v','error','-i',str(file),'-f','null','-'],check=True,capture_output=True)
    report=dict(method='New independent noise sources, abstract broad-band statistics, new envelopes and frequency register',
                files=records, montage_seconds=round(len(montage)/SR,3))
    (OUT/'checks.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps(dict(files=[{k:r[k] for k in ['file','seconds','true_peak_dbfs','rms_dbfs']} for r in records],
                         montage_seconds=report['montage_seconds']),ensure_ascii=False))


if __name__ == '__main__':
    main()
