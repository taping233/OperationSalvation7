import hashlib
import json
import shutil
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

HERE = Path(__file__).resolve().parent
PROJECT = HERE.parents[2]
ROOT = PROJECT.parent
OUT = ROOT / '.tmp/imagegen/transition-12-16-remake-1021'
OUT.mkdir(parents=True, exist_ok=True)
names = ['紧急撤离点', '事件入口', '跨层移动', '返回探索', '共用加载等待']
keys = ['12-emergency-exit', '13-event', '14-layer-passage', '15-map-return', '16-loading']
requests = json.loads((HERE / 'builtin-requests.json').read_text(encoding='utf-8'))
receipt = {'pipeline': 'NAI4.5 Full new draft then built-in ImageGen redraw', 'installed': False,
           'style': 'docs/production/art/ART-STYLE-V1.md; approved base pair plus fusion reference-09',
           'user_correction': '不要有过多的细节 去掉ai味', 'items': [], 'reference_sha256': {}}
font = ImageFont.truetype('C:/Windows/Fonts/msyh.ttc', 23)
small = ImageFont.truetype('C:/Windows/Fonts/msyh.ttc', 17)
board = Image.new('RGB', (1440, 1020), '#111b23')
draw = ImageDraw.Draw(board)
draw.text((22, 15), '12—16 过场重做 · 简化版候选', font=font, fill='#edf0ed')
draw.text((22, 53), 'NAI 4.5新底稿 → 项目默认画风内置重绘｜未接入游戏', font=small, fill='#adbac4')
for index, item in enumerate(requests['items']):
    key = keys[index]
    target = OUT / f'{key}-simple-v2.png'
    shutil.copy2(item['source'], target)
    with Image.open(target) as original:
        original.load()
        im = original.convert('RGB')
    webp = target.with_suffix('.webp')
    im.save(webp, 'WEBP', quality=94, method=6)
    nai = json.loads((HERE / f'{key}-nai-request.json').read_text(encoding='utf-8'))
    receipt['items'].append({'id': key, 'name': names[index], 'size': im.size,
        'png': str(target.relative_to(ROOT)), 'png_sha256': hashlib.sha256(target.read_bytes()).hexdigest(),
        'webp': str(webp.relative_to(ROOT)), 'webp_sha256': hashlib.sha256(webp.read_bytes()).hexdigest(),
        'nai_source': nai['output'], 'nai_sha256': nai['sha256']})
    im.thumbnail((690, 390))
    x = 15 + index % 2 * 720
    y = 92 + index // 2 * 306
    # Board previews use equal 16:9 cells without changing the saved originals.
    im.thumbnail((690, 258))
    board.paste(im, (x + (690-im.width)//2, y))
    draw.text((x, y+267), f'{index+12}  {names[index]}', font=small, fill='#edf0ed')
for ref in requests['items'][0]['request']['referenced_image_paths'][1:]:
    receipt['reference_sha256'][ref] = hashlib.sha256(Path(ref).read_bytes()).hexdigest()
board.save(OUT/'review-board.jpg', quality=93)
(HERE/'receipt.json').write_text(json.dumps(receipt, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
print('Saved five PNG/WebP pairs and review-board.jpg. All sources decoded; no runtime changes.')
