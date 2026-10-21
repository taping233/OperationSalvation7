"""Encode review candidates and record provenance; does not install game assets."""
import hashlib
import json
import sys
from pathlib import Path
from PIL import Image

evidence = Path(__file__).resolve().parent
root = evidence.parents[3]
out = root / '.tmp/imagegen/missing-transition-20261021'
simple = '--simple' in sys.argv
prefix = 'simple' if simple else 'builtin'
request = json.loads((evidence / (prefix + '-requests.json')).read_text(encoding='utf-8'))
items = []
for spec in request['specs']:
    png = out / (spec['id'] + ('-simple' if simple else '') + '.png')
    webp = png.with_suffix('.webp')
    with Image.open(png) as im:
        im.load()
        size = list(im.size)
        im.save(webp, 'WEBP', quality=94, method=6)
    with Image.open(webp) as im:
        im.load()
        assert list(im.size) == size
    def entry(path):
        return {'path': path.relative_to(root).as_posix(), 'sha256': hashlib.sha256(path.read_bytes()).hexdigest(), 'bytes': path.stat().st_size}
    items.append({'id': spec['id'], 'name': spec['name'], 'size': size, 'png': entry(png), 'webp': entry(webp), 'inputs': [entry(Path(p)) for p in spec['references']]})
receipt = {'generator': 'Built-in ImageGen', 'thread': '01a15d1f-7909-72c0-b18e-bc233d425b5f', 'status': 'seven review candidates complete; not installed', 'prompts': prefix + '-requests.json', 'encoding': 'WebP quality=94 method=6; original dimensions retained', 'items': items}
(evidence / (prefix + '-receipt.json')).write_text(json.dumps(receipt, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(json.dumps({'count': len(items), 'sizes': [i['size'] for i in items], 'webpBytes': [i['webp']['bytes'] for i in items]}, ensure_ascii=False))
