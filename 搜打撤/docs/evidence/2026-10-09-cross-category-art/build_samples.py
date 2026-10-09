from pathlib import Path
from PIL import Image,ImageDraw,ImageFont,ImageOps
import hashlib,json
ROOT=Path(__file__).resolve().parent
W,H=1600,1000
BG=(29,37,45,242); LINE='#8d99a5'; TEXT='#eef2f5'; MUTED='#b4c0ca'; BLUE='#416f9b'; GOLD='#c79d5c'; DANGER='#cf8067'
FONT={False:'C:/Windows/Fonts/msyh.ttc',True:'C:/Windows/Fonts/msyhbd.ttc'}
sheet=Image.open(ROOT/'统一画风-卡牌插画.png').convert('RGB')
arts=[sheet.crop((i*sheet.width//3,0,(i+1)*sheet.width//3,sheet.height)) for i in range(3)]
texts=[]
class Screen:
    def __init__(self,path):
        self.im=ImageOps.fit(Image.open(path).convert('RGBA'),(W,H),Image.Resampling.LANCZOS)
        self.overlay=Image.new('RGBA',(W,H));self.d=ImageDraw.Draw(self.overlay)
    def txt(self,x,y,s,size=25,color=TEXT,bold=False):
        f=ImageFont.truetype(FONT[bold],size);box=self.d.textbbox((x,y),s,font=f)
        assert box[0]>=0 and box[2]<=W and box[1]>=0 and box[3]<=H,(s,box)
        self.d.text((x,y),s,font=f,fill=color);texts.append({'text':s,'box':box})
    def panel(self,box,accent=LINE):
        x,y,r,b=box
        self.d.polygon([(x+8,y),(r-15,y),(r,y+12),(r,b-5),(r-9,b),(x,b),(x,y+10)],fill=BG)
        self.d.line([(x+8,y+3),(r-17,y+3),(r-3,y+14)],fill=accent,width=3)
        self.d.line([(x+3,y+12),(x+3,b-5),(r-10,b-5)],fill='#53606b',width=1)
    def card(self,x,y,idx,name,kind,accent):
        self.panel((x,y,x+198,y+244),accent)
        a=ImageOps.fit(arts[idx],(180,174),Image.Resampling.LANCZOS).convert('RGBA')
        self.overlay.alpha_composite(a,(x+9,y+9))
        self.txt(x+14,y+190,name,24, TEXT,True);self.txt(x+125,y+198,kind,16,MUTED)
    def button(self,box,label,accent=BLUE):
        x,y,r,b=box;self.d.polygon([(x+8,y),(r-10,y),(r,y+10),(r,b),(x,b),(x,y+8)],fill=accent)
        font=ImageFont.truetype(FONT[True],27);width=self.d.textlength(label,font=font)
        self.txt(int((x+r-width)/2),y+16,label,27,TEXT,True)
    def common(self,title,status,accent):
        self.panel((26,24,490,112),accent)
        self.panel((1100,24,1574,112),accent)
        self.txt(50,42,'代号柒',32,TEXT,True);self.txt(216,50,'/ '+title,27)
        self.txt(1125,51,status,25,accent,True)
        self.panel((26,142,220,218));self.txt(46,151,'无',29,TEXT,True);self.txt(105,163,'当前角色',18,MUTED)
        self.panel((905,566,1572,894));self.txt(931,582,'随身卡牌',27,TEXT,True);self.txt(1260,589,'美术样板',19,MUTED)
        for i,(name,kind,a) in enumerate([('斩击','攻击',BLUE),('火球','能力',GOLD),('补给','物资',LINE)]):self.card(923+i*213,635,i,name,kind,a)
        self.panel((26,935,422,981))
        self.txt(44,943,'跨类别静态样板 · 界面为概念示例',14,MUTED)
        self.txt(44,964,'角色 / 场景 / 卡牌 / UI',12,MUTED)
    def save(self,name):
        out=Image.alpha_composite(self.im,self.overlay).convert('RGB');out.save(ROOT/name);return out

base=Screen(ROOT/'安全基地-场景角色.png')
base.common('整备基地','安全 · 准备出发',GOLD)
base.panel((1190,143,1572,469),GOLD)
base.txt(1216,165,'出发前整备',29,TEXT,True)
base.txt(1216,225,'整理携带的卡牌与物资',23,MUTED)
base.txt(1216,272,'确认装备，准备下一次探索',22,MUTED)
base.d.line((1216,328,1547,328),fill='#596875',width=1)
base.txt(1216,352,'出发准备',20,GOLD,True)
base.txt(1216,391,'卡牌 / 装备 / 随身物资',23,TEXT)
base.button((1190,913,1572,984),'开始探索',BLUE)
b=base.save('01-安全基地-跨类别样板.png')

risk=Screen(ROOT/'风险探索-场景角色.png')
risk.common('探索区域','警示 · 异常信号',DANGER)
risk.panel((1190,143,1572,492),DANGER)
risk.txt(1216,165,'前方发现异常',29,TEXT,True)
risk.txt(1216,225,'设施通道出现未知现象',23,MUTED)
risk.txt(1216,274,'继续深入，还是带着收获离开？',21,MUTED)
risk.d.line((1216,335,1547,335),fill='#596875',width=1)
risk.txt(1216,359,'行动选择',20,DANGER,True)
risk.txt(1216,401,'深入探索 / 寻找撤离',23,TEXT)
risk.button((905,913,1218,984),'继续深入',BLUE)
risk.button((1240,913,1572,984),'撤离',GOLD)
r=risk.save('02-风险探索-跨类别样板.png')
overview=Image.new('RGB',(1600,2150),'#e8ecf0');d=ImageDraw.Draw(overview)
font=ImageFont.truetype(FONT[True],33)
d.text((28,18),'同一画风 / 安全整备与风险探索',font=font,fill='#172736')
overview.paste(b,(0,77));overview.paste(r,(0,1107));overview.save(ROOT/'两种场景-样板总览.png')
manifest={'approved_reference_sha256':hashlib.sha256((ROOT/'老板确认画风参考.png').read_bytes()).hexdigest(),'text_layout':texts,'outputs':[]}
for p in ROOT.glob('*.png'):manifest['outputs'].append({'name':p.name,'size':Image.open(p).size,'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()})
(ROOT/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8')
print('PASS: 2 static samples; same UI/card family; text bounds valid')
