"""A lighter anime fantasy direction; original synthesis, without imported samples."""
from pathlib import Path
import importlib.util
import numpy as np

SOURCE = Path(__file__).resolve().parent.parent / '2026-09-30-sfx-audition-v1' / 'generate_sfx.py'
spec = importlib.util.spec_from_file_location('sfx_synthesis', SOURCE)
s = importlib.util.module_from_spec(spec)
spec.loader.exec_module(s)
s.OUT = Path(__file__).resolve().parent
s.RNG = np.random.default_rng(9301730)


def bell(t, at, f, amp, decay=.09, attack=.002):
    u = np.maximum(t - at, 0)
    # A restrained FM transient and soft upper partial; no sharp square-wave beep.
    phase = 2 * np.pi * f * u + .24 * np.sin(2 * np.pi * f * 2.01 * u) * np.exp(-u / .022)
    wave = np.sin(phase) + .12 * np.sin(2 * np.pi * f * 2 * u) * np.exp(-u / .035)
    return wave * s.envelope(t, at, attack, decay) * amp


def click():
    t = s.timeline(.20)
    elastic = s.sweep(t, .006, 1180, 810, .023) * s.envelope(t, .006, .0008, .014) * .047
    sheen = bell(t, .011, 1568, .017, .028)
    cushion = bell(t, .006, 440, .013, .014)
    air = s.noise(t, 2600, 6800) * s.envelope(t, .006, .0008, .004) * .0022
    return s.finish(s.stereo(elastic + sheen + cushion + air), -11)


def card_play():
    t = s.timeline(.46)
    flick = s.noise(t, 2000, 6900) * s.window(t, .008, .065, 2.3) * .006
    lift = s.sweep(t, .018, 570, 990, .055) * s.window(t, .018, .067, 2.1) * .012
    tap = bell(t, .075, 660, .034, .03)
    crystal = bell(t, .083, 1318.51, .013, .055) + bell(t, .099, 1760, .004, .04)
    tuck = s.sweep(t, .075, 310, 210, .031) * s.envelope(t, .075, .001, .018) * .017
    x = s.stereo(flick + lift + tap + crystal + tuck, crystal, .12)
    return s.finish(s.room(x, .12, .035), -9)


def impact():
    t = s.timeline(.57)
    air = s.noise(t, 2200, 7300) * s.window(t, .007, .045, 2.2) * .007
    at = .042
    # Stylized elastic impact replaces the sub-bass slam and realistic crack of v1.
    pop = s.sweep(t, at, 390, 175, .045) * s.envelope(t, at, .0008, .03) * .051
    tap = s.noise(t, 1900, 6200) * s.envelope(t, at, .0007, .006) * .008
    sparkle = bell(t, at + .006, 1046.5, .014, .06) + bell(t, at + .014, 1568, .007, .045)
    body = bell(t, at, 261.63, .018, .038)
    x = s.stereo(air + pop + tap + sparkle + body, sparkle, .18)
    return s.finish(s.room(x, .19, .065), -7.5)


def event_enter():
    t = s.timeline(1.40)
    dust = s.noise(t, 2600, 8300) * s.window(t, .008, .26, 2) * .0027
    lift = s.sweep(t, .02, 440, 880, .19) * s.window(t, .02, .22, 2) * .006
    # Open D/A/E voicing: curious and magical, without a horror-style low drone.
    notes = sum(bell(t, at, f, amp, decay) for at, f, amp, decay in
                [(.055, 587.33, .028, .125), (.13, 880, .021, .15),
                 (.23, 1318.51, .017, .21), (.245, 1760, .004, .13)])
    warmth = bell(t, .19, 293.66, .008, .16, .025)
    side = bell(t, .232, 1323.2, .008, .18, .013)
    x = s.stereo(dust + lift + notes + warmth, side, .42)
    return s.finish(s.room(x, .8, .09, 1.6), -9)


def boss_reveal():
    t = s.timeline(1.90)
    # A restrained fantasy challenge cue: suspended anticipation, then a compact minor chord.
    pre = bell(t, .02, 440, .012, .065, .008) + bell(t, .105, 622.25, .012, .065, .008)
    rise = s.sweep(t, .09, 470, 880, .16) * s.window(t, .09, .19, 2.5) * .009
    at = .255
    pulse = s.sweep(t, at, 270, 147, .058) * s.envelope(t, at, .003, .065) * .031
    chord = sum(bell(t, at + delay, f, amp, decay, .004) for delay, f, amp, decay in
                [(0, 293.66, .025, .16), (.008, 440, .022, .14),
                 (.016, 698.46, .015, .18), (.03, 1174.66, .010, .22)])
    glitter = bell(t, .33, 1760, .006, .10) + bell(t, .38, 2349.32, .003, .11)
    breath = s.noise(t, 2100, 7300) * s.envelope(t, at, .015, .12) * .003
    side = bell(t, at + .027, 1178.5, .007, .21, .008)
    x = s.stereo(pre + rise + pulse + chord + glitter + breath, side, .34)
    return s.finish(s.room(x, 1.15, .12, 1.9), -7.5)


s.SOUNDS = [
    ('01-ui-click', '按钮点击', click, '短小弹性触点，柔和亮音，无写实锁扣。'),
    ('02-card-play', '出牌', card_play, '轻拂、弹性落点与微弱晶亮泛音。'),
    ('03-attack-impact', '攻击命中', impact, '轻量弹性冲击与短闪光感，削弱写实低频。'),
    ('04-event-enter', '进入事件', event_enter, '疏朗上行共鸣，轻微神秘与好奇。'),
    ('05-boss-reveal', '首脑登场', boss_reveal, '短蓄势与幻想小和弦，保留挑战感而减轻压迫。'),
]

if __name__ == '__main__':
    s.main()
