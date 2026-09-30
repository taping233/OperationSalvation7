"""Original restrained tactical-electronic SFX. No sample or melody borrowing."""
from pathlib import Path
import importlib.util
import numpy as np
from scipy import signal

SOURCE = Path(__file__).resolve().parent.parent / '2026-09-30-sfx-audition-v1' / 'generate_sfx.py'
spec = importlib.util.spec_from_file_location('sfx_synthesis', SOURCE)
s = importlib.util.module_from_spec(spec)
spec.loader.exec_module(s)
s.OUT = Path(__file__).resolve().parent
s.RNG = np.random.default_rng(9301745)


def fm(t, at, f, ratio, index, decay=.04, amp=.02, attack=.001):
    u = np.maximum(t - at, 0)
    wave = np.sin(2 * np.pi * f * u + index * np.sin(2 * np.pi * f * ratio * u) * np.exp(-u / .016))
    return wave * s.envelope(t, at, attack, decay) * amp


def darken(x, cutoff):
    return signal.sosfilt(signal.butter(2, cutoff, fs=s.SR, output='sos'), x)


def click():
    t = s.timeline(.22)
    # A compact digital acknowledgement: little note sustain, no physical lock clack.
    tick = s.noise(t, 1200, 3800) * s.envelope(t, .006, .00065, .0048) * .024
    touch = fm(t, .006, 890, 1.43, .85, .011, .026)
    settle = fm(t, .019, 610, 1.71, .45, .008, .009)
    return s.finish(s.stereo(darken(tick + touch + settle, 4600)), -11)


def card_play():
    t = s.timeline(.40)
    slide = s.noise(t, 700, 3300) * s.window(t, .006, .067, 1.9) * .007
    granular = (1 + .28 * np.sin(2 * np.pi * 128 * t))
    slide *= granular
    at = .069
    stamp = fm(t, at, 540, 1.59, 1.3, .018, .032)
    contact = s.noise(t, 850, 4200) * s.envelope(t, at, .0007, .008) * .013
    tail = fm(t, at + .014, 790, 1.41, .4, .026, .005)
    x = s.stereo(darken(slide + stamp + contact + tail, 5000), slide, .10)
    return s.finish(s.room(x, .095, .025), -9.5)


def impact():
    t = s.timeline(.59)
    pre = s.noise(t, 900, 3100) * s.window(t, .004, .038, 2.1) * .006
    at = .031
    body = s.sweep(t, at, 290, 138, .042) * s.envelope(t, at, .0012, .033) * .045
    attack = s.noise(t, 500, 3700) * s.envelope(t, at, .0006, .009) * .039
    grit = s.noise(t, 750, 2900) * s.envelope(t, at + .006, .002, .031) * .010
    edge = fm(t, at + .002, 610, 1.46, 1.55, .025, .012)
    residual = fm(t, at + .021, 424, 1.61, .42, .044, .004)
    x = s.stereo(darken(pre + body + attack + grit + edge + residual, 4600), grit + residual, .12)
    return s.finish(s.room(x, .20, .045), -8)


def event_enter():
    t = s.timeline(1.46)
    # A data/atmosphere transition rather than a melodic reward cue.
    band = s.noise(t, 240, 2200) * s.window(t, .015, .24, 1.65) * .010
    scanning = s.noise(t, 1100, 2900) * s.window(t, .04, .29, 2) * .003
    scanning *= .75 + .25 * np.sin(2 * np.pi * 33 * t)
    at = .208
    signal_touch = fm(t, at, 690, 1.37, 1.1, .035, .015, .003)
    flick = s.noise(t, 1100, 3600) * s.envelope(t, at, .001, .009) * .007
    breath = s.noise(t, 170, 1150) * s.envelope(t, at, .05, .145) * .005
    pad = (s.sine(t, 196, at) + .35 * s.sine(t, 207.7, at)) * s.envelope(t, at, .055, .155) * .006
    grain = fm(t, at + .07, 421, 1.59, .32, .125, .0035, .04)
    side = s.noise(t, 420, 1800) * s.envelope(t, at + .02, .065, .16) * .003
    x = s.stereo(darken(band + scanning + signal_touch + flick + breath + pad + grain, 3700), side, .22)
    return s.finish(s.room(x, .75, .075, 1.4), -10)


def boss_reveal():
    t = s.timeline(1.85)
    # Compact escalation: a processed challenge signal plus dark synthetic texture.
    rising = s.noise(t, 250, 1900) * s.window(t, .013, .32, 2.3) * .013
    pulses = sum(fm(t, at, f, 1.43, .8, .017, amp)
                 for at, f, amp in [(.025, 540, .009), (.115, 525, .011)])
    at = .295
    edge = s.noise(t, 650, 3100) * s.envelope(t, at, .0012, .024) * .022
    stamp = fm(t, at, 275, 1.52, 1.15, .052, .041, .0017)
    resonance = (s.sine(t, 148.5, at) + .45 * s.sine(t, 198.8, at)) * s.envelope(t, at, .025, .14) * .010
    tension = (s.sine(t, 460, at) + .65 * s.sine(t, 493.6, at)) * s.envelope(t, at, .045, .12) * .006
    texture = s.noise(t, 280, 1700) * s.envelope(t, at, .035, .14) * .005
    side = fm(t, at + .045, 402, 1.71, .43, .14, .005, .035)
    x = s.stereo(darken(rising + pulses + edge + stamp + resonance + tension + texture, 4100), side, .20)
    return s.finish(s.room(x, 1.0, .10, 1.8), -8.5)


s.SOUNDS = [
    ('01-ui-click', '按钮点击', click, '短干电子触点，紧凑、微颗粒，无铃音。'),
    ('02-card-play', '出牌', card_play, '滤波滑动与数字落点，克制的确认感。'),
    ('03-attack-impact', '攻击命中', impact, '中频冲击与短粗糙层，保留力度而压低低频重量。'),
    ('04-event-enter', '进入事件', event_enter, '短扫描、信号落点、暗色空间；无上行旋律。'),
    ('05-boss-reveal', '首脑登场', boss_reveal, '蓄势信号与暗色共鸣，紧张但不使用大片重击。'),
]

if __name__ == '__main__':
    s.main()
