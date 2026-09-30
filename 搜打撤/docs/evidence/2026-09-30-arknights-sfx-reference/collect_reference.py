"""Download a small explicit selection of public audio files, not repository code."""
from pathlib import Path
import concurrent.futures
import hashlib
import json
import subprocess
import urllib.request
import numpy as np

OUT = Path(__file__).resolve().parent
REPO = 'PseudoMon/arknights-audio'
BRANCH = 'global-server-voices'
CHOICES = {
    'battle/b_ui': ['b_ui_whoosh.wav', 'b_ui_mark.wav', 'b_ui_alarmenter.wav',
                    'b_ui_rewardappear.wav', 'b_ui_getcast.wav'],
    'battle/b_char': ['b_char_atkboost.wav', 'b_char_dead.wav'],
    'avg': ['d_avg_button.wav', 'd_avg_shufflecards.wav', 'd_gen_transmissionget.wav'],
}


def request(url):
    req = urllib.request.Request(url, headers={'User-Agent': 'Codex-Audio-Reference'})
    with urllib.request.urlopen(req, timeout=30) as response:
        return response.read()


def main():
    selections = []
    for directory, names in CHOICES.items():
        listing = json.loads(request(f'https://api.github.com/repos/{REPO}/contents/{directory}?ref={BRANCH}'))
        by_name = {item['name']: item for item in listing}
        for name in names:
            item = by_name[name]
            assert item['type'] == 'file' and item['size'] < 5_000_000
            selections.append(item)

    def retrieve(item):
        data = request(item['download_url'])
        assert len(data) == item['size']
        assert data[:4] == b'RIFF' and data[8:12] == b'WAVE'
        path = OUT / item['name']
        path.write_bytes(data)
        # Decode through ffmpeg rather than assuming the file extension matches the codec.
        result = subprocess.run(['ffmpeg', '-v', 'error', '-i', str(path), '-ac', '2',
                                 '-ar', '48000', '-f', 'f32le', '-'], check=True, capture_output=True)
        x = np.frombuffer(result.stdout, dtype='<f4').reshape(-1, 2)
        assert len(x) and np.isfinite(x).all()
        record = dict(file=path.name, source_path=item['path'], source_url=item['download_url'],
                      github_blob_sha=item['sha'], sha256=hashlib.sha256(data).hexdigest(),
                      bytes=len(data), decoded_duration_s=round(len(x) / 48000, 3),
                      decoded_peak_dbfs=round(float(20 * np.log10(max(np.max(np.abs(x)), 1e-12))), 2),
                      decode='pass')
        return record, x

    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
        results = list(pool.map(retrieve, selections))

    records, pieces, markers = [], [np.zeros((24000, 2), dtype=np.float32)], []
    cursor = .5
    for record, x in results:
        records.append(record)
        # Preview assembly only: originals remain byte-for-byte unchanged.
        excerpt = x[:4 * 48000].copy()
        fade = min(720, len(excerpt) // 3)
        excerpt[:fade] *= np.linspace(0, 1, fade)[:, None]
        excerpt[-fade:] *= np.linspace(1, 0, fade)[:, None]
        peak = np.max(np.abs(excerpt))
        if peak:
            excerpt *= .42 / peak
        markers.append(dict(file=record['file'], start_s=round(cursor, 3),
                            excerpt_duration_s=round(len(excerpt) / 48000, 3)))
        pieces.extend([excerpt, np.zeros((38400, 2), dtype=np.float32)])
        cursor += len(excerpt) / 48000 + .8
    montage = np.concatenate(pieces).astype('<f4')
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'f32le', '-ar', '48000', '-ac', '2',
                    '-i', '-', '-codec:a', 'libmp3lame', '-q:a', '2',
                    str(OUT / '00-reference-preview.mp3')], input=montage.tobytes(), check=True, capture_output=True)
    subprocess.run(['ffmpeg', '-v', 'error', '-i', str(OUT / '00-reference-preview.mp3'),
                    '-f', 'null', '-'], check=True, capture_output=True)
    report = dict(repository=f'https://github.com/{REPO}', branch=BRANCH,
                  originals_unchanged=True, purpose='Reference only; not licensed game assets',
                  files=records, preview=dict(duration_s=round(cursor, 3), markers=markers,
                  note='At most first four seconds each; preview-only peak adjustment and edge fades'))
    (OUT / 'sources-and-checks.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
    print(json.dumps(dict(count=len(records), downloaded_bytes=sum(r['bytes'] for r in records),
                         files=[dict(file=r['file'], seconds=r['decoded_duration_s'], decode=r['decode']) for r in records],
                         preview_seconds=round(cursor, 3)), ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
