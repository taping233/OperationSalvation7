"""Fetch selected full-quality Mixkit WAV downloads; preserve original bytes."""
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from urllib.request import urlopen, Request
import hashlib
import html
import json
import re
import subprocess

BASE = Path(__file__).resolve().parent
ROOT = BASE.parents[2]
SRC = BASE / 'sources'
OUT = ROOT / 'game/assets/sfx/mixkit-1018'
OUT.mkdir(parents=True, exist_ok=True)
ids = [2568,1109,2573,2574,2575,2576,2577,2578,2569,2020,2021,269,2018,2015,270,3083,
       2380,1530,1104,1101,268,2583,2153,2158,2166,2761,2771,2160,2765,2795,2794,2141,
       2589,873,2999,863,2628,2345,2584,600]
catalog = {}
for page in SRC.glob('mixkit-*.html'):
    for part in page.read_text(encoding='utf-8').split('data-audio-player-item-id-value=')[1:]:
        item = int(part.split('"')[1])
        title = re.search(r'<h2[^>]*>(.*?)</h2>', part, re.S)
        if title:
            catalog[item] = {'title':html.unescape(re.sub('<[^>]+>','',title.group(1))).strip(),
                             'source':'https://mixkit.co/free-sound-effects/'+page.stem[7:]+'/'}

def fetch(item):
    metadata = catalog[item]
    endpoint = f'https://mixkit.co/free-sound-effects/download/{item}/?context=item+grid'
    modal = SRC/f'download-{item}.html'
    if modal.exists():
        url = re.search(r'data-download--modal-url-value="([^"]+)"',modal.read_text(encoding='utf-8')).group(1)
    else:
        # Same full WAV CDN layout disclosed by the downloaded item-2568 modal.
        url = f'https://assets.mixkit.co/active_storage/sfx/{item}/{item}.wav'
    file = OUT/f'{item}.wav'
    raw = file.read_bytes() if file.exists() else urlopen(Request(html.unescape(url),headers={'User-Agent':'Mozilla/5.0'}),timeout=90).read()
    if not file.exists():
        file.write_bytes(raw)
    # Duration is source metadata for the existing audition catalog, not a playback test.
    info=json.loads(subprocess.check_output(['ffprobe','-v','quiet','-show_format','-show_streams','-of','json',str(file)]))
    return {'path':f'sfx/mixkit-1018/{item}.wav','ext':'wav','license':'Mixkit Sound Effects Free License — licensed for incorporation in video games; no standalone/source redistribution',
            'source':metadata['source'],'title':metadata['title'],'download_page':endpoint,'download_url':html.unescape(url),
            'bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest(),'processing':'none; original full-quality WAV bytes preserved; runtime gain only',
            'seconds':float(info['format']['duration']),'sample_rate':int(info['streams'][0]['sample_rate']),'channels':info['streams'][0]['channels']}

with ThreadPoolExecutor(max_workers=2) as pool:
    files=list(pool.map(fetch,ids))
(BASE/'receipt.json').write_text(json.dumps({'source':'Mixkit','license_url':'https://mixkit.co/license/#sfxFree',
    'license_snapshot':'sources/sfx-license.html','listening_verified':False,'tests_run':False,'files':files},ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps({'downloaded':len(files),'total_bytes':sum(x['bytes'] for x in files)},ensure_ascii=False))
print('\n'.join(f"{x['path']} {x['title']} {x['seconds']:.2f}s" for x in files))
