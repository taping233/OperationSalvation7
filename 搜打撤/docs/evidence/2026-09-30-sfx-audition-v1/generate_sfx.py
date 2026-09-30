"""Original winter expedition SFX: deterministic synthesis, no external samples."""
from pathlib import Path
import hashlib
import json
import numpy as np
import soundfile as sf
from scipy import signal

SR = 48000
OUT = Path(__file__).resolve().parent
RNG = np.random.default_rng(9301714)


def timeline(seconds):
    return np.arange(round(seconds * SR)) / SR


def envelope(t, start=0, attack=.001, decay=.08):
    u = np.maximum(0, t - start)
    return (t >= start) * (1 - np.exp(-u / attack)) * np.exp(-u / decay)


def window(t, start, duration, power=1):
    u = (t - start) / duration
    return np.where((u > 0) & (u < 1), np.sin(np.pi * np.clip(u, 0, 1)) ** power, 0)


def noise(t, low=100, high=7000):
    n = RNG.normal(0, 1, len(t))
    sos = signal.butter(3, [low, high], btype='bandpass', fs=SR, output='sos')
    n = signal.sosfilt(sos, n)
    return n / max(1e-9, np.std(n))


def sine(t, frequency, start=0, phase=0):
    return np.sin(2 * np.pi * frequency * np.maximum(t - start, 0) + phase)


def sweep(t, start, f0, f1, seconds):
    u = np.maximum(t - start, 0)
    k = np.log(f1 / f0) / seconds
    return np.sin(2 * np.pi * f0 * np.expm1(np.minimum(u, seconds) * k) / k
                  + 2 * np.pi * f1 * np.maximum(u - seconds, 0)) * (t >= start)


def modes(t, start, frequencies, decays, weights):
    return sum(w * sine(t, f, start) * envelope(t, start, .0007, d)
               for f, d, w in zip(frequencies, decays, weights))


def stereo(center, width=None, amount=.1):
    if width is None:
        width = np.zeros_like(center)
    return np.column_stack([center + width * amount, center - width * amount])


def room(x, seconds=.18, wet=.1, size=1):
    # Procedural diffuse impulse; reflected highs darken with path length.
    ir_n = int(seconds * SR)
    ir = np.zeros((ir_n, 2))
    for channel in range(2):
        for delay, gain in [(.012, .31), (.023, .22), (.041, .16), (.067, .1)]:
            i = int((delay * size + channel * .0017) * SR)
            if i < ir_n:
                ir[i, channel] += gain * (-1 if channel and i % 3 else 1)
        ir_t = np.arange(ir_n) / SR
        diffuse = RNG.normal(0, 1, ir_n) * np.exp(-ir_t / (seconds / 5))
        diffuse[:int(.025 * size * SR)] = 0
        diffuse = signal.sosfilt(signal.butter(2, 4200, fs=SR, output='sos'), diffuse)
        ir[:, channel] += diffuse * .025
        ir[:, channel] /= max(1, np.linalg.norm(ir[:, channel]))
    reflected = np.column_stack([signal.fftconvolve(x[:, c], ir[:, c])[:len(x)] for c in range(2)])
    return x + wet * reflected


def finish(x, peak_db):
    x = signal.sosfilt(signal.butter(2, 35, btype='highpass', fs=SR, output='sos'), x, axis=0)
    x = signal.sosfilt(signal.butter(2, 14500, fs=SR, output='sos'), x, axis=0)
    # Gentle saturation followed by consistent peak ceiling; no hard clipping.
    scale = max(np.max(np.abs(x)), 1e-9)
    x = np.tanh(x / scale * 1.05)
    x *= 10 ** (peak_db / 20) / max(np.max(np.abs(x)), 1e-9)
    fade_in, fade_out = int(.0005 * SR), int(.035 * SR)
    x[:fade_in] *= np.sin(np.linspace(0, np.pi / 2, fade_in))[:, None] ** 2
    x[-fade_out:] *= np.cos(np.linspace(0, np.pi / 2, fade_out))[:, None] ** 2
    return x


def click():
    t = timeline(.25)
    contact = noise(t, 1600, 7600) * envelope(t, .007, .00035, .004) * .11
    body = modes(t, .009, [810, 1740, 2860], [.019, .012, .009], [.11, .05, .017])
    latch = noise(t, 700, 4000) * envelope(t, .029, .0004, .005) * .035
    return finish(room(stereo(contact + body + latch), .08, .04), -9)


def card_play():
    t = timeline(.58)
    paper = noise(t, 900, 7600) * window(t, .012, .14, 1.7) * .035
    flutter = sum(noise(t, 1600, 6200) * envelope(t, s, .001, .012) * a
                  for s, a in [(.025, .014), (.063, .023), (.102, .017)])
    snap = noise(t, 2100, 9500) * envelope(t, .146, .0003, .006) * .09
    landing = modes(t, .149, [162, 370, 840], [.032, .023, .014], [.16, .06, .018])
    trailing = noise(t, 600, 3000) * envelope(t, .168, .003, .035) * .012
    x = stereo(paper + flutter + snap + landing + trailing, paper, .17)
    return finish(room(x, .17, .075), -6.5)


def impact():
    t = timeline(.86)
    air = noise(t, 650, 4900) * window(t, .008, .075, 2.1) * .022
    strike = .072
    low = sweep(t, strike, 177, 54, .13) * envelope(t, strike, .0013, .052) * .33
    body = modes(t, strike, [108, 241, 580], [.09, .043, .028], [.19, .07, .028])
    crack = noise(t, 1050, 10500) * envelope(t, strike, .00035, .007) * .18
    grit = noise(t, 100, 1700) * envelope(t, strike + .005, .003, .049) * .10
    ring = modes(t, strike + .003, [932, 1567, 2429], [.09, .055, .033], [.028, .013, .005])
    x = stereo(air + low + body + crack + grit + ring, ring + air, .19)
    return finish(room(x, .37, .10, 1.2), -3.5)


def event_enter():
    t = timeline(2.05)
    airy = noise(t, 1300, 5900) * window(t, .02, .63, 1.7) * .018
    soft = noise(t, 180, 1600) * window(t, .04, .70, 2) * .018
    draw_in = sweep(t, .035, 330, 760, .46) * window(t, .035, .50, 2.2) * .012
    reveal = .47
    glass = modes(t, reveal, [523.25, 783.99, 1174.66, 1760], [.27, .21, .15, .08], [.039, .025, .012, .004])
    core = sum(sine(t, f, reveal) * envelope(t, reveal, .04, .29) * a
               for f, a in [(146.83, .021), (220, .019), (349.23, .011)])
    sparkle = noise(t, 4200, 11000) * envelope(t, reveal, .004, .095) * .006
    side = sine(t, 526.1, reveal) * envelope(t, reveal, .07, .36) * .009 + airy * .35
    x = stereo(airy + soft + draw_in + glass + core + sparkle, side, .48)
    return finish(room(x, 1.35, .20, 2), -6)


def boss_reveal():
    t = timeline(3.05)
    buildup = noise(t, 110, 900) * window(t, .02, .64, 2.3) * .05
    strained = sweep(t, .035, 270, 510, .5) * window(t, .035, .53, 2) * .018
    start = .53
    sub = sweep(t, start, 112, 43, .25) * envelope(t, start, .002, .18) * .25
    slam = noise(t, 100, 3600) * envelope(t, start, .0007, .028) * .19
    metal = modes(t, start, [137, 311, 683, 1290], [.26, .17, .12, .07], [.085, .048, .03, .01])
    falling = sweep(t, start + .04, 680, 187, .67) * envelope(t, start + .04, .035, .25) * .027
    # Low brass-like harmonics and subtly detuned resonators; original synthetic texture.
    growl = sum(sine(t, 73.416 * k, start) / k ** 1.45 for k in range(1, 9))
    growl *= envelope(t, start, .05, .35) * .085
    omen = sum(sine(t, f, start) * envelope(t, start, .11, .49) * a
               for f, a in [(110, .035), (155.56, .017), (233.08, .013)])
    fragments = noise(t, 1800, 6500) * envelope(t, start + .085, .025, .19) * .014
    side = (sine(t, 156.6, start) + sine(t, 235.2, start)) * envelope(t, start, .09, .42) * .018
    x = stereo(buildup + strained + sub + slam + metal + falling + growl + omen + fragments, side, .38)
    return finish(room(x, 1.9, .26, 2.7), -3.5)


SOUNDS = [
    ('01-ui-click', '按钮点击', click, '冷金属锁扣与短共鸣，轻而清楚。'),
    ('02-card-play', '出牌', card_play, '纸张滑动、轻微翻动、落桌瞬态与实体低频。'),
    ('03-attack-impact', '攻击命中', impact, '攻击前气流、硬质瞬态、低频力度、金属余振。'),
    ('04-event-enter', '进入事件', event_enter, '冰冷气流吸入、玻璃共鸣揭示、克制空间尾音。'),
    ('05-boss-reveal', '首脑登场', boss_reveal, '蓄势、低频冲击、受压金属与不稳定共鸣尾音。'),
]


def main():
    report, rendered = [], []
    for name, label, render, description in SOUNDS:
        x = render()
        path = OUT / (name + '.wav')
        sf.write(str(path), x, SR, subtype='PCM_24')
        actual, sr = sf.read(str(path), always_2d=True)
        true_peak = np.max(np.abs(signal.resample_poly(actual, 4, 1, axis=0)))
        tail = np.max(np.abs(actual[-int(.015 * SR):]))
        peak = np.max(np.abs(actual))
        rms = np.sqrt(np.mean(actual ** 2))
        assert sr == SR and actual.shape[1] == 2 and np.isfinite(actual).all()
        assert 0 < peak < .9 and true_peak < .95 and tail < .001
        assert abs(np.mean(actual)) < .001
        report.append(dict(file=path.name, label=label, description=description,
                           duration_s=round(len(actual) / SR, 3), channels=2, sample_rate=SR,
                           format='WAV PCM_24', peak_dbfs=round(20 * np.log10(peak), 2),
                           true_peak_dbfs_4x=round(20 * np.log10(true_peak), 2),
                           rms_dbfs=round(20 * np.log10(rms), 2), tail_peak_dbfs=round(20 * np.log10(max(tail, 1e-12)), 2),
                           dc_offset=float(np.mean(actual)), sha256=hashlib.sha256(path.read_bytes()).hexdigest()))
        rendered.append(actual)
    # A/B-like audition: each short sound three times; long transitions twice, with silence.
    pieces = [np.zeros((int(.45 * SR), 2))]
    markers = []
    cursor = .45
    for index, x in enumerate(rendered):
        repeats = 3 if index < 3 else 2
        markers.append(dict(label=SOUNDS[index][1], start_s=round(cursor, 3), repeats=repeats))
        for repetition in range(repeats):
            pieces.extend([x, np.zeros((int(.38 * SR), 2))])
            cursor += len(x) / SR + .38
        pieces.append(np.zeros((int(.85 * SR), 2)))
        cursor += .85
    montage = np.concatenate(pieces)
    sf.write(str(OUT / '00-audition-five.wav'), montage, SR, subtype='PCM_24')
    (OUT / 'audio-checks.json').write_text(json.dumps(dict(source='Deterministic procedural synthesis; no imported audio samples', sounds=report, montage_markers=markers,
                                                           montage_duration_s=round(len(montage) / SR, 3)), ensure_ascii=False, indent=2), encoding='utf-8')
    print(json.dumps(dict(sounds=report, montage_markers=markers, montage_duration_s=round(len(montage) / SR, 3)), ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
