// @ts-check
// M4 规则迁移；逐卡依据见 docs/archive/card-migration-2026-09-27/M4-D6-RESULT.md。
import { createRuleBackfiller } from './cards.sync.backfiller.js';
import { canonicalTables } from './card-rule-definitions.js';

const M4_MARKER_KEY = 'sdt-cards-m4-equip-rules-v1-seeded';

// 深海咒印：穿戴期间身负诅咒时攻+2、法伤+2，解除诅咒时收回。
const definitions = new Map([
  ['tt3-deep-diary', { rules: { version: 1, equip: { passive: {
    cond: { hasCurse: true },
    aura: { atk: 2, spellPower: 2 },
  } } } }],
]);

export const ensureM4EquipRules = createRuleBackfiller({
  label: 'M4',
  markerKey: M4_MARKER_KEY,
  definitions,
  canonicalTableById: canonicalTables(definitions, 'TABLETOP10'),
});
