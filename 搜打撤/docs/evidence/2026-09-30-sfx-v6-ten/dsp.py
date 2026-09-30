"""Small DSP building blocks; each cue has its own acoustic construction."""
from pathlib import Path
import subprocess
import numpy as np
from scipy import signal

SR = 48000
HERE = Path(__file__).resolve().parent


def timeline(seconds):
    return np.arange(round(seconds * SR)) / SR


def env(t, at=0, attack=.001, decay=.04):
    u = np.maximum(t - at, 0)
    return (t >= at) * (1 - np.exp(-u / attack)) * np.exp(-u / decay)


def arc(t, at, length, power=1):
    return np.sin(np.pi * np.clip((t - at) / length, 0, 1)) ** power


def noise(t, rng, low=200, high=6500):
    n = signal.sosfilt(signal.butter(3, [low, high], fs=SR, btype='bandpass', output='sos'), rng.normal(size=len(t)))
    return n / max(np.std(n), 1e-12)


def lowpass(x, frequency):
    return signal.sosfilt(signal.butter(2, frequency, fs=SR, output='sos'), x, axis=0)


def modes(t, at, frequencies, decays, weights):
    u = np.maximum(t - at, 0)
    return sum(a * np.sin(2 * np.pi * f * u) * env(t, at, .0006, d)
               for f, d, a in zip(frequencies, decays, weights))


def fm(t, at, f, ratio, index, attack=.001, decay=.07):
    u = np.maximum(t - at, 0)
    phase = 2 * np.pi * f * u + index * np.sin(2 * np.pi * f * ratio * u) * np.exp(-u / .035)
    return np.sin(phase) * env(t, at, attack, decay)


def chirp(t, at, start, end, seconds, attack=.001, decay=.06):
    u = np.maximum(t - at, 0)
    k = np.log(end / start) / seconds
    phase = 2 * np.pi * start * np.expm1(np.minimum(u, seconds) * k) / k
    phase += 2 * np.pi * end * np.maximum(u - seconds, 0)
    return np.sin(phase) * env(t, at, attack, decay)


def pan(x, position=0):
    p = np.clip(position, -.85, .85)
    return np.column_stack([x * np.sqrt((1-p)/2), x * np.sqrt((1+p)/2)])


def material(name, t, at=0, rate=1, length=None, gain=1):
    raw = subprocess.run(['ffmpeg','-v','error','-i',str(HERE/'materials'/name),'-ac','1',
                          '-ar',str(SR),'-f','f32le','-'],check=True,capture_output=True).stdout
    source = np.frombuffer(raw,dtype='<f4').copy()
    source /= max(np.max(abs(source)), 1e-12)
    length = min(len(source)/SR/rate, length or len(source)/SR/rate)
    n = round(length*SR)
    piece = np.interp(np.arange(n)*rate, np.arange(len(source)), source)
    edge = min(240,n//4)
    piece[:edge] *= np.linspace(0,1,edge)
    piece[-edge:] *= np.linspace(1,0,edge)
    y = np.zeros_like(t); offset = round(at*SR); n=min(n,len(y)-offset)
    y[offset:offset+n] = piece[:n] * gain
    return y


def reverb(x, rng, wet=.08, t60=.4, predelay=.010):
    ir_n = round(t60*SR); u=np.arange(ir_n)/SR
    out=x.copy()
    for channel in range(2):
        impulse=rng.normal(size=ir_n)*np.exp(-6.9*u/t60)*.024
        impulse[:round(predelay*SR)] = 0
        impulse=lowpass(impulse,3400)
        for delay,amp in [(predelay+.004,.3),(predelay+.017,.19),(predelay+.032,.12)]:
            i=round((delay+channel*.0014)*SR)
            impulse[i] += amp
        impulse /= max(np.linalg.norm(impulse),1)
        out[:,channel] += signal.fftconvolve(x[:,channel],impulse)[:len(x)]*wet
    return out


def master(x, peak_db):
    x=signal.sosfilt(signal.butter(2,38,fs=SR,btype='highpass',output='sos'),x,axis=0)
    x=lowpass(x,15000)
    x*=10**(peak_db/20)/max(np.max(abs(x)),1e-12)
    lead=min(40,len(x)//4); tail=min(2880,len(x)//3)
    x[:lead]*=np.sin(np.linspace(0,np.pi/2,lead))[:,None]**2
    x[-tail:]*=np.cos(np.linspace(0,np.pi/2,tail))[:,None]**2
    return x
