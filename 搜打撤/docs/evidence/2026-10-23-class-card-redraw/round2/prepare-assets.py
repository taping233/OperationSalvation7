"""Preserve generated sources and export uniform square review candidates."""
from pathlib import Path
from PIL import Image, ImageOps, ImageDraw, ImageFont
import hashlib, json, shutil

HERE = Path(__file__).resolve().parent
EVIDENCE = HERE.parent
PROJECT = EVIDENCE.parents[2]
ROOT = PROJECT.parent
DEST = PROJECT / 'game/art-source/class-card-redraw-20261023/v2'
PNGS = ROOT / '.tmp/imagegen/class-card-feedback-v2-1023'
DEST.mkdir(parents=True, exist_ok=True)
PNGS.mkdir(parents=True, exist_ok=True)
read = lambda p: json.loads(p.read_text('utf-8'))
sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
latest = {x['card_id']: x for x in read(HERE / 'receipt.json')['items']}
assert len(latest) == 12
items = []
for original in read(EVIDENCE / 'receipt.json')['items']:
    item = dict(original)
    cid = item['card_id']
    item['previous_webp'] = original['webp']
    if cid in latest:
        edit = latest[cid]
        source = Path(edit['source'])
        png = PNGS / (cid + '.png')
        webp = DEST / (cid + '.webp')
        shutil.copy2(source, png)
        with Image.open(png) as raw:
            raw = ImageOps.exif_transpose(raw).convert('RGB')
            w, h = raw.size
            side = min(w, h)
            box = ((w-side)//2, (h-side)//2, (w+side)//2, (h+side)//2)
            square = raw.crop(box).resize((1254, 1254), Image.Resampling.LANCZOS)
            square.save(webp, 'WEBP', quality=94, method=6)
        item.update(source=str(source), png=str(png), webp=str(webp),
                    source_size=[w,h], crop_box=list(box), size=[1254,1254],
                    source_sha256=sha(source), png_sha256=sha(png), webp_sha256=sha(webp),
                    revision=2, status='revised-candidate-not-installed')
    else:
        item.update(revision=1, status='owner-approved-preserved')
    with Image.open(item['webp']) as checked:
        assert checked.size == (1254,1254), (cid, checked.size)
    items.append(item)
manifest = dict(status='12-revised-4-preserved', runtime_replaced=False,
                edited_unique=12, generation_attempts=len(read(HERE/'receipt.json')['items']),
                feedback_sha256=sha(EVIDENCE/'feedback.json'), items=items)
(HERE/'final-receipt.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2), 'utf-8')
board = Image.new('RGB', (1280,1456), '#171b22')
draw = ImageDraw.Draw(board)
font = ImageFont.truetype('C:/Windows/Fonts/msyh.ttc', 17)
for i,item in enumerate(items):
    x,y = (i%4)*320, (i//4)*364
    with Image.open(item['webp']) as im:
        board.paste(im.resize((312,312), Image.Resampling.LANCZOS), (x+4,y+4))
    label = ('V2 ' if item['revision']==2 else 'KEEP ') + item['name']
    draw.text((x+8,y+325), label, fill='#eef0f5', font=font)
board.save(DEST/'overview.jpg', quality=92)
print(json.dumps(dict(edited=12,preserved=4,attempts=manifest['generation_attempts'],
                     cropped=[dict(id=x['card_id'],size=x['source_size'],box=x['crop_box']) for x in items if x['revision']==2 and x['source_size'][0]!=x['source_size'][1]]), ensure_ascii=True))
