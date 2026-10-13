import concurrent.futures
import hashlib
import json
import pathlib
import subprocess
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parent
HEADERS = {'User-Agent': 'Mozilla/5.0', 'Referer': 'https://www.bilibili.com/'}
TRACKS = [
    ('01-phantom-battle1', 'BV1Ar4y1U7nq', 3),
    ('02-phantom-battle2', 'BV1Ar4y1U7nq', 5),
    ('03-mizuki-battle1', 'BV1wg411e7QT', 11),
    ('04-mizuki-battle2', 'BV1wg411e7QT', 12),
    ('05-sami-hunt', 'BV1hM4y1x7ar', 5),
    ('06-sami-soulcall', 'BV1hM4y1x7ar', 6),
    ('07-sami-annihilation', 'BV1hM4y1x7ar', 7),
]

def get(url):
    return urllib.request.urlopen(urllib.request.Request(url, headers=HEADERS), timeout=40)

def download(track):
    name, bvid, page = track
    info = json.load(get('https://api.bilibili.com/x/web-interface/view?bvid=' + bvid))
    if info['code'] != 0:
        raise RuntimeError(info)
    part = info['data']['pages'][page - 1]
    play = json.load(get('https://api.bilibili.com/x/player/playurl?bvid=%s&cid=%s&fnval=16&qn=64' % (bvid, part['cid'])))
    if play['code'] != 0:
        raise RuntimeError(play)
    audio = max(play['data']['dash']['audio'], key=lambda a: a['bandwidth'])
    target = ROOT / (name + '.m4a')
    with get(audio.get('baseUrl') or audio['base_url']) as response:
        target.write_bytes(response.read())
    subprocess.run(['ffmpeg', '-v', 'error', '-i', str(target), '-f', 'null', '-'], check=True)
    digest = hashlib.sha256(target.read_bytes()).hexdigest()
    print(name + ' OK', flush=True)
    return {'file': target.name, 'part': part['part'], 'source': 'https://www.bilibili.com/video/%s/?p=%s' % (bvid, page), 'bytes': target.stat().st_size, 'sha256': digest, 'duration': part['duration'], 'method': 'Public Bilibili DASH audio stream; original AAC retained; ffmpeg full decode passed.'}

if __name__ == '__main__':
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
        results = list(pool.map(download, TRACKS))
    (ROOT / 'sources.json').write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding='utf-8')
