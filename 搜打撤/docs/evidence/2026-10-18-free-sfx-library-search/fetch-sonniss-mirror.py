"""Read selected WAV assets from Sonniss's public Google Drive mirrors."""
from concurrent.futures import ThreadPoolExecutor
from html.parser import HTMLParser
from urllib.parse import urlencode
from urllib.request import urlopen
import importlib.util
import json
import re
import sys

from pathlib import Path
BASE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('sonniss', BASE/'fetch-sonniss.py')
source = importlib.util.module_from_spec(spec)
spec.loader.exec_module(source)
IDS = {
    1: '1ndDWhCoq0NgkrJH6ku5MSA65zinEby9r',
    2: '1s9GAn7KBS4jr4NlF_ggTYDrXySCg6HXS',
    3: '16PX5T28pQaEs6S8j-m6ArR16JwQCQNNB',
    4: '1HqMHc0o9Uxv5SmR3KQzx2nHIyrn3sW6M',
    5: '1XL8zDflfC86Asd4D7G1T5N1DJ6hNLQVc',
}

class PublicDownloadForm(HTMLParser):
    def __init__(self):
        super().__init__()
        self.fields = {}
    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == 'input' and attrs.get('name'):
            self.fields[attrs['name']] = attrs.get('value', '')

links = {}
direct_range = source.read_range
def mirror_range(url, header, limit):
    part = int(re.search(r'Bundle([1-5])of5', url).group(1))
    if part not in links:
        initial = 'https://drive.usercontent.google.com/download?'+urlencode({'id':IDS[part], 'export':'download'})
        with urlopen(initial, timeout=45) as response:
            form = PublicDownloadForm()
            form.feed(response.read(65536).decode('utf-8'))
        if form.fields.get('id') != IDS[part] or form.fields.get('confirm') != 't':
            raise RuntimeError('Expected public large-file download form unavailable')
        links[part] = 'https://drive.usercontent.google.com/download?'+urlencode(form.fields)
    return direct_range(links[part], header, limit)
source.read_range = mirror_range

if len(sys.argv) == 1:
    with ThreadPoolExecutor(max_workers=3) as pool:
        indexed = list(pool.map(source.index, range(1, 6)))
    (BASE/'sonniss-mirror-indexes.json').write_text(json.dumps(indexed,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    for group in indexed:
        print('Part',group['part'],len(group['records']),'entries')
        for item in group['records']:
            if any(word in item['name'].lower() for word in ['anime game','board game','system & ui','ui interaction','interface &','melee weapons','tower defense','casino cards']):
                print(item['name'].encode('ascii','backslashreplace').decode())
else:
    records = [r for group in json.loads((BASE/'sonniss-mirror-indexes.json').read_text(encoding='utf-8')) for r in group['records']]
    choices = json.loads((BASE/'sonniss-selection.json').read_text(encoding='utf-8'))
    receipt = []
    for choice in choices:
        matches = [r for r in records if r['name'].endswith(choice['source_filename'])]
        if len(matches) != 1:
            raise RuntimeError('Source filename not unique: '+choice['source_filename'])
        (source.SRC/choice['filename']).parent.mkdir(parents=True,exist_ok=True)
        item = source.extract(matches[0],choice['filename'])
        item['mirror'] = 'https://drive.google.com/file/d/'+IDS[item['part']]+'/view'
        receipt.append({**item,**choice})
    (BASE/'sonniss-receipt.json').write_text(json.dumps({'source':'Sonniss GDC 2026 official Google Drive mirrors','license':'https://sonniss.com/gdc-bundle-license/','files':receipt,'game_installed':False,'tests_run':False,'listening_verified':False},ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print('Downloaded',len(receipt),'source WAV files. No game changes or tests.')
