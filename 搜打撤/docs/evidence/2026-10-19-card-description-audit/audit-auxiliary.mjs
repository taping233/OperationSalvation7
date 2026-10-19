import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { displayCardDescription } from '../../../game/src/cards/card-description-text.js';

const directory = 'docs/evidence/2026-10-19-card-description-audit';
const catalogBytes = fs.readFileSync(directory + '/catalog.json');
const catalog = JSON.parse(catalogBytes);
const types = ['道具','资源','事件','生物','能力卡'];
const cards = catalog.cards.filter(card => types.includes(card.type));
const sources = new Map();
const read = file => { if (!sources.has(file)) sources.set(file,fs.readFileSync(file,'utf8')); return sources.get(file); };
const ref = (file, needle, note = '') => {
  const line = read(file).split(/\r?\n/).findIndex(text => text.includes(needle));
  if (line < 0) throw new Error(file + ': missing reference ' + needle);
  return {file,line:line+1,note};
};
const bag = 'game/src/battle/bag/battle.bag.js';
const mapBag = 'game/src/hub/game.bag.rules.js';
const flow = 'game/src/run/game.run.flow.js';
const kills = 'game/src/battle/effects/effect-steps.kills.js';
const selection = 'game/src/battle/core/battle.selection-flow.js';
const engine = 'game/src/battle/core/battle.engine.js';
const rules = 'game/src/cards/cards.rules.js';
const notes = new Map();
function note(id,status,evidence,references) { notes.set(id,{status,evidence,implementationRefs:references}); }

for (const card of cards.filter(card => card.type === '道具')) {
  let evidence = '按该ID结构化bag.use逐op核对地图/战斗消费者；静态相符，不代表逐卡实页通过。';
  const references = [ref(mapBag,'export function useStructuredBagRule'),ref(bag,'function useStructuredBattleBag')];
  if (card.rules?.bag?.use?.some(op=>op.op==='heal')) {
    evidence = `治疗amountField=heal，运行卡库heal=${card.heal}，与描述治疗值逐项核对；战斗禁疗仍沿共享规则。`;
    references.push(ref(bag,"if (op.op === 'heal')"));
  }
  note(card.id,'aligned-static',evidence,references);
}
note('cmtmvq6ss84l','aligned-static','地图/战斗均从本职业能力池直接获得1张，不打开发现；与“获取本职业的能力卡”相符。',
  [ref(mapBag,"operation.pool?.kind === 'legendary'"),ref(bag,"op.pool?.kind === 'classAbility'")]);
for (const id of ['cmtn6bge52qt','tt-crystal']) note(id,'aligned-static','地图从usedPocket顺序复原至多规则amount张；战斗restoreConsumed回手。空区与容量守卫已有定向证据。',
  [ref(mapBag,"operation.op === 'restoreConsumed' &&"),ref(bag,"op.op === 'restoreConsumed'"),ref('tests/bag-item-rule-baseline.test.js','describe(')]);
note('tt-token-gold','context-gap','地图acquire随机直授与卡面相符。战斗legendary专用pred路径未调用isRandomObtainable，存在进入unrandom传说的全局卡池边界风险；不是“随机/发现”混淆。',
  [ref(bag,"op.op === 'acquire' && op.pool?.kind === 'legendary'"),ref('game/src/battle/effects/battle.discover-candidates.js','if (pred)'),ref(rules,'isRandomObtainable(card)')]);
note('tt3-blue-potion','context-gap','战斗heal5+energy1按两op执行；地图可使用却只过滤并执行heal，energy被静默略过。卡面未说明地图只有治疗，需补场景限定或确认地图使用规则。',
  [ref(mapBag,'const isMapBagOperation'),ref(mapBag,'const mapSide = operations.filter'),ref(bag,"op.op === 'energy'")]);
note('tt3-mind-potion','mismatch-static','卡面/运行数据draw=2，规则amountField=draw；战斗amount仅支持amountField=heal，其余落op.n||1，所以实际抽1（普通战置入1张初始攻击）。',
  [ref(bag,"op.amountField === 'heal'"),ref(bag,"op.op === 'draw'")]);
note('tt3-python-potion','mismatch-static','卡面写对全体2点法伤；bag damage规则无dmgType，消费者以fixed默认结算。法伤加成与伤害类型不符。',
  [ref(bag,"op.op === 'damage'"),ref(bag,"op.dmgType || 'fixed'")]);
note('tt3sp-doom','mismatch-static','卡面仅攻击<=5的小怪；bag execute只检攻击/死亡，不排affix/BOSS，低攻击首脑也进入目标。通用resolveExecute另有!foe.affix排除，两个消费器不一致。',
  [ref(bag,"op.op === 'execute'"),ref('game/src/battle/effects/effect-steps.m2.js','function matchesExecuteCap')]);
note('tt4-shine-token','fixed-awaiting-browser','本轮按老板拍板修复地图三选一，B未改变；13项专属事务、真实RunStorage写读及旧卡入口已有证据。战斗原发现独立保留；unrandom卡池风险同B另记。',
  [ref(mapBag,'export function openBagLegendaryDiscovery'),ref('game/src/hub/game.bag.js','openBagLegendaryDiscovery(card, i'),ref(bag,"op.op === 'acquire' || op.op === 'discover'"),ref('tests/bag-token-discover.test.js','真实RunStorage')]);
note('tt3-mystery-potion','aligned-static','地图明确拒绝；战斗hosted登记次回合开始，随机招式变形且费用0，与现行场景描述相符。',
  [ref('game/src/hub/game.bag.js',"if (card.id === 'tt3-mystery-potion')"),ref('game/src/battle/effects/effect-steps.damage.js',"id: 'summon.morphRandom'"),ref('game/src/battle/effects/battle.hosted.js','export function getHostedExecutionCard')]);
note('tt4-smoke-bomb','aligned-static','地图禁用，战斗flee显式非BOSS守卫，finish(null)为逃跑而非战败。',
  [ref(bag,"card.rules.bag.use.some(op => op?.op === 'flee')"),ref(bag,'finish(null)')]);

for (const card of cards.filter(card => card.type === '资源')) note(card.id,'aligned-static',
  card.rules?.base?.material ? `仓库使用按结构化material折入${card.rules.base.material.kind}×${card.rules.base.material.amount}；对照卡名/描述数量相符。` : '出售类资源按value/稀有度由共享出售入口结算；描述没有声称战斗效果。',
  [ref('game/src/hub/base.js','function useStashMaterial'),ref('game/src/hub/base.js','function sellStashCards'),ref(rules,'sellPrice(card)')]);
note('pet-egg','aligned-static','仓库确有孵化入口：1蛋+50储备币，获得未拥有宠物；描述“可以孵化”不声明免费。界面另显示费用。',
  [ref('game/src/hub/base.js','function hatchPet()'),ref('game/src/hub/game.hub.pages.js','data-act="stashHatch"')]);
note('tt-econpack','aligned-static','仅仓库详情拆包，通用合法池随机5张写入卡牌仓库；先要求5格，符合卡面入口及数量。',
  [ref('game/src/hub/game.hub.pages.js','const openPack = () =>'),ref('game/src/hub/game.hub.pages.js','for (let k = 0; k < 5; k++)')]);
for (const id of ['tt-key','tt-key-one','tt-keys-bunch']) {
  const card = cards.find(card=>card.id===id);
  note(id,'aligned-static',`仓库材料规则折入真实钥匙×${card.rules.base.material.amount}；研究所大门消费真实钥匙。没有把卡牌直接当战斗道具。`,
    [ref('game/src/hub/base.js','function useStashMaterial'),ref('game/src/run/game.nest.js','经典生命研究所大门紧闭')]);
}

const eventNotes = {
  'cmtn7qttxqo4':'获得1碎片，openPocketRestore(1)在本事件复原1张；与描述相符。',
  'ev19-arrows':'随机池限武术/法术/装备、名称含箭，且非职业且无cls，投骰发2张；与描述相符。',
  'ev19-classchest':'openChestsOnCell medium+isClass=true，职业密封物资箱；与描述相符。',
  'ev19-fireballs':'固定查tt3-fireball并奖励同卡2张；与描述相符。',
  'ev19-gamble':'骰面1–3落空、4–6命中，每次3币、第5次必中；货物1装备+2招式、可返回，见现行规则107。',
  'ev19-pearlbox':'固定奖励tt2-pearlbox，满包沿固定待领奖；与描述相符。',
  'ev19-potions':'随机药水3候选，eventCardChoice保留候选、选1张；与描述相符。',
  'ev19-quartermaster':'先检查并支付3币，3装备候选选1；中断恢复不重复收费，见eventCardChoiceController。',
  'ev19-recode':'同稀有度/同类型替换已选条目；但need=Math.min(2,eligible.length)，只有1张合格卡时只转换1张，卡面固定“选择2张”缺少“至多”。',
  'ev19-vital':'maxHp+=3且hp+=3；与卡面上限+3/回复3一致。',
  'tt6-airdrop':'木材、口粮为卡牌；能量饮料分支立即回血6，随机药水投骰得1张。卡面“选择一项”未限定所有分支必须发卡，列出这一场景差异。',
  'tt6-bandits':'叙事迎战分支走eventEnemies配置，随层数3–5个bandit；胜利两个medium箱；可逃离不领奖。',
  'tt6-chestdraw':'六面骰1–2小、3–4中、5–6大，等概率开1箱，与“随机抽取1个”相符。',
  'tt6-demondeal':'卡面扣5血；实现Math.max(1,hp-5)，低于6血时不足额扣款且保留1血，仍领军用箱。需按描述决定低血拒绝还是允许致死成本，尚未扩改。',
  'tt6-goldhammer':'领取指定闪金之锤或记录下一店两格免费委托，二选一；与描述相符。',
  'tt6-goldmine':'稳妥+3币；深挖+6币但hp=Math.max(1,hp-3)，低于4血时实际损失少于3；卡面未说明保命钳位。',
  'tt6-mystery':'六面骰前三面1碎片、后三面3币，可离开；与描述相符。',
  'tt6-relief':'治疗6与投骰随机武术/法术二选一；与描述相符。',
  'tt6-systemsupply':'实际另有“碎片+2币”分支，卡面只有“碎片+木材”；现行rules明确二选一，属描述遗漏。',
};
for (const card of cards.filter(card=>card.type==='事件')) {
  const status = ['tt6-demondeal','tt6-goldmine'].includes(card.id) ? 'mismatch-static'
    : ['ev19-recode','tt6-airdrop','tt6-systemsupply'].includes(card.id) ? 'context-gap' : 'aligned-static';
  const refs = [ref(flow,card.id==='tt6-bandits'?'bandits_fight':card.id==='tt6-goldmine'?'goldmine_safe':card.id)];
  if (['ev19-potions','ev19-quartermaster'].includes(card.id)) refs.push(ref('game/src/run/event-card-choice.js','export function createEventCardChoiceController'));
  if (card.id==='ev19-recode') refs.push(ref(flow,'const need = Math.min(2, eligible.length)'));
  note(card.id,status,eventNotes[card.id],refs);
}

const map = JSON.parse(read('game/data/map.json'));
const enemies = {...map.monsters,...Object.fromEntries(map.altar.bosses.map(enemy=>[enemy.id,enemy]))};
for (const card of cards.filter(card=>card.type==='生物')) {
  if (card.id.startsWith('foe-')) {
    const enemy = enemies[card.id.slice(4)], parsed = card.desc.match(/攻击\s*(\d+)\s*\/\s*生命\s*(\d+)/);
    const matches = !!enemy && !!parsed && enemy.atk===+parsed[1] && enemy.hp===+parsed[2];
    note(card.id,matches?'reference-card-static':'needs-runtime-check',
      `敌人图鉴、无法打出且排除随机池。描述基础攻血${parsed?.[1]}/${parsed?.[2]}，map.json真源${enemy?.atk}/${enemy?.hp}，${matches?'逐值一致':'需核对'}；精英模式×1.5由scaledEnemy派生，图鉴不是当前场次缩放值。行为标签=${enemy?.behavior}${enemy?.affix?'，词缀='+enemy.affix:''}，词缀/行为入口另列，不把不可打出当缺陷。`,
      [ref('game/src/cards/cards.data.js',card.id),ref('game/data/map.json','"id": "'+card.id.slice(4)+'"'),ref('game/src/cards/cards.sync.js','ensureFoeRename()'),ref('game/src/battle/effects/battle.target-rules.js',"card.type === '生物'"),ref('game/src/run/game.session.modes.js','export const scaledEnemy')]);
  } else if (card.id.startsWith('tt8-')) {
    note(card.id,'reference-card-static','封印肢体本牌无法打出、入手无即时效果；只在5张封印集齐检查中计数。不是普通敌人图鉴；以ID集合与受缚之残影共同触发化形。',
      [ref(engine,'const SEAL_LIMB_IDS'),ref(engine,'function checkSealTransformation()'),ref('game/src/battle/effects/battle.target-rules.js','无法打出')]);
  } else if (card.id==='cmtn6ulm4boj') {
    note(card.id,'reference-card-static','步兵是召唤随从参考卡；4/4数值来自召唤参数，活体随从优先承伤、玩家回合结束自动攻击。生物卡本身不可直接打出。',
      [ref(engine,'function summonAlly'),ref('game/src/battle/core/battle.enemy-phase.js','for (const a of allies.filter'),ref('game/src/battle/core/battle.enemy-phase.js','const guard = allies.find')]);
  } else if (card.id==='cmtn79743r2n') {
    note(card.id,'reference-card-static','由花开两面抉择展开的持续场面物件，每回合开始对所有存活敌方各随机1层诅咒，优先未拥有；不是可直接打出的生物牌。',
      [ref(selection,'if (ref && ref.type'),ref('game/src/battle/effects/effect-steps.damage.js',"id: 'curse.doomGate'")]);
  } else {
    note(card.id,'mismatch-static','天国之门卡面写全体友方；随机祝福实现仅更新ctx.pstat/pdef，不遍历allies。并且作为花开两面第二扇门时，延期文本未附括号候选词，随机祝福列表可能为空。',
      [ref(kills,"id: 'buff.randomBlessing'"),ref(kills,"combat.addBlessing(ctx.pstat, 'stealth'"),ref(selection,'parts2.turnStart.forEach')]);
  }
}

const abilitySpecs = {
  'tt8-abyss-sovereign':['抽到6、免诅咒、能量/法伤+1、注能视为已满足与4无攻血肢体均有明确接线。',[[engine,'const SOVEREIGN_ID'],['game/src/battle/core/battle.exec-play.js','召唤\\s*4'],['game/src/battle/effects/effect-steps.audit.js',"id: 'draw.untilN'"]]],
  'tt8-hero-assassin':['净化+潜行2、破隐伤害翻倍分别接线；非只写描述。',[['game/src/battle/effects/effect-steps.curse.js',"id: 'buff.stealth'"],['game/src/battle/effects/effect-steps.rules.js',"id: 'rule.stealthStrike'"]]],
  'tt8-hero-descender':['法伤+1与consume-fireball被动登记；消耗卡时引擎施放火球。',[['game/src/battle/core/battle.exec-play.js',"hosted.includes('consume-fireball')"],[engine,'function* consumeFireballSteps']]],
  'tt8-hero-guardian':['能量上限+1由尾段、装备上限+1由已打出卡规则读取，两者分工明确。',[['game/src/battle/effects/effect-steps.tail.js',"id: 'res.energyCap'"],['game/src/battle/bag/battle.equipment.js','function equipCap()']]],
  'tt8-hero-mage':['法伤+1，句内回合开始发现登记为重复延迟效果；已有turn-start发现测试。',[['game/src/battle/effects/effect-steps.rules.js',"id: 'rule.turnStartDiscover'"],['game/src/battle/effects/effect-steps.curse.js',"id: 'buff.spellUp'"]]],
  'tt8-hero-priest':['置入随机牌补到6；统计其中法术张数，每张回血3；不是普通draw代替。',[[kills,"id: 'hand.fillRandom'"]]],
  'tt8-hero-ranger':['指名天启剑与诛魔剑，拆多卡名洗入；两剑后续合成仍为已有PENDING40，非本能力卡缺失。',[['game/src/battle/effects/effect-steps.deck.js',"id: 'deck.insert'"]]],
  'tt8-hero-sealer':['入场按选中能力注入4肢体，5张手牌集齐后消耗封印并加入主宰；无法打出闸存在。普通战不能使用能力卡是共享规则。',[[engine,'function injectSealCards()'],[engine,'function checkSealTransformation()'],['game/src/battle/effects/battle.target-rules.js',"mode === 'normal' && card.type === '能力卡'"]]],
  'tt8-hero-summoner':['两门抉择及延后2回合登记存在；但第二门若为天国之门，缺括号候选且祝福仅玩家，未满足全部描述。现有hero测试只查门日志，不能排除该缺陷。',[[selection,'function completeChoice()'],[selection,'parts2.turnStart.forEach'],[kills,"id: 'buff.randomBlessing'"]]],
  'tt8-hero-sword':['抽5并autoPlayHandType释放其中武术；主流程有刚抽UID记录，不把普通战能力禁用误判缺陷。',[['game/src/battle/effects/effect-steps.recovery.js','const autoM = ctx.desc.match'],['game/src/battle/core/battle.draw.js','置入手牌视同']]],
  'tt8-hero-warlock':['四张禁咒系列按名称前缀洗入，再抽2；牌库操作仅BOSS场景有效。',[['game/src/battle/effects/effect-steps.deck.js','洗混后结算']]],
  'tt8-hero-warrior':['初始攻击变形规则登记并用于后续取卡；本场对战作用域，与卡面相符。',[['game/src/battle/effects/effect-steps.rules.js',"id: 'rule.shaTransform'"]]],
};
for (const card of cards.filter(card=>card.type==='能力卡')) {
  const spec=abilitySpecs[card.id];
  note(card.id,card.id==='tt8-hero-summoner'?'mismatch-static':'aligned-static',spec[0],
    [ref('game/src/battle/effects/battle.hosted.js','export function getHostedExecutionCard'),...spec[1].map(([file,needle])=>ref(file,needle)),ref(card.id==='tt8-abyss-sovereign'?'tests/abyss-sovereign.test.js':'tests/hero-cards.test.js',card.id)]);
}

const rows = cards.map(card => {
  const review=notes.get(card.id); if(!review) throw new Error('Missing review '+card.id);
  return {id:card.id,name:card.name,type:card.type,status:review.status,description:displayCardDescription(card.desc,card.id),
    rawDescription:card.desc,rules:card.rules??null,implementationRefs:review.implementationRefs,evidence:review.evidence,
    coverage:'逐ID静态来源/消费者核对；未在本审查中逐卡实战。C修复测试另列。'};
});
if(rows.length!==91||new Set(rows.map(row=>row.id)).size!==91) throw new Error('Auxiliary coverage must be exactly 91 IDs');
const sha=value=>createHash('sha256').update(value).digest('hex');
const result={version:1,reviewedAt:new Date().toISOString(),catalogSha256:sha(catalogBytes),expectedCount:91,count:rows.length,
  counts:Object.fromEntries(types.map(type=>[type,rows.filter(row=>row.type===type).length])),
  statusCounts:Object.fromEntries([...new Set(rows.map(row=>row.status))].map(status=>[status,rows.filter(row=>row.status===status).length])),
  limits:['仅C地图修复已实施，其余只读审查。','静态相符不等于真实实战通过。','foe基础数值与map.json逐值比对，不以精英缩放差异或生物不可打出报错。','源码清单为审查时快照，不构成冻结index或远端CI凭证。'],
  sourceInventory:[...sources].map(([file,source])=>({file,sha256:sha(source)})),rows};
fs.writeFileSync(directory+'/auxiliary-review.json',JSON.stringify(result,null,2)+'\n');
const flagged=rows.filter(row=>['mismatch-static','context-gap'].includes(row.status));
const table=rows.map(row=>`| ${row.id} · ${row.name} | ${row.status} | ${row.description.replaceAll('|','／')} | ${row.evidence.replaceAll('|','／')} | ${row.implementationRefs.map(item=>item.file+':'+item.line).join('<br>')} |`).join('\n');
fs.writeFileSync(directory+'/auxiliary-review.md',`# 道具/资源/事件/生物/能力卡逐ID核对\n\n覆盖91/91：道具20、资源15、事件19、生物25、能力卡12。仅C地图修复落地，其余未批改。静态核对不等于逐卡实战；详细原文、规则、来源哈希见JSON。\n\n## 需处理或补场景说明\n\n${flagged.map(row=>'- '+row.name+'（'+row.id+'）：'+row.evidence).join('\n')}\n\n## 逐ID清单\n\n| ID/名称 | 状态 | 当前展示描述 | 核对结果/缺口 | 实现引用 |\n| --- | --- | --- | --- | --- |\n${table}\n`);
console.log(JSON.stringify({count:result.count,counts:result.counts,statusCounts:result.statusCounts,flagged:flagged.map(row=>({id:row.id,name:row.name,status:row.status}))}));
