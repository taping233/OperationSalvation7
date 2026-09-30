"""Download audio data and source/license evidence only; no external code is executed."""
from pathlib import Path
from html.parser import HTMLParser
from urllib.request import Request, urlopen
from urllib.parse import urljoin, urlparse
from concurrent.futures import ThreadPoolExecutor
import json
import zipfile
import hashlib
import soundfile as sf

ROOT = Path(__file__).resolve().parent
MATERIALS = ROOT / 'materials'
MATERIALS.mkdir(parents=True, exist_ok=True)
PAGES = [
    ('starninjas-swords', 'https://opengameart.org/content/20-sword-sound-effects-attacks-and-clashes'),
    ('vehicle-tinysized', 'https://opengameart.org/content/fantasy-sound-effects-tinysized-sfx'),
    ('rubberduck-rpg', 'https://opengameart.org/content/80-cc0-rpg-sfx'),
    ('rubberduck-breaks', 'https://opengameart.org/content/75-cc0-breaking-falling-hit-sfx'),
]

class Links(HTMLParser):
    def __init__(self):
        super().__init__()
        self.links = []
    def handle_starttag(self, tag, attrs):
        if tag == 'a':
            self.links.extend(v for k, v in attrs if k == 'href' and v)

def fetch(url):
    with urlopen(Request(url, headers={'User-Agent': 'Mozilla/5.0 (source-license-audit)'}), timeout=40) as response:
        return response.read()

def download_pack(item):
    slug, page = item
    html = fetch(page)
    (ROOT / (slug + '-source.html')).write_bytes(html)
    parser = Links()
    parser.feed(html.decode('utf-8', errors='replace'))
    urls = list(dict.fromkeys(urljoin(page, link) for link in parser.links if urlparse(link).path.lower().endswith('.zip')))
    result = {'slug': slug, 'pageUrl': page, 'license': 'CC0-1.0', 'downloads': []}
    for index, url in enumerate(urls):
        data = fetch(url)
        archive = MATERIALS / (slug + '-' + str(index) + '.zip')
        archive.write_bytes(data)
        unpack = MATERIALS / slug
        unpack.mkdir(exist_ok=True)
        download = {'url': url, 'archive': str(archive.relative_to(ROOT)), 'sha256': hashlib.sha256(data).hexdigest(), 'files': []}
        with zipfile.ZipFile(archive) as z:
            for entry in z.infolist():
                suffix = Path(entry.filename).suffix.lower()
                is_audio = suffix in {'.wav', '.ogg', '.mp3', '.flac'}
                is_license = suffix == '.txt' and any(word in entry.filename.lower() for word in ('license', 'licence', 'readme'))
                if entry.is_dir() or not (is_audio or is_license):
                    continue
                # Keep archive-relative names, check final target is inside this task's materials.
                destination = (unpack / entry.filename).resolve()
                if unpack.resolve() not in destination.parents:
                    raise ValueError('Unsafe archive path: ' + entry.filename)
                destination.parent.mkdir(parents=True, exist_ok=True)
                destination.write_bytes(z.read(entry))
                file_record = {'archivePath': entry.filename, 'localPath': str(destination.relative_to(ROOT)), 'bytes': entry.file_size}
                if is_audio:
                    try:
                        info = sf.info(str(destination))
                        file_record.update({'seconds': round(info.duration, 4), 'rate': info.samplerate, 'channels': info.channels})
                    except Exception as exc:
                        file_record['decodeNote'] = str(exc)
                download['files'].append(file_record)
        result['downloads'].append(download)
    print(json.dumps(result, ensure_ascii=False), flush=True)
    return result

if __name__ == '__main__':
    with ThreadPoolExecutor(max_workers=4) as pool:
        results = list(pool.map(download_pack, PAGES))
    (ROOT / 'source-inventory.json').write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding='utf-8')
