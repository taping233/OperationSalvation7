import json,math,re,html,io,hashlib
from pathlib import Path
from collections import defaultdict
from PIL import Image,ImageOps
from reportlab.pdfgen.canvas import Canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.utils import ImageReader
from reportlab.platypus import Paragraph
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.colors import HexColor,Color
from reportlab.lib.pagesizes import A4
from pypdf import PdfReader

B=Path(__file__).parent;ROOT=B.parents[2];ASSETS=ROOT/'game/assets'
D=json.loads((B/'catalog.json').read_text(encoding='utf-8'))
ART=json.loads((ROOT/'game/data/art-mapping.json').read_text(encoding='utf-8'))
OUT=B/'output/pdf';OUT.mkdir(parents=True,exist_ok=True)
pdfmetrics.registerFont(TTFont('YH','C:/Windows/Fonts/msyh.ttc',subfontIndex=0))
pdfmetrics.registerFont(TTFont('YHB','C:/Windows/Fonts/msyhbd.ttc',subfontIndex=0))
W,H=A4;M=38;CONTENT=W-2*M;COL=(CONTENT-18)/2;PANEL_H=335
INK='#182331';MUTED='#536373';BLUE='#23647A';BG='#F4F7F8';LINE='#D9E1E6'
COLORS={'现役':BLUE,'明确退役':'#9A5349','旧ID迁移或合并':'#7A693B','仅历史存在':'#626775'}
STATES=list(COLORS);TYPES=['武术','法术','装备','道具','资源','能力卡','事件','生物']
written=set();oldwritten=0;images={};issues=[];currentpage=0;mainpages={};historypages={}
def escape(t):
 t=re.sub(r'\[\[icon:([^]]+)\]\]',lambda m:{'coin':'币','crystal':'稀有度'}.get(m[1],m[1]),str(t))
 return html.escape(t).replace('\n','<br/>')
def para(t,x,top,width,size=11,leading=16,color=INK,bold=False,maxheight=None):
 st=ParagraphStyle('p',fontName='YHB' if bold else 'YH',fontSize=size,leading=leading,textColor=HexColor(color),wordWrap='CJK',spaceBefore=0,spaceAfter=0)
 p=Paragraph(escape(t),st);pw,ph=p.wrap(width,2000)
 if maxheight is not None and ph>maxheight+1:issues.append({'page':currentpage,'text':str(t)[:50],'height':ph,'budget':maxheight})
 p.drawOn(c,x,top-ph);return ph
def label(t,x,y,size=9,color=MUTED,bold=False):
 c.setFillColor(HexColor(color));c.setFont('YHB' if bold else 'YH',size);c.drawString(x,y,t)
def measure(t,width,size=11,leading=16):
 st=ParagraphStyle('m',fontName='YH',fontSize=size,leading=leading,wordWrap='CJK');return Paragraph(escape(t),st).wrap(width,2000)[1]
def priority(v):return (max([s.split(' ')[0] for s in v['sources'] if re.match(r'^\d{4}-',s)],default='0000'),any('搜打撤/game/' in s for s in v['sources']))
def main(e):return e['current'] or sorted(e['versions'],key=priority)[-1]['card']
F=['name','type','cost','rarity','cls','desc','dmg','dmgType','draw','heal','armor','infuse','value','sellable','unrandom','tokenOf']
def face(card):return {k:card[k] for k in F if k in card}
def old(e):return [v for v in sorted(e['versions'],key=priority) if face(v['card'])!=face(main(e))]
def stats(card):
 names={'dmg':'伤害','dmgType':'伤害类型','draw':'抽牌','heal':'回复','armor':'护甲','infuse':'注能','sellable':'可出售','unrandom':'排除随机','tokenOf':'衍生来源'}
 def value(v):return ('是' if v else '否') if isinstance(v,bool) else {'attack':'攻击','spell':'法术','fixed':'固定','true':'真实'}.get(str(v),str(v))
 return '   '.join(names[k]+' '+value(card[k]) for k in names if k in card)
def imagefor(card):
 cid=card['id'];override=ART.get('cardArtOverrides',{}).get(cid)
 candidates=([ASSETS/override] if override else [])+[ASSETS/'cards'/f'{p}-{cid}.webp' for p in ['martial','spell','equip','creature','event']]
 for p in candidates:
  if p.is_file():return p
 return None
def picture(p,x,y,w,h):
 key=str(p)
 if key not in images:
  im=Image.open(p).convert('RGBA');base=Image.new('RGB',im.size,'#EEF1F3');base.paste(im,mask=im.getchannel('A'));base=ImageOps.contain(base,(420,420));buf=io.BytesIO();base.save(buf,format='JPEG',quality=78,optimize=True);buf.seek(0);images[key]=ImageReader(buf)
 c.drawImage(images[key],x,y,w,h,preserveAspectRatio=True,anchor='c',mask='auto')
def newpage(title,sub='',bookmark=None,level=0):
 global currentpage
 if currentpage:c.showPage()
 currentpage+=1
 c.setFillColor(HexColor('#FFFFFF'));c.rect(0,0,W,H,fill=1,stroke=0)
 label('代号柒  /  卡牌总录',M,H-24,8)
 label(f'{currentpage:03}',W-M-22,23,9)
 label('2026.10.09',M,23,8)
 c.setStrokeColor(HexColor(LINE));c.line(M,39,W-M,39)
 if title:para(title,M,H-44,CONTENT,18,24,bold=True)
 if sub:para(sub,M,H-74,CONTENT,9,13,MUTED)
 if bookmark:
  c.bookmarkPage(bookmark);c.addOutlineEntry(title,bookmark,level=level)
 if currentpage>1:
  label('返回总目录',W-M-85,H-24,8,BLUE);c.linkRect('', 'index', (W-M-90,H-29,W-M,H-13),relative=0,thickness=0)

entries=[];groups=[]
for state in STATES:
 for typ in TYPES:
  g=sorted([e for e in D['cards'] if e['status']==state and main(e)['type']==typ],key=lambda e:(main(e)['name'],e['id']))
  if g:groups.append((state,typ,g));entries.extend(g)
indexpages=math.ceil(len(entries)/56)
page=2+indexpages
for state,typ,g in groups:
 for i in range(0,len(g),4):
  for e in g[i:i+4]:mainpages[e['id']]=page
  page+=1
sources={s['source']:f'S{i:02}' for i,s in enumerate(D['sources'],1)}
def refs(v):
 ss=[s for s in v['sources'] if s in sources];ids=[sources[s] for s in ss];return '、'.join(ids[:2])+(' 等，共 '+str(len(ids))+' 份来源记录' if len(ids)>2 else '')+'；完整关系见原始资料'

file=OUT/'代号柒卡牌图鉴与历史总录.pdf'
c=Canvas(str(file),pagesize=A4,pageCompression=1)
c.setTitle('代号柒卡牌图鉴与历史总录');c.setAuthor('Friday')

# Cover
newpage('','',bookmark=None)
c.setFillColor(HexColor('#173A4C'));c.rect(0,H-270,W,270,fill=1,stroke=0)
label('CARD CATALOGUE  /  ARCHIVE',M,H-68,10,'#C7DCE5')
para('代号柒\n卡牌图鉴与历史总录',M,H-100,CONTENT,27,39,'#FFFFFF',True)
label('331 个卡牌 ID   /   816 份卡面记录',M,H-233,12,'#FFFFFF')
coverart=[ASSETS/'cards/wu-void.webp',ASSETS/'cards/dark-eclipse.webp',ASSETS/'cards/martial-tt7-ironcharge.webp']
for i,p in enumerate(coverart):
 if p.is_file():picture(p,M+i*(CONTENT/3+2),H-446,CONTENT/3-8,150)
para('先查卡牌，再看旧版本',M,H-472,CONTENT,19,25,bold=True)
para('现役 272 张   ·   明确退役 49 张\n旧 ID 迁移或合并 2 张   ·   其他历史卡 8 张',M,H-510,CONTENT,12,21)
para('点击目录中的卡名即可跳转。速查页每页最多四张卡，旧版本独立放在历史附录；每张卡的“历史卡面”链接可直接查看变化。',M,H-568,CONTENT,11,18,MUTED)
para('覆盖本地当前与历史卡库、冻结旧端、原型及卡库快照。配图使用现有素材，历史条目的配图只作识别，不代表旧版本当时的卡图。',M,H-644,CONTENT,9,15,MUTED)
para('资料快照 2026年10月9日   整理 Friday',M,H-724,CONTENT,9,14,MUTED)

# Every-card clickable index
for idx in range(indexpages):
 newpage('卡名总目录',f'{idx+1} / {indexpages}   蓝色页码与卡名均可点击；也可使用 PDF 书签查找。','index' if idx==0 else None)
 batch=entries[idx*56:(idx+1)*56]
 for j,e in enumerate(batch):
  column=j//28;row=j%28;x=M+column*(COL+18);top=H-112-row*24
  card=main(e);name=card['name'];namewidth=COL-35
  if pdfmetrics.stringWidth(name,'YH',10)>namewidth:
   size=9
  else:size=10
  label(name,x,top,size,COLORS[e['status']])
  label(f"{mainpages[e['id']]:03}",x+COL-25,top,9,BLUE)
  short={'旧ID迁移或合并':'旧 ID','仅历史存在':'历史'}.get(e['status'],e['status'])
  label(card['type']+' · '+short,x,top-11,7.5)
  c.linkRect('', 'card-'+e['id'],(x,top-15,x+COL,top+12),relative=0,thickness=0)

# Four cards per page; the underlying effect text is never truncated.
for state,typ,g in groups:
 for start in range(0,len(g),4):
  key='group-'+state+'-'+typ if start==0 else None
  newpage(state+' / '+typ,f'{len(g)} 张   |   每页最多四张卡   |   '+('当前卡面' if state=='现役' else '可检索历史记录中的一个版本'),key,0)
  for pos,e in enumerate(g[start:start+4]):
   x=M+(pos%2)*(COL+18);top=H-110-(pos//2)*(PANEL_H+18);bottom=top-PANEL_H
   c.setFillColor(HexColor(BG));c.setStrokeColor(HexColor(LINE));c.roundRect(x,bottom,COL,PANEL_H,9,fill=1,stroke=1)
   c.setFillColor(HexColor(COLORS[state]));c.roundRect(x,bottom,COL,4,2,fill=1,stroke=0)
   card=main(e);written.add(e['id']);c.bookmarkHorizontalAbsolute('card-'+e['id'],top)
   c.addOutlineEntry(card['name']+'  '+e['id'],'card-'+e['id'],level=1)
   tx=x+14;cw=COL-28
   titleheight=para(card['name'],tx,top-15,cw-35,14,19,bold=True,maxheight=40)
   label(str(card.get('cost','?'))+' 费',x+COL-43,top-31,10,BLUE,True)
   idtop=top-20-titleheight
   label(e['id'],tx,idtop,8)
   details=card['type']+' · '+card.get('rarity','未记录')+'\n'+('职业 '+card['cls'] if card.get('cls') else '通用 / 职业未标注')
   if 'value' in card:details+='\n币值 '+str(card['value'])
   art=imagefor(card);imgtop=idtop-17
   if measure(card.get('desc','效果未记录'),cw,11,16)+measure(stats(card),cw,8.5,12)>140:art=None
   if art:
    picture(art,tx,imgtop-80,80,80)
    para(details,tx+91,imgtop,cw-91,10,16)
    desc_top=imgtop-95
   else:
    dh=para(details,tx,imgtop,cw,10,16);desc_top=imgtop-dh-11
   desc=card.get('desc','效果未记录')
   dh=para(desc,tx,desc_top,cw,11,16,maxheight=desc_top-bottom-62)
   ah=para(stats(card),tx,desc_top-dh-9,cw,8.5,12,MUTED,maxheight=desc_top-dh-9-bottom-30)
   oldlist=old(e)
   if oldlist:
    label(f'历史卡面 {len(oldlist)} 份  >',tx,bottom+16,9,BLUE)
    c.linkRect('', 'history-'+e['id'],(tx,bottom+9,tx+140,bottom+28),relative=0,thickness=0)
   else:label('单一卡面记录',tx,bottom+16,8,MUTED)

# History annex with spacious full-width blocks.
newpage('历史卡面附录','按卡牌 ID 分组。每条保留旧名称、完整效果、属性和来源编号。','history',0)
y=H-114
for e in entries:
 vv=old(e)
 if not vv:continue
 first=vv[0]['card']
 firstmeta=f"旧卡面 1   {first['name']}   |   {first['type']}   |   {first.get('cost','未记录')} 费   |   {first.get('rarity','未记录')}   |   {first.get('cls','通用或未标注')}"
 if 'value' in first:firstmeta+='   |   币值 '+str(first['value'])
 firstheight=sum([measure(firstmeta,CONTENT-24,10,15),measure(first.get('desc','效果未记录'),CONTENT-24,11,17),measure(stats(first),CONTENT-24,9,13),measure('来源 '+refs(vv[0]),CONTENT-24,8,12)])+43
 headerheight=measure(main(e)['name']+'  '+e['id'],CONTENT,14,20)+35
 if y-firstheight-headerheight<56:newpage('历史卡面附录','续页');y=H-108
 c.bookmarkHorizontalAbsolute('history-'+e['id'],y);historypages[e['id']]=currentpage
 c.addOutlineEntry(main(e)['name']+'  '+e['id'],'history-'+e['id'],1)
 header=main(e)['name']+'  '+e['id']
 hh=para(header,M,y,CONTENT,14,20,bold=True);y-=hh+7
 label('返回卡牌速查  >',M,y-8,9,BLUE);c.linkRect('','card-'+e['id'],(M,y-14,M+150,y+2),relative=0,thickness=0);y-=28
 for vi,v in enumerate(vv,1):
  card=v['card'];meta=f"旧卡面 {vi}   {card['name']}   |   {card['type']}   |   {card.get('cost','未记录')} 费   |   {card.get('rarity','未记录')}   |   {card.get('cls','通用或未标注')}"
  if 'value' in card:meta+='   |   币值 '+str(card['value'])
  source='来源 '+refs(v)
  body=card.get('desc','效果未记录')
  heights=[measure(meta,CONTENT-24,10,15),measure(body,CONTENT-24,11,17),measure(stats(card),CONTENT-24,9,13),measure(source,CONTENT-24,8,12)]
  needed=sum(heights)+43
  if y-needed<56:
   newpage('历史卡面附录',main(e)['name']+'  '+e['id']+'  续');y=H-110
  c.setFillColor(HexColor(BG));c.roundRect(M,y-needed,CONTENT,needed,6,fill=1,stroke=0)
  yy=y-12;xx=M+12;ww=CONTENT-24
  yy-=para(meta,xx,yy,ww,10,15,bold=True)+7
  yy-=para(body,xx,yy,ww,11,17)+7
  yy-=para(stats(card),xx,yy,ww,9,13,MUTED)+6
  yy-=para(source,xx,yy,ww,8,12,MUTED)
  if yy<y-needed+5:issues.append({'history':e['id'],'page':currentpage,'overflow':y-needed+5-yy})
  y-=needed+13;oldwritten+=1
 y-=12

newpage('状态依据与来源','资料范围与状态分类，供回查。','sources',0);y=H-114
notes=[('收录范围','272 张现役、49 张明确退役、2 张旧 ID 迁移或合并、8 张其余历史卡；共 331 个 ID、816 份卡面。本文保留全部 485 份附属历史卡面。'),('现役与退役','现役来自当前源码在空档装配后的卡库。明确退役依据 cards-sync v35、RETIRE_TT10、RETIRE_TT11 及按名清理新兵操典的代码。现役不代表可随机获取。'),('迁移与历史','builtin-sha 迁移至 starter-attack；builtin-jinchuangyao 合并并清理旧 ID。其余未在册且缺少明确整卡退役依据的卡单列为历史，不推断退役。'),('记录方法','稳定 ID 区分卡牌；同名不同 ID 分开保留。名称、费用、稀有度、职业、描述或属性改变，记作不同卡面。内部执行规则改变但卡面相同的记录合并。历史效果不作为当前规则。'),('资料边界','范围为本地所有 Git 引用中的卡库文件、当前源码、冻结 Godot、旧桌面端、原型及证据快照。未读取浏览器私有存档、远端未取回引用或其他外部库。'),('配图说明','配图来自当前工作区已留存素材，只按明确卡牌 ID 或覆盖映射匹配。无对应图的卡保持文字条目；历史版本不推断当时图像。'),('当前库基准','HEAD '+D['head']+'；cards-sync v'+str(D['syncVersion'])+'。CURRENT 指内存空档装配卡库，原始来源关系见 catalog.json。')]
for title,body in notes:
 hh=measure(body,CONTENT,11,17)+42
 if y-hh<56:newpage('状态依据与来源','续页');y=H-108
 y-=para(title,M,y,CONTENT,12,18,bold=True)+7;y-=para(body,M,y,CONTENT,11,17)+22
for s in D['sources']:
 t=sources[s['source']]+'   '+s['source']+'   /   提取 '+str(s['count'])+' 条'
 hh=measure(t,CONTENT,8,12)+10
 if y-hh<56:newpage('来源文件索引','Git 时间表示记录时点，不表示设计生效时间。');y=H-108
 y-=para(t,M,y,CONTENT,8,12,MUTED)+10
c.save()
assert written=={e['id'] for e in D['cards']}
assert oldwritten==485
assert not issues,issues
pdf=PdfReader(str(file));alltext='\n'.join(p.extract_text() for p in pdf.pages)
assert all(cid in alltext for cid in written)
assert len(pdf.pages)==currentpage
def outlinecount(xs):return sum(outlinecount(x) if isinstance(x,list) else 1 for x in xs)
assert outlinecount(pdf.outline)>=331
report={'pages':currentpage,'mainEntries':len(written),'historicalFaces':oldwritten,'totalFaces':len(written)+oldwritten,'illustrationFiles':len(images),'bookmarks':outlinecount(pdf.outline),'layoutOverflows':issues,'pdfBytes':file.stat().st_size,'pdfSha256':hashlib.sha256(file.read_bytes()).hexdigest(),'mainPages':mainpages,'historyPages':historypages,'artSources':[{'path':str(Path(p).relative_to(ROOT)),'sha256':hashlib.sha256(Path(p).read_bytes()).hexdigest()} for p in images]}
(B/'pdf-checks.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({k:v for k,v in report.items() if k not in ['mainPages','historyPages','artSources']},ensure_ascii=False))
