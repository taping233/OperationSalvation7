"""Build a frame-only comparison from one locked existing card DOM."""
import hashlib
import html
import json
import re
import shutil
import statistics
from pathlib import Path
from PIL import Image

here = Path(__file__).resolve().parent
root = here.parents[2]
board = root / 'docs/previews/card-style-directions-20261015'
request = json.loads((here / 'request-frames.json').read_text(encoding='utf-8'))
outputs = json.loads((here / 'generated-frames.json').read_text(encoding='utf-8'))
locked = (here / 'locked-card.html').read_text(encoding='utf-8')
card_height = 371.0839
records = []
articles = []


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def extent(values):
    mid = len(values) // 2
    left = next(i + 1 for i in range(mid, -1, -1) if values[i] >= 160)
    right = next(i for i in range(mid, len(values)) if values[i] >= 160)
    return left, right


for item in request['variants']:
    key = item['key']
    src = Path(outputs[key])
    im = Image.open(src).convert('RGBA')
    w, h = im.size
    alpha = im.getchannel('A')
    assert alpha.getpixel((w // 2, h // 2)) == 0, key + ': opaque center'
    assert alpha.getpixel((0, 0)) == 0, key + ': opaque outside'
    safe = alpha.crop((round(w * .16), round(h * .12), round(w * .85), round(h * .89)))
    assert safe.getextrema()[1] == 0, key + ': central content obstructed'
    horizontal = [extent([alpha.getpixel((x, round(h * f))) for x in range(w)]) for f in (.3, .5, .7)]
    vertical = [extent([alpha.getpixel((round(w * f), y)) for y in range(h)]) for f in (.3, .5, .7)]
    left, right = [round(statistics.median(v[i] for v in horizontal)) for i in range(2)]
    top, bottom = [round(statistics.median(v[i] for v in vertical)) for i in range(2)]
    sx, sy = 232 / (right - left), card_height / (bottom - top)
    dest = board / (key + '.webp')
    im.save(dest, 'WEBP', lossless=True, method=6)
    assert dest.stat().st_size <= 1_000_000, key + ': image over 1MB'
    geometry = f'left:{-left*sx:.4f}px;top:{-top*sy:.4f}px;width:{w*sx:.4f}px;height:{h*sy:.4f}px'
    frame = f'<img class="frame" src="{dest.name}" alt="{html.escape(item["label"])}透明边框" style="{geometry}">'
    article = re.sub(r'<img class="frame"[^>]*>', frame, locked)
    article = re.sub(r'<div class="caption">.*?</div></article>', f'<div class="caption"><h3>{html.escape(item["label"])}</h3><p>{html.escape(item["note"])}</p><a href="{dest.name}" target="_blank">透明边框原图</a></div></article>', article, flags=re.S)
    article = article.replace('<article ', f'<article data-option="{key}" ')
    articles.append(article)
    records.append(dict(key=key, source=str(src), sourceSha256=sha(src), output=dest.relative_to(root).as_posix(), outputSha256=sha(dest), bytes=dest.stat().st_size, size=[w,h], opening=[left,top,right,bottom], safeAlphaMax=safe.getextrema()[1], scaleXY=[sx,sy]))

baseline = re.sub(r'<div class="caption">.*?</div></article>', '<div class="caption"><h3>现行纸边框</h3><p>同一张卡的对照基线</p></div></article>', locked, flags=re.S)
page = '''<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>只换边框 · 四方向对比</title>
<link rel="stylesheet" href="../card-paper-rarity-20261015/board.css"><link rel="stylesheet" href="../card-paper-rarity-20261015/paper-face.css">
<style>
main{max-width:1640px;padding:25px 42px}.gallery{grid-template-columns:repeat(4,minmax(280px,1fr));gap:34px 14px;overflow:auto;padding:62px 0 25px}.sample{padding:0 22px}.caption{margin-top:48px}.caption a{display:inline-block;color:#b7a17c;font-size:12px;margin-top:12px;text-underline-offset:4px}.controls{display:flex;gap:24px;flex-wrap:wrap;align-items:center}.mode{margin-top:15px}.baseline{padding:50px 0}.baseline .sample{width:310px;margin:auto}summary{cursor:pointer;color:#c7b68e;padding:14px 0}details{border-top:1px solid #ffffff20}button{font:inherit}.frame-only .card{background:repeating-conic-gradient(#242b34 0 25%,#1c222b 0 50%) 0/20px 20px;box-shadow:none}.frame-only .frame{filter:none}.gallery .sample{--ink:#e4c88d}
</style></head><body><main><header><div class="eyebrow">代号柒 / FRAME STUDY / 2026.10.15</div><h1>只换边框 · 四方向对比</h1><p>四版均为传说框。卡图、文字、费用、标签、分隔和内容排版完全相同；只比较外框。</p><div class="controls"><label class="mode"><input id="frame-only" type="checkbox">只看透明边框</label></div></header><section class="gallery" aria-label="四种透明边框套在同一卡面">''' + '\n'.join(articles) + '''</section><details><summary>展开现行纸边框对照</summary><section class="baseline">''' + baseline + '''</section></details><footer>四张透明外框由内置生图制作，卡内内容复用原参考板。候选仅用于挑选，正式卡面待选定后接入。</footer></main><script>document.querySelector('#frame-only').addEventListener('change',e=>document.body.classList.toggle('frame-only',e.target.checked));</script></body></html>'''
(board / 'index.html').write_text(page, encoding='utf-8')
(here / 'frame-assets.json').write_text(json.dumps(records, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
print(json.dumps(dict(frames=len(records), page=str(board/'index.html'), lockedCardSha256=sha(here/'locked-card.html'), centralAlphaMax=[r['safeAlphaMax'] for r in records]), ensure_ascii=True))
