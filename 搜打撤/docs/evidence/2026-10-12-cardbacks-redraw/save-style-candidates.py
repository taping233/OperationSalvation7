"""Save the requested three approval candidates; leave runtime assets unchanged."""
import hashlib
import json
import shutil
import sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

EVIDENCE = Path(__file__).resolve().parent
PROJECT = EVIDENCE.parents[2]
SERIES = 'gacha' if '--gacha' in sys.argv[1:] else 'style'
RAW = PROJECT / ('.tmp/imagegen/cardbacks-' + SERIES + '-approval-20261012')
request = json.load(sys.stdin)
if RAW.exists():
    raise SystemExit('Approval candidate directory exists; preserve the previous run.')
RAW.mkdir(parents=True)
sheet = Image.new('RGB', (3 * 344, 568), '#202020')
draw = ImageDraw.Draw(sheet)
font = ImageFont.truetype('C:/Windows/Fonts/msyh.ttc', 18)
receipt = {'status': 'awaiting-user-style-approval', 'sample': '富商锦缎',
           'workflow': 'Existing NAI theme seed and game visual references; built-in ImageGen candidates' if SERIES == 'gacha' else 'Existing NAI draft and framed ImageGen composition; three built-in style edits',
           'runtime_assets': 'Unchanged by these candidates', 'items': []}
for index, version in enumerate(request):
    source = Path(version['generated_source'])
    saved = RAW / (version['id'] + '-source.png')
    shutil.copy2(source, saved)
    with Image.open(source) as original:
        image = original.convert('RGB').resize((512, 768), Image.Resampling.LANCZOS)
    preview = EVIDENCE / (SERIES + '-' + version['id'].lower() + '.webp')
    image.save(preview, 'WEBP', quality=90, method=6)
    thumb = image.resize((320, 480), Image.Resampling.LANCZOS)
    sheet.paste(thumb, (index * 344 + 12, 12))
    draw.text((index * 344 + 14, 510), version['id'] + '  ' + version['name'], fill='#eeeeee', font=font)
    receipt['items'].append({'id': version['id'], 'name': version['name'],
                            'basis': version.get('basis'), 'reference_page': version.get('reference_page'),
                            'preview': preview.relative_to(PROJECT).as_posix(),
                            'preview_sha256': hashlib.sha256(preview.read_bytes()).hexdigest(),
                            'raw': saved.relative_to(PROJECT).as_posix(),
                            'raw_sha256': hashlib.sha256(saved.read_bytes()).hexdigest(),
                            'generated_source': str(source)})
sheet.save(EVIDENCE / (SERIES + '-comparison.webp'), 'WEBP', quality=90, method=6)
(EVIDENCE / (SERIES + '-approval-request.json')).write_text(json.dumps(request, ensure_ascii=False, indent=2), encoding='utf-8')
(EVIDENCE / (SERIES + '-approval-receipt.json')).write_text(json.dumps(receipt, ensure_ascii=False, indent=2), encoding='utf-8')
print('Saved three style candidates and comparison; runtime assets unchanged.')
