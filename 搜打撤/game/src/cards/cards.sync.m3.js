// @ts-check
// M3 规则迁移；逐卡依据见 docs/archive/card-migration-2026-09-27/M3-D5-RESULT.md。
import { createRuleBackfiller } from './cards.sync.backfiller.js';
import { canonicalTables, onPlayDefinition as R } from './card-rule-definitions.js';

// v6：飞身劈仅当次攻击翻倍流血加成，移除旧持续 bleedAmp 声明。
const M3_MARKER_KEY = 'sdt-cards-m3-onplay-rules-v6-seeded';

const ENEMY_ONE = { target: { side: 'enemy', area: false } };
const SELF = { target: { side: 'self', area: false } };
const dmgField = () => ({ op: 'damage', amountField: 'dmg', target: 'chosenEnemy' });
// 获取卡（灵能召唤/千变万化/永恒绽放/药水魔法/挖宝/江湖救急）：acquire 走池名词直透 parsePoolNoun。
const acquire = (n, kind, dest, act) => ({ op: 'acquire', n, pool: { kind }, dest, ...(act ? { act } : {}) });

// id → 结构化 rules（有序 ops：伤害 → 诅咒 → 自身域效果/获取）。字面量 amount 与卡面字段一致。
const definitions = new Map([
  ['cc-cursed-blade', R(ENEMY_ONE, [
    dmgField(),
    // 手牌招式诅咒聚合：按卡面默认量逐诅咒施加，同种只取一次（执行器 curse 分支）
    { op: 'curse', source: 'handMoves', target: 'chosenEnemy' },
  ])],
  ['cc-last-stand', R(ENEMY_ONE, [{ ...dmgField(), recast: { on: 'lastHand', times: 1 } }])],
  ['cc-rapid-fire', R(ENEMY_ONE, [
    { op: 'damage', amount: 2, target: 'chosenEnemy', hits: { perPlayedMoves: true } },
  ])],
  ['cmtn0xt0zr7', R(ENEMY_ONE, [
    { op: 'damage', amount: 5, target: 'chosenEnemy', onKill: { coins: 2 } },
  ])],
  ['tt2-jianghu', R(SELF, [acquire(1, '其它职业', 'discover', 'play')])],
  ['tt2-turtlearmor', R({ ...SELF, requirements: [{ kind: 'handCards', count: 1, type: '装备' }] },
    [{ op: 'armor', amount: 10 }])],
  ['tt3-dig-treasure', R(SELF, [
    acquire(3, '牌库底', 'discover'),
    // n 是真实底库候选数；只发现一次，护甲锚定所选牌价格。
    { op: 'armor', priceOf: 'discovered' },
  ])],
  ['tt3-fly-arrowhawk', R(ENEMY_ONE, [dmgField()])],
  ['tt3-purify-arrow', R(ENEMY_ONE, [dmgField(), { op: 'cleanse', target: 'self' }])],
  ['tt3sp-shadowbug', R(ENEMY_ONE, [{ op: 'stealAtk', capTo: 1, target: 'chosenEnemy' }])],
  ['tt3wu-shike', R(ENEMY_ONE, [
    { op: 'curse', curse: 'atkDown', amount: 2, duration: 3, target: 'chosenEnemy' },
    { op: 'curse', curse: 'bleed', stacks: 1, target: 'chosenEnemy' },
  ])],
  ['tt7-armup', R(SELF, [{ op: 'draw', amount: 2, filter: { type: '装备' } }])],
  ['cmtn1epgt20j', R(SELF, [acquire(1, '注能', 'discover', 'noInfuse')])],
  ['cmtn1p9vb5au', R(SELF, [acquire(1, '形态', 'discover', 'play')])],
  ['tt12-chargeray', R(ENEMY_ONE, [
    { op: 'damage', amount: 5, target: 'chosenEnemy', perInfusedInHand: 2 },
  ])],
  ['tt3-holy-water', R(SELF, [
    { op: 'heal', amountField: 'heal' },
    { op: 'cleanse', target: 'self' },
  ])],
  ['tt3-thunderblast', R(ENEMY_ONE, [
    { op: 'damage', amount: 7, target: 'chosenEnemy', graveyard: { type: '法术', perCard: 1 } },
  ])],
  ['tt7-bladebloom', R(SELF, [acquire(1, '随机', 'discover', 'playKeep')])],
  ['tt7-burnharvest', R(ENEMY_ONE, [
    { op: 'damage', amount: 5, target: 'chosenEnemy', spellPowerMul: 2 },
  ])],
  ['tt7-maxsupply', R(SELF, [{ op: 'draw', untilHandN: 4 }])],
  ['tt7-recruit', R(SELF, [{ op: 'summon', name: '步兵', atk: 4, hp: 4, count: 2, taunt: true }])],
  ['tt3sp-devour', R(ENEMY_ONE, [{ op: 'execute', cap: { atk: 4 }, count: 1 }])],
  ['tt3sp-magicoil', R(SELF, [acquire(1, '药水', 'discover', 'play')])],
  ['tt3sp-shadowshot', R(ENEMY_ONE, [
    // 基础段无条件 3 点；条件段=「对手身负诅咒时额外施放 1 次」（anyCurse 门，见文件头口径注）
    { op: 'damage', amount: 3, target: 'chosenEnemy' },
    { op: 'damage', amount: 3, target: 'chosenEnemy', cond: { anyCurse: true } },
  ])],
]);

export const ensureM3OnplayRules = createRuleBackfiller({
  label: 'M3',
  markerKey: M3_MARKER_KEY,
  definitions,
  canonicalTableById: canonicalTables(definitions, 'TABLETOP10', {
    'cc-cursed-blade': 'CARDS_SYNC',
    'cc-last-stand': 'CARDS_SYNC',
    'cc-rapid-fire': 'CARDS_SYNC',
    'tt3-holy-water': 'CARDS_SYNC',
    'cmtn0xt0zr7': 'TABLETOP11',
    'cmtn1p9vb5au': 'TABLETOP11',
    'tt7-maxsupply': 'TABLETOP11',
    'tt12-chargeray': 'TABLETOP12',
  }),
  // v1 时代旧版 rules 快照（v3 修正语义，m3-data.test.js 批次级保守语义章守护）：
  // 整卡（canonical 卡面 + 旧版 rules）精确匹配的存档视为本批旧版产物，允许重写为现行版；
  // 玩家改名/改字段的卡深不相等，仍保守跳过。
  previousRulesById: new Map([
    ['tt3-fly-arrowhawk', R(ENEMY_ONE, [dmgField(), { op: 'registerRule', rule: 'bleedAmp' }]).rules],
    ['cmtn1epgt20j', R(SELF, [acquire(1, '注能', 'hand', 'noInfuse')]).rules],
    ['tt7-bladebloom', R(SELF, [acquire(3, '随机', 'discover', 'playKeep')]).rules],
    ['tt2-turtlearmor', R(SELF, [{ op: 'armor', amount: 10, consumeEquip: true }]).rules],
    ['cc-last-stand', R(ENEMY_ONE, [{ ...dmgField(), recast: { on: 'lastHand', times: 2 } }]).rules],
  ]),
});
