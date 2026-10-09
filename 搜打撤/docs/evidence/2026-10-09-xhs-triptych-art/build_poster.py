from pathlib import Path
from PIL import Image,ImageDraw,ImageFont,ImageOps
import hashlib,json,io,base64,xml.etree.ElementTree as ET
from html import escape
OUT=Path(__file__).resolve().parent
W,H=900,1250
image=Image.new('RGB',(W,H),'white');d=ImageDraw.Draw(image)
svg=['<svg xmlns="http://www.w3.org/2000/svg" width="900" height="1250" viewBox="0 0 900 1250">','<rect width="900" height="1250" fill="white"/>']
INK='#172736';BLUE='#31599e';GRAY='#626c77'
for x,name in [(0,'01-衣装细节.png'),(307,'02-人物近景.png'),(615,'03-武器细节.png')]:
    art=Image.open(OUT/name).convert('RGB')
    art=ImageOps.contain(art,(285,855),Image.Resampling.LANCZOS)
    image.paste(art,(x,0));buf=io.BytesIO();art.save(buf,format='PNG')
    svg.append(f'<image x="{x}" y="0" width="{art.width}" height="{art.height}" href="data:image/png;base64,{base64.b64encode(buf.getvalue()).decode()}"/>')
def text(x,y,s,size,color=INK,bold=False):
    f=ImageFont.truetype('C:/Windows/Fonts/msyhbd.ttc' if bold else 'C:/Windows/Fonts/msyh.ttc',size)
    box=d.textbbox((x,y),s,font=f,anchor='ls');assert 0<=box[0] and box[2]<=W and 0<=box[1] and box[3]<=H,(s,box)
    d.text((x,y),s,font=f,fill=color,anchor='ls')
    svg.append(f'<text x="{x}" y="{y}" font-family="Microsoft YaHei" font-size="{size}" font-weight="{700 if bold else 400}" fill="{color}">{escape(s)}</text>')
for x,n,title in [(25,'01','衣装'),(330,'02','无'),(643,'03','长剑')]:
    text(x,896,n,25,BLUE,True);text(x,942,title,28,INK,True)
d.line((25,986,875,986),fill='#c7cdd4',width=1)
svg.append('<path d="M25 986H875" stroke="#c7cdd4"/>')
text(25,1095,'代号柒',99,INK,True)
text(510,1045,'从桌游到电子游戏',23,INK,True)
text(510,1082,'轻松简单 · 搜打撤 + 卡牌',22,GRAY)
text(510,1120,'制作过程逐阶段开源',23,BLUE)
text(25,1186,'创 / 游戏设计师     太平 / 制作人',23,GRAY)
text(25,1230,'立项宣传概念稿 · 参考选人立绘重新绘制',18,GRAY)
image.save(OUT/'三栏宣传概念图-v3.png')
p=OUT/'三栏宣传概念图-v3.svg';p.write_text('\n'.join(svg+['</svg>']),encoding='utf-8');ET.parse(p)
image.resize((360,500),Image.Resampling.LANCZOS).save(OUT/'缩略检查.png')
source=OUT.parents[2]/'game/assets/portraits/full/wu.webp'
manifest={'reference':str(source),'reference_sha256':hashlib.sha256(source.read_bytes()).hexdigest(),'method':'内置 image_gen 制作三份插画；Pillow/SVG 后台排版，素材只等比缩放不裁切','outputs':[]}
for p in OUT.iterdir():
    if p.suffix in ['.png','.svg']:manifest['outputs'].append({'file':p.name,'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()})
(OUT/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8')
print('PASS: 3 original-ratio panels; editable SVG parsed; text bounds checked')
