// @ts-check
/* M7 装备收编（2026-09-27）：仅迁当前 schema、capability 与运行时执行器均可完整消费的卡。
 * canonical 直接从 TABLETOP10/11 读取，按实际运行时定版深相等；不依赖旧 TABLETOP3 行。
 * rules.equip 是装备文本效果的单源开关，因此每张卡必须覆盖其当前 canonical 描述全部效果。
 * 其余复杂装备与阻塞原因见 docs/archive/card-migration-2026-09-27/M7-RESULT.md。
 *
 * 2026-09-29 重构：入口骨架收敛到 cards.sync.backfiller.js createRuleBackfiller，
 * 本文件只保留 definitions 数据与批次参数；迁移数据行为不变（m7-data/m7-battle 测试守护）。
 * 注意：canonical 映射中 tt8-archdemon 原文件存在 TABLETOP11/TABLETOP10 重复键
 * （Map 构造后者覆盖前者，实际取 TABLETOP10）——逐字保留该现状未改，待拍板是否为笔误。 */
import { createRuleBackfiller } from './cards.sync.backfiller.js';
import { canonicalTables } from './card-rule-definitions.js';

export const M7_EQUIP_MARKER_KEY = 'sdt-cards-m7-equip-rules-v1-seeded';

const equip = value => ({ rules: { version: 1, equip: value } });
// pure trigger 装备也要声明 no-op onEquip，使 M3 suppressText 生效；schema 不接受空 equip 对象，
// 空 ops 数组是合法、无行为的单源标记，避免旧装备文本路径与 trigger runner 双结算。
const equipTrigger = value => ({ rules: { version: 1, equip: { onEquip: [] }, triggers: value } });

const definitions = new Map([
  ['tt3-longsword', equip({ passive: { aura: { atk: 1 } } })],
  ['tt3-staff', equip({ passive: { aura: { spellPower: 1 } } })],
  ['tt3-grass-armor', equip({ onEquip: [{ op: 'armor', amountField: 'armor' }] })],
  ['tt3-light-mail', equip({ skill: { oncePerBattle: true, ops: [{ op: 'draw', amountField: 'draw' }] } })],
  ['tt3-holy-staff', equip({ skill: { oncePerBattle: true, ops: [
    { op: 'cleanse', target: 'self' }, { op: 'heal', amountField: 'heal' },
  ] } })],
  ['tt2-treasuremap', equip({ skill: { oncePerBattle: true, ops: [
    { op: 'acquire', n: 1, pool: { kind: '搜索军用保险柜' }, dest: 'deck' },
    { op: 'draw', amountField: 'draw' },
  ] } })],
  ['tt12-raygun', equip({ skill: { oncePerBattle: true, ops: [
    { op: 'acquire', n: 1, pool: { kind: '射线' }, dest: 'discover', act: 'play' },
  ] } })],
  ['tt7-talisman', equip({ battleStart: [{ op: 'draw', amountField: 'draw' }] })],
  ['tt3-blooddrinker', equipTrigger({ onKill: [{ op: 'blessing', key: 'atkUp', stacks: 1 }] })],
  ['tt3-master-staff', equipTrigger({ onTurnStart: [{ op: 'blessing', key: 'spellUp', stacks: 1 }] })],
  ['tt3-twinwater-mail', equipTrigger({ onFreezeDealt: [{ op: 'armor', amountField: 'armor' }] })],
  ['tt2-apollo', equipTrigger({ onAcquire: [
    { op: 'energy', n: 1 }, { op: 'acquire', n: 1, pool: { kind: '随机' },
      filter: { exceptIds: ['tt2-apollo'] }, dest: 'hand' },
  ] })],
  ['tt2-wreck', equipTrigger({ onConsume: [{ op: 'acquire', n: 2, pool: { kind: '随机' }, dest: 'hand' }] })],
  ['tt8-archdemon', equip({
    passive: { aura: { atk: 1 } },
    onEquip: [{ op: 'acquire', n: 3, pool: { kind: '重斩' }, dest: 'hand' }],
  })],
  ['tt7-arcanescroll', equipTrigger({ onConsume: [{ op: 'draw', amountField: 'draw' }] })],
]);

const CANONICAL_TABLE_BY_ID = canonicalTables(definitions, 'TABLETOP10', {
  __proto__: null,
  'tt2-treasuremap': 'TABLETOP11',
  'tt7-arcanescroll': 'TABLETOP11',
  'tt7-talisman': 'TABLETOP11',
  'tt12-raygun': 'TABLETOP12',
});

export const ensureM7EquipRules = createRuleBackfiller({
  label: 'M7',
  markerKey: M7_EQUIP_MARKER_KEY,
  definitions,
  canonicalTableById: CANONICAL_TABLE_BY_ID,
});
