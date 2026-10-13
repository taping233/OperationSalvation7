"""Targeted reference measurements and native instrument audibility probes."""
import concurrent.futures
import copy
import hashlib
import json
import os
import pathlib
import subprocess
import xml.etree.ElementTree as ET
import numpy as np
import soundfile as sf
from scipy.signal import stft, find_peaks

OUT = pathlib.Path(__file__).resolve().parent
ROOT = OUT.parents[2]
LMMS = ROOT / '.tmp/music-workstation/LMMS'
REFERENCES = ROOT / 'docs/evidence/2026-10-12-WF-roguelike-bgm-reference'
PROJECT = OUT / 'battle-shadowtide-30s.mmp'

def reference(name):
    path = REFERENCES / name
    result = subprocess.run(['ffmpeg', '-v', 'error', '-i', str(path), '-t', '60',
        '-ac', '1', '-ar', '22050', '-f', 'f32le', '-'], capture_output=True, check=True)
    x = np.frombuffer(result.stdout, dtype=np.float32)
    frequency, time, spectrum = stft(x, fs=22050, nperseg=1024, noverlap=768)
    power = np.abs(spectrum)**2
    bands = {label: float(power[(frequency >= a) & (frequency < b)].sum()/power.sum())
        for label, a, b in [('below_150hz', 20, 150), ('150_to_1500hz', 150, 1500), ('above_4000hz', 4000, 11026)]}
    onset = np.maximum(np.diff(np.abs(spectrum), axis=1), 0).sum(axis=0)
    frame_rate = 22050/256
    onset -= onset.mean()
    ac = np.correlate(onset, onset, mode='full')[len(onset)-1:]
    lags = np.arange(round(frame_rate*60/180), round(frame_rate*60/85))
    peaks, _ = find_peaks(ac[lags])
    best = sorted(peaks, key=lambda i: ac[lags[i]], reverse=True)[:3]
    return {'file': name, 'sha256': hashlib.sha256(path.read_bytes()).hexdigest(),
        'scope_seconds': len(x)/22050, 'band_energy_fraction': bands,
        'tempo_candidates_bpm': [round(60*frame_rate/lags[i], 2) for i in best],
        'interpretation': 'Partial numerical observations, not exact beat/key transcription or listening claims.'}

def probe(index):
    tree = ET.parse(PROJECT)
    container = tree.find('.//trackcontainer')
    tracks = container.findall('track')
    selected = tracks[index]
    label = selected.get('name')
    for track in tracks:
        if track is not selected:
            container.remove(track)
    for pattern in list(selected.findall('pattern')):
        selected.remove(pattern)
    pattern = ET.SubElement(selected, 'pattern', type='1', pos='0', len='192', steps='16', name='Audibility probe')
    midi = 36 if 'beat' in label else (38 if 'bass' in label else 65)
    ET.SubElement(pattern, 'note', key=str(midi-12), pos='0', len='72', vol='80', pan='0')
    target = OUT/'instrument-probes'
    target.mkdir(exist_ok=True)
    project = target/('probe-%02d.mmp' % index)
    wav = target/('probe-%02d.wav' % index)
    config = target/('probe-%02d-config.xml' % index)
    config.write_bytes((OUT/'lmms-local.xml').read_bytes())
    tree.write(project, encoding='utf-8', xml_declaration=True)
    startup = subprocess.STARTUPINFO()
    startup.dwFlags |= subprocess.STARTF_USESHOWWINDOW
    startup.wShowWindow = 0
    with (target/('probe-%02d.log' % index)).open('wb') as log:
        subprocess.run([str(LMMS/'lmms.exe'), '-c', str(config), 'render',
            os.path.relpath(project, LMMS), '-o', os.path.relpath(wav, LMMS), '-s', '48000',
            '-a', '-i', 'sincbest'], cwd=LMMS, stdout=log, stderr=subprocess.STDOUT,
            startupinfo=startup, check=True, timeout=60)
    x, sr = sf.read(wav, always_2d=True)
    rms = float(20*np.log10(np.sqrt(np.mean(x[:sr]**2))+1e-15))
    return {'track': label, 'file': wav.relative_to(OUT).as_posix(), 'bytes': wav.stat().st_size,
        'method': 'Native LMMS isolated instrument render from the delivered project',
        'rms_first_second_dbfs': rms, 'audible_signal': rms > -75,
        'wav_sha256': hashlib.sha256(wav.read_bytes()).hexdigest()}

if __name__ == '__main__':
    references = [reference(name) for name in ['01-phantom-battle1.m4a', '03-mizuki-battle1.m4a']]
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
        probes = list(pool.map(probe, range(12)))
    report = {'references': references, 'instrument_probes': probes,
        'all_12_tracks_produced_signal': all(p['audible_signal'] for p in probes)}
    (OUT/'reference-and-instrument-check.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
    print(json.dumps(report, ensure_ascii=True), flush=True)
    if not report['all_12_tracks_produced_signal']:
        raise RuntimeError('One or more native instruments did not produce signal')
