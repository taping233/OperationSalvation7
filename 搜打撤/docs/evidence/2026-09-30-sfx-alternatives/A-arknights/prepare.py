from pathlib import Path
import json, urllib.request, hashlib, subprocess, re
import numpy as np

HERE = Path(__file__).resolve().parent
PROJECT = HERE.parents[3]
RAW = HERE / 'originals'
RAW.mkdir(parents=True, exist_ok=True)
HEADERS = {'User-Agent': 'Friday-Arknights-SFX-sample'}

def fetch(url):
    return urllib.request.urlopen(urllib.request.Request(url, headers=HEADERS), timeout=30).read()

requests = [
    ('Cromemadnd/ArknightsUI-React-Template', 'main', 'public/click.wav', 'ui-recorded-click.wav'),
    ('misaka10843/arknights-h5', 'master', 'voice/button.wav', 'ui-home-button.wav'),
    ('PseudoMon/arknights-audio', 'global-server-voices', 'avg/d_avg_glass_break.wav', 'd_avg_glass_break.wav'),
]
records = []
for repo, branch, path, name in requests:
    meta = json.loads(fetch(f'https://api.github.com/repos/{repo}/contents/{path}?ref={branch}'))
    data = fetch(meta['download_url'])
    (RAW / name).write_bytes(data)
    records.append(dict(file=name, repository=f'https://github.com/{repo}', branch=branch,
                        source_path=path, source_url=meta['download_url'], github_blob_sha=meta['sha'],
                        sha256=hashlib.sha256(data).hexdigest(), bytes=len(data)))

contexts = []
for repo, branch, paths in [
    ('Cromemadnd/ArknightsUI-React-Template', 'main', ['src/App.tsx', 'src/components/Buttons.tsx', 'README.md']),
    ('misaka10843/arknights-h5', 'master', ['index.html', 'README.md']),
]:
    for path in paths:
        url = f'https://raw.githubusercontent.com/{repo}/{branch}/{path}'
        try:
            lines = fetch(url).decode('utf-8').splitlines()
            selected = set()
            for i, line in enumerate(lines):
                if re.search(r'click.wav|button.wav|clickSound|yinxiao|audio|playSound|音效|版权|录制|商用', line, re.I):
                    selected.update(range(max(0, i-2), min(len(lines), i+4)))
            contexts.append(dict(url=url, excerpts=[dict(line=i+1,text=lines[i]) for i in sorted(selected)]))
        except Exception as exc:
            contexts.append(dict(url=url, error=str(exc)))
(HERE / 'new-source-metadata.json').write_text(json.dumps(dict(files=records, contexts=contexts), ensure_ascii=False, indent=2), encoding='utf-8')

for record in records:
    path = RAW / record['file']
    out = subprocess.run(['ffmpeg','-v','error','-i',str(path),'-ac','2','-ar','48000','-f','f32le','-'], check=True,capture_output=True).stdout
    a = np.frombuffer(out, dtype='<f4').reshape(-1,2)
    print(record['file'], 'seconds',round(len(a)/48000,4),'peak',round(float(np.max(abs(a))),4))
print('contexts', json.dumps(contexts, ensure_ascii=True)[:7000])
