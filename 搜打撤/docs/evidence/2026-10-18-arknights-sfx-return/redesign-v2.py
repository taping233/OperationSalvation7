"""Original v2 sketches informed by broad transient/timbre observations.

Reference files are not loaded by this generator. It uses independent noise,
inharmonic damped modes and air/pressure envelopes, not source audio fragments.
"""
from pathlib import Path
import hashlib
import json
import subprocess
import wave
import numpy as np

BASE = Path(__file__).resolve().parent
RATE = 48000
TAU = 2 * np.pi

def texture(size, seed, center, width):
    rng = np.random.default_rng(seed)
    raw = rng.normal(0, 1, size)
    freqs = np.fft.rfftfreq(size, 1 / RATE)
    weight = np.exp(-.5 * ((freqs - center) / width) ** 2)
    weight *= 1 - np.exp(-(freqs / 450) ** 4)
    weight *= np.exp(-(freqs / 9500) ** 8)
    result = np.fft.irfft(np.fft.rfft(raw) * weight, n=size)
    return result / np.sqrt(np.mean(result ** 2))

def env(t, attack, decay):
    return (1 - np.exp(-np.maximum(t, 0) / attack)) * np.exp(-np.maximum(t, 0) / decay) * (t >= 0)

def contact(t, seed, brightness=1.0):
    fizz = texture(len(t), seed, 4300 * brightness, 2450)
    low = texture(len(t), seed + 27, 1700 * brightness, 580)
    output = .75 * fizz * env(t, .00011, .0033)
    output += .28 * low * env(t, .0003, .009)
    # Inharmonic, very short material response instead of a sustained UI beep.
    for frequency, level, decay in [(607,.21,.014),(1083,.18,.009),
                                    (1887,.13,.006),(3437,.08,.0038),
                                    (5783,.04,.0024)]:
        phase = (frequency % 13) / 13
        output += level * np.sin(TAU * frequency * brightness * t + phase) * env(t, .0003, decay)
    return output

def stereo(signal, t, seed, spread):
    # A low-level dispersed tail, not an obvious echo or chorus.
    air_l = texture(len(t), seed, 5100, 1600) * env(t - .036, .004, .018)
    air_r = texture(len(t), seed + 31, 4900, 1650) * env(t - .041, .005, .017)
    return signal + spread * air_l, signal + spread * air_r

def click(t):
    signal = contact(t, 71901)
    rebound = texture(len(t), 71902, 4600, 1100) * env(t - .078, .002, .012)
    signal += .035 * rebound
    return stereo(signal, t, 71903, .005)

def confirm(t):
    signal = contact(t, 71911, 1.075) * .87
    settle = contact(np.maximum(t - .092, 0), 71912, 1.2) * (t >= .092)
    signal += .22 * settle
    shimmer = texture(len(t), 71913, 3700, 620) * env(t - .093, .0015, .018)
    signal += .035 * shimmer
    return stereo(signal, t, 71914, .008)

def reward(t):
    # A soft, compact pressure release and diffuse data-grain reveal, no tune.
    low = .23 * np.sin(TAU * (151 * t - 34 * t * t)) * env(t, .005, .042)
    air = texture(len(t), 71921, 5000, 2350) * env(t, .0025, .043)
    air *= .35 + .65 * np.exp(-t / .026)
    grain = texture(len(t), 71922, 3450, 1200) * env(t - .085, .0035, .028)
    signal = low + .115 * air + .055 * grain
    # Sparse, non-pitched shimmer instead of bells or an ascending arpeggio.
    shimmer_l = texture(len(t), 71923, 6300, 1700) * env(t - .031, .009, .052)
    shimmer_r = texture(len(t), 71924, 6100, 1900) * env(t - .038, .01, .05)
    return signal + .014 * shimmer_l, signal + .014 * shimmer_r

def render(name, duration, voice, peak):
    t = np.arange(round(RATE * duration)) / RATE
    left, right = voice(t)
    final = np.minimum(1, (duration - t) / .008)
    signal = np.stack([left * final, right * final], axis=1)
    signal *= peak / np.max(np.abs(signal))
    pcm = (signal * 32767).astype('<i2').tobytes()
    wav = BASE / f'{name}.wav'
    with wave.open(str(wav), 'wb') as output:
        output.setparams((2, 2, RATE, 0, 'NONE', 'not compressed'))
        output.writeframes(pcm)
    mp3 = BASE / f'{name}.mp3'
    subprocess.run(['ffmpeg','-v','error','-y','-i',str(wav),
                    '-c:a','libmp3lame','-q:a','2',str(mp3)],check=True)
    return {'name':name,'duration':duration,'designed_peak_linear':peak,
            'wav_sha256':hashlib.sha256(wav.read_bytes()).hexdigest(),
            'mp3_sha256':hashlib.sha256(mp3.read_bytes()).hexdigest()}

files = [render('v2-01-click',.185,click,.135),
         render('v2-02-confirm',.225,confirm,.145),
         render('v2-03-reward',.375,reward,.125)]
(BASE / 'v2-receipt.json').write_text(json.dumps({
    'method':'independent synthesis from new noise seeds, inharmonic transient modes, pressure and air layers',
    'audio_inputs':[], 'reference_use':'coarse attack, tonal/noise balance, decay and action hierarchy; no source waveform reuse',
    'changes_from_v1':'remove sustained sine motifs and bell-like reward; add short broadband contacts and a subdued pressure/air reward',
    'tests_run':False,'listening_verified':False,'runtime_installed':False,
    'legal_noninfringement_determination':False,'files':files,
},indent=2)+'\n',encoding='utf-8')
print('V2 sketches written; game untouched; no tests run.')
