import hashlib, json, shutil
from pathlib import Path
from PIL import Image

here = Path(__file__).resolve().parent
project = here.parents[3]
assets = project / 'game' / 'assets' / 'icons' / 'base-v3'
assets.mkdir(parents=True, exist_ok=True)
receipt_file = here / 'receipts.json'
receipt = json.loads(receipt_file.read_text(encoding='utf-8'))
for job in receipt['jobs']:
    if job.get('outputPath') and (project / job['outputPath']).exists():
        continue
    if not job.get('source'):
        continue
    source = Path(job['source'])
    raw = here / ('raw-' + job['id'] + '.png')
    shutil.copy2(source, raw)
    if job.get('status') == 'rejected':
        job.update(rawPath=str(raw.relative_to(project)), sha256=hashlib.sha256(raw.read_bytes()).hexdigest(), rawBytes=raw.stat().st_size, visualReview='rejected')
        continue
    image = Image.open(raw).convert('RGBA')
    size = 1920 if job['id'].startswith('base-home') else 720 if job['id'].startswith('companion-') else 480
    image.thumbnail((size, size), Image.Resampling.LANCZOS)
    output = assets / (job['id'] + '.webp')
    image.save(output, 'WEBP', quality=88, method=6)
    job.update(rawPath=str(raw.relative_to(project)), outputPath=str(output.relative_to(project)), sha256=hashlib.sha256(raw.read_bytes()).hexdigest(), rawBytes=raw.stat().st_size, outputBytes=output.stat().st_size, width=image.width, height=image.height, alphaExtrema=image.getchannel('A').getextrema(), visualReview='passed')
receipt_file.write_text(json.dumps(receipt, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(json.dumps([{'id':j['id'],'outputPath':j.get('outputPath'),'size':[j.get('width'),j.get('height')],'bytes':j.get('outputBytes'),'alpha':j.get('alphaExtrema')} for j in receipt['jobs']], ensure_ascii=True))
