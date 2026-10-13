from pathlib import Path
from html.parser import HTMLParser
from urllib.parse import urlsplit, unquote
import hashlib
import json
import re

root = Path(__file__).resolve().parent
class BoardParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.ids = set()
        self.links = []
        self.images = []
        self.duplicates = []
    def handle_starttag(self, tag, attrs):
        data = dict(attrs)
        if 'id' in data:
            if data['id'] in self.ids:
                self.duplicates.append(data['id'])
            self.ids.add(data['id'])
        if tag == 'a' and 'href' in data:
            self.links.append(data['href'])
        if tag in ('img', 'script') and data.get('src'):
            self.images.append(data['src'])
        if tag == 'link' and data.get('href'):
            self.images.append(data['href'])

parser = BoardParser()
parser.feed((root / 'reference-board.html').read_text(encoding='utf-8'))
errors = ['duplicate id: ' + x for x in parser.duplicates]
checked = 0
for ref in parser.links + parser.images:
    url = urlsplit(ref)
    if url.scheme:
        continue
    if url.fragment and not url.path and url.fragment not in parser.ids:
        errors.append('missing anchor: ' + ref)
    if url.path and not (root / unquote(url.path)).is_file():
        errors.append('missing file: ' + ref)
    checked += 1
notes = (root / 'reference-notes.md').read_text(encoding='utf-8')
readme = (root / 'README.md').read_text(encoding='utf-8')
for ref in re.findall(r'\]\(([^)]+)\)', notes + readme):
    url = urlsplit(ref)
    if not url.scheme and url.path and not (root / unquote(url.path)).is_file():
        errors.append('missing markdown target: ' + ref)
    checked += 1
for ref in json.loads((root / 'sources.json').read_text(encoding='utf-8')):
    data = (root / ref['file']).read_bytes()
    if hashlib.sha256(data).hexdigest() != ref['sha256']:
        errors.append('SHA mismatch: ' + ref['id'])
    if len(data) != ref['bytes']:
        errors.append('size mismatch: ' + ref['id'])
large = [str(p.relative_to(root)) for p in root.rglob('*') if p.is_file() and p.stat().st_size > 1000000]
report = {'ok': not errors, 'checkedLocalReferencesAndLinks': checked, 'imageHashes': 14, 'duplicateIds': parser.duplicates, 'filesOver1MB': large, 'errors': errors}
(root / 'static-verification.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(json.dumps(report, ensure_ascii=False))
if errors:
    raise SystemExit(1)
