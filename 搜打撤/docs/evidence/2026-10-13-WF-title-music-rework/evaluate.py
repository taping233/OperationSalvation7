"""Check the rendered title cue against the shipped cue and the local brief."""
import importlib.util
import json
import pathlib
import subprocess
import sys

import librosa
import numpy as np
import soundfile as sf

OUT = pathlib.Path(__file__).resolve().parent
ROOT = OUT.parents[2]
OLD = ROOT / 'game/assets/music-demo/01-title-frostglass.ogg'
NEW = OUT / '01-title-frostglass-v11.ogg'
sys.stdout.reconfigure(encoding='utf-8')


def decode(path):
    raw = subprocess.check_output(['ffmpeg', '-v', 'error', '-i', str(path),
                                   '-ar', '24000', '-ac', '2', '-f', 'f32le', '-'])
    return np.frombuffer(raw, dtype='<f4').reshape(-1, 2).copy()


def matched_metrics(path):
    spec = importlib.util.spec_from_file_location('music_gap_metrics',
        OUT.parent / '2026-10-05-WF-music-gap/analyze.py')
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    raw = subprocess.check_output(['ffmpeg', '-v', 'error', '-ss', '12', '-t', '48',
                                   '-i', str(path), '-ar', '48000', '-ac', '2', '-f', 'f32le', '-'])
    pcm = np.frombuffer(raw, dtype='<f4').reshape(-1, 2).copy()
    result = module.metrics(pcm)
    return {'texture_movement': round(result['spectral_shape_novelty_median'], 3),
            'side_mid_energy_db': round(result['side_mid_energy_db'], 1),
            'onsets_per_second': round(result['onsets_per_second'], 2),
            'pulse_peak': round(result['onset_autocorrelation_peak'], 3)}


def section_distances(audio):
    # Four 8-bar sections, comparing averaged log-mel shape independently of gain.
    samples = round(32 * 60 / 84 * 24000)
    vectors = []
    for index in range(4):
        mono = audio[index * samples:(index + 1) * samples].mean(axis=1)
        power = abs(librosa.stft(mono, n_fft=2048, hop_length=512)) ** 2
        mel = librosa.feature.melspectrogram(S=power, sr=24000, n_mels=48)
        vector = librosa.power_to_db(mel + 1e-10).mean(axis=1)
        vector -= vector.mean()
        vectors.append(vector / np.linalg.norm(vector))
    return [round(float(np.linalg.norm(vectors[i] - vectors[0])), 3) for i in (1, 2, 3)]


def main():
    old, new = decode(OLD), decode(NEW)
    original_score = json.loads((OUT.parent / '2026-10-05-WF-music-piano-two-hands/title-score.json').read_text(encoding='utf-8'))
    score = json.loads((OUT / 'score.json').read_text(encoding='utf-8'))
    right_unchanged = score['tracks']['Piano right hand']['notes'] == original_score['tracks']['Piano right hand']['notes']
    wav, sr = sf.read(OUT / '01-title-frostglass-v11.wav', dtype='float32', always_2d=True)
    assert sr == 48000 and len(wav) == round(32 * 4 * 60 / 84 * sr)
    assert len(old) == len(new) and right_unchanged
    assert np.isfinite(wav).all() and np.abs(wav).max() < 1
    def rms(block): return float(np.sqrt(np.mean(block.astype(np.float64) ** 2)))
    seam_db = 20 * np.log10((rms(wav[-4800:]) + 1e-12) / (rms(wav[:4800]) + 1e-12))
    assert abs(seam_db) < 12
    before, after = section_distances(old), section_distances(new)
    assert after[0] > before[0] and after[2] > before[2]
    previous_metrics, current_metrics = matched_metrics(OLD), matched_metrics(NEW)
    reference_report = json.loads((OUT.parent / '2026-10-05-WF-music-gap/comparison.json').read_text(encoding='utf-8'))
    references = {item['name']: {
        'texture_movement': round(item['matched_metrics']['spectral_shape_novelty_median'], 3),
        'side_mid_energy_db': round(item['matched_metrics']['side_mid_energy_db'], 1),
        'onsets_per_second': round(item['matched_metrics']['onsets_per_second'], 2),
        'pulse_peak': round(item['matched_metrics']['onset_autocorrelation_peak'], 3)}
        for item in reference_report['tracks'] if item['group'] == 'reference'}
    report = {'old_file': str(OLD.relative_to(ROOT)), 'new_file': str(NEW.relative_to(ROOT)),
              'duration_seconds': round(len(new) / 24000, 5), 'right_hand_notes_preserved': right_unchanged,
              'section_log_mel_distance_from_first_A': {'old': before, 'new': after},
              'matched_12_to_60_seconds': {'old': previous_metrics, 'new': current_metrics,
                                           'three_reference_recordings_from_prior_local_analysis': references},
              'decoded_peak': round(float(np.abs(new).max()), 4),
              'wav_start_end_100ms_rms_delta_db': round(float(seam_db), 2),
              'checks_passed': True,
              'limits': 'Log-mel distance shows section contrast, not perceived quality. No human listening claimed.'}
    (OUT / 'evaluation.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(json.dumps(report, ensure_ascii=False))


if __name__ == '__main__':
    main()
