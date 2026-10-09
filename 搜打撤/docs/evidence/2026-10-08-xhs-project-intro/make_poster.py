from pathlib import Path
import base64
import hashlib
import io
import json
import xml.etree.ElementTree as ET
from html import escape
from PIL import Image, ImageDraw, ImageFont, ImageChops

ROOT = Path(__file__).resolve().parent
SOURCE = ROOT.parents[2] / 'game/assets/portraits/full/wu.webp'
W, H = 1200, 1600
INK, BLUE, MUTED = '#202833', '#315ca6', '#677381'
font_paths = {False: 'C:/Windows/Fonts/msyh.ttc', True: 'C:/Windows/Fonts/msyhbd.ttc'}
source = Image.open(SOURCE).convert('RGB')
# Only crop surrounding white space; preserve every non-white source pixel.
difference = ImageChops.difference(source, Image.new('RGB', source.size, 'white'))
mask = difference.convert('L').point(lambda x: 255 if x > 20 else 0)
bbox = mask.getbbox()
assert bbox, 'Source is empty'
x0, y0, x1, y1 = bbox
bbox = (max(0, x0-16), max(0, y0-16), min(source.width, x1+16), min(source.height, y1+16))
art = source.crop(bbox)
art.thumbnail((665, 1160), Image.Resampling.LANCZOS)
art_x, art_y = W-60-art.width, 330
assert art_y+art.height < 1515
canvas = Image.new('RGB', (W,H), 'white')
canvas.paste(art, (art_x,art_y))
draw = ImageDraw.Draw(canvas)
buffer = io.BytesIO()
art.save(buffer, format='PNG')
embedded = base64.b64encode(buffer.getvalue()).decode('ascii')
svg = [f'<svg xmlns="http://www.w3.org/2000/svg" xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape" width="{W}" height="{H}" viewBox="0 0 {W} {H}">',
       '<title>代号柒 · 项目介绍初版</title>',
       '<desc>选人原图与独立文字对象；后台确定性排版，无生成图。</desc>',
       '<g id="background"><rect width="1200" height="1600" fill="white"/></g>',
       f'<g id="character-original"><image x="{art_x}" y="{art_y}" width="{art.width}" height="{art.height}" href="data:image/png;base64,{embedded}"/></g>']
elements = []
def text(group, x, baseline, content, size, color=INK, bold=False):
    font = ImageFont.truetype(font_paths[bold],size)
    draw.text((x,baseline),content,font=font,fill=color,anchor='ls')
    bounds = draw.textbbox((x,baseline),content,font=font,anchor='ls')
    assert bounds[0] >= 0 and bounds[2] <= W and bounds[1]>=0 and bounds[3]<=H, (content,bounds)
    svg.append(f'<g id="{group}"><text x="{x}" y="{baseline}" font-family="Microsoft YaHei, sans-serif" font-size="{size}" font-weight="{700 if bold else 400}" fill="{color}">{escape(content)}</text></g>')
    elements.append({'id':group,'text':content,'bounds':bounds})

text('record',80,100,'独立游戏制作记录',28,MUTED)
text('issue',1035,100,'01',34,BLUE,True)
draw.line((80,132,1120,132),fill='#dce2e9',width=2)
svg.append('<g id="rule"><path d="M80 132H1120" stroke="#dce2e9" stroke-width="2"/></g>')
text('title',75,292,'代号柒',142,INK,True)
text('genre',80,367,'卡牌战斗 × 探索 × 搜打撤',36,BLUE)
text('hook-one',80,630,'继续深入，',46,INK,True)
text('hook-two',80,700,'还是撤离？',46,INK,True)
text('motivation-one',80,925,'做过几个小项目，',27,MUTED)
text('motivation-two',80,978,'这次想做得更完整。',27,MUTED)
text('status',80,1405,'制作中 · 最终目标开源',26,BLUE)
text('footer',80,1538,'项目介绍 / 角色图来自游戏选人界面',23,MUTED)
svg.append('</svg>')
svg_path = ROOT/'立项海报-原图排版-v2.svg'
png_path = ROOT/'立项海报-原图排版-v2.png'
svg_path.write_text('\n'.join(svg),encoding='utf-8')
ET.parse(svg_path)
canvas.save(png_path)
canvas.resize((360,480),Image.Resampling.LANCZOS).save(ROOT/'立项海报-v2-缩略检查.png')
report = {'source':str(SOURCE),'source_sha256':hashlib.sha256(SOURCE.read_bytes()).hexdigest(),
          'source_size':source.size,'crop':bbox,'character_rect':[art_x,art_y,art.width,art.height],
          'canvas':[W,H],'text_objects':elements,'outputs':[]}
for path in [svg_path,png_path,ROOT/'立项海报-v2-缩略检查.png']:
    report['outputs'].append({'file':path.name,'bytes':path.stat().st_size,'sha256':hashlib.sha256(path.read_bytes()).hexdigest()})
(ROOT/'poster-v2-manifest.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(report,ensure_ascii=False))
