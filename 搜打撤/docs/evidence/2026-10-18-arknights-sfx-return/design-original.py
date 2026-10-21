"""Independent UI sketches from mathematical oscillators and seeded noise.

No third-party recordings, extracted waveforms, or samples are used.
Only a quiet, short, cool electronic UI direction is shared with the reference.
"""
import array
import hashlib
import json
import math
from pathlib import Path
import random
import subprocess
import wave

ROOT = Path(__file__).resolve().parent
RATE = 48000
TAU = math.tau

def noise(seed, count):
    rng = random.Random(seed)
    smooth = 0.0
    result = []
    for _ in range(count):
        smooth += .24 * (rng.uniform(-1, 1) - smooth)
        result.append(smooth)
    return result

def envelope(t, attack, decay):
    return (1 - math.exp(-t / attack)) * math.exp(-t / decay)

def render(name, seconds, seed, voice, peak):
    count = int(RATE * seconds)
    texture = noise(seed, count)
    left, right = [], []
    for i in range(count):
        t = i / RATE
        # 8ms final fade leaves the designed exponential release intact.
        fade = min(1.0, (seconds - t) / .008)
        l, r = voice(t, texture[i])
        left.append(l * fade)
        right.append(r * fade)
    scale = peak / max(max(map(abs, left)), max(map(abs, right)))
    pcm = array.array('h')
    for l, r in zip(left, right):
        pcm.extend([int(32767 * l * scale), int(32767 * r * scale)])
    wav = ROOT / f'{name}.wav'
    with wave.open(str(wav), 'wb') as out:
        out.setparams((2, 2, RATE, 0, 'NONE', 'not compressed'))
        out.writeframes(pcm.tobytes())
    mp3 = ROOT / f'{name}.mp3'
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', str(wav),
                    '-c:a', 'libmp3lame', '-q:a', '2', str(mp3)], check=True)
    return {'name': name, 'duration': seconds, 'designed_peak_linear': peak,
            'seed': seed, 'wav_sha256': hashlib.sha256(wav.read_bytes()).hexdigest(),
            'mp3_sha256': hashlib.sha256(mp3.read_bytes()).hexdigest(),
            'source': 'Independent mathematical synthesis; no source audio input'}

def click(t, air):
    # A low, damped contact with a very faint, dispersed electronic edge.
    body = envelope(t, .0008, .013) * math.sin(TAU * (510 * t - 1350 * t * t))
    edge = .19 * envelope(t, .0004, .006) * math.sin(TAU * 2350 * t)
    touch = .2 * air * envelope(t, .0005, .009)
    return body + edge + touch, body + .94 * edge + touch

def confirm(t, air):
    # A single timbral opening, with no copied motif or sequence of UI notes.
    env = envelope(t, .004, .057)
    carrier = math.sin(TAU * 710 * t + .34 * math.sin(TAU * 131 * t))
    upper = .15 * math.sin(TAU * 1427 * t) * math.exp(-t / .028)
    tail = .06 * math.sin(TAU * 487 * t) * envelope(t, .012, .065)
    return env * (carrier + upper + .07 * air) + tail, env * (carrier + upper * .92 + .07 * air) + tail

def reward(t, air):
    # One soft inharmonic glass/air bloom, not a fanfare or recognisable tune.
    bloom = envelope(t, .011, .095)
    core = math.sin(TAU * 586 * t + .18 * math.sin(TAU * 73 * t))
    mid = .28 * math.sin(TAU * 983 * t) * math.exp(-t / .09)
    glint_l = .095 * math.sin(TAU * 1657 * t) * math.exp(-t / .045)
    glint_r = .095 * math.sin(TAU * 1663 * t) * math.exp(-t / .045)
    haze = .05 * air * envelope(t, .018, .07)
    return bloom * (core + mid + glint_l) + haze, bloom * (core + mid + glint_r) + haze

files = [render('01-original-click', .105, 71018, click, .105),
         render('02-original-confirm', .29, 71019, confirm, .115),
         render('03-original-reward', .48, 71020, reward, .12)]
(ROOT / 'original-receipt.json').write_text(json.dumps({
    'status': 'independent-original-sketches-for-user-listening',
    'third_party_audio_inputs': [], 'runtime_installed': False,
    'tests_run': False, 'listening_verified': False,
    'legal_noninfringement_determination': False, 'files': files,
}, indent=2) + '\n', encoding='utf-8')
print('Three independent original sketches written; no source audio used; no tests run.')
