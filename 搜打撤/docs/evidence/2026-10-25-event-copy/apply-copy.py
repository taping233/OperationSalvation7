from pathlib import Path
import json
root=Path('.')
ev=root/'docs/evidence/2026-10-25-event-copy'
ev.mkdir(parents=True,exist_ok=True)
paths=['game/src/cards/cards.data.js','game/src/cards/cards.consts.js','game/src/cards/cards.sync.catalog.js','game/src/run/game.run.events.js','game/src/run/event-card-choice.js','game/src/run/shop-commission.js','narrative/events.ink','game/src/generated/narrative-events.js','game/src/home/story.last-lamp.js','game/src/hub/hub.archive.js','game/src/hub/hub.archive-v3.js','docs/production/design/STORY-PART-ONE.md']
json.dump({p:(root/p).read_text(encoding='utf-8') for p in paths},(ev/'before.json').open('w',encoding='utf-8'),ensure_ascii=False)
names=dict(zip('隧道血契|暴雨劫道|实验室余粮|塌方采掘点|满电动力锤|临时救护站|污染空投箱|熔断物资箱|末班配送无人机|巷口修鞋匠|高压急救|遗落的珍珠匣|双焰走私|黑箱调拨|故障重编|避难市集药摊|海堤箭库|地下商场黑市|装备征用令|最后一盏引路灯'.split('|'),'受困运输队|武装截查|失联配给柜|塌陷地下库|中断的接应|隔离线急救|封锁区投送|封存储备库|撤离登记台|战地整备|封存针剂|撤离遗存|封装火种|无署名封条|异常改装台|应急药品站|撤防射击位|暗巷赌约|转运军需|北门灯标'.split('|')))
def rep(s,a,b):
    if a not in s: raise RuntimeError('missing '+a[:90])
    return s.replace(a,b)
def rename(s):
    for a,b in names.items(): s=s.replace(a,b)
    return s
def edit(p,fn):
    path=root/p; old=path.read_text(encoding='utf-8'); new=fn(old)
    if old==new: raise RuntimeError('unchanged '+p)
    path.write_text(new,encoding='utf-8',newline='\n')
def data(s):
    pos=s.index('    // 拥有伤害词条'); head=rename(s[:pos])
    head=rep(head,'获得员工通行证A碎片和木材卡 ×1。','选择获得员工通行证A碎片 ×1 与木材卡 ×1，或碎片 ×1 与 2 币。')
    head=rep(head,'稳妥取走 3 币，或冒险深挖获得 6 币并损失 3 血。','取走外侧的 3 币，或深入坍塌处获得 6 币并损失 3 血。')
    return rep(head,'或接受送信委托','或接受接应委托')+s[pos:]
edit(paths[0],data)
edit(paths[1],lambda s:rep(s,'sdt-events-0919-v2-seeded','sdt-events-0919-v3-seeded'))
edit(paths[2],rename)
def runtime(s):
    s=rename(s)
    s=rep(s,"import { esc, escAttr } from '../core/shared.js';","import { esc, escAttr } from '../core/shared.js';\nimport { eventEncounterText } from '../core/event-encounter-text.js';")
    s=rep(s,'async function triggerEventCard(card, current) {','async function triggerEventCard(card, current) {\n  const encounter = eventEncounterText(card.id, game.characterId || game.myClass);\n  if (encounter.name) card = { ...card, name: encounter.name };')
    s=rep(s,"sub: esc((narrative && narrative.intro) || card.desc || '神秘事件发生了……'),","sub: esc(encounter.intro || (narrative && narrative.intro) || card.desc || '神秘事件发生了……'),")
    pairs=[
    ('<b>获取并离开</b>','<b>接受整备并离开</b>'),
    ('药摊暂无药水。','药品站暂无可领取的药水。'),('军需征用','军需转运费'),('黑市抽签','暗巷赌约'),
    ('指示灯变红，这次什么也没拿到。','骰子停下，这次没中。'),('黑市货架无法生成完整的三张奖品','本次赌约暂无完整的三张奖品'),
    ("label:'投骰领取'","label:'启动配给柜'"),("label:'碎片与木材'","label:'领取建材补给包'"),("label:'碎片与货币'","label:'领取轻装补给包'"),
    ("label: '成交'","label: '协助搬出重箱'"),("eventCommands.damage(5, '受困运输队')","eventCommands.damage(5, '搬运途中擦伤')"),
    ('[[icon:demon]] 恶魔收走了 5 点生命力，并丢给你一个军用保险柜','[[icon:tools]] 你在拖出重箱时被破损的车架划伤（-5 血）。运输队按约把军用保险柜留给了你。'),
    ("'恶魔的报酬'","'运输队留下的军用保险柜'"),("label: '拒绝', detail: '无事发生'","label: '不作停留', detail: '不搬运，也不领取物资'"),('你顶住了诱惑，继续赶路','你示意无法停留，沿侧巷继续赶路。'),
    ("label:'投骰开箱'","label:'接通储备库电源'"),("label: '查看并领取'","label: '带走闪金之锤'"),
    ("label:'接受送信委托'","label:'接下交接凭据'"),('替校工把配送凭据交给下一家商店','替运输员把接应凭据交给下一家商店'),
    ('校工把配送凭据塞进你的手里：“交给下一家店的行商，两格货物算我的账。”','运输员把接应凭据塞进你手里：“交给下一处交易点的人。认这个签名，两件货物算我的账。”'),
    ("label:'接受处理'","label:'包扎伤口'"),("label: '接受强化急救'","label: '使用封存针剂', detail: '生命上限 +3，并回复 3 点生命'"),
    ("label: '取走珍珠匣'","label: '接过珍珠匣', detail: '获得卡牌「珍珠盒」'"),
    ("label: '接收封装火种'","label: '接过两份火种', detail: '获得「火球」×2'"),
    ("label: '启封黑箱'","label: '拆开封条', detail: '获得 1 个职业·密封物资箱'"),('军方调拨的黑色职业宝箱','回收点留下的职业物资箱'),
    ("label: '接入重编台'","label: '接入改装台'"),("label: '查看药摊'","label: '领取一瓶应急药水'"),
    ("label:'投骰打开弹药柜'","label:'取出封存箭具', detail:'投骰获得 2 张随机非职业箭系列卡牌'"),
    ("label: '查看黑市货物'","label: '看看季渊的赌注'"),("label: '放弃征用'","label: '不领取装备'"),
    ('你没有签下军需转运费单','你没有领取转运装备，留下货币继续前进。'),('爱心救济站为你处理了伤口','急救点的值守者替你处理了伤口'),
    ('// 修鞋铺（2026-09-09 审计补实装）','// 战地整备'),('修鞋铺送了你一枚员工通行证A碎片','整备队交给你一枚员工通行证A碎片'),
    ('修鞋铺 · 修整行装','战地整备 · 修整行装'),('老师傅替你修整行装。','整备队在撤离前替你修整一件行装。')]
    for a,b in pairs: s=rep(s,a,b)
    return s
edit(paths[3],runtime)
edit(paths[4],lambda s:rep(rep(rename(s),'污染区药师只能保住一瓶——从 3 瓶随机药水中选择 1 瓶。','庇护所的存量有限——从 3 瓶随机药水中选择 1 瓶。'),'已支付 3 币。从军需官摆出的 3 件装备中选择 1 件。','已支付 3 币转运费。从货位上的 3 件装备中选择 1 件。'))
def commission(s):
    for a,b in [('配送凭据','接应凭据'),('校工已经替你结了账','凭据已经兑付'),('核对了校工的签名','核对了运输员的签名'),('由校工付钱','由运输员付钱'),('送到下一家店的信','中断的接应 · 交付凭据'),('校工的','运输员的'),('送信的报酬','接应的报酬')]: s=rep(s,a,b)
    return s
edit(paths[5],commission)
for p in paths[8:11]: edit(p,rename)
print('已更新事件卡名、现有选项、人物视角接线与后续页面文字。')
