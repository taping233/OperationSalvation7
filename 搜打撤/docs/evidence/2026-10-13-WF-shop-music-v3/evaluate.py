"""Matched 30-second reference comparison plus full-loop engineering checks."""
import json
import pathlib
import subprocess
import sys

import numpy as np
import soundfile as sf
from scipy import signal

OUT = pathlib.Path(__file__).absolute().parent
ROOT = OUT.parents[2]
OLD = ROOT / 'game/assets/music-demo/05-shop-lamplight-deal-v2.ogg'
NEW = OUT / '05-shop-lamplight-deal-v3.ogg'
REFERENCE = ROOT / '.tmp/shop-reference-1009/cannot-the-trader.mp3'
sys.stdout.reconfigure(encoding='utf-8')


def decode(path, seconds):
    raw = subprocess.check_output(['ffmpeg', '-v', 'error', '-t', str(seconds),
        '-i', str(path), '-ar', '24000', '-ac', '2', '-f', 'f32le', '-'])
    return np.frombuffer(raw, dtype='<f4').reshape(-1, 2).copy()


def first_30_metrics(path):
    x = decode(path, 30)
    assert len(x) == 30 * 24000
    mono = x.mean(axis=1)
    side = (x[:, 0] - x[:, 1]) / 2
    freq, times, stft = signal.stft(mono, fs=24000, nperseg=2048,
                                    noverlap=1792, boundary=None)
    power = np.abs(stft) ** 2
    bands = np.geomspace(80, 10000, 33)
    spectrum = np.array([power[(freq >= bands[i]) & (freq < bands[i+1])].sum(axis=0)
                         for i in range(32)])
    db = 10 * np.log10(spectrum + 1e-12)
    flux = np.maximum(0, np.diff(db, axis=1)).mean(axis=0)
    peaks, _ = signal.find_peaks(flux, distance=10, prominence=1.5)
    count = len(peaks)
    vectors = []
    for second in range(30):
        block = db[:, (times >= second) & (times < second + 1)]
        vector = block.mean(axis=1)
        vector -= vector.mean()
        vectors.append(vector / (np.linalg.norm(vector) + 1e-12))
    movement = [np.linalg.norm(np.mean(vectors[i-6:i], axis=0)
                               - np.mean(vectors[i:i+6], axis=0)) for i in range(6, 24)]
    mid_power = np.mean(mono.astype('f8') ** 2)
    side_power = np.mean(side.astype('f8') ** 2)
    return {'onsets_per_second': round(count / 30, 2),
            'texture_movement': round(float(np.median(movement)), 3),
            'side_energy_percent': round(100 * side_power / (mid_power + side_power), 1)}


def main():
    old_score = json.loads((OUT.parent / '2026-10-13-WF-shop-music-v2/score.json').read_text(encoding='utf-8'))
    new_score = json.loads((OUT / 'score.json').read_text(encoding='utf-8'))
    def counts(score):
        notes = [e for e in score['events'] if e['beat'] < 30 * score['bpm'] / 60]
        return {'first_30s_notes': len(notes),
                'first_30s_shorter_than_0_7_beats': sum(e['length'] < .7 for e in notes)}
    old_count, new_count = counts(old_score), counts(new_score)
    x, sr = sf.read(OUT / '05-shop-lamplight-deal-v3.wav', dtype='float32', always_2d=True)
    assert sr == 48000 and len(x) == 60 * sr and np.isfinite(x).all()
    def rms(y): return float(np.sqrt(np.mean(y.astype('f8') ** 2)))
    seam_db = 20 * np.log10((rms(x[-4800:]) + 1e-12) / (rms(x[:4800]) + 1e-12))
    quietest_half_second = min(20 * np.log10(rms(x[i:i+sr//2]) + 1e-12)
                                 for i in range(0, len(x)-sr//2+1, sr//2))
    decoded = decode(NEW, 60)
    assert len(decoded) == 60 * 24000
    comparison = {name: first_30_metrics(path) for name, path in
                  [('old', OLD), ('new', NEW), ('reference', REFERENCE)]}
    assert new_score['bpm'] > old_score['bpm']
    assert comparison['new']['side_energy_percent'] > 3
    assert np.abs(x).max() < 1 and abs(seam_db) < 6 and quietest_half_second > -45
    report = {'matched_0_to_30_seconds': comparison,
              'tempo_bpm': {'old': old_score['bpm'], 'new': new_score['bpm']},
              'score_event_counts': {'old': old_count, 'new': new_count},
              'loop': {'decoded_seconds': len(decoded) / 24000,
                       'sample_jump': round(float(np.max(np.abs(x[-1] - x[0]))), 7),
                       'start_end_100ms_rms_delta_db': round(float(seam_db), 2),
                       'quietest_half_second_dbfs': round(float(quietest_half_second), 2),
                       'sample_peak': round(float(np.abs(x).max()), 4)},
              'checks_passed': True,
              'limits': 'Transient peaks use log-frequency spectral flux and are comparable only within this report. More spectral movement or width is not a quality score; reference intro and structure differ. No human audition claimed.'}
    (OUT / 'evaluation.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(json.dumps(report, ensure_ascii=False))


if __name__ == '__main__':
    main()
