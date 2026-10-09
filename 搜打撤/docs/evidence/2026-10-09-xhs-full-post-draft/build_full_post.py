from pathlib import Path
from PIL import Image,ImageDraw,ImageFont,ImageOps
import io,base64,json,hashlib,shutil,xml.etree.ElementTree as ET
from html import escape
OUT=Path(__file__).resolve().parent
DOCS=OUT.parents[1]; GAME=OUT.parents[2]/'game'
ART=OUT.parent/'2026-10-09-xhs-triptych-art'
W,H=900,1250; INK='#172736'; BLUE='#31599e'; GRAY='#626c77'; PALE='#eef2f7'
F={False:'C:/Windows/Fonts/msyh.ttc',True:'C:/Windows/Fonts/msyhbd.ttc'}
inputs={}
class Page:
    def __init__(self,n):
        self.n=n;self.im=Image.new('RGB',(W,H),'white');self.d=ImageDraw.Draw(self.im)
        self.svg=['<svg xmlns="http://www.w3.org/2000/svg" width="900" height="1250" viewBox="0 0 900 1250">','<rect width="900" height="1250" fill="white"/>']
    def t(self,x,y,s,size,color=INK,bold=False):
        font=ImageFont.truetype(F[bold],size);b=self.d.textbbox((x,y),s,font=font,anchor='ls')
        assert 0<=b[0] and b[2]<=W and 0<=b[1] and b[3]<=H,(s,b)
        self.d.text((x,y),s,font=font,fill=color,anchor='ls')
        self.svg.append(f'<text x="{x}" y="{y}" font-family="Microsoft YaHei" font-size="{size}" font-weight="{700 if bold else 400}" fill="{color}">{escape(s)}</text>')
    def rect(self,box,color):
        x,y,r,b=box;self.d.rectangle(box,fill=color);self.svg.append(f'<rect x="{x}" y="{y}" width="{r-x}" height="{b-y}" fill="{color}"/>')
    def line(self,y):
        self.d.line((42,y,858,y),fill='#c7cdd4',width=1);self.svg.append(f'<path d="M42 {y}H858" stroke="#c7cdd4"/>')
    def art(self,path,box):
        src=Image.open(path).convert('RGBA');inputs[str(path)]=hashlib.sha256(path.read_bytes()).hexdigest()
        x,y,r,b=box;src=ImageOps.contain(src,(r-x,b-y),Image.Resampling.LANCZOS);x+=(r-x-src.width)//2;y+=(b-y-src.height)//2
        self.im.paste(src,(x,y),src);buf=io.BytesIO();src.save(buf,format='PNG')
        self.svg.append(f'<image x="{x}" y="{y}" width="{src.width}" height="{src.height}" href="data:image/png;base64,{base64.b64encode(buf.getvalue()).decode()}"/>')
    def footer(self,label):
        self.line(1170);self.t(42,1220,'代号柒 / 立项与项目介绍',20,GRAY);self.t(688,1220,label,20,BLUE,True)
    def save(self,name):
        self.im.save(OUT/(name+'.png'));p=OUT/(name+'.svg');p.write_text('\n'.join(self.svg+['</svg>']),encoding='utf-8');ET.parse(p)

# Cover: preserve approved composition and use only a shorter draft footer.
cover=Image.open(ART/'三栏宣传概念图-v3.png').convert('RGB')
cover.save(OUT/'01-封面.png');shutil.copyfile(ART/'三栏宣传概念图-v3.svg',OUT/'01-封面.svg')
inputs[str(ART/'三栏宣传概念图-v3.png')]=hashlib.sha256((ART/'三栏宣传概念图-v3.png').read_bytes()).hexdigest()

p2=Page(2)
p2.t(42,65,'游戏构想',23,BLUE,True);p2.t(770,65,'02',28,BLUE,True)
p2.t(40,176,'搜打撤 + 卡牌',78,INK,True)
p2.t(42,254,'我们想做一款轻松、简单的游戏。',35,GRAY)
for i,name in enumerate(['basic-attack.webp','fireball.webp','rations.webp']):
    x=42+276*i;p2.rect((x,326,x+255,628),PALE)
    p2.art(GAME/'assets/cards/expedition-starters'/name,(x+8,339,x+247,608))
for x,n,title,lines in [(42,'01','搜',['探索地图','搜集物资']),(318,'02','打',['使用卡牌','应对战斗']),(594,'03','撤',['继续深入？','带着收获离开？'])]:
    p2.t(x,701,n,23,BLUE,True);p2.t(x,801,title,79,INK,True)
    for j,s in enumerate(lines):p2.t(x,867+j*49,s,28,GRAY)
p2.line(981);p2.t(42,1043,'从桌游《代号柒》出发，',32,INK,True);p2.t(42,1091,'重新梳理电子游戏版的制作流程。',30,GRAY)
p2.t(42,1143,'图中为早期卡牌资源，后续可能调整或重做。',20,GRAY)
p2.footer('游戏介绍');p2.save('02-游戏介绍')

p3=Page(3)
p3.art(ART/'02-人物近景.png',(565,0,900,1005))
p3.t(42,65,'团队与动机',23,BLUE,True);p3.t(42,176,'两个人，',76,INK,True);p3.t(42,266,'制作一款游戏。',62,INK,True)
p3.t(42,414,'创',80,INK,True);p3.t(42,477,'游戏设计师',31,BLUE)
p3.t(42,654,'太平',80,INK,True);p3.t(42,717,'制作人',31,BLUE)
p3.t(42,847,'制作人的目标',24,GRAY)
p3.t(42,909,'积累工程与游戏开发经验，',30,INK,True);p3.t(42,958,'把作品做得更完整。',30,INK,True)
p3.t(607,1060,'角色插画参考',20,GRAY)
p3.line(1100);p3.t(42,1145,'已有原型和素材，会按阶段重新审视、修改和复用。',25,GRAY)
p3.footer('两人团队');p3.save('03-团队与动机')

p4=Page(4)
p4.t(42,65,'制作过程与开放计划',23,BLUE,True);p4.t(770,65,'04',28,BLUE,True)
p4.t(40,174,'从立项开始，',73,INK,True);p4.t(40,270,'逐阶段开源。',73,BLUE,True)
p4.t(42,335,'每个阶段分享：成果、问题、制作总结。',30,GRAY)
for y,num,title,body in [(422,'01','设计文档','游戏构想、玩法设计、制作方案'),(632,'02','源码与工具','代码、工具脚本、工程与开发记录'),(842,'03','美术与音频','对应阶段的素材与制作资料')]:
    p4.rect((42,y,858,y+175),PALE);p4.t(64,y+57,num,26,BLUE,True)
    p4.t(135,y+67,title,39,INK,True);p4.t(135,y+123,body,27,GRAY)
p4.t(42,1083,'跟着项目，看一款游戏怎样做出来。',31,INK,True)
p4.t(42,1134,'当前按立项阶段记录，资料随对应阶段逐步开放。',24,GRAY)
p4.footer('阶段开源');p4.save('04-阶段开放计划')

caption=(OUT/'帖子文案.md').read_text(encoding='utf-8').strip()
title=caption.splitlines()[0].removeprefix('# ')
body=caption.split('\n\n',1)[1]
# Complete review sheet with four actual pages, followed by proposed title and text.
S=1920;sheet=Image.new('RGB',(S,1820),'#e9edf1');d=ImageDraw.Draw(sheet)
font=lambda size,b=False:ImageFont.truetype(F[b],size)
d.text((42,25),'《代号柒》完整帖子草稿 · 4 张配图 + 标题正文',font=font(37,True),fill=INK)
names=['01-封面','02-游戏介绍','03-团队与动机','04-阶段开放计划']
for i,name in enumerate(names):
    thumb=Image.open(OUT/(name+'.png')).resize((450,625),Image.Resampling.LANCZOS)
    sheet.paste(thumb,(42+i*470,95));d.text((42+i*470,741),name,font=font(24,True),fill=INK)
d.rounded_rectangle((42,812,1878,1775),radius=18,fill='white')
d.text((78,844),'拟发布标题',font=font(23),fill=GRAY);d.text((78,895),title,font=font(37,True),fill=INK)
d.text((78,963),'拟发布正文',font=font(23),fill=GRAY)
def wrap(s,max_width,f):
    result=[];line=''
    for c in s:
        if d.textlength(line+c,font=f)>max_width:result.append(line);line=c
        else:line+=c
    if line:result.append(line)
    return result
y=1012
for paragraph in body.split('\n\n'):
    for line in wrap(paragraph,1740,font(25)):
        d.text((78,y),line,font=font(25),fill=INK);y+=43
    y+=18
assert y<1750,y
sheet.save(OUT/'完整帖子草稿总览.png')
manifest={'inputs':inputs,'outputs':[]}
for p in OUT.iterdir():
    if p.suffix in ['.png','.svg']:manifest['outputs'].append({'name':p.name,'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()})
(OUT/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8')
print('PASS: 4 pages + caption sheet, text bounds checked, SVG parsed')
