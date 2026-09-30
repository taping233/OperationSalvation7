"""Original winter-terminal SFX. Reference audio is never opened or sampled."""
from pathlib import Path
import importlib.util
import numpy as np
from scipy import signal

SOURCE = Path(__file__).resolve().parent.parent / '2026-09-30-sfx-audition-v1' / 'generate_sfx.py'
spec = importlib.util.spec_from_file_location('sfx_synthesis', SOURCE)
s = importlib.util.module_from_spec(spec)
spec.loader.exec_module(s)
s.OUT = Path(__file__).resolve().parent
s.RNG = np.random.default_rng(9301818)


def filter_audio(x, cutoff):
    return signal.sosfilt(signal.butter(2, cutoff, fs=s.SR, output='sos'), x)


def contact(t, start, f, decay, amplitude, metal=.3):
    u = np.maximum(t - start, 0)
    phase = 2 * np.pi * f * u + metal * np.sin(2 * np.pi * f * 1.673 * u) * np.exp(-u / .013)
    return np.sin(phase) * s.envelope(t, start, .0008, decay) * amplitude


def frost(t, start, duration, amplitude, low=1000, high=4500, grain=130):
    texture = s.noise(t, low, high)
    texture *= .8 + .2 * np.sin(2 * np.pi * grain * t)
    return texture * s.window(t, start, duration, 1.9) * amplitude


def click():
    t = s.timeline(.26)
    a = s.noise(t, 1700, 6100) * s.envelope(t, .005, .0007, .0037) * .023
    b = s.noise(t, 900, 4200) * s.envelope(t, .027, .0009, .005) * .010
    body = contact(t, .006, 714, .009, .016, .7)
    tail = contact(t, .028, 491, .015, .008, .2)
    x = filter_audio(a + b + body + tail, 6700)
    return s.finish(s.stereo(x), -9.5)


def card_play():
    t = s.timeline(.56)
    slide = frost(t, .006, .075, .009, 700, 4000, 91)
    catch = frost(t, .066, .032, .006, 1200, 4900, 220)
    at = .090
    stamp = contact(t, at, 342, .018, .032, 1.15)
    snap = s.noise(t, 1700, 6500) * s.envelope(t, at, .0006, .005) * .022
    seal = contact(t, .123, 823, .023, .007, .28)
    residual = frost(t, .12, .11, .0028, 450, 1850, 140)
    x = s.stereo(filter_audio(slide + catch + stamp + snap + seal + residual, 6200), residual, .18)
    return s.finish(s.room(x, .12, .025), -8)


def impact():
    t = s.timeline(.69)
    air = frost(t, .004, .043, .006, 1300, 5000, 190)
    at = .035
    core = s.sweep(t, at, 237, 97, .074) * s.envelope(t, at, .0015, .039) * .041
    strike = s.noise(t, 600, 5200) * s.envelope(t, at, .0005, .011) * .032
    flake = s.noise(t, 1200, 3600) * s.envelope(t, .052, .0015, .027) * .007
    edge = contact(t, .038, 592, .031, .008, 1.34)
    recoil = contact(t, .072, 313, .043, .005, .3)
    x = s.stereo(filter_audio(air + core + strike + flake + edge + recoil, 5900), flake, .19)
    return s.finish(s.room(x, .19, .04), -6.8)


def event_enter():
    t = s.timeline(1.45)
    # Distinct segmented scan, deliberately unlike the reference's single whoosh.
    scan = frost(t, .01, .13, .008, 400, 2200, 73)
    scan += frost(t, .18, .16, .011, 600, 2900, 107)
    scan += frost(t, .35, .18, .007, 300, 1900, 59)
    points = contact(t, .138, 527, .025, .008, .5) + contact(t, .33, 391, .032, .011, .7)
    at = .405
    breathe = s.noise(t, 130, 1100) * s.envelope(t, at, .025, .13) * .006
    depth = (s.sine(t, 157.7, at) + .31 * s.sine(t, 225.1, at)) * s.envelope(t, at, .033, .125) * .009
    texture = contact(t, .44, 361, .12, .003, .11)
    side = frost(t, .39, .34, .003, 750, 2600, 97)
    x = s.stereo(filter_audio(scan + points + breathe + depth + texture, 4400), side, .27)
    return s.finish(s.room(x, .65, .085, 1.6), -8.5)


def boss_reveal():
    t = s.timeline(1.93)
    # Three escalating electronic seals; no sampled alarm or cinematic explosion.
    seals = np.zeros_like(t)
    for at, f, amplitude in [(.02, 402, .019), (.17, 331, .026), (.40, 218, .038)]:
        seals += contact(t, at, f, .045 if at < .3 else .072, amplitude, .95)
        seals += s.noise(t, 400, 3100) * s.envelope(t, at, .0018, .018) * amplitude * .4
    bridge = frost(t, .045, .41, .005, 200, 1900, 63)
    at = .425
    anchor = s.sweep(t, at, 166, 103, .13) * s.envelope(t, at, .009, .085) * .014
    field = (s.sine(t, 241, at) + .41 * s.sine(t, 267.3, at)) * s.envelope(t, at, .035, .15) * .010
    haze = s.noise(t, 300, 2300) * s.envelope(t, at, .04, .15) * .0035
    side = contact(t, .48, 383, .17, .0035, .2)
    x = s.stereo(filter_audio(seals + bridge + anchor + field + haze, 4300), side, .24)
    return s.finish(s.room(x, .9, .095, 1.85), -7.5)


s.SOUNDS = [
    ('01-ui-click', '按钮点击', click, '原创双触点确认；微颗粒、短中频触感。'),
    ('02-card-play', '出牌', card_play, '原创分段滑移、短扣合和细小尾音。'),
    ('03-attack-impact', '攻击命中', impact, '原创合成弹性冲击、微碎屑、短回弹。'),
    ('04-event-enter', '进入事件', event_enter, '原创三段断续扫描、双信号触点、冷色残响。'),
    ('05-boss-reveal', '首脑登场', boss_reveal, '原创三段递进封印声与暗色场域。'),
]

if __name__ == '__main__':
    s.main()
