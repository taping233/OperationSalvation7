"""Prepare preview-only PNGs and a board; no runtime game assets are modified."""
import hashlib
import html
import json
import shutil
import statistics
from pathlib import Path
from PIL import Image

here = Path(__file__).resolve().parent
root = here.parents[2]
assets = root / 'game/art-source/card-paper-rarity-20261015'
board = root / 'docs/previews/card-paper-rarity-20261015'
current = assets / 'current.json'
request_path = root / json.loads(current.read_text(encoding='utf-8'))['request'] if current.exists() else here / 'request.json'
request = json.loads(request_path.read_text(encoding='utf-8'))
board.mkdir(parents=True, exist_ok=True)
records, articles, career_articles = [], [], []
colors = dict(initial='#d8dfe1', common='#e9e8e1', rare='#9ed5f5', epic='#ddbcf5', legendary='#e4c88d', prism='#dfcef0', token='#b5d9d4', career='#adbed5')

def extent(values):
    middle = len(values) // 2
    left = next(i + 1 for i in range(middle, -1, -1) if values[i] >= 160)
    right = next(i for i in range(middle, len(values)) if values[i] >= 160)
    return left, right

for item in request['items']:
    source = Path(item['source'])
    filename = item.get('filename', item['key'] + '.png')
    destination = assets / filename
    if destination.exists() and destination.read_bytes() != source.read_bytes():
        raise FileExistsError('Changed preview source: ' + str(destination))
    image = Image.open(source).convert('RGBA')
    w, h = image.size
    alpha = image.getchannel('A')
    if alpha.getpixel((w // 2, h // 2)) != 0:
        raise ValueError(item['key'] + ': opaque aperture')
    horizontal = [extent([alpha.getpixel((x, round(h * f))) for x in range(w)]) for f in (.35, .5, .65)]
    vertical = [extent([alpha.getpixel((round(w * f), y)) for y in range(h)]) for f in (.3, .5, .7)]
    left, right = [round(statistics.median(v[i] for v in horizontal)) for i in range(2)]
    top, bottom = [round(statistics.median(v[i] for v in vertical)) for i in range(2)]
    scale = 232 / (right - left)
    card_height = (bottom - top) * scale
    if not destination.exists():
        shutil.copy2(source, destination)
    digest = hashlib.sha256(destination.read_bytes()).hexdigest()
    records.append(dict(key=item['key'], label=item['label'], path=destination.relative_to(root).as_posix(), source=str(source), sha256=digest, bytes=destination.stat().st_size, width=w, height=h, opening=[left, top, right, bottom], display=dict(width=w*scale, left=-left*scale, top=-top*scale, apertureHeight=card_height)))
    key, label = item['key'], html.escape(item['label'])
    is_career = item.get('group') == 'career'
    rarity = 'career' if is_career else key
    note = html.escape(item['note'])
    frame = '../../../game/art-source/card-paper-rarity-20261015/' + filename
    symbols = dict(initial='·', common='—', rare='◆', epic='✦', legendary='☀', prism='✧', token='┄', career='⚔')
    prism = f'<div class="prism-halo" aria-hidden="true" style="left:{-left*scale:.4f}px;top:{-top*scale:.4f}px;width:{w*scale:.4f}px;height:{h*scale:.4f}px"></div><div class="prism-sheen" aria-hidden="true"></div>' if key == 'prism' else ''
    card = item.get('card', dict(name='元素爆裂', type='法术', cost=2, description='对随机敌人造成2点法术伤害；本牌的伤害效果触发4–5次。', art='cards/spell-tt12-elemburst.webp'))
    name, card_type, description = [html.escape(str(card[field])) for field in ('name', 'type', 'description')]
    class_name = 'sample dense' if len(card['description']) > 48 else 'sample'
    pigment = f";--pigment:{item['pigment']};--wash:{item['pigment']};--pale:{item['accent']}" if item.get('pigment') else ''
    symbol = item.get('symbol', symbols[rarity])
    caption = html.escape(card.get('caption', item['label'])) if is_career else label
    article = f'''<article class="{class_name}" data-rarity="{rarity}" data-frame="{key}" style="--ink:{item.get('accent', colors[rarity])};--frame-image:url('{frame}'){pigment}">
<div class="card" style="height:{card_height:.4f}px">
<div class="art"><img src="/assets/{card['art']}" alt="{name}卡图"></div>
<div class="copy"><h2>{name}</h2><p>{description}</p><span class="ink-strokes" aria-hidden="true"></span></div>
<span class="type">{card_type}</span><span class="quality-seal"><span aria-hidden="true">{symbol}</span> {label}</span>{prism}
<img class="frame" src="{frame}" alt="{label}纸边框" style="left:{-left*scale:.4f}px;top:{-top*scale:.4f}px;width:{w*scale:.4f}px;height:auto">
<span class="cost" aria-label="费用{card['cost']}">{card['cost']}</span></div><div class="caption"><h3>{caption}</h3><p>{note}</p></div></article>'''
    (career_articles if is_career else articles).append(article)

page = '''<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>纸边笔痕 · 品质参考板</title><link rel="stylesheet" href="./board.css"><link rel="stylesheet" href="./paper-face.css"></head>
<body><main><header><div class="eyebrow">代号柒 / PAPER & INK</div><h1>纸边笔痕 · 品质参考板</h1><p>初始 → 古朴 → 稀有 → 史诗 → 传说 → 棱彩，逐级增加叠层、角饰与绘制细节。衍生与职业为独立样式。</p><label class="mode"><input id="frame-only" type="checkbox">只看边框</label></header>
<nav class="board-tabs" aria-label="展示分组"><button type="button" data-group="quality" aria-pressed="true">品质框 8</button><button type="button" data-group="career" aria-pressed="false">职业专属框 5</button></nav>
<section id="quality" class="gallery" aria-label="八档纸边品质框">''' + '\n'.join(articles) + '''</section><section id="career" class="gallery" aria-label="五人职业专属框" hidden>''' + '\n'.join(career_articles) + '''</section><footer>纸边卡面已统一实装 · 此页为设计对照</footer></main>
<script>document.querySelector('#frame-only').addEventListener('change', e => document.body.classList.toggle('frame-only',e.target.checked));document.querySelectorAll('[data-group]').forEach(button=>button.addEventListener('click',()=>{document.querySelectorAll('[data-group]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));document.querySelectorAll('section.gallery').forEach(section=>section.hidden=section.id!==button.dataset.group);}));</script></body></html>'''
(board / 'index.html').write_text(page, encoding='utf-8')
(assets / 'geometry.json').write_text(json.dumps(records, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
(request_path.parent / 'receipt.json').write_text(json.dumps(dict(assets=records, recovery='各PNG不进Git，按source复制到path并核对SHA256', scope='参考板候选；未测试、未构建、未提交'), ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
print(json.dumps(dict(board='docs/previews/card-paper-rarity-20261015/index.html', frames=len(records), display='same artwork, proportional frame scaling'), ensure_ascii=False))
