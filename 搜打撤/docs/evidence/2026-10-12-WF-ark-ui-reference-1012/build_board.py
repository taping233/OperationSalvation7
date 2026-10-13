from pathlib import Path
import base64, hashlib, html, json, math
from PIL import Image
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.colors import HexColor, Color
from reportlab.lib.utils import ImageReader
import pypdfium2 as pdfium

ROOT=Path(__file__).parent
PROJECT=ROOT.parents[2]
OUT=ROOT/'output'
OUT.mkdir(exist_ok=True)
pdfmetrics.registerFont(TTFont('UI',r'C:\Windows\Fonts\msyh.ttc',subfontIndex=0))
pdfmetrics.registerFont(TTFont('Bold',r'C:\Windows\Fonts\msyhbd.ttc',subfontIndex=0))
W,H=1280,800
INK='#E5EDF0'; MUTED='#A7BAC4'; BASE='#111B22'; PANEL='#1B2932'; LINE='#344651'
GOLD='#E3B966'; CYAN='#89C2D1'; RED='#E58E8B'; GREEN='#94C5AE'
PDF=OUT/'arknights-ui-reference-board.pdf'
C=canvas.Canvas(str(PDF),pagesize=(W,H),pageCompression=1)
C.setTitle('代号柒 | 明日方舟肉鸽美术、UI与交互参考板')
C.setAuthor('Friday')
PAGES=[]
SRC=json.loads((ROOT/'sources.json').read_text(encoding='utf-8'))['refs']
REF={r['id']:r for r in SRC}
ASSET=PROJECT/'game/assets'
CITY=ASSET/'scenes/camp-transition-city-v1.webp'
CARD=[ASSET/'cards/spell-tt3-ice-spike.webp',ASSET/'cards/martial-tt3-double-shot.webp',ASSET/'cards/martial-tt3-bandage.webp']
NAME=['冰刺','连射','绷带']
TEXT_ERRORS=[]

def rect(x,y,w,h,fill=PANEL,stroke=None,r=0):
    C.setFillColor(HexColor(fill))
    if stroke:C.setStrokeColor(HexColor(stroke))
    if r:C.roundRect(x,H-y-h,w,h,r,stroke=bool(stroke),fill=1)
    else:C.rect(x,H-y-h,w,h,stroke=bool(stroke),fill=1)

def line(x1,y1,x2,y2,color=LINE,width=1):
    C.setStrokeColor(HexColor(color)); C.setLineWidth(width)
    C.line(x1,H-y1,x2,H-y2)

def txt(s,x,y,size=14,color=INK,bold=False):
    C.setFont('Bold' if bold else 'UI',size); C.setFillColor(HexColor(color))
    C.drawString(x,H-y-size*.86,str(s))

def para(s,x,y,w,size=14,color=MUTED,leading=None,bold=False,max_h=None):
    font='Bold' if bold else 'UI'; leading=leading or size*1.6
    yy=y
    for segment in s.split('\n'):
        buf=''
        for ch in segment:
            if pdfmetrics.stringWidth(buf+ch,font,size)>w and buf and ch not in '，。！？：；）】”':
                txt(buf,x,yy,size,color,bold); yy+=leading; buf=ch
            else:buf+=ch
        if buf:txt(buf,x,yy,size,color,bold); yy+=leading
    if max_h and yy-y>max_h:TEXT_ERRORS.append({'text':s[:35],'height':yy-y,'max':max_h})
    return yy

def image(path,x,y,w,h,cover=False):
    with Image.open(path) as im:
        iw,ih=im.size
        scale=max(w/iw,h/ih) if cover else min(w/iw,h/ih)
        dw,dh=iw*scale,ih*scale
        C.saveState()
        clip=C.beginPath();clip.rect(x,H-y-h,w,h);C.clipPath(clip,stroke=0)
        C.drawImage(ImageReader(im),x+(w-dw)/2,H-y-h+(h-dh)/2,width=dw,height=dh,mask='auto')
        C.restoreState()

def badge(label,x,y,w=90,color=CYAN):
    rect(x,y,w,26,fill=PANEL,stroke=LINE)
    txt(label,x+10,y+6,11,color,bold=True)

def pin(n,x,y):
    C.setFillColor(HexColor(GOLD)); C.circle(x,H-y,13,fill=1,stroke=0)
    C.setFont('Bold',12); C.setFillColor(HexColor(BASE)); C.drawCentredString(x,H-y-4,str(n))

def button(label,x,y,w=160,h=40,primary=False,disabled=False):
    fill=GOLD if primary and not disabled else PANEL
    rect(x,y,w,h,fill=fill,stroke=LINE if not primary or disabled else None)
    color=BASE if primary and not disabled else MUTED if disabled else INK
    C.setFont('Bold',13); C.setFillColor(HexColor(color))
    C.drawCentredString(x+w/2,H-y-h/2-4,label)

def note(n,title,body,x,y,w=340):
    pin(n,x+12,y+13);txt(title,x+35,y,17,INK,True)
    para(body,x+35,y+31,w-35,13,leading=21,max_h=115)

def new(title,sub,kind='我方建议',summary=''):
    num=len(PAGES)+1
    rect(0,0,W,H,BASE)
    txt('代号柒  /  UI REFERENCE',40,24,12,CYAN,True)
    txt(f'{num:02d} / 13',1150,24,12,MUTED)
    txt(title,40,64,31,INK,True)
    para(sub,40,109,1120,14,MUTED,leading=21,max_h=45)
    badge(kind,1140,65,100,GOLD if kind=='我方建议' else CYAN)
    line(40,150,1240,150)
    line(40,750,1240,750)
    txt('来源观察与替代建议分开标注 · 2026-10-12 · 只整理美术/UI/交互',40,768,10,MUTED)
    txt('图内结构注释不作玩家文案；正文入口 reference-board.md',894,768,9,MUTED)
    PAGES.append({'title':title,'sub':sub,'kind':kind,'summary':summary})

def finish():C.showPage()

def screen(x,y,w,h,kind='event',selected=False,received=False,full=False,choose=False):
    C.saveState()
    C.translate(x,H-y)
    C.scale(w/898,h/470)
    C.translate(0,-H)
    x,y,w,h=0,0,898,470
    rect(x,y,w,h,fill='#0D151B',stroke=LINE)
    image(CITY,x,y,w,h,cover=True)
    C.saveState();C.setFillColor(Color(.04,.08,.11,alpha=.28));C.rect(x,H-y-h,w,h,fill=1,stroke=0);C.restoreState()
    sh=35
    rect(x,y,w,sh,fill='#17232C')
    txt('第 2 层 · 城市外缘',x+14,y+10,11,CYAN,True)
    txt('生命  28 / 40    金币  18    背包  '+('10 / 10' if full else '7 / 10'),x+w-310,y+10,11,INK)
    rect(x,y+h-40,w,40,fill='#17232C')
    txt('背包  /  当前携带物品',x+14,y+h-27,11,MUTED)
    txt('查看背包',x+w-95,y+h-27,10,CYAN)
    if kind=='event':
        px=x+w*.57;pw=w*.41
        rect(x+20,y+h-162,w*.51,107,fill='#17232C')
        txt('断电的补给终端',x+36,y+h-149,22,INK,True)
        para('风雪掠过高架桥。路边的自动补给终端仍亮着一盏灯，屏幕上留下了短短一行求助讯息。',x+36,y+h-112,w*.47,12,leading=20,max_h=70)
        choices=[('接通临时电源','【结构注释：已知代价与所得】'),('检查遗留物资','【结构注释：已知结果或条件】'),('沿着高架桥离开','离开这个事件')]
        for i,(a,b) in enumerate(choices):
            yy=y+61+i*85
            rect(px,yy,pw,72,fill='#263B47' if selected and i==0 else '#182630',stroke=GOLD if selected and i==0 else LINE)
            if selected and i==0:rect(px,yy,4,72,fill=GOLD)
            txt(a,px+15,yy+12,15,INK,True)
            txt(b,px+15,yy+41,10,MUTED)
        button('确认选择' if selected else '先选择一个选项',px,y+h-98,pw,39,primary=selected,disabled=not selected)
    if kind=='reward':
        px=x+w*.06;py=y+52;pw=w*.88;ph=h-103
        rect(px,py,pw,ph,fill='#17242D',stroke=LINE)
        txt('选择 1 张带走' if choose else '搜刮完成',px+20,py+12,22,INK,True)
        txt('待领取 · 普通宝箱 · 来源始终可见',px+20,py+45,11,MUTED)
        cw=pw*.20;ch=ph*.52;gap=pw*.025;cy=py+76
        for i in range(3):
            cx=px+20+i*(cw+gap)
            rect(cx,cy,cw,ch,fill='#22333D',stroke=GOLD if selected and i==0 else LINE)
            image(CARD[i],cx+4,cy+5,cw-8,ch-39)
            txt(NAME[i],cx+10,cy+ch-27,12,INK,True)
            if received and i==0:
                rect(cx,cy+ch*.42,cw,28,fill='#244139')
                txt('已入背包',cx+10,cy+ch*.42+7,11,GREEN,True)
            elif selected and i==0:txt('已选中',cx+cw-52,cy+8,10,GOLD,True)
        dx=px+pw*.72;dw=pw*.25
        txt('冰刺' if selected else '查看物品',dx,cy+5,17,INK,True)
        para('【结构注释】此区绑定选中物品的完整描述；不是最终玩家文案。' if selected else '点选一张卡牌，查看详情与实际去向。',dx,cy+38,dw,11,leading=19,max_h=78)
        txt('去向：本次远征背包',dx,cy+116,10,CYAN)
        button('背包已满' if full else '已收下' if received else '收下这张' if selected else '先选择物品',dx,cy+145,dw,35,primary=selected and not received and not full,disabled=full or received or not selected)
        fy=py+ph-47
        txt('剩余 2 张待领取' if received else '背包 10 / 10 · 这张暂时放不下' if full else '背包 7 / 10 · 当前查看不占格',px+20,fy+9,11,RED if full else MUTED)
        button('放弃其余并离开' if received else '放弃卡牌并离开',px+pw-307,fy,155,34)
        if not choose:button('整理背包' if full else '全部收下',px+pw-142,fy,122,34,primary=full or not selected)
    C.restoreState()

# 01: selection and transfer principles
new('只取对代号柒有用的五件事','以冬日科幻城市与块面厚涂为视觉基底；现有页面可以删减重组。先解决看懂、选对、收下、离开。',summary='优先采用事件分区、奖励去向、稳定工具带、对象详情、少量强调色。')
image(CITY,40,175,750,330,cover=True)
rect(40,393,750,112,fill='#192A35')
txt('环境有情绪，操作有秩序',63,413,26,INK,True)
para('场景的大色块留完整，正文有安静的不透明底；琥珀只指向当前主动作。',63,458,704,14,INK)
for i,(a,b) in enumerate([
 ('事件分区','左侧看场景与故事，右侧比较选项。'),
 ('奖励去向','待领取与已拥有分开，收下后指向背包。'),
 ('稳定工具带','状态固定在上，背包固定在下，内容在中间。'),
 ('对象详情','预览与执行分开，关闭详情保留原位置。'),
 ('强调节制','同一时刻一个主动作，红色只给风险。')]):
    note(i+1,a,b,820,178+i*75,390)
for i,(a,b) in enumerate([('优先做','事件替代布局；奖励三种状态；满包反馈。'),('后续做','地图预览；物品详情；商店商品与价格。'),('取舍','不沿用古堡/园林装饰；不堆细线与小英文。')]):
    x=40+i*408
    txt(a,x,553,18,GOLD,True)
    para(b,x,590,365,15,INK,leading=25,max_h=100)
finish()

# 02: real event reference
new('事件原图：场景、故事、选择，各自有位置','读图只确认静态可见事实；右侧“确定这么做？”说明这个画面有独立的确认呈现。',kind='来源观察',summary='原图采用大场景、左下叙述、右侧纵列选项；顶部与底部状态持续可见。')
image(ROOT/'refs/event.png',40,184,820,370)
for n,x,y in [(1,160,275),(2,269,459),(3,657,297),(4,811,276),(5,526,519)]:pin(n,x,y)
note(1,'大场景负责氛围','背景可观看，功能信息沿边缘安排。借布局，不借园林和戏台题材。',893,183,340)
note(2,'故事贴着场景','标题、叙述在左下成组，不与选项全文混排。',893,286,340)
note(3,'选项可逐项比较','动作名在上，已知结果在下，每项有完整独立区域。',893,389,340)
note(4,'确认落在所选对象','选中反馈与确认提示相邻，玩家能复核正在选哪一项。',893,492,340)
note(5,'上下保留上下文','资源与随身信息没有因进入事件而全部消失。',893,595,340)
txt('对我们最有用',40,590,19,GOLD,True)
para('采用分区与阅读顺序；把正文从画面的碎纹理中移到安静信息面。选项先给动作，再给已知结果。',40,627,802,16,INK,leading=26,max_h=80)
C.linkURL(REF['event']['source'],(40,H-729,850,H-706),relative=0)
txt('图源：TapTap 玩家截图 · 岁的界园志异 · 点击此行查看原出处',40,709,11,CYAN)
finish()

# 03: replacement event design
new('事件替代方案：一张完整场景，两个安静阅读区','布局示意：现有素材只作构图占位；结构注释不作玩家文案，比例与尺寸可按内容调整。',summary='场景约60%，选项约40%。故事与选项分层；比例是起点，现有布局与素材可替换。')
screen(40,174,892,469,'event',selected=True)
for n,x,y in [(1,277,316),(2,164,560),(3,749,264),(4,803,568)]:pin(n,x,y)
note(1,'让环境成为主体','城市空间保持大形与冷天光；人物/终端焦点避开正文。',965,179,270)
note(2,'标题与短故事','标题 24–28 px；正文 16–18 px，行高 1.5–1.65。长文在故事区展开。',965,287,270)
note(3,'右侧选项列','选项宽度稳定；动作 18–20 px，结果说明 14–16 px。超过三项仅选项区滚动。',965,402,270)
note(4,'一次只强调确认','选项以窄色条表达选中；主按钮用琥珀。未选时写“先选择一个选项”。',965,520,270)
para('构图起点：场景/叙述 58–62%，选项 38–42%；间隔 24–32 px。正文与选项都使用低纹理信息面。',40,676,875,14,INK,leading=23,max_h=55)
finish()

# 04: event flow
new('事件交互：先看清，再选择，再让结果落地','改变的是动作组织与反馈；事件结果继续引用对应的现行内容。确认不必再叠一个通用弹窗。',summary='初始未选→选中并预览→确认结果→返回地图。仅不可恢复动作使用针对性确认。')
states=[('01  未选择','场景与短故事先可读。选项全可看，确认按钮保持受限。','先选择一个选项',False),('02  已选中','仅当前选项亮边/色条。已知结果紧贴它，主按钮可用。','确认选择',True),('03  结果已发生','保留场景与事件标题，原选择区改为结果卡，再给继续。','返回地图',True)]
for i,(a,b,bt,active) in enumerate(states):
    x=40+i*406
    txt(a,x,185,20,CYAN,True)
    rect(x,225,380,285,fill=PANEL,stroke=LINE)
    image(CITY,x,225,380,120,cover=True)
    txt('断电的补给终端',x+16,359,17,INK,True)
    if i<2:
        for j in range(2):
            rect(x+16,391+j*41,348,34,fill='#263B47' if i==1 and j==0 else '#14212A',stroke=GOLD if i==1 and j==0 else LINE)
            txt('接通电源 · 查看已知结果' if j==0 else '离开 · 保留当前状态',x+28,400+j*41,12,INK)
    else:
        txt('已获得补给',x+16,399,20,GREEN,True)
        txt('名称 / 数量 / 实际去向',x+16,435,13,INK)
        txt('状态条同步显示已经发生的变化',x+16,461,11,MUTED)
    button(bt,x,528,380,44,primary=active,disabled=not active)
    para(b,x,599,364,15,INK,leading=25,max_h=75)
txt('反馈建议',40,697,14,GOLD,True)
txt('选中反馈 120–180 ms；结果强调 180–260 ms；结果事实先可见，动画不锁住继续。均为设计起点。',138,697,12,MUTED)
finish()

# 05: reward view
new('领奖励长这样：待领卡牌在中央，去向在右侧','把奖励从“出现了什么”做成“我看哪件、收哪件、已经收了什么”。可整体替换旧领取排布。',summary='结果/来源→待领取对象→选中详情与去向→底部容量与主动作。卡面点击仅预览。')
screen(40,180,898,470,'reward',selected=True)
for n,x,y in [(1,295,257),(2,250,391),(3,831,397),(4,211,594)]:pin(n,x,y)
note(1,'标题与来源分层','“搜刮完成”是结果；普通宝箱/战斗掉落是来源。来源小一档但始终可见。',970,180,264)
note(2,'奖励是画面主角','卡面不缩成图标；一张卡一个名称。数量多时滚动对象区，底部不动。',970,292,264)
note(3,'查看与收下分开','单击卡面只预览；右侧写完整规则、实际去向，再给“收下这张”。',970,409,264)
note(4,'容量贴着动作','显示当前容量及这张能否放下；卡牌估值与实际金币收益分开表达。',970,527,264)
para('建议结构：对象区约 68%，详情约 32%；底部固定 64–80 px。普通奖励保留逐件与批量入口。',40,683,890,14,INK,leading=23,max_h=48)
finish()

# 06: reward states
new('领取全过程：看一件 → 收一件 → 留下一条明确记录','不以卡牌消失作为唯一成功信号。收下后留“已入背包”标记，剩余待领内容保持原位。',summary='预览不会领取；确认后标记已收并显示去向；继续浏览保持选择与滚动位置。')
for i,(a,b) in enumerate([('01  查看','点击卡面，边缘出现选中轮廓；右侧显示详情。'),('02  收下','点击“收下这张”；数据成功后再显示领取成功。'),('03  复核','卡牌原位标“已入背包”；容量与待领数同步变化。')]):
    x=40+i*406
    txt(a,x,185,20,CYAN,True)
    rect(x,225,380,288,fill=PANEL,stroke=LINE)
    image(CARD[0],x+20,246,141,176)
    txt('冰刺',x+185,246,20,INK,True)
    para('卡面、名称、等级与完整规则保持身份一致。',x+185,289,175,12,leading=20,max_h=74)
    txt('去向：本次背包',x+185,372,12,CYAN)
    button('已收下' if i==2 else '收下这张',x+183,415,177,38,primary=i!=2,disabled=i==2)
    if i==1:
        line(x+156,444,x+325,481,GOLD,2)
        txt('物品 → 背包',x+47,476,12,GOLD,True)
    if i==2:
        rect(x+20,391,141,31,fill='#29423B')
        txt('已入背包',x+40,399,13,GREEN,True)
        txt('剩余 2 张待领取',x+22,474,13,INK)
    para(b,x,548,369,15,INK,leading=25,max_h=85)
txt('具体反馈',40,653,17,GOLD,True)
para('成功先显示静态标记，再做短距离“物品 → 背包”反馈；保持卡牌原位避免队列跳动。已收对象可继续查看，但不能重复领取。',40,686,1190,15,INK,leading=25,max_h=55)
finish()

# 07: choose and full
new('两种特殊状态：三选一与背包放不下','只改变呈现与操作组织；可领取条件、同名合并、特殊扩格等继续以相应规则判定。',summary='三选一先选再确认；满包保留奖励，给整理背包出口；离开明确说明遗留对象。')
txt('A  三选一：选中不等于已经领取',40,179,20,CYAN,True)
screen(40,219,588,322,'reward',selected=True,choose=True)
txt('B  满包：保留当前对象，给出下一步',657,179,20,CYAN,True)
screen(657,219,583,322,'reward',selected=True,full=True)
txt('三选一的按钮逻辑',40,575,18,GOLD,True)
para('标题明确“选择 1 张”。卡面点击只改变选中对象；“收下这张”确认。确认前可换选；离开写清将放弃哪些卡牌。',40,614,572,15,INK,leading=25,max_h=105)
txt('满包与离开的按钮逻辑',657,575,18,GOLD,True)
para('显示“这张暂时放不下”，收下按钮受限；“整理背包”成为主动作。返回后恢复同一奖励与已领标记。批量领取存在散落时，按钮文案写明数量。',657,614,578,15,INK,leading=25,max_h=105)
finish()

# Reward completion and explicit leave state.
new('收完与离开：两个终点，两个清楚的动作','收完后只留继续；还有待领对象时，离开确认直接列出会留下的内容，取消回到原奖励。',summary='待领取0→继续探索。剩余2张→明确放弃清单；取消保留选择、已领标记与滚动位置。')
txt('A  全部领取完成',40,187,22,CYAN,True)
rect(40,235,567,294,fill=PANEL,stroke=LINE)
txt('收获已整理',66,265,27,INK,True)
txt('已入背包 3 张  /  待领取 0 张',66,315,16,GREEN,True)
for i in range(3):
    image(CARD[i],68+i*94,353,72,85)
    txt(NAME[i],68+i*94,444,12,INK)
button('继续探索',347,457,232,43,primary=True)
para('全部收下后，去掉“收下/放弃”等失效动作。保留本次收获摘要与实际去向，主动作变为继续。',40,563,567,15,INK,leading=25,max_h=86)
txt('B  还有待领对象，准备离开',654,187,22,CYAN,True)
rect(654,235,586,294,fill=PANEL,stroke=LINE)
txt('还有 2 张卡牌未收下',680,265,26,INK,True)
txt('将留在这里：连射、绷带',680,318,17,RED,True)
para('已经收下的冰刺保留在背包。确认离开后，未收下的卡牌将散落。',680,359,528,15,INK,leading=25,max_h=73)
button('返回继续领取',680,457,206,43)
rect(901,457,311,43,fill=RED)
txt('放弃这 2 张并离开',942,470,15,BASE,True)
para('确认针对实际对象与数量。不要只问“确定吗”；取消后回到原位置，不重播开箱，不重置已收状态。',654,563,586,15,INK,leading=25,max_h=86)
txt('从整理背包返回',40,677,18,GOLD,True)
para('保持同一奖励清单、已收标记和当前查看对象；只重新计算容量与可领取状态。金币等结算时点继续以对应规则为准。',40,709,1180,13,MUTED,leading=21,max_h=40)
finish()

# 08: map + node preview
new('地图可借的是连接关系与预览层级','地图外观、排布与信息区可重做；连接与可前往关系读当前内容，借图学习关系表达。',kind='观察 / 建议',summary='地图呈现可替换；类别与状态分开表达，预览与进入动作分开，连接信息保持准确。')
image(ROOT/'refs/map.png',40,185,662,373)
pin(1,190,321);pin(2,469,322);pin(3,490,541)
badge('方舟原图',52,571,106)
para('图标+类别名；连线表达方向与汇合；顶部状态/底部随身信息保留。',40,615,658,14,INK,leading=23,max_h=75)
rect(733,185,507,373,fill=PANEL,stroke=LINE)
txt('我方建议：节点预览留在地图侧边',755,206,18,INK,True)
nodes=[(780,345,'当前位置'),(855,282,'事件'),(855,407,'补给'),(950,346,'商店')]
for a,b in [(0,1),(0,2),(1,3),(2,3)]:line(nodes[a][0],nodes[a][1],nodes[b][0],nodes[b][1],CYAN,2)
for i,(nx,ny,label) in enumerate(nodes):
    rect(nx-22,ny-22,44,44,fill='#314B58' if i==1 else '#1A2C35',stroke=GOLD if i==1 else LINE)
    txt(str(i+1),nx-5,ny-7,14,GOLD if i==1 else INK,True)
    txt(label,nx-28,ny+31,11,INK)
rect(1003,259,215,245,fill='#13212A',stroke=LINE)
txt('断电的补给终端',1017,278,15,INK,True)
para('类别：事件\n状态：可以前往\n预览：城市外缘的一次偶遇',1017,321,182,12,leading=23,max_h=92)
button('进入事件',1017,443,185,40,primary=True)
badge('我方建议',746,571,106,GOLD)
para('类别用图标与文字；状态用标记与明暗。选择后先看详情，执行按钮单独承担进入。关闭预览仍停在原处。',733,615,507,14,INK,leading=23,max_h=100)
C.linkURL(REF['map']['source'],(40,H-730,701,H-708),relative=0)
txt('图源：巴哈姆特水月主题整理 · 点击查看出处',40,712,11,CYAN)
finish()

# 09: detail reference+shop
new('商店可借的是商品身份、价格与动作层级','店景、人物位置与商品排布均可重做。商品比较区统一结构；买前看去向，买后原位标状态。',kind='观察 / 建议',summary='商人形象与商品区分离；名称、图像、价格对齐。原图红框为出处作者标记。')
image(ROOT/'refs/shop.png',40,179,687,387)
pin(1,254,257);pin(2,475,275);pin(3,580,454)
txt('原图里值得取的结构',758,185,22,INK,True)
note(1,'角色与商品分区','角色建立店铺身份；商品排列保持清楚，不压在人物脸与关键道具上。',758,233,472)
note(2,'同位置放同信息','名称在顶部、图像在中部、价格在底部，比较时不用重新找。',758,345,472)
note(3,'预算持续可见','余额与价格同屏，查看商品时仍能确认自己的状态。',758,457,472)
txt('我方具体替代建议',40,607,19,GOLD,True)
para('商品列表 + 右侧详情：点击商品先查看完整规则、价格与放置去向，再点击“购买并放入背包”。已购买标记留在原商品位置。余额不足、放不下分别给出原因与可用出口。',40,645,1167,15,INK,leading=25,max_h=80)
C.linkURL(REF['shop']['source'],(40,H-732,1100,H-711),relative=0)
txt('图源：IS Central 的游戏截图；原图红框是作者标记，仅观察商品布局 · 点击查看出处',40,715,11,CYAN)
finish()

# 10: reusable details
new('统一详情：大图认身份，正文讲规则，底部给动作','同一个物品在奖励、背包、商店之间保持同一名字、卡面和等级表达。详情可以共用，动作按场景变化。',summary='名称与图像相邻，规则有独立阅读面，估值/成本/去向分开；详情关闭保持原选择。')
rect(40,184,759,415,fill=PANEL,stroke=LINE)
image(CARD[0],64,209,271,335)
txt('冰刺',367,216,30,INK,True)
txt('法术  /  对应真实类别与等级',368,263,13,CYAN)
line(368,294,770,294)
txt('规则正文',368,315,14,MUTED,True)
para('【结构注释】这里绑定选中物品的真实完整描述。长文在当前阅读区展开，说明文字不进入玩家页面。',368,350,391,17,INK,leading=29,max_h=100)
txt('估值与实际支出分别标注',368,468,13,MUTED)
txt('实际去向：本次远征背包',368,501,14,CYAN,True)
button('收下这张',368,540,391,40,primary=True)
note(1,'阅读顺序','名称与类别 → 完整规则 → 价格/成本 → 去向 → 执行动作。说明面用稳定深色底。',840,187,390)
note(2,'动作随场景变','奖励：收下这张。\n商店：购买并放入背包。\n背包：展示当前可用的整理动作。',840,314,390)
note(3,'只展开一层详情','列表/场景 + 一层详情。长说明原位展开；整理背包切换前景，不堆叠新详情。',840,454,390)
txt('尺寸起点',40,648,17,GOLD,True)
para('详情标题 24–28 px，正文 16–18 px，标签 12–14 px；主要操作高 44–48 px。内边距 24–32 px；卡图、名称与等级不被选中效果覆盖。',40,685,1158,15,INK,leading=25,max_h=55)
finish()

# 11: hierarchy and palette
new('层级与色彩：让背景有层次，让文字有安静的落点','取方舟的分工方式，转成我们的冷灰、块面与暖金。不要把每个标题、边框都变成主焦点。',summary='层级从环境到反馈。暖金只给主动作与价值，状态保留文字/图形；近直角，正文不透明。')
layers=[('01  环境','冬日城市 / 大块冷天光', '#1C303A'),('02  氛围','雪、低频纹理与局部暖光', '#203744'),('03  结构','顶部状态 / 底部工具', '#263E4B'),('04  内容','卡牌 / 选项 / 节点', '#2A4856'),('05  文字','名称 / 正文 / 数字', '#345464'),('06  反馈','选中 / 已收 / 危险', '#3D6273')]
for i,(a,b,color) in enumerate(layers):
    yy=185+i*77
    rect(40+i*8,yy,602-i*8,63,fill=color)
    txt(a,60+i*8,yy+12,17,INK,True)
    txt(b,273+i*8,yy+17,13,INK)
txt('我们采用的色彩职责',701,185,23,INK,True)
for i,(color,name,desc) in enumerate([(GOLD,'金 / 琥珀','当前主动作、价值重点'),(CYAN,'冷青灰','环境身份与辅助定位'),(RED,'红','损失、危险与明确警示'),(GREEN,'绿','已完成/治疗等正向状态'),('#B89CD3','紫','诅咒/异能等已定语义')]):
    yy=242+i*62
    rect(704,yy,34,34,fill=color)
    txt(name,754,yy+1,16,INK,True);txt(desc,891,yy+5,13,MUTED)
txt('面板与文字',701,575,18,GOLD,True)
para('近直角、细边、低纹理底面。正文不直接贴高反差插画。单屏一个首要焦点；长内容只在自身区域滚动，主动作不被挤走。',701,613,513,15,INK,leading=25,max_h=100)
finish()

# 12: specification, source contract
new('可直接用于下一轮设计的交付清单','这是候选替代方案与制作依据；真实来源图仅证明静态布局，点击链路与动效是我方建议。',summary='下一轮先做事件、普通奖励、三选一/满包，随后地图与详情。来源版权归原作者。')
cols=[('先做 01','事件样板',['完整城市场景 + 左下短故事','右侧动作/已知结果分层','未选 / 已选 / 结果三态']),('先做 02','奖励样板',['待领区 + 详情/去向 + 固定底栏','预览 / 收下 / 已收三态','三选一 / 满包 / 离开确认']),('随后 03','地图与共用详情',['类别与状态分别表达','侧边预览 + 一个进入动作','奖励/商店/背包保持身份连续'])]
for i,(label,title,items) in enumerate(cols):
    x=40+i*405
    badge(label,x,185,98,GOLD)
    txt(title,x,239,24,INK,True)
    for j,item in enumerate(items):
        txt(f'{j+1:02d}',x,292+j*47,12,CYAN,True)
        para(item,x+35,289+j*47,345,14,INK,leading=23,max_h=44)
txt('验收看这些具体状态',40,461,21,INK,True)
para('长故事、长规则、多个选项、多件奖励、部分已领、全部已领、放不下、返回整理、取消放弃、重复点击。静态图也必须能看出结果与下一步。',40,503,1173,16,INK,leading=26,max_h=75)
txt('来源与依据',40,608,17,GOLD,True)
para('方舟原图：TapTap 事件、巴哈姆特水月地图、IS Central 商店。\n我方依据：当前美术方向、视觉规范，以及事件/奖励呈现源码；仅用于查清对象与去向。\n本板：原图观察 + 独立绘制的替代布局。示意文案与数值不写入玩法规则。',40,643,1173,13,MUTED,leading=23,max_h=88)
finish()
C.save()

if TEXT_ERRORS:raise RuntimeError(json.dumps(TEXT_ERRORS,ensure_ascii=False))
doc=pdfium.PdfDocument(str(PDF))
rendered=[]
for i,page in enumerate(doc):
    pil=page.render(scale=1.25).to_pil()
    target=OUT/f'plate-{i+1:02d}.jpg'
    pil.convert('RGB').save(target,quality=89,optimize=True)
    rendered.append(target)
    page.close()
doc.close()

# Standalone reference board: all imagery is embedded for reliable offline viewing.
nav=''.join(f'<a href="#p{i+1}">{i+1:02d} {html.escape(p["title"].split("：")[0])}</a>' for i,p in enumerate(PAGES))
sections=[]
for i,p in enumerate(PAGES):
    b64=base64.b64encode(rendered[i].read_bytes()).decode()
    sections.append(f'<section id="p{i+1}" aria-label="{html.escape(p["title"])}"><div class="section-label"><b>{i+1:02d}</b><span>{html.escape(p["kind"])}</span><a href="output/plate-{i+1:02d}.jpg" target="_blank">放大查看</a></div><img src="data:image/jpeg;base64,{b64}" alt="{html.escape(p["title"]+"。"+p["summary"])}"><p class="accessible-summary">{html.escape(p["summary"])}</p></section>')
links=''.join(f'<li><a href="{r["source"]}" target="_blank" rel="noopener">{html.escape(r["caption"])}</a></li>' for r in SRC)
HTML='''<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>代号柒 · 方舟肉鸽UI参考板</title><style>
:root{color-scheme:dark;--bg:#111b22;--fg:#e5edf0;--muted:#a7bac4;--gold:#e3b966;--line:#344651}*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;background:var(--bg);color:var(--fg);font-family:'Microsoft YaHei',sans-serif}a{color:#89c2d1;text-decoration:none}a:hover{text-decoration:underline}header{max-width:1360px;margin:auto;padding:48px 30px 28px}h1{font-size:32px;line-height:1.4;margin:0 0 16px}header p{max-width:950px;line-height:1.9;color:var(--muted)}.actions{display:flex;gap:20px;align-items:center;flex-wrap:wrap}.download{background:var(--gold);color:var(--bg);padding:12px 20px;font-weight:bold}nav{max-width:1300px;margin:0 auto 30px;padding:0 30px;display:flex;gap:10px 22px;flex-wrap:wrap;font-size:13px;line-height:1.8}main{max-width:1340px;margin:auto;padding:0 20px}section{margin:0 0 48px;scroll-margin-top:16px}.section-label{display:flex;gap:16px;align-items:center;padding:15px 8px;border-top:1px solid var(--line)}.section-label b{color:var(--gold)}.section-label span{color:var(--muted);font-size:12px}.section-label a{margin-left:auto;font-size:13px}section img{display:block;width:100%;height:auto}.accessible-summary{margin:12px 8px;color:var(--muted);line-height:1.8;font-size:14px}footer{max-width:1300px;margin:0 auto;padding:20px 30px 60px;border-top:1px solid var(--line)}footer li{margin:12px 0}footer p{color:var(--muted);line-height:1.9;font-size:13px}@media(max-width:600px){header{padding:26px 20px}h1{font-size:25px}main{padding:0 8px}nav{padding:0 20px}section{margin-bottom:25px}}
</style></head><body><header><div class="actions"><span>Friday / 2026-10-12</span><a class="download" href="reference-board.md">AI 主阅读入口</a><a href="output/arknights-ui-reference-board.pdf">辅助图版 PDF</a></div><h1>代号柒 · 明日方舟肉鸽 UI 参考板</h1><p>本资料给后续 AI 使用：先读文字版，再按编号读图。现有页面、布局与店景均可删减重做。图片中的结构注释不是玩家文案；比例与时长是起点，不是硬规范。正文包含完整状态、动作与适用条件。</p></header><nav>'''+nav+'</nav><main>'+''.join(sections)+'</main><footer><h2>图源与观察边界</h2><ul>'+links+'''</ul><p>方舟图像版权归原作者，仅用于设计分析。原图为静态截图，只证明可见布局。点击链路与动画为我方建议。图片是正文旁证；后续 AI 以文字入口与老板最新指令为准。城市与卡面只作布局占位，不构成保留要求。</p></footer></body></html>'''
(ROOT/'reference-board.html').write_text(HTML,encoding='utf-8')

# A compact overview for the chat; full plates retain the readable text.
thumbs=[]
for p in rendered:
    im=Image.open(p).convert('RGB');im.thumbnail((480,300));thumbs.append(im)
sheet=Image.new('RGB',(1440,math.ceil(len(thumbs)/3)*300),BASE)
for i,im in enumerate(thumbs):sheet.paste(im,((i%3)*480,(i//3)*300))
sheet.save(OUT/'overview.jpg',quality=92,optimize=True)

own=[CITY,*CARD]
sources=json.loads((ROOT/'sources.json').read_text(encoding='utf-8'))
sources['project_assets']=[{'path':p.relative_to(PROJECT).as_posix(),'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'usage':'布局示意，不证明素材最终认可'} for p in own]
sources['output']=[{'path':p.relative_to(ROOT).as_posix(),'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'bytes':p.stat().st_size,'acquisition':'手工编写正文或build_board.py生成图版；超1MB文件不进入git'} for p in [ROOT/'reference-board.md',PDF,ROOT/'reference-board.html',OUT/'overview.jpg',*rendered]]
sources['ai_entry']='reference-board.md'
sources['source_evidence']='静态截图仅证明可见布局；操作链路、尺寸与时长为我方建议'
sources['revision_review']='2026-10-12按老板要求完成内容审读；本轮未追加游戏测试或视觉验收'
sources['scope']='仅参考资料；未修改游戏、美术基准、玩法与存档'
(ROOT/'sources.json').write_text(json.dumps(sources,ensure_ascii=False,indent=2),encoding='utf-8')
(ROOT/'plates.json').write_text(json.dumps(PAGES,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({'pages':len(PAGES),'pdf_bytes':PDF.stat().st_size,'html_bytes':(ROOT/'reference-board.html').stat().st_size,'text_overflow':TEXT_ERRORS},ensure_ascii=False))
