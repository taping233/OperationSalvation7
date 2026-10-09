from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageOps
import hashlib,json,io,base64
from html import escape
import xml.etree.ElementTree as ET
OUT=Path(__file__).resolve().parent
GAME=OUT.parents[2]/'game'
W,H=900,1200
INK='#172736';BLUE='#31599e';GRAY='#626c77'
F={False:'C:/Windows/Fonts/msyh.ttc',True:'C:/Windows/Fonts/msyhbd.ttc'}
class Poster:
    def __init__(self):
        self.im=Image.new('RGB',(W,H),'white');self.d=ImageDraw.Draw(self.im)
        self.svg=['<svg xmlns="http://www.w3.org/2000/svg" width="900" height="1200" viewBox="0 0 900 1200">','<rect width="900" height="1200" fill="white"/>']
    def t(self,x,y,s,size,color=INK,bold=False):
        f=ImageFont.truetype(F[bold],size)
        b=self.d.textbbox((x,y),s,font=f,anchor='ls')
        assert 0<=b[0] and b[2]<=900 and 0<=b[1] and b[3]<=1200,(s,b)
        self.d.text((x,y),s,font=f,fill=color,anchor='ls')
        self.svg.append(f'<text x="{x}" y="{y}" font-family="Microsoft YaHei" font-size="{size}" font-weight="{700 if bold else 400}" fill="{color}">{escape(s)}</text>')
    def image(self,path,crop,box):
        src=Image.open(path).convert('RGB').crop(crop)
        x,y,r,b=box;src=ImageOps.fit(src,(r-x,b-y),Image.Resampling.LANCZOS)
        self.im.paste(src,(x,y));buffer=io.BytesIO();src.save(buffer,format='PNG')
        self.svg.append(f'<image x="{x}" y="{y}" width="{r-x}" height="{b-y}" href="data:image/png;base64,{base64.b64encode(buffer.getvalue()).decode()}"/>')
    def line(self,coords,color=INK,width=1):
        self.d.line(coords,fill=color,width=width)
        x,y,r,b=coords;self.svg.append(f'<path d="M{x} {y}L{r} {b}" stroke="{color}" stroke-width="{width}"/>')
    def save(self,name):
        self.im.save(OUT/(name+'.png'));p=OUT/(name+'.svg');p.write_text('\n'.join(self.svg+['</svg>']),encoding='utf-8');ET.parse(p)

wu=GAME/'assets/portraits/full/wu.webp';fire=GAME/'assets/cards/expedition-starters/fireball.webp'
a=Poster()
a.image(wu,(1050,0,1600,700),(260,0,900,1010))
a.t(42,68,'PROJECT / 01',22,BLUE,True)
a.t(40,166,'代号柒',72,INK,True)
a.t(44,212,'CODENAME 7',21,GRAY)
a.line((44,246,180,246),BLUE,4)
a.t(44,646,'从桌游',38,INK,True);a.t(44,704,'到电子游戏。',38,INK,True)
a.t(44,780,'两个人的游戏制作计划',20,GRAY)
a.t(44,815,'创 / 游戏设计师',19,GRAY);a.t(44,849,'太平 / 制作人',19,GRAY)
a.t(44,1065,'搜打撤 × 卡牌',41,INK,True)
a.t(44,1118,'制作过程，逐阶段开源。',27,BLUE,True)
a.t(44,1171,'封面构图小样 / 角色沿用已有资源',18,GRAY)
a.save('概念A-近景封面')

b=Poster()
b.image(wu,(950,310,1230,1120),(0,0,285,815))
b.image(wu,(1190,40,1520,900),(306,0,594,815))
b.image(fire,(60,0,680,679),(615,0,900,815))
for x,n,title,body in [(25,'01','角色','选人原图局部'),(330,'02','桌游改编','轻松简单的搜打撤'),(643,'03','卡牌','已有插画资源')]:
    b.t(x,862,n,25,BLUE,True);b.t(x,906,title,27,INK,True);b.t(x,944,body,18,GRAY)
b.line((25,973,875,973),'#b9c1ca',1)
b.t(24,1076,'代号柒',94,INK,True)
b.t(490,1027,'从桌游到电子游戏',23,INK,True)
b.t(490,1068,'制作过程逐阶段开源',23,BLUE)
b.t(25,1134,'创 / 游戏设计师     太平 / 制作人',23,GRAY)
b.t(25,1174,'封面构图小样 / 早期素材可能调整',18,GRAY)
b.save('概念B-三栏拼接')

def board(reference,concept,filename,subtitle):
    sheet=Image.new('RGB',(1500,1190),'#e9edf1');d=ImageDraw.Draw(sheet)
    heading=ImageFont.truetype(F[True],33);small=ImageFont.truetype(F[False],24)
    d.text((40,25),subtitle,font=heading,fill=INK)
    d.text((40,87),'左：NoriZC 参考原图',font=small,fill=INK);d.text((790,87),'右：《代号柒》对应概念小样',font=small,fill=INK)
    for x,path in [(40,reference),(790,concept)]:
        thumb=ImageOps.contain(Image.open(path).convert('RGB'),(660,940),Image.Resampling.LANCZOS)
        sheet.paste(thumb,(x+(660-thumb.width)//2,140))
    d.text((40,1110),'参考图仅用于讨论；概念小样使用本项目素材。',font=small,fill=GRAY)
    sheet.save(OUT/filename)
board(OUT/'参考A-角色近景.webp',OUT/'概念A-近景封面.png','参考与概念-A.png','A / 放大人物局部，集中小块文字')
board(OUT/'参考-3.webp',OUT/'概念B-三栏拼接.png','参考与概念-B.png','B / 三栏裁切，图像先行，信息集中到底部')
manifest={'reference_page':'https://www.xiaohongshu.com/explore/6abf6eb900000000180142c0','author':'NoriZC','method':'Codex 内置浏览器 pageAssets.bundle / 已观察 img.downloadMedia','inputs':[],'outputs':[]}
for p in [wu,fire]:manifest['inputs'].append({'path':str(p),'sha256':hashlib.sha256(p.read_bytes()).hexdigest()})
for p in OUT.iterdir():
    if p.suffix in ['.png','.svg','.webp']:manifest['outputs'].append({'name':p.name,'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()})
(OUT/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8')
print('PASS: 2 concepts, 2 reference comparisons, SVG parsed')
