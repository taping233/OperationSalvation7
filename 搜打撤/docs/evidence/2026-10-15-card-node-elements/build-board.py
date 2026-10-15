"""Import complete node-style frame candidates and render preview-only comparisons."""
import hashlib
import html
import json
import shutil
import statistics
from pathlib import Path
from PIL import Image

here = Path(__file__).resolve().parent
root = here.parents[2]
assets = root / 'game/art-source/card-node-elements-20261015'
board = root / 'docs/previews/card-node-elements-20261015'
board.mkdir(parents=True, exist_ok=True)
request = json.loads((here / 'request.json').read_text(encoding='utf-8'))
catalog = json.loads((root / 'docs/previews/card-split-20261014/gallery-catalog.json').read_text(encoding='utf-8'))
career_cards = next(group['cards'] for group in catalog if group['group'] == 'career')
groups = {'quality': [], 'career': []}
records = []
digest = lambda path: hashlib.sha256(path.read_bytes()).hexdigest()

def extent(values):
    middle = len(values) // 2
    left = next(i + 1 for i in range(middle, -1, -1) if values[i] >= 160)
    right = next(i for i in range(middle, len(values)) if values[i] >= 160)
    return left, right

for item in request['items']:
    source = Path(item['source'])
    raw = assets / (item['key'] + '-frame.png')
    runtime = assets / (item['key'] + '-frame.webp')
    if raw.exists() or runtime.exists():
        raise FileExistsError(item['key'])
    image = Image.open(source).convert('RGBA')
    w, h = image.size
    alpha = image.getchannel('A')
    if (w, h) != (1024,1536) or alpha.getpixel((w // 2, h // 2)) != 0:
        raise ValueError(item['key'] + ': frame canvas or alpha aperture mismatch')
    horizontal = [extent([alpha.getpixel((x, round(h * f))) for x in range(w)]) for f in (.35,.5,.65)]
    vertical = [extent([alpha.getpixel((round(w * f), y)) for y in range(h)]) for f in (.3,.5,.7)]
    left, right = [round(statistics.median(v[i] for v in horizontal)) for i in range(2)]
    top, bottom = [round(statistics.median(v[i] for v in vertical)) for i in range(2)]
    scale = 232 / (right-left)
    foundation = dict(width=w*scale, left=-left*scale, top=-top*scale, apertureHeight=(bottom-top)*scale)
    shutil.copy2(source, raw)
    image.resize((512, 768), Image.Resampling.LANCZOS).save(runtime, 'WEBP', lossless=True, method=6, exact=True)
    records.append(dict(key=item['key'], source=str(source), opening=[left,top,right,bottom], display=foundation, raw=dict(path=raw.relative_to(root).as_posix(), bytes=raw.stat().st_size, sha256=digest(raw)), webp=dict(path=runtime.relative_to(root).as_posix(), bytes=runtime.stat().st_size, sha256=digest(runtime))))
    label = html.escape(item['label'])
    note = html.escape(item['note'])
    url = '../../../' + runtime.relative_to(root).as_posix()
    if item['group'] == 'career':
        card = career_cards[item['cardIndex']]
        rarity = 'career'
        caption = html.escape(card['caption'])
    else:
        card = dict(name='元素爆裂', type='法术', cost=2, description='对随机敌人造成2点法术伤害；本牌的伤害效果触发4–5次。', art='cards/spell-tt12-elemburst.webp')
        rarity = item['key']
        caption = label
    name, card_type, description = [html.escape(str(card[field])) for field in ('name', 'type', 'description')]
    dense = ' dense' if len(card['description']) > 48 else ''
    base_url = url
    prism = f'<div class="prism-halo" aria-hidden="true" style="left:{foundation["left"]:.4f}px;top:{foundation["top"]:.4f}px;width:{foundation["width"]:.4f}px;height:{foundation["width"] * 1.5:.4f}px"></div><div class="prism-sheen" aria-hidden="true"></div>' if rarity == 'prism' else ''
    groups[item['group']].append(f'''<article class="sample{dense}" data-rarity="{rarity}" style="--ink:{item['accent']};--pigment:{item['pigment']};--wash:{item['pigment']};--frame-image:url('{base_url}')">
<div class="frame-study"><img src="{url}" alt="{label}完整边框"></div>
<div class="card" style="height:{foundation['apertureHeight']:.4f}px">
<div class="art"><img src="/assets/{card['art']}" alt="{name}卡图"></div><div class="copy"><h2>{name}</h2><p>{description}</p><span class="ink-strokes" aria-hidden="true"></span></div>
<span class="type">{card_type}</span>{prism}<img class="frame" src="{base_url}" alt="{label}完整边框" style="left:{foundation['left']:.4f}px;top:{foundation['top']:.4f}px;width:{foundation['width']:.4f}px;height:auto">
<span class="cost">{card['cost']}</span><span class="quality-seal">{label}</span></div>
<div class="caption"><h3>{caption}</h3><p>{note}</p></div></article>''')

page = '''<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>节点画风卡框 · 参考板</title><link rel="stylesheet" href="../card-paper-rarity-20261015/board.css"><link rel="stylesheet" href="../card-paper-rarity-20261015/paper-face.css"><link rel="stylesheet" href="./node-board.css"></head>
<body data-mode="cards"><main><header><div class="eyebrow">代号柒 / FRAME & LIGHT</div><h1>节点画风卡框 · 参考板</h1><p>完整边框重绘：品质从简到繁，职业以人物锚点组织四边。星月黑黄，白塔绿黄。</p></header>
<nav class="board-tabs" aria-label="展示分组"><button data-group="quality" aria-pressed="true">品质递进 6</button><button data-group="career" aria-pressed="false">职业锚点 5</button></nav>
<nav class="board-tabs view-tabs" aria-label="显示方式"><button data-mode="cards" aria-pressed="true">整卡搭配</button><button data-mode="frames" aria-pressed="false">只看边框</button></nav>
<section id="quality" class="gallery" aria-label="品质递进边框">''' + '\n'.join(groups['quality']) + '''</section><section id="career" class="gallery" aria-label="职业锚点边框" hidden>''' + '\n'.join(groups['career']) + '''</section><footer>完整卡框候选 · 正式游戏素材未替换</footer></main>
<script>document.querySelectorAll('[data-group]').forEach(button=>button.addEventListener('click',()=>{document.querySelectorAll('[data-group]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));document.querySelectorAll('section.gallery').forEach(section=>section.hidden=section.id!==button.dataset.group);}));document.querySelectorAll('button[data-mode]').forEach(button=>button.addEventListener('click',()=>{document.body.dataset.mode=button.dataset.mode;document.querySelectorAll('button[data-mode]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));}));</script></body></html>'''
(board / 'index.html').write_text(page, encoding='utf-8')
(here / 'receipt.json').write_text(json.dumps(dict(assets=records, recovery='按source恢复raw并核对SHA256；WebP由本脚本无损编码', scope='仅参考板元素；未测试、未构建、未提交'), ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
print(json.dumps(dict(page='docs/previews/card-node-elements-20261015/index.html', completeFrames=len(records)), ensure_ascii=False))
