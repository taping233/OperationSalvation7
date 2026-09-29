// @ts-check
/* M1 卡牌规则化数据迁移批 D1（2026-09-27）：现集批次——当前 schema/capability 已支持能力的
 * legacy 卡迁结构化 rules，共 4 张：starter-attack / tt3-skewer / tt8-dragonblade / tt7-livingwater。
 * definitions 内联手写，字段风格与 cards.sync.js ensureA3* 回填定义一致（version:1 / onPlay 有序 ops）；
 * canonical 整卡取实际 TABLETOP10/11 定版（E8 ensureE8FixedHealRules 先例：不另存一份可漂移数值表）。
 *
 * 迁移口径（逐卡对照 capability 实际支持集 + schema battle.target 交叉契约）：
 *   starter-attack  攻（+0）：造成等同于攻击力的伤害 → damage amountField:'dmg'（attack 型由
 *                   Combat.dealDamage 并入攻击力，card.dmg=0 即纯攻击力，B1 tt2-shoot 同款）；
 *   tt3-skewer      攻（+2），附加破甲持续 1 回合 → damage + curse abreak duration:1（B5 frost-slash 同款）；
 *   tt8-dragonblade 攻+6，附加破甲与 1 层流血 → damage + curse abreak + curse bleed（破甲无回合词，
 *                   文本路径默认 2 回合——battle.engine.js CURSE 解析表 def:2，故 duration:2）；
 *   tt7-livingwater 抽 5 张牌 → draw amountField:'draw'（SELF，B1 tt7-ironcharge 同款）。
 *
 * 跳过 8 张——混合目标契约缺口：battle.target 是卡级单值，heal/armor/draw 强制 side:'self'
 * （card-rules.schema.js 交叉契约），damage/curse 选定敌强制 side:'enemy'，无法同卡表达：
 *   tt2-forestarrow / tt2-piercearrow（伤害+自护甲；前者 A3 已显式排除）、
 *   tt2-swiftarrow / tt7-fullstrike / tt7-arcanebolt（伤害+自抽牌）、
 *   tt7-throwblade（伤害+流血可表达，但抽牌自益无法同卡声明）、
 *   tt3-toxin / tt12-sporewall（A3 排除清单已点名「毒药+抽牌 / 孢子城墙+护甲」）。
 *
 * 2026-09-29 重构：入口骨架（marker 一次性/深相等守卫/双门/复读确认等）收敛到
 * cards.sync.backfiller.js createRuleBackfiller，本文件只保留 definitions 数据与批次参数；
 * 迁移数据行为不变（m1-data.test.js 守护）。 */
import { createRuleBackfiller } from './cards.sync.backfiller.js';

export const M1_MARKER_KEY = 'sdt-cards-m1-onplay-rules-v1-seeded';

const R = (battle, onPlay) => ({ rules: { version: 1, battle, triggers: { onPlay } } });
const ENEMY_ONE = { target: { side: 'enemy', area: false } };
const SELF = { target: { side: 'self', area: false } };
const dmgOne = () => R(ENEMY_ONE, [{ op: 'damage', amountField: 'dmg', target: 'chosenEnemy' }]);

// id → 结构化 rules（有序 ops）。四张卡的全部卡面字段（dmg/draw 等）已在 TABLETOP 定版中存在，
// 无需 A3 的字段回填（extraFieldsById），definitions 只携带 rules。
const definitions = new Map([
  ['starter-attack', dmgOne()],
  ['tt3-skewer', R(ENEMY_ONE, [
    { op: 'damage', amountField: 'dmg', target: 'chosenEnemy' },
    { op: 'curse', curse: 'abreak', duration: 1, target: 'chosenEnemy' },   // 持续 1 回合
  ])],
  ['tt8-dragonblade', R(ENEMY_ONE, [
    { op: 'damage', amountField: 'dmg', target: 'chosenEnemy' },
    { op: 'curse', curse: 'abreak', duration: 2, target: 'chosenEnemy' },   // 无回合词 → 文本路径默认 2 回合
    { op: 'curse', curse: 'bleed', stacks: 1, target: 'chosenEnemy' },
  ])],
  ['tt7-livingwater', R(SELF, [{ op: 'draw', amountField: 'draw' }])],
]);

// canonical 源表：id → SDT.Cards 上的 TABLETOP 定版数组名（这 4 个 id 均不在 cards-sync，
// TABLETOP10/11 内联对象即定版真身；tt3-skewer / tt8-dragonblade 的旧批次同名卡已被
// TABLETOP10 定版覆盖，与 E8 产线观测一致）。
const CANONICAL_TABLE_BY_ID = new Map([
  ['starter-attack', 'TABLETOP10'],
  ['tt3-skewer', 'TABLETOP10'],
  ['tt8-dragonblade', 'TABLETOP10'],
  ['tt7-livingwater', 'TABLETOP11'],
]);

export const ensureM1OnplayRules = createRuleBackfiller({
  label: 'M1',
  markerKey: M1_MARKER_KEY,
  definitions,
  canonicalTableById: CANONICAL_TABLE_BY_ID,
});
