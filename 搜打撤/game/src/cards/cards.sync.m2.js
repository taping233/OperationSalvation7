// @ts-check
// M2 规则迁移；逐卡依据见 docs/archive/card-migration-2026-09-27/M2-D3-RESULT.md。
import { createRuleBackfiller } from './cards.sync.backfiller.js';
import { canonicalTables, onPlayDefinition as R } from './card-rule-definitions.js';

const M2_MARKER_KEY = 'sdt-cards-m2-onplay-rules-v1-seeded';

const ENEMY_ONE = { target: { side: 'enemy', area: false } };
const ENEMY_ALL = { target: { side: 'enemy', area: true } };
const SELF = { target: { side: 'self', area: false } };
const dmgOne = () => R(ENEMY_ONE, [{ op: 'damage', amountField: 'dmg', target: 'chosenEnemy' }]);
// 费用修改器卡：R 的 battle 域在 target 之外追加 costModifiers（cc-chase-slash / tt2-comboarrow）。
const withCostModifiers = costModifiers => R({ ...ENEMY_ONE, costModifiers }, dmgOne().rules.triggers.onPlay);
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

export const ensureM2OnplayRules = createRuleBackfiller({
  label: 'M2',
  markerKey: M2_MARKER_KEY,
  definitions,
  canonicalTableById: canonicalTables(definitions, 'TABLETOP10', {
    'cc-chase-slash': 'CARDS_SYNC',
    'cc-demon': 'TABLETOP7',
    'cmtn28jv33wx': 'TABLETOP11',
    'tt12-breakthrough': 'TABLETOP12',
    'tt12-sporewall': 'TABLETOP12',
    'tt3-flame-storm': 'TABLETOP11',
  }),
});
