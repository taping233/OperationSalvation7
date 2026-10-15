"""Technical atlas slicing/alignment and lossless encoding; no repaint or alpha keying."""
import hashlib
import json
import shutil
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[3]
SOURCE = ROOT / 'game/art-source/chests/safe-v3'
DEST = ROOT / 'game/assets/scenes/chests/safe-v3'
request = json.loads((SOURCE / 'imagegen-request.json').read_text(encoding='utf-8'))
assert not DEST.exists(), 'Do not overwrite an earlier import.'
DEST.mkdir(parents=True)
records = []
def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()
def record(path, image):
    alpha = image.getchannel('A')
    assert alpha.getextrema()[0] == 0 and alpha.getextrema()[1] > 220
    records.append(dict(path=str(path.relative_to(ROOT / 'game/assets')).replace('\\','/'),
                        bytes=path.stat().st_size, sha256=sha(path), size=list(image.size),
                        alpha_extrema=list(alpha.getextrema())))

for index, item in enumerate(request['images']):
    source = Path(item['source'])
    local = SOURCE / ('safe-atlas.png' if index == 0 else 'burst-source.png')
    assert not local.exists()
    shutil.copy2(source, local)
    item['local_source'] = str(local.relative_to(ROOT)).replace('\\','/')
    item['sha256'] = sha(local)
    with Image.open(local) as image:
        assert image.mode == 'RGBA', 'Real generated alpha required.'
        if index == 0:
            assert image.size == (1536, 1024), image.size
            for frame in range(6):
                col, row = frame % 3, frame // 3
                cell = image.crop((col*512,row*512,(col+1)*512,(row+1)*512))
                # Row two's body was drawn 32px higher; align technical atlas origins.
                aligned = Image.new('RGBA',(512,512))
                aligned.paste(cell,(0,item['row_offsets_y'][row]))
                target = DEST / f'frame-{frame:02}.webp'
                aligned.save(target,'WEBP',lossless=True,method=6)
                record(target,aligned)
        else:
            encoded = image.resize((640,640),Image.Resampling.LANCZOS)
            target = DEST / 'burst.webp'
            encoded.save(target,'WEBP',lossless=True,method=6)
            record(target,encoded)
request['status']='imported'
(SOURCE / 'imagegen-request.json').write_text(json.dumps(request,ensure_ascii=False,indent=2),encoding='utf-8')
receipt = dict(status='imported',processing='Equal-cell cropping, +32px row-two origin alignment, lossless RGBA WebP encoding. Generated alpha preserved, no keying/repainting.',
               assets=records,sources=[{k:item[k] for k in ('local_source','sha256','tool')} for item in request['images']])
(Path(__file__).parent / 'asset-receipt.json').write_text(json.dumps(receipt,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({'assets':len(records),'total_bytes':sum(item['bytes'] for item in records),'receipt':'docs/evidence/2026-10-15-chest-repaint/asset-receipt.json'}))
