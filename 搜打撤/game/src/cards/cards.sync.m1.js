// @ts-check
// M1 规则迁移；逐卡依据见 docs/archive/card-migration-2026-09-27/M1-D1-RESULT.md。
import { createRuleBackfiller } from './cards.sync.backfiller.js';
import { canonicalTables, onPlayDefinition as R } from './card-rule-definitions.js';

const M1_MARKER_KEY = 'sdt-cards-m1-onplay-rules-v1-seeded';

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

export const ensureM1OnplayRules = createRuleBackfiller({
  label: 'M1',
  markerKey: M1_MARKER_KEY,
  definitions,
  canonicalTableById: canonicalTables(definitions, 'TABLETOP10', {
    'tt7-livingwater': 'TABLETOP11',
  }),
});
