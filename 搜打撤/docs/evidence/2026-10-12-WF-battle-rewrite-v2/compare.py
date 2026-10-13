"""Same-window audio measurements; melody estimates are not a transcription."""
import hashlib
import json
import pathlib
import subprocess
import numpy as np
from scipy.signal import stft, find_peaks
from scipy.ndimage import median_filter

OUT = pathlib.Path(__file__).resolve().parent
ROOT = OUT.parents[2]
FILES = {
    'phantom': ROOT/'docs/evidence/2026-10-12-WF-roguelike-bgm-reference/01-phantom-battle1.m4a',
    'mizuki': ROOT/'docs/evidence/2026-10-12-WF-roguelike-bgm-reference/03-mizuki-battle1.m4a',
    'v1': ROOT/'docs/evidence/2026-10-12-WF-battle-rewrite-demo/battle-shadowtide-30s.mp3',
}

def measure(path, offset=0):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', str(path), '-ss', str(offset), '-t', '30',
        '-ac', '2', '-ar', '22050', '-f', 'f32le', '-'], capture_output=True, check=True).stdout
    stereo = np.frombuffer(raw, dtype=np.float32).reshape(-1, 2)
    x = stereo.mean(axis=1)
    x /= max(np.sqrt(np.mean(x*x)), 1e-10)
    f, t, spec = stft(x, fs=22050, nperseg=2048, noverlap=1536)
    power = np.abs(spec)**2
    bands = {'20_150': (20, 150), '150_500': (150, 500), '500_2000': (500, 2000),
             '2000_4000': (2000, 4000), '4000_10000': (4000, 10000)}
    energy = {k: float(power[(f >= a) & (f < b)].sum()/power.sum()) for k, (a, b) in bands.items()}
    mag = np.abs(spec)
    harmonic = median_filter(mag, size=(1, 17))
    percussive = median_filter(mag, size=(17, 1))
    harmonic_mask = harmonic**2/(harmonic**2+percussive**2+1e-12)
    harmonic_energy = float((power*harmonic_mask).sum()/power.sum())
    # Envelope features describe rhythmic texture, not exact kick/snare events.
    flux = np.maximum(np.diff(mag, axis=1), 0).sum(axis=0)
    peaks, _ = find_peaks(flux, distance=3, prominence=max(np.percentile(flux, 75), 1e-10)*.3)
    envelope = np.sqrt(np.mean(x[:len(x)//11025*11025].reshape(-1,11025)**2, axis=1))
    variation = float(np.percentile(20*np.log10(envelope+1e-9),90)-np.percentile(20*np.log10(envelope+1e-9),10))
    return {'offset_seconds': offset, 'seconds': len(x)/22050, 'band_power_fraction': energy,
        'spectral_centroid_hz': float((power*f[:,None]).sum()/power.sum()),
        'harmonic_energy_fraction': harmonic_energy, 'onset_peaks_per_second': len(peaks)/(len(x)/22050),
        'halfsecond_level_p90_p10_db': variation,
        'stereo_correlation': float(np.corrcoef(stereo.T)[0,1]),
        'crest_db': float(20*np.log10(np.max(np.abs(x))/np.sqrt(np.mean(x*x))))}

def compare():
    rows = {}
    for name, path in FILES.items():
        rows[name] = {'file': path.relative_to(ROOT).as_posix(), 'sha256': hashlib.sha256(path.read_bytes()).hexdigest(),
                      'windows': [measure(path)] + ([measure(path, 30)] if name in ('phantom', 'mizuki') else [])}
    for version, source, track in [('v1', ROOT/'docs/evidence/2026-10-12-WF-battle-rewrite-demo/score.json','Violin motif'),
                                   ('v2',OUT/'score.json','Ensemble theme')]:
        if not source.exists():
            continue
        score = json.loads(source.read_text(encoding='utf-8'))
        melody = sorted([e for e in score['events'] if e['track']==track], key=lambda e:e['start_beats'])
        leaps = np.abs(np.diff([e['midi'] for e in melody]))
        notes = np.array([e['length_beats']*60/128 for e in melody])
        rows[version+'_score'] = {'melody_note_count': len(melody), 'melody_range_semitones': max(e['midi'] for e in melody)-min(e['midi'] for e in melody),
            'mean_melodic_leap_semitones': float(leaps.mean()), 'leaps_over_fifth': int((leaps>7).sum()),
            'median_note_seconds': float(np.median(notes)), 'notes_under_250ms': int((notes<.25).sum()),
            'sustained_melody_notes_over_500ms': int((notes>.5).sum())}
    rows['scope'] = 'Identical 30s analysis windows, mono RMS normalized for spectral/envelope comparison; references also sampled at 30-60s. Not human listening, source separation or exact melody transcription.'
    (OUT/'comparison.json').write_text(json.dumps(rows, ensure_ascii=False, indent=2), encoding='utf-8')
    print(json.dumps(rows, ensure_ascii=True))

if __name__ == '__main__':
    v2 = OUT/'battle-shadowtide-v2-30s.mp3'
    if v2.exists():
        FILES['v2'] = v2
    compare()
