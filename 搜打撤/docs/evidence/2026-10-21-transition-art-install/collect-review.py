import base64
import hashlib
import io
import json
import shutil
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[3]
HERE = Path(__file__).resolve().parent
VIS = Path('C:/Users/太平/.codex/visualizations/2026/10/20/01a15a22-8b3e-7611-97f9-321deb86583d/transition-art-review.html')
OUTPUT = ROOT.parent / '.tmp/nai/transition-art-sample-20261021'
rows = json.loads((HERE / 'inventory.json').read_text(encoding='utf-8'))
for row in rows:
    if row['path']:
        path = Path(row['path'])
        if not path.is_absolute():
            path = ROOT / path
        assert path.is_file(), str(path)
        row['sha256'] = hashlib.sha256(path.read_bytes()).hexdigest()
        with Image.open(path) as original:
            row['size'] = list(original.size)
            preview = original.convert('RGB')
            preview.thumbnail((640, 400), Image.Resampling.LANCZOS)
            buffer = io.BytesIO()
            preview.save(buffer, format='WEBP', quality=73, method=6)
            row['thumbnail'] = 'data:image/webp;base64,' + base64.b64encode(buffer.getvalue()).decode('ascii')
        if row['id'] in ('22', '23'):
            target = OUTPUT / ('corrected-original-v2.png' if row['id'] == '22' else 'expanded-rejected-v1.png')
            if not target.exists():
                shutil.copy2(path, target)
            assert hashlib.sha256(target.read_bytes()).hexdigest() == row['sha256']
            request_file = HERE / ('correction-request.json' if row['id'] == '22' else 'request.json')
            record = json.loads(request_file.read_text(encoding='utf-8'))
            record.update(status='generated-awaiting-user-selection' if row['id'] == '22' else 'generated-user-rejected',
                          output=str(target), originalOutput=str(path), sha256=row['sha256'], size=row['size'],
                          integration='未接入；老板要求先列现图选择，生产代码/运行素材未修改')
            request_file.write_text(json.dumps(record, ensure_ascii=False, indent=2), encoding='utf-8')
html = VIS.read_text(encoding='utf-8')
assert html.count('__INVENTORY_JSON__') == 1, 'Review already materialized; do not overwrite.'
html = html.replace('__INVENTORY_JSON__', json.dumps(rows, ensure_ascii=False).replace('</', '<\/'))
assert len(html.encode('utf-8')) < 1_000_000
assert '\\"' not in html and html.lstrip().startswith('<div')
VIS.write_text(html, encoding='utf-8')
summary = [{k: v for k, v in row.items() if k != 'thumbnail'} for row in rows]
(HERE / 'inventory-receipt.json').write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps({'items':len(rows),'images':sum(bool(row['path']) for row in rows),
                  'fragmentBytes':VIS.stat().st_size,'productionChanged':False}, ensure_ascii=False))
