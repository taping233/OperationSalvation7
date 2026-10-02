from pathlib import Path
import json, hashlib, re, math, html
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.colors import HexColor, Color
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import Paragraph
from reportlab.lib.utils import ImageReader
from PIL import Image

HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[2]
OUT=ROOT/'output/pdf/七部门调研汇报-2026-10-02.pdf'
OUT.parent.mkdir(parents=True,exist_ok=True)
D=json.loads((HERE/'report-data.json').read_text(encoding='utf-8'))
M=json.loads((HERE/'measurements.json').read_text(encoding='utf-8'))
pdfmetrics.registerFont(TTFont('CN','C:/Windows/Fonts/msyh.ttc',subfontIndex=0))
pdfmetrics.registerFont(TTFont('CNBold','C:/Windows/Fonts/msyhbd.ttc',subfontIndex=0))
pdfmetrics.registerFontFamily('CN',normal='CN',bold='CNBold',italic='CN',boldItalic='CNBold')
W,H=960,540
BG=HexColor('#F4F3EC'); INK=HexColor('#17323F'); MUT=HexColor('#587079'); TEAL=HexColor('#157A75'); GOLD=HexColor('#BB8B42'); RED=HexColor('#B3593D'); LINE=HexColor('#D8E0DA'); WHITE=HexColor('#FFFFFF')
C=canvas.Canvas(str(OUT),pagesize=(W,H),pageCompression=1)
C.setTitle('代号柒：七部门证据调研与成品对标')
C.setAuthor('Friday / Codex')
N=0; bounds=[]

def text(t,x,y,size=12,color=INK,bold=False):
    C.setFillColor(color); C.setFont('CNBold' if bold else 'CN',size); C.drawString(x,y,t)

def para(t,x,y,width,size=12,color=INK,leading=None,maxh=None):
    style=ParagraphStyle('p',fontName='CN',fontSize=size,leading=leading or size*1.55,textColor=color,wordWrap='CJK',spaceAfter=0)
    p=Paragraph(t.replace('\n','<br/>'),style)
    aw,ah=p.wrap(width,1000)
    if maxh is not None and ah>maxh: raise ValueError(f'Overflow page{N}: {ah}>{maxh}: {t[:65]}')
    if y-ah<37: raise ValueError(f'Bottom overflow page{N}: {y-ah}: {t[:65]}')
    p.drawOn(C,x,y-ah); bounds.append({'page':N,'x':x,'y':y-ah,'w':width,'h':ah,'text':re.sub('<[^>]+>','',t)})
    return y-ah

def box(x,y,w,h,fill=WHITE,stroke=None):
    C.setFillColor(fill); C.setStrokeColor(stroke or fill); C.roundRect(x,y,w,h,10,fill=1,stroke=bool(stroke))

def page(title,kicker,sub='',dark=False):
    global N
    N+=1
    C.setFillColor(INK if dark else BG); C.rect(0,0,W,H,fill=1,stroke=0)
    C.bookmarkPage(f'p{N}'); C.addOutlineEntry(title,f'p{N}',level=0)
    text(kicker,44,505,10,TEAL if not dark else HexColor('#A9D5CE'),True)
    text(title,44,460,28,WHITE if dark else INK,True)
    if sub: para(sub,44,442,872,10.5,HexColor('#BFD0D1') if dark else MUT,maxh=31)
    C.setStrokeColor(HexColor('#34505A') if dark else LINE); C.line(44,38,916,38)
    text('FRIDAY  /  代号柒项目调研  /  2026-10-02',44,21,8,HexColor('#BFD0D1') if dark else MUT)
    text(f'{N:02d}',889,20,10,HexColor('#BFD0D1') if dark else MUT)

def end(): C.showPage()
def chip(t,x,y,w=118,color=TEAL):
    box(x,y,w,25,color); text(t,x+10,y+8,9.5,WHITE,True)

def points(items,x,y,width,size=11.8,gap=10):
    for s in items:
        text('•',x,y-size,14,TEAL,True)
        y=para(s,x+18,y,width-18,size,maxh=105)-gap
    return y

def image(path,x,y,w,h):
    im=Image.open(path); iw,ih=im.size; scale=min(w/iw,h/ih); dw,dh=iw*scale,ih*scale
    C.drawImage(ImageReader(im),x+(w-dw)/2,y+(h-dh)/2,dw,dh)
    return x+(w-dw)/2,y+(h-dh)/2,dw,dh

def chart_bar(t,v,x,y,w=300):
    text(t,x,y,12,INK,True); C.setFillColor(LINE); C.roundRect(x,y-21,w,9,4,fill=1,stroke=0)
    C.setFillColor(TEAL if v>=7 else GOLD if v>=6 else RED); C.roundRect(x,y-21,w*v/10,9,4,fill=1,stroke=0)
    text(f'{v:.1f}',x+w+12,y-21,14,INK,True)

def score(d): return sum(a*b for a,b in zip(d['scores'],D['weights']))/100
def player(d): return sum(a*b for a,b in zip(d['scores'][:4],D['weights'][:4]))/80
PRODUCT=sum(player(d)*w for d,w in zip(D['departments'][:4],[.3,.35,.2,.15]))
ENABLE=sum(score(d) for d in D['departments'][4:])/3

# 01
page('七部门近况：证据、评分与差距','BOARD REPORT  /  调研升级版',dark=True)
para('从“做了多少功能”\n转向“玩家得到多成熟的体验”',44,399,550,29,WHITE,leading=45,maxh=100)
para('Vite《搜打撤》 / v0.60.0 / HEAD c6ee206840\n本轮：当前代码盘点 + 14文件105断言 + NAI离线测试 + 五款成品公开对标。',46,262,565,14,HexColor('#BFD0D1'),maxh=70)
box(670,156,246,243,HexColor('#244752'))
text('老板认可的成品体验锚点',690,366,11,HexColor('#BFD0D1'))
text('火山的女儿',690,326,23,WHITE,True)
text('9.0',690,239,72,HexColor('#E6CA92'),True)
para('老板指定的评价参照；不是媒体分、Steam好评率或本轮独立重评。',690,216,200,10.5,HexColor('#BFD0D1'),maxh=52)
chip('内部管理评估',44,110,130); chip('不代替发行验收',184,110,150)
end()

# 02
page('现状判断：产品约6.3，开发支撑约7.0','01 / 老板先看这页','采用两套汇总，避免开发工具成绩抬高玩家体验。评分是证据支持的判断，非实测满意度。')
for x,val,label,note in [(44,PRODUCT,'玩家产品成熟度','部门1-4的前四维，按30/35/20/15汇总'),(354,ENABLE,'项目开发支撑能力','部门5-7的六维加权分，等权汇总'),(664,9,'火山的女儿锚点','仅玩家体验尺度；内部工程不对标')]:
    box(x,272,288,140); text(f'{val:.1f}',x+19,330,44,TEAL if x<664 else GOLD,True); text(label,x+21,304,14,INK,True); para(note,x+21,293,247,9.7,MUT,maxh=35)
points(['<b>已有可玩的核心：</b>真实第三层撤离接力完成，仓库2→14；战斗存在护甲、支付与连击决策。', '<b>工程有实绩：</b>本轮105断言通过、存量资产审计0错误；近期修过28项审计问题。', '<b>成品差距：</b>新手理解、规则去向、最终收束仍需完善；整局、当前画面与数值基线待补验。'],44,248,870,13,gap=13)
para('上一版7.3混合了功能存在、工具建设与玩家成熟度。本版改用成品锚点，并补回真实撤离和照相馆已改善的证据；分数变化不是项目突然退步。[E02/E04/E06/E08]',44,92,870,10.8,MUT,maxh=38)
end()

# 03
page('怎么打分：六维、两层汇总、四档证据','02 / 方法与边界','同一刻度只比较相同对象；分数可以被更强证据推翻，不能由测试数量自动得出。')
rows=[('功能完整 / 20%','模块与正式路径覆盖，取消/重复/恢复边界'),('规则可靠 / 25%','文本与执行一致、数据不损坏、奖励不重复'),('体验清晰 / 20%','理解成本、操作反馈、舒服程度与排版'),('内容深度 / 15%','有效选择、组合/成长/剧情的可消费结果'),('性能维护 / 10%','有条件说明的测量、回归成本与资产管理'),('验收交付 / 10%','同输入的测试/构建/实页/版本证据闭合')]
y=405
for label,desc in rows:
    text(label,44,y,12.5,INK,True); para(desc,235,y+11,340,11.3,MUT,maxh=28); y-=48
box(618,108,298,304)
para('<b>评分锚点</b>\n0-2：无实现或不可用\n3-4：原型/明显缺口\n5-6：可用，有关键遗留\n7-8：成熟并有较强验证\n9：优秀成品体验\n10：近乎无短板，证据全面',638,392,258,12,maxh=171)
para('<b>证据标签</b>\nA 本轮机器验证 / B 历史实机\nC 源码、文档与静态盘点\nD 评估者判断或未核实意见',638,206,258,11.2,MUT,maxh=80)
para('六维分=Σ(维度分×权重)。产品分取1-4部门前四维归一；支撑分取5-7部门六维加权后均值。评分是证据约束下的评审估计，不是客观质量测量。缺验收主要降低交付分/置信度，不单凭未测判定体验坏；未知内容深度按现有静态信号暂评。',44,100,870,10.3,MUT,maxh=40)
end()

# 04
page('五个对标，分别回答五类问题','03 / 成品对照','只使用已核实的公开产品说明；不编造竞品内部源码、测试、Agent、存档故障率和性能。')
y=405
for b in D['benchmarks']:
    box(44,y-54,872,61)
    text(b['name'],60,y-13,15,INK,True); text(b['role'],245,y-12,11.5,TEAL,True)
    para(b['facts'],245,y-24,650,10.4,MUT,maxh=37)
    C.linkURL(b['url'],(54,y-55,228,y+1),relative=0,thickness=0)
    text(b['id'],61,y-39,9,MUT); y-=65
para('火山的女儿9分是老板指定的体验锚点。其余四款作为维度标杆，本轮未统一实玩重评，所以不给“9.x总分”制造虚假的精确横向排行。Steam好评率与本报告0-10评分也不互换。',44,75,870,10.3,MUT,maxh=33)
end()

# 05
page('七部门评分矩阵：强弱在哪一列','04 / 部门雷达的可复核替代','部门六维总分表示该部门当前产出成熟度；“内容”在工具部门指实验/流程/生产产出的深度。')
headers=['部门']+D['dimensions']+['加权分']
xs=[44,265,358,451,544,637,730,823]
for h,x in zip(headers,xs): text(h,x+7,397,11,INK,True)
for i,d in enumerate(D['departments']):
    y=353-i*40; box(44,y-8,872,36,WHITE)
    text(f'{i+1}  {d["name"]}',55,y+4,12,INK,True)
    for v,x in zip(d['scores'],xs[1:7]):
        C.setFillColor(TEAL if v>=7 else GOLD if v>=6 else RED); C.roundRect(x,y-4,75,27,4,fill=1,stroke=0); text(f'{v:.1f}',x+26,y+4,12,WHITE,True)
    text(f'{score(d):.1f}',xs[-1]+26,y+4,14,INK,True)
para('权重：20% / 25% / 20% / 15% / 10% / 10%。界面低分来自阅读、排版与验证缺口，而不是缺少背景或立绘；开发工具高分也不等于游戏值得玩家长期玩。',44,88,870,11,MUT,maxh=38)
end()

# 06-12
for i,d in enumerate(D['departments']):
    page(d['name'],f'05 / 部门 {i+1}  ·  证据等级混合 A/B/C/D',d['verdict'])
    for j,(label,v) in enumerate(zip(D['dimensions'],d['scores'])):
        x=44+j*147; box(x,350,135,59,WHITE); text(label,x+10,389,10.3,MUT); text(f'{v:.1f}',x+10,363,19,TEAL if v>=7 else GOLD if v>=6 else RED,True)
    text('已有实质证据',44,329,14,INK,True)
    points(d['facts'],44,313,512,11.5,gap=9)
    box(594,135,322,204,WHITE)
    text(f'加权 {score(d):.1f}/10',611,311,20,TEAL,True)
    para('主要扣分：',611,293,288,11,INK,maxh=22)
    points(d['deductions'],610,275,289,10.5,gap=6)
    para('可信度：'+d['confidence'],611,161,286,9.5,MUT,maxh=22)
    para('<b>对照对象：</b>'+d['peer']+'。'+d['why'],44,130,512,10.3,MUT,maxh=70)
    para('<b>下一步：</b>'+d['next']+'<br/><b>验收：</b>'+d['accept'],594,121,322,9.5,INK,maxh=76)
    end()

# 13
page('美术舒服与排版合理，必须单独评价','06 / 历史视觉样本复核','5张1280×720历史截图；本轮重新看图，但没有重开当前游戏。舒服程度属主观判断，遮挡与破图属可见事实。')
image(ROOT/'docs/evidence/2026-09-30-vertical-slice-review/primary-start-supply.jpg',44,188,428,241)
image(ROOT/'docs/evidence/2026-09-30-vertical-slice-review/continue-extraction.jpg',488,188,428,241)
# annotation rectangles locate source facts rather than alter source pixels
C.setStrokeColor(RED); C.setLineWidth(2); C.rect(176,383,185,18,fill=0,stroke=1); C.rect(818,301,34,24,fill=0,stroke=1)
para('<b>左：补给页。</b>顶部收获条跨过遭遇标题开头。<br/><b>右：撤离整理。</b>右栏第二排“完成整理”按钮部分被容器裁掉。两个截图仍能完成操作，不能夸大为流程无法运行。[E06/E07]',44,180,872,11.2,maxh=52)
labels=['风格一致 6.5','色彩舒适 6.0','文字可读 5.5','排版层级 5.0','交互发现 5.5']
for j,label in enumerate(labels):
    box(44+j*176,74,164,38); text(label,54+j*176,88,11,INK,True)
para('独立视觉复核：历史样本静态表现均值5.7，见冬境风格，也见低对比、小字和留白失衡。基地CTA层级较好；奖励图有破图标记。动效/听感未评分。五项解释体验分，不重复计入总分，也不代表当前画面已复验。',44,68,872,9.5,MUT,maxh=31)
end()

# 14
page('看实际结果：结算能核账，不等于整局全验','07 / 证据案例一','真实路径优先；把成功、失败、未执行分开，避免把“一条能通”当作“所有路径成熟”。')
image(ROOT/'docs/evidence/2026-09-30-vertical-slice-review/continue-base.jpg',44,199,504,214)
text('09-30第三层正常撤离接力',574,387,17,INK,True)
points(['献祭3牌，余下12牌入库。','仓库2/25 → 14/25，可核对净增12。','消耗口袋8张：保留穿刺1，散失7。','首页记成功撤离1次，选档转为基地档案。'],574,362,342,12,gap=12)
box(44,77,872,105,WHITE)
para('<b>能证明：</b>这条第三层信标可达、献祭/入库/回基地有实际结果，前版遗漏了它。<br/><b>不能证明：</b>独立完整首玩、第四层终局、死亡安全格、第二局或普遍平衡。84:12墙钟含工具等待与用户接力，不能当真人局长。<br/><b>仍有问题：</b>“完成整理”按钮裁切；材料牌入仓后尚未兑换，木材资源栏0不能认定为材料丢失。[E06]',61,166,836,11.5,maxh=83)
end()

# 15
page('测试绿灯、性能改善：各自只证明自己的范围','08 / 证据案例二','本轮没有build、全量游戏套件、当前实页、真实付费生图或远端CI核验。')
box(44,216,425,194); text('本轮新证据',63,382,18,TEAL,True)
points(['14文件 / 105断言通过；输入前后指纹一致，17.31秒。','NAI离线18项：17通过、POSIX fsync 1跳过；沙箱临时目录WinError5，正式权限重跑通过。','存量资产审计：0错误 / 1162历史提示。','剧本日志出现Path2D缺失；断言通过不能当画面验收。'],61,365,389,11.7,gap=8)
box(489,216,427,194); text('照相馆已有改善，不能漏算',508,382,18,TEAL,True)
points(['09-29最新IAB真实悬停：P95 7.1ms、LoAF 0。','真实滚动+悬停：P95 27.8ms、3次51-61ms长帧；未全部达到120Hz目标。','老板实机验收已通过；旧20.5fps来自不同方法/早期状态，不做无条件前后倍率。','当前代码/设备/页面是否相同仍需复核，本轮未重测。'],506,365,389,11.7,gap=8)
text('验证维度不能互相替代',44,186,16,INK,True)
para('断言通过 → 所选逻辑契约。截图 → 当时外观。真实输入 → 所走交互链。性能测量 → 特定设备与采样条件。生产构建预算 → 产物指标。没有一种单项证据能自动证明其余五项。',44,168,872,13,maxh=55)
para('证据入口：[E02] 本轮JSON+原始日志；[E03] NAI离线日志；[E01] 资产盘点；[E08] 照相馆专项§三/四刀及老板实机验收。',44,80,872,10.5,MUT,maxh=34)
end()

# 16
page('统计能定位问题，但旧策略数据不能替当前版本','09 / 证据案例三','r24-T2-challenger：100局历史样本。未与当前版本或对照进行本轮配对，所以仅用作研究线索。')
text('历史100局结果',44,391,18,INK,True)
parts=[('撤离',46,TEAL),('死亡',51,RED),('弃局',3,GOLD)]
x=44
for label,n,color in parts:
    ww=5.0*n; C.setFillColor(color); C.rect(x,312,ww,45,fill=1,stroke=0); x+=ww
for j,(label,n,color) in enumerate(parts):
    C.setFillColor(color); C.rect(44+j*175,282,10,10,fill=1,stroke=0); text(f'{label} {n}局',61+j*175,282,12,INK,True)
text('通关 0 / 战斗胜率61.1%',44,247,22,INK,True)
para('833场战斗胜509，平均到第3层。它支持“深层生存值得研究”，不能证明游戏过难、当前策略46%撤离、或者新玩法一定改善。',44,224,506,12,maxh=73)
box(594,165,322,245,WHITE)
text('新基线需要这样建立',614,380,17,TEAL,True)
points(['冻结代码与实验设置。','同seed对照 T100+100。','只改变一个预先声明的变量。','独立V100+100验证。','100%配对，留停因/指纹。','弃局与超时分别≤5%。'],613,360,282,11.6,gap=8)
para('可关注：深层血量/护甲利用、火堆寻路、宝箱奖励是否被正确收取。旧ledger里“tuning + 缺独立V证据 + promote”的组合按新规不能当可靠晋级；需保留历史并重验，不能悄悄改写记录。[E12/E13]',44,123,872,12,maxh=62)
end()

# 17
page('怎样从6分段推进到7-8分段','10 / 下一周期建议','以下是建议验收批次，不是新增授权、排期承诺或分数保证。优先增加可信的玩家结果。')
steps=[('P0  先闭合核心路径','多箱#26定性；自然四层终局、死亡回城、刷新恢复；核对奖励/仓库增量。','退出条件：关键路径无阻断，结果可核账。'),('P1  再解决第一次理解','统一卡牌去向与带出规则；明确整备推荐；修裁切/遮挡/缺图。','退出条件：3-5名新玩家能解释规则并找到操作；当前窗口实页通过。'),('P2  然后建立数值基线','当前代码策略T/V配对；复核费用、深层收益、宠物与成长节奏。','退出条件：原始数据可复现，有独立验收集与失败归因。'),('P3  最后形成候选交付','冻结输入的全量与构建预算、关键画面/听感、运行素材登记与授权。','退出条件：版本、输入指纹、证据、未覆盖项一一对应。')]
y=401
for label,goal,exitnote in steps:
    box(44,y-67,872,75)
    text(label,60,y-15,15,TEAL,True); para(goal,300,y-2,590,11.5,maxh=35); para(exitnote,300,y-40,590,10.2,MUT,maxh=22); y-=86
para('暂缓扩大新系统：当前最有价值的投资，是让已有循环更清楚、更可靠、更有回报。更多卡牌、宠物或自动化脚本，不会自行修复排版、首次理解与终局验证缺口。',44,78,872,11.5,MUT,maxh=36)
end()

# source ledger
SOURCES=[
('E01','本轮只读盘点','docs/evidence/2026-10-02-seven-departments-review/measurements.json','静态池259、宠物6、成就26、strict显式源码JS31，另6个非源码JS文件。'),
('E02','本轮定向验证','docs/evidence/2026-10-02-seven-departments-review/2026-10-02T09-21-48.343Z-d90b0bd3.json','14文件105 passed，输入指纹；同名.log保留Path2D渲染异常。'),
('E03','本轮NAI离线验证','docs/evidence/2026-10-02-seven-departments-review/nai-offline-approved.log','18 tests，17通过1平台跳过；网络和凭证替身封闭。'),
('E04','审计修复与性能第二轮','docs/evidence/2026-10-01-full-audit-fix-perf/README.md','BC/ROOT/WORLD/INFRA共28项处置；第二轮全量与优化边界。'),
('E05','历史实机剧本验收','docs/evidence/2026-10-01-acceptance-scenes/README.md','七短场景pass；extract受阻；boss/fullrun未单独完成。'),
('E06','真实撤离接力实收','docs/evidence/2026-09-30-vertical-slice-review/continuation-result.md','第三层节点15、献祭3、入库12、仓库2→14；非独立整局。'),
('E07','历史试玩与界面观察','docs/evidence/2026-09-30-vertical-slice-review/review.md','规则表达、布局、可读性与实机覆盖边界；截图在同目录。'),
('E08','照相馆最新专项记录','docs/PHOTOLIB-PERF-TASK-2026-09-29.md','§三/四刀裁决：IAB真实悬停7.1ms、组合滚动27.8ms；老板验收。'),
('E09','跨平台质量及生图修复','docs/evidence/2026-10-02-quality-art-fixes-crossplatform/README.md','Windows153/10skip、Linux258相关测试；不等于完整项目验收。'),
('E10','现行待决与遗留','docs/PENDING.md','#13/#16/#19/#20/#26；后续2199全量为任务时点记录。'),
('E11','结构性债务现况','docs/DEBT-CAMPAIGN-2026-10.md','受控双轨、strict两批试点、engine拆分方案未实施。'),
('E12','Agent实验契约','docs/production/engineering/AGENT-EXPERIMENTS.md','同seed、独立T/V、指纹及晋级守卫；不能用旧裸均值晋级。'),
('E13','历史策略样本','output/r24-T2-challenger/summary.json','100局：extract46/death51/abandon3/clear0，833战509胜。'),
('E14','后续路线图','docs/roadmap.md','内容获取流程、词条校对、特殊事件/最终胜利及候选发布仍需完善。'),
('E15','历史晋级台账','output/agent-ledger.jsonl','末尾r23使用tuning/promote，未能由该行证明符合新版独立V规则。'),
('E16','成长与五档源码','game/data/pets.json','同时核对game/data/achievements.json与game/src/hub/game.storage.js。'),
('E17','音频运行源码','game/src/audio/sound.js','标题/通用/战斗曲、分控与回退；叙事验证见E02 narrative测试。'),
('E18','设计研究交付','docs/nightshift/2026-10-01-gameflow-study/MORNING-REPORT.md','预筛/原型与假设；历史晨报须用后续记录修正，不能当当前总状态。')]

for k in range(2):
    page(f'证据索引 {k+1}/2：按编号回到原始记录','APPENDIX / 本地来源','路径以 D:/素材/代号柒/搜打撤 为根；点击来源行打开本地原文件。SHA为制作时文件指纹，不是验收成绩。')
    y=408
    for eid,label,p,note in SOURCES[k*9:(k+1)*9]:
        raw=(ROOT/p).read_bytes(); sha=hashlib.sha256(raw).hexdigest()[:12]
        text(eid,44,y,11,TEAL,True); text(label,85,y,10.4,INK,True); text('SHA '+sha,731,y,8.7,MUT)
        para(html.escape(p),85,y-5,816,8.3,MUT,leading=10.4,maxh=23)
        para(note,85,y-19,816,8.9,INK,leading=12,maxh=25)
        C.linkURL((ROOT/p).as_uri(),(44,y-34,916,y+13),relative=0,thickness=0)
        C.setStrokeColor(LINE); C.line(44,y-36,916,y-36); y-=40
    end()

# 20
page('公开对标来源与调查限制','APPENDIX / 五款官方商店说明','联网核对日期2026-10-02。公开说明用于功能关系比较，不代替本轮统一实玩、满意度实验或竞品内部工程审计。')
y=407
for b in D['benchmarks']:
    text(b['id']+'  '+b['name'],44,y,13,INK,True)
    para(b['scope'],240,y+11,675,11.2,MUT,maxh=36)
    para(html.escape(b['url']),240,y-15,675,8.3,TEAL,maxh=23)
    C.linkURL(b['url'],(44,y-38,916,y+15),relative=0,thickness=0); y-=58
box(44,63,872,70,WHITE)
para('<b>限制：</b>本轮未启动游戏服务或新试玩；视觉评分基于5张历史截图。定向测试不是全量，NAI离线不是实际出图。未刷新远端引用、未核实远端CI、未构建。旧性能与策略数据保留方法/时点边界；评分包含主观判断，不是完成百分比、好评率或人才绩效排名。',61,118,838,10.7,maxh=50)
end()
C.save()
(HERE/'layout-bounds.json').write_text(json.dumps(bounds,ensure_ascii=False,indent=2),encoding='utf-8')
(HERE/'score-results.json').write_text(json.dumps({'product':PRODUCT,'enablement':ENABLE,'departments':[{'name':d['name'],'sixDim':score(d),'playerFour':player(d)} for d in D['departments']],'pages':N},ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({'pdf':str(OUT),'pages':N,'product':PRODUCT,'enablement':ENABLE,'bytes':OUT.stat().st_size},ensure_ascii=False))
