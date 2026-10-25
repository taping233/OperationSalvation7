// @ts-check
// M5 规则迁移；逐卡依据见 docs/archive/card-migration-2026-09-27/M5-D7-RESULT.md。
import { createRuleBackfiller } from './cards.sync.backfiller.js';
import { canonicalTables, triggerDefinition } from './card-rule-definitions.js';

const M5_MARKER_KEY = 'sdt-cards-m5-delayed-rules-v1-seeded';

const ENEMY_ONE = { target: { side: 'enemy', area: false } };
// onPlay: [] 抑制文本重复执行；抽到禁咒时立即结算，目标为首个存活敌人。
const onDraw = ops => triggerDefinition({ onDraw: ops, onPlay: [] });
const definitions = new Map([
  ['tt3-wave-slash', triggerDefinition({ onPlay: [
    { op: 'damage', amountField: 'dmg', target: 'chosenEnemy' },
    { op: 'noDrawNext' },
  ] }, ENEMY_ONE)],
  ['tt3-noon-duel', {
    // 每枪 2 点固定伤害；仅在 canonical 深相等之后覆盖这两个卡面字段。
    dmg: 2,
    dmgType: 'fixed',
    ...triggerDefinition({ onPlay: [
      { op: 'damage', amountField: 'dmg', target: 'chosenEnemy', schedule: 'nextTurnStart', hits: { count: 4 } },
    ] }, { target: { side: 'enemy', area: false } }),
  }],
  ['tt8-curse1', onDraw([{ op: 'stealAtk', target: 'chosenEnemy', amount: 1 }])],
  ['tt8-curse2', onDraw([{ op: 'curse', curse: 'freeze', duration: 1, target: 'chosenEnemy' }])],
  ['tt8-curse3', onDraw([
    { op: 'curse', curse: 'poison', stacks: 1, target: 'chosenEnemy' },
    { op: 'curse', curse: 'bleed', stacks: 1, target: 'chosenEnemy' },
  ])],
  ['tt8-curse4', onDraw([{ op: 'curse', curse: 'silence', duration: 1, target: 'chosenEnemy' }])],
]);
const FACE_FIELDS_BY_ID = new Map([
  ['tt3-noon-duel', ['dmg', 'dmgType']],
]);

export const ensureM5DelayedRules = createRuleBackfiller({
  label: 'M5',
  markerKey: M5_MARKER_KEY,
  definitions,
  canonicalTableById: canonicalTables(definitions, 'CARDS_SYNC', {
    'tt3-wave-slash': 'TABLETOP10',
    'tt3-noon-duel': 'TABLETOP10',
  }),
  faceFieldsById: FACE_FIELDS_BY_ID,
});
