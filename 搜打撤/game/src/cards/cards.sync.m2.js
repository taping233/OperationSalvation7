// @ts-check
/* M2 卡牌规则化数据迁移批 D3（2026-09-27）：B-M1 现集批次剩余 S 级卡迁结构化 rules，共 16 张。
 * definitions 内联手写，字段风格与 cards.sync.js ensureA3* / cards.sync.m1.js 一致（version:1 /
 * onPlay 有序 ops）；canonical 整卡取实际定版（TABLETOP7/10/11/12 + CARDS_SYNC，m1 先例：
 * 不另存一份可漂移数值表）。
 *
 * 迁移口径（逐卡对照矩阵 docs/M-BATCH-MATRIX.md B-M1 行 + 工作区现场 schema/capability/执行器）：
 *   cc-chase-slash    攻（+0），每打出一张其他武术费用-1 → damage + battle.costModifiers
 *                     martialPlayedDiscount amount:1（消费端 battle.card-cost.js:36 做减法，
 *                     amount 为正整数折扣步长——矩阵草案的 -1 过不了 schema 正整数校验）；
 *   tt2-comboarrow    攻（-1），上一张武术则 0 费 → damage + previousCardTypeFree type:'武术'；
 *   tt2-forestarrow   攻（-1），+3 甲 → damage + armor amount:3（字面量，M1 混合目标放行）；
 *   tt2-piercearrow   攻（-1），附加破甲 2 回合（2026-10-20 定版修订）；
 *   tt2-swiftarrow    攻（-1），抽 1 → damage + draw amount:1（amountField 锚定不得与 damage
 *                     混排，字面量与卡面 draw 字段一致仍满足 declaresField 契约——A3 先例）；
 *   tt7-fullstrike    攻（+5），抽 1 → 同 swiftarrow 同构；
 *   tt7-throwblade    攻（-3），附加流血，抽 1 → damage + curse bleed stacks:1 + draw amount:1；
 *   cc-demon          4′，损失 2 点生命 → damage(amountField:'dmg', spell) + heal selfDamage:2
 *                     （执行器 heal 分支「自伤不是治疗」注释即点名恶魔之力，battle.resolution.js heal 段）；
 *   cmtn28jv33wx      随机获取 3 张卡牌 → acquire n:3 pool:'随机' dest:'hand'（A3 生命箭同款）；
 *   tt12-breakthrough 随机获取 0/1/2 费招式各 1 张 → 三段 acquire（A3 基础开发 '0费招式' 名词
 *                     同款；A3 时「三段费用无键」被排除，M1 acquire 落地后可迁）；
 *   tt12-sporewall    2 层中毒 + 自身 6 甲 → curse poison stacks:2 + armor amount:6（字面量混合放行）；
 *   tt3-firm-barrier  延长冰冻 1 回合，抽 1 → curse freeze duration:1 + extend:1（extend 走
 *                     「只延长不施加」语义，duration 仅为 schema 计时诅咒必填、不参与施加——
 *                     执行器 extend 分支注释点名坚冰结界）+ draw amount:1；
 *   tt3-flame-storm   全体敌人每人一次火球（实作 4 点法伤全体）→ damage amount:4 allEnemies；
 *   tt3-nature-form   本局能量上限 +1 → energyCap n:1（A3 energize 同款 SELF）；
 *   tt3-toxin         1 层中毒，抽 1 → curse poison stacks:1 + draw amount:1；
 *   tt7-silence       沉默 1 回合，抽 1 → curse silence duration:1 + draw amount:1。
 *
 * 跳过 10 张（逐条原因见 docs/archive/card-migration-2026-09-27/M2-D3-RESULT.md，此处仅摘要）：
 *   tt3-fatal-pierce（破甲在宿主受流血门条件生效，curse op 无 cond 键，迁后行为偏差）、
 *   tt7-ghostblade（cond.foeStatus 值域限七诅咒键，'stealth' 被 schema 拒——敌侧键
 *   status.stealth 已核实存在，卡在 schema 值域白名单，T5）、
 *   cc-poison-burst / tt3sp-flowerzhen（宿主为纯引爆/纯翻倍，结构化 curse 强制施加毒层，行为偏差）、
 *   tt12-felguard / tt12-raydragon / tt7-holyheal / tt3sp-bloodstorm（卡面 infuse:1/2，
 *   schema 禁 onPlay 保留 card.infuse，注能门无 schema 表达，T11；bloodstorm 另有
 *   recast 仅 on:'kill' 一层缺口）、
 *   tt12-freezeray（foeFullHp 近似「未曾受伤」会被回满血敌人误判——远古龙尊每回合回血 10，
 *   误判情形实锤，口径需拍板，T2）、
 *   tt7-arcanebolt（存储卡被 ensureEffectFields 动态补 draw 字段，与源表定版不可深相等；
 *   内联手写补丁快照违背 m1「不另存可漂移数值表」先例）。
 *
 * 2026-09-29 重构：入口骨架收敛到 cards.sync.backfiller.js createRuleBackfiller，
 * 本文件只保留 definitions 数据与批次参数；迁移数据行为不变（m2-data.test.js 守护）。 */
import { createRuleBackfiller } from './cards.sync.backfiller.js';

const M2_MARKER_KEY = 'sdt-cards-m2-onplay-rules-v1-seeded';

const R = (battle, onPlay) => ({ rules: { version: 1, battle, triggers: { onPlay } } });
const ENEMY_ONE = { target: { side: 'enemy', area: false } };
const ENEMY_ALL = { target: { side: 'enemy', area: true } };
const SELF = { target: { side: 'self', area: false } };
const dmgOne = () => R(ENEMY_ONE, [{ op: 'damage', amountField: 'dmg', target: 'chosenEnemy' }]);
// 费用修改器卡：R 的 battle 域在 target 之外追加 costModifiers（cc-chase-slash / tt2-comboarrow）。
const withCostModifiers = (costModifiers) => ({
  rules: { version: 1, battle: { target: ENEMY_ONE.target, costModifiers }, triggers: { onPlay: dmgOne().rules.triggers.onPlay } },
});
// 混合目标卡（敌方主体 + 自身域字面量效果 op）：damage/curse 之外追加自身效果 op。
const dmgOneWith = (selfOps) => R(ENEMY_ONE, [...dmgOne().rules.triggers.onPlay, ...selfOps]);
const acquire = (n, kind, dest) => ({ op: 'acquire', n, pool: { kind }, dest });

// id → 结构化 rules（有序 ops：伤害 → 诅咒 → 自身域效果）。全部字面量 amount 与卡面字段一致。
const definitions = new Map([
  ['cc-chase-slash', withCostModifiers([{ kind: 'martialPlayedDiscount', amount: 1 }])],
  ['tt2-comboarrow', withCostModifiers([{ kind: 'previousCardTypeFree', type: '武术' }])],
  ['tt2-forestarrow', dmgOneWith([{ op: 'armor', amount: 3 }])],
  ['tt2-piercearrow', dmgOneWith([{ op: 'curse', curse: 'abreak', duration: 2, target: 'chosenEnemy' }])],
  ['tt2-swiftarrow', dmgOneWith([{ op: 'draw', amount: 1 }])],
  ['tt7-fullstrike', dmgOneWith([{ op: 'draw', amount: 1 }])],
  ['tt7-throwblade', dmgOneWith([
    { op: 'curse', curse: 'bleed', stacks: 1, target: 'chosenEnemy' },
    { op: 'draw', amount: 1 },
  ])],
  ['cc-demon', dmgOneWith([{ op: 'heal', selfDamage: 2 }])],   // 损失 2 点生命（自伤非治疗）
  ['cmtn28jv33wx', R(SELF, [acquire(3, '随机', 'hand')])],
  ['tt12-breakthrough', R(SELF, [
    acquire(1, '0费招式', 'hand'),
    acquire(1, '1费招式', 'hand'),
    acquire(1, '2费招式', 'hand'),
  ])],
  ['tt12-sporewall', R(ENEMY_ONE, [
    { op: 'curse', curse: 'poison', stacks: 2, target: 'chosenEnemy' },
    { op: 'armor', amount: 6 },
  ])],
  ['tt3-firm-barrier', R(ENEMY_ONE, [
    // duration:1 满足 schema 计时诅咒必填；extend 存在时整体走「只延长不施加」语义
    { op: 'curse', curse: 'freeze', duration: 1, extend: 1, target: 'chosenEnemy' },
    { op: 'draw', amount: 1 },
  ])],
  ['tt3-flame-storm', R(ENEMY_ALL, [{ op: 'damage', amount: 4, target: 'allEnemies' }])],
  ['tt3-nature-form', R(SELF, [{ op: 'energyCap', n: 1 }])],
  ['tt3-toxin', R(ENEMY_ONE, [
    { op: 'curse', curse: 'poison', stacks: 1, target: 'chosenEnemy' },
    { op: 'draw', amount: 1 },
  ])],
  ['tt7-silence', R(ENEMY_ONE, [
    { op: 'curse', curse: 'silence', duration: 1, target: 'chosenEnemy' },
    { op: 'draw', amount: 1 },
  ])],
]);

// canonical 源表：id → SDT.Cards 上的定版数组名。多数为 TABLETOP 定版（同 id 双引用取后表）；
// cc-chase-slash 定版真身在实机覆盖批次 cards-sync.json（cards.js 装配为 CARDS_SYNC 表）。
const CANONICAL_TABLE_BY_ID = new Map([
  ['cc-chase-slash', 'CARDS_SYNC'],
  ['tt2-comboarrow', 'TABLETOP10'],
  ['tt2-forestarrow', 'TABLETOP10'],
  ['tt2-piercearrow', 'TABLETOP10'],
  ['tt2-swiftarrow', 'TABLETOP10'],
  ['tt7-fullstrike', 'TABLETOP10'],
  ['tt7-throwblade', 'TABLETOP10'],
  ['cc-demon', 'TABLETOP7'],
  ['cmtn28jv33wx', 'TABLETOP11'],
  ['tt12-breakthrough', 'TABLETOP12'],
  ['tt12-sporewall', 'TABLETOP12'],
  ['tt3-firm-barrier', 'TABLETOP10'],
  ['tt3-flame-storm', 'TABLETOP11'],
  ['tt3-nature-form', 'TABLETOP10'],
  ['tt3-toxin', 'TABLETOP10'],
  ['tt7-silence', 'TABLETOP10'],
]);

export const ensureM2OnplayRules = createRuleBackfiller({
  label: 'M2',
  markerKey: M2_MARKER_KEY,
  definitions,
  canonicalTableById: CANONICAL_TABLE_BY_ID,
});
