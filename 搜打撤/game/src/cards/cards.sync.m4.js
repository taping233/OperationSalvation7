// @ts-check
/* M4 卡牌规则化数据迁移批 D6（2026-09-27）：B-M3 装备批（27 张派工，实迁 2 张）。
 * definitions 内联手写，字段风格与 cards.sync.m1/m2.js 一致；canonical 整卡取 TABLETOP10
 * 定版（同 id 双引用取后表，m1/m2 先例：旧批同名卡已被 TABLETOP10 定版覆盖）。
 *
 * 迁移口径（逐卡对照矩阵 docs/M-BATCH-MATRIX.md B-M3 行 + 工作区现场 schema/capability/执行器；
 * 装备域消费点 battle.equipment.js registerEquip / syncCurseCondEquips + battle.triggers.m2.js）：
 *   tt3-deep-diary  深海咒印「自身处于诅咒状态时，获得 2 点攻击力且法伤 +2」→
 *                   equip.passive.cond.hasCurse + aura {atk:2, spellPower:2}。
 *                   单源性：穿戴文本路径 gate.curseCond（effect-steps.gates.js）对装备只提示不
 *                   结算数值（HALT）；syncCurseCondEquips 的 rules 分支命中后 return，短路
 *                   desc 正则旧读法——rules 迁入即收编，无双算。
 *                   行为修复：desc 正则旧读法的攻加成提取式（/攻\s*\+\s*\d/）匹配不到
 *                   「获得 2 点攻击力」，文本版诅咒期间只 +2 法伤；rules 版按卡面 2/2 全生效。
 *   tt3-deep-seal   深海印记「诅咒状态下，攻 +2，法伤 +2」→ 同款 rules（矩阵陷阱 T6：两卡
 *                   同草案同测，防漂移）。文本正则旧读法本就正确，迁移前后数值一致。
 *
 * 跳过 25 张（逐卡原因见 docs/archive/card-migration-2026-09-27/M4-D6-RESULT.md，此处按缺口归组摘要）：
 *   穿戴/光环双算 4 张（tt3-longsword / tt3-staff / tt3-grass-armor / tt3-silver-runesword /
 *   tt8-archdemon）——rules.equip 消费不抑制文本：hasStructuredOnPlay 只认 triggers.onPlay
 *   （battle.resolution.js），desc immediate 句（+1 攻 / 法伤+1 / 获得5点护甲 / 获得3张重斩…）
 *   照常结算，与 aura/onEquip 叠加即双算；
 *   消耗触发双算 4 张（tt2-wreck / tt3-azure-sword / tt3-sapper-bomb / tt7-arcanescroll）——
 *   fireConsumeTriggers（battle.engine.js）对 rules.triggers.onConsume 与 consumeTriggerTexts
 *   文本提取无条件并存，迁移即每次消耗结算两遍；
 *   主动技能死数据 8 张（tt3-light-mail / tt3-holy-staff / tt12-raygun / tt2-treasuremap /
 *   tt3-crimson-pouch / tt3-fate-wheel / tt3eq-boiler / tt3-reverse-bow）——desc 带
 *   「主动技能：」时 useEquipSkill 走文本（battle.equipment.js 的 !text 门），rules.equip.skill
 *   仅对无技能文本装备生效，迁入即死数据；其中 4 张另有个别表达缺口（见结果文档）；
 *   时点触发双路径 3 张（tt3-blooddrinker / tt3-master-staff / tt3-wolf-bow）——文本宿主
 *   （打出侧 killAtkUp 登记 / turnStart 句 registerTurnStartText）与 rules 触发器
 *   （registerCard 登记 + runner）并存双算；equip 域键集亦无 onTurnStart；
 *   开战被动双读法 3 张（tt3-chaos-eye / tt7-talisman / tt3-immortal-blade）——迎战路径
 *   applyBattleStartPassives 只走文本（rules.equip.battleStart 死数据），战斗中穿戴补发又与
 *   文本叠加；chaos-eye 另有矩阵陷阱 T3：deckCapBonus() 读 desc 文本与 rules deckCap op
 *   双读法，收编点在 battle.lifecycle.js（本批禁改执行器）；
 *   表达缺口 2 张（tt2-frostsword / tt3-twinwater-mail）——「对冰冻伤害+2」「冰冻后+3甲」
 *   无 schema 键（EQUIP_AURA_KEYS 仅 atk/spellPower/focus；cond 仅 hasCurse/vsFreeze，
 *   且 vsFreeze 无结构化消费点）。
 *
 * 2026-09-29 重构：入口骨架收敛到 cards.sync.backfiller.js createRuleBackfiller，
 * 本文件只保留 definitions 数据与批次参数；迁移数据行为不变（m4-data.test.js 守护）。 */
import { createRuleBackfiller } from './cards.sync.backfiller.js';

export const M4_MARKER_KEY = 'sdt-cards-m4-equip-rules-v1-seeded';

// 诅咒条件被动（深海咒印/深海印记，矩阵 T6 同草案）：身负诅咒 → 攻+2 法伤+2，解除即收回
//（动态核算由 battle.equipment.js syncCurseCondEquips 消费；rules 纯装备域，无 battle/triggers）。
const curseCondAura = () => ({
  rules: {
    version: 1,
    equip: {
      passive: {
        cond: { hasCurse: true },
        aura: { atk: 2, spellPower: 2 },
      },
    },
  },
});

// id → 结构化 rules（卡形部分定义，回填只取其 .rules）。两卡卡面字段已在 TABLETOP 定版中
// 存在，无需 A3 的字段回填（extraFieldsById），definitions 只携带 rules。
const definitions = new Map([
  ['tt3-deep-diary', curseCondAura()],
  ['tt3-deep-seal', curseCondAura()],
]);

// canonical 源表：id → SDT.Cards 上的定版数组名。两卡的 TABLETOP3 旧行（深解印记/深衍日记）
// 已被 TABLETOP10 定版覆盖（同 id 双引用取后表，与 E8 产线观测一致）。
const CANONICAL_TABLE_BY_ID = new Map([
  ['tt3-deep-diary', 'TABLETOP10'],
  ['tt3-deep-seal', 'TABLETOP10'],
]);

export const ensureM4EquipRules = createRuleBackfiller({
  label: 'M4',
  markerKey: M4_MARKER_KEY,
  definitions,
  canonicalTableById: CANONICAL_TABLE_BY_ID,
});
