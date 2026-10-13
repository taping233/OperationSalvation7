"""Matched 30-second reference comparison plus full-loop engineering checks."""
import json
import pathlib
import subprocess
import sys

import librosa
import numpy as np
import soundfile as sf

OUT = pathlib.Path(__file__).resolve().parent
ROOT = OUT.parents[2]
OLD = ROOT / 'game/assets/music-demo/05-shop-lamplight-deal.ogg'
NEW = OUT / '05-shop-lamplight-deal-v2.ogg'
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
    onset = librosa.onset.onset_strength(y=mono, sr=24000, hop_length=256)
    count = len(librosa.onset.onset_detect(onset_envelope=onset, sr=24000, hop_length=256))
    mel = librosa.feature.melspectrogram(y=mono, sr=24000, n_fft=2048,
                                         hop_length=256, n_mels=32)
    db = librosa.power_to_db(mel, ref=np.max)
    vectors = []
    for second in range(30):
        block = db[:, round(second * 24000 / 256):round((second + 1) * 24000 / 256)]
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
    old_score = json.loads((OUT.parent / '2026-10-09-WF-shop-remake/score.json').read_text(encoding='utf-8'))
    new_score = json.loads((OUT / 'score.json').read_text(encoding='utf-8'))
    def counts(score):
        notes = [e for e in score['events'] if e['beat'] < 48]
        return {'first_30s_notes': len(notes),
                'first_30s_shorter_than_0_7_beats': sum(e['length'] < .7 for e in notes)}
    old_count, new_count = counts(old_score), counts(new_score)
    x, sr = sf.read(OUT / '05-shop-lamplight-deal-v2.wav', dtype='float32', always_2d=True)
    assert sr == 48000 and len(x) == 60 * sr and np.isfinite(x).all()
    def rms(y): return float(np.sqrt(np.mean(y.astype('f8') ** 2)))
    seam_db = 20 * np.log10((rms(x[-4800:]) + 1e-12) / (rms(x[:4800]) + 1e-12))
    quietest_half_second = min(20 * np.log10(rms(x[i:i+sr//2]) + 1e-12)
                                 for i in range(0, len(x)-sr//2+1, sr//2))
    decoded = decode(NEW, 60)
    assert len(decoded) == 60 * 24000
    comparison = {name: first_30_metrics(path) for name, path in
                  [('old', OLD), ('new', NEW), ('reference', REFERENCE)]}
    assert new_count['first_30s_notes'] < old_count['first_30s_notes']
    assert new_count['first_30s_shorter_than_0_7_beats'] < old_count['first_30s_shorter_than_0_7_beats']
    assert comparison['new']['side_energy_percent'] > comparison['old']['side_energy_percent']
    assert np.abs(x).max() < 1 and abs(seam_db) < 6 and quietest_half_second > -45
    report = {'matched_0_to_30_seconds': comparison,
              'score_event_counts': {'old': old_count, 'new': new_count},
              'loop': {'decoded_seconds': len(decoded) / 24000,
                       'sample_jump': round(float(np.max(np.abs(x[-1] - x[0]))), 7),
                       'start_end_100ms_rms_delta_db': round(float(seam_db), 2),
                       'quietest_half_second_dbfs': round(float(quietest_half_second), 2),
                       'sample_peak': round(float(np.abs(x).max()), 4)},
              'checks_passed': True,
              'limits': 'Onsets are detected transients, not authored note counts. More spectral movement or width is not a quality score; reference intro and structure differ. No human audition claimed.'}
    (OUT / 'evaluation.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(json.dumps(report, ensure_ascii=False))


if __name__ == '__main__':
    main()
