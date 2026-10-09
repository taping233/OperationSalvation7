from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageOps
import base64, io, json, hashlib
from html import escape

OUT = Path(__file__).resolve().parent
GAME = OUT.parents[2] / 'game'
W,H = 900,1200
INK='#192a39'; BLUE='#264fad'; PALE='#e9eff7'; GRAY='#647281'
FONTS={False:'C:/Windows/Fonts/msyh.ttc',True:'C:/Windows/Fonts/msyhbd.ttc'}
inputs=[]
class Page:
    def __init__(self,name):
        self.name=name; self.image=Image.new('RGB',(W,H),'white'); self.draw=ImageDraw.Draw(self.image)
        self.svg=[f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}">','<rect width="900" height="1200" fill="white"/>']
        self.texts=[]
    def text(self,x,y,s,size,color=INK,bold=False):
        font=ImageFont.truetype(FONTS[bold],size)
        box=self.draw.textbbox((x,y),s,font=font,anchor='ls')
        assert box[0]>=0 and box[2]<=W and box[1]>=0 and box[3]<=H,(s,box)
        self.draw.text((x,y),s,font=font,fill=color,anchor='ls')
        self.svg.append(f'<text x="{x}" y="{y}" font-family="Microsoft YaHei" font-size="{size}" font-weight="{700 if bold else 400}" fill="{color}">{escape(s)}</text>')
        self.texts.append(s)
    def rect(self,box,color):
        self.draw.rectangle(box,fill=color)
        x,y,r,b=box; self.svg.append(f'<rect x="{x}" y="{y}" width="{r-x}" height="{b-y}" fill="{color}"/>')
    def art(self,path,box,crop=None):
        src=Image.open(path).convert('RGBA')
        if crop: src=src.crop(crop)
        image=ImageOps.contain(src,(box[2]-box[0],box[3]-box[1]),Image.Resampling.LANCZOS)
        x=box[0]+(box[2]-box[0]-image.width)//2; y=box[1]+(box[3]-box[1]-image.height)//2
        self.image.paste(image,(x,y),image)
        buf=io.BytesIO();image.save(buf,format='PNG')
        self.svg.append(f'<image x="{x}" y="{y}" width="{image.width}" height="{image.height}" href="data:image/png;base64,{base64.b64encode(buf.getvalue()).decode()}"/>')
        if str(path) not in [i['path'] for i in inputs]:inputs.append({'path':str(path),'sha256':hashlib.sha256(path.read_bytes()).hexdigest()})
    def finish(self):
        self.image.save(OUT/(self.name+'.png'))
        (OUT/(self.name+'.svg')).write_text('\n'.join(self.svg+['</svg>']),encoding='utf-8')
        return self

wu=GAME/'assets/portraits/full/wu.webp'
attack=GAME/'assets/cards/expedition-starters/basic-attack.webp'
fire=GAME/'assets/cards/expedition-starters/fireball.webp'
rations=GAME/'assets/cards/expedition-starters/rations.webp'

p1=Page('01-封面内容草稿')
p1.text(54,64,'项目初次介绍',23,GRAY)
p1.text(770,65,'01',26,BLUE,True)
p1.text(52,166,'把桌游',82,INK,True)
p1.text(52,270,'做成电子游戏。',82,INK,True)
p1.art(wu,(80,295,900,1070),(883,4,1754,1050))
p1.rect((52,850,385,1005),INK)
p1.text(70,950,'代号柒',87,'white',True)
p1.text(54,1060,'搜打撤 + 卡牌',37,BLUE,True)
p1.text(54,1111,'两人制作 · 制作过程逐阶段开源',26,INK)
p1.text(54,1167,'配图草稿 / 早期角色素材，后续可能调整',19,GRAY)
p1.finish()

p2=Page('02-游戏介绍内容草稿')
p2.text(54,64,'这是一款什么游戏？',23,GRAY)
p2.text(770,65,'02',26,BLUE,True)
p2.text(52,162,'轻松简单，',78,INK,True)
p2.text(52,254,'搜打撤 + 卡牌。',69,BLUE,True)
p2.text(54,320,'探索、搜集，用卡牌应对战斗，决定何时撤离。',25,INK)
p2.rect((54,375,846,750),PALE)
p2.art(attack,(75,402,450,650))
p2.art(fire,(450,402,825,650))
p2.text(78,710,'已有卡牌插画',25,BLUE,True)
p2.art(rations,(615,780,846,1005))
p2.text(54,850,'搜',52,INK,True);p2.text(135,850,'探索与收集物资',29,INK)
p2.text(54,930,'打',52,INK,True);p2.text(135,930,'用卡牌应对战斗',29,INK)
p2.text(54,1010,'撤',52,INK,True);p2.text(135,1010,'带着收获离开',29,INK)
p2.text(54,1104,'从桌游《代号柒》出发，制作电子游戏版。',27,INK)
p2.text(54,1167,'配图草稿 / 已有资源展示，不代表最终卡牌界面',19,GRAY)
p2.finish()

p3=Page('03-团队与开放计划草稿')
p3.text(54,64,'谁在做？会公开什么？',23,GRAY)
p3.text(770,65,'03',26,BLUE,True)
p3.text(52,162,'两个人制作，',72,INK,True)
p3.text(52,255,'每个阶段都开源。',68,BLUE,True)
p3.rect((54,320,846,515),PALE)
p3.text(83,397,'创',54,INK,True);p3.text(83,467,'游戏设计师',27,GRAY)
p3.text(490,397,'我',54,INK,True);p3.text(490,467,'制作人',27,GRAY)
p3.text(54,597,'把游戏做出来，也把过程留下来。',35,INK,True)
p3.text(54,668,'从立项开始，按阶段分享成果、问题和总结。',26,GRAY)
p3.text(54,775,'阶段开放的资料',31,BLUE,True)
for j,(a,b) in enumerate([('设计文档','玩法与制作方案'),('源码与工具','代码、脚本与工程记录'),('美术与音频','阶段素材与制作资料')]):
    y=850+j*77
    p3.text(54,y,a,31,INK,True);p3.text(315,y,b,27,GRAY)
p3.text(54,1110,'已有成果会重新审视、修改和复用。',27,INK)
p3.text(54,1167,'配图内容草稿 / 开放计划，尚未表示资料已经发布',19,GRAY)
p3.finish()

sheet=Image.new('RGB',(1440,750),'#e4e8ec');d=ImageDraw.Draw(sheet)
head=ImageFont.truetype(FONTS[True],29); small=ImageFont.truetype(FONTS[False],21)
d.text((30,22),'《代号柒》第一篇帖子 · 三张配图内容草稿',font=head,fill=INK)
pages=[p1,p2,p3]
for i,p in enumerate(pages):
    thumb=p.image.resize((450,600),Image.Resampling.LANCZOS);sheet.paste(thumb,(30+i*465,83))
    d.text((30+i*465,698),['01 封面：桌游 → 电子游戏','02 游戏：轻松简单的搜打撤＋卡牌','03 团队：两人制作＋阶段开源'][i],font=small,fill=INK)
sheet.save(OUT/'三张配图概念总览.png')
manifest={'inputs':inputs,'pages':[{'file':p.name+'.png','text':p.texts} for p in pages], 'outputs':[]}
for file in OUT.iterdir():
    if file.suffix in ['.png','.svg']:
        manifest['outputs'].append({'name':file.name,'bytes':file.stat().st_size,'sha256':hashlib.sha256(file.read_bytes()).hexdigest()})
(OUT/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({'ok':True,'outputs':manifest['outputs']},ensure_ascii=True))
