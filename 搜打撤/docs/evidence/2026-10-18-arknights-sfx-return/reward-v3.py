"""Two independent reward revisions; accepted click/confirm files are untouched."""
from pathlib import Path
import hashlib
import json
import subprocess
import wave
import numpy as np

BASE = Path(__file__).resolve().parent
RATE = 48000
TAU = 2 * np.pi

def decay(t, attack, release):
    u = np.maximum(t, 0)
    return (1 - np.exp(-u / attack)) * np.exp(-u / release) * (t >= 0)

def dust(t, seed, center, width):
    rng = np.random.default_rng(seed)
    f = np.fft.rfftfreq(len(t), 1 / RATE)
    spectrum = np.exp(-.5 * ((f - center) / width) ** 2)
    spectrum *= (1 - np.exp(-(f / 850) ** 4)) * np.exp(-(f / 8500) ** 8)
    a = np.fft.irfft(np.fft.rfft(rng.standard_normal(len(t))) * spectrum, n=len(t))
    return a / np.sqrt(np.mean(a * a))

def light(t):
    # Muted inharmonic crystal particles opening into one compact resolved body.
    onset = dust(t, 72101, 3600, 1500) * decay(t, .001, .008) * .18
    body = np.zeros_like(t)
    for freq, amp, tail in [(793,.27,.043),(1327,.19,.035),
                            (2213,.095,.022),(3617,.045,.013)]:
        body += amp * np.sin(TAU * freq * t) * decay(t, .0018, tail)
    u = np.maximum(t - .049, 0)
    settle = np.zeros_like(t)
    for freq, amp, tail in [(1049,.3,.047),(1753,.1,.032),(2897,.055,.018)]:
        # A tiny pitch relaxation, not a melody or a long musical sting.
        phase = TAU * freq * (u + .00018 * (1 - np.exp(-u / .012)))
        settle += amp * np.sin(phase) * decay(t - .049, .002, tail)
    sheen_l = dust(t, 72102, 4800, 1250) * decay(t - .044, .003, .023) * .013
    sheen_r = dust(t, 72103, 4700, 1300) * decay(t - .047, .003, .023) * .013
    return onset + body + settle + sheen_l, onset + body + settle + sheen_r

def compact(t):
    # Two tactile digital grains, with a restrained resolved glint instead of bass.
    first = dust(t, 72111, 2800, 1600) * decay(t, .0006, .006) * .32
    second = dust(t, 72112, 4100, 1450) * decay(t - .041, .001, .012) * .12
    mode = np.zeros_like(t)
    for freq, amp, tail in [(937,.15,.025),(1583,.08,.018),(2677,.025,.011)]:
        mode += amp * np.sin(TAU * freq * np.maximum(t-.041, 0)) * decay(t-.041,.001,tail)
    quiet_l = dust(t, 72113, 5200, 900) * decay(t - .045,.003,.016) * .007
    quiet_r = dust(t, 72114, 5100, 950) * decay(t - .048,.003,.016) * .007
    return first+second+mode+quiet_l, first+second+mode+quiet_r

def render(name, seconds, fn, peak):
    t = np.arange(round(seconds * RATE)) / RATE
    l, r = fn(t)
    a = np.stack([l,r],axis=1) * np.minimum(1,(seconds-t)/.008)[:,None]
    a *= peak / np.max(np.abs(a))
    wav = BASE / (name+'.wav')
    with wave.open(str(wav),'wb') as out:
        out.setparams((2,2,RATE,0,'NONE','not compressed'))
        out.writeframes((a*32767).astype('<i2').tobytes())
    mp3 = BASE / (name+'.mp3')
    subprocess.run(['ffmpeg','-v','error','-y','-i',str(wav),'-c:a','libmp3lame','-q:a','2',str(mp3)],check=True)
    return {'file':mp3.name,'seconds':seconds,'designed_peak':peak,
            'wav_sha256':hashlib.sha256(wav.read_bytes()).hexdigest(),
            'mp3_sha256':hashlib.sha256(mp3.read_bytes()).hexdigest()}

files = [render('v3-reward-A-light',.29,light,.115),
         render('v3-reward-B-compact',.19,compact,.125)]
(BASE/'v3-reward-receipt.json').write_text(json.dumps({
    'accepted_unchanged':['v2-01-click','v2-02-confirm'],
    'scope':'reward only; remove the v2 pressure/bass gesture',
    'audio_inputs':[],'runtime_installed':False,'tests_run':False,
    'listening_verified':False,'files':files},indent=2)+'\n',encoding='utf-8')
print('Two reward-only revisions written. Accepted click/confirm untouched.')
