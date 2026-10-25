// @ts-check
// M6 规则迁移；逐卡依据见 docs/archive/card-migration-2026-09-27/M6-D8-RESULT.md。
import { createRuleBackfiller } from './cards.sync.backfiller.js';
import { canonicalTables } from './card-rule-definitions.js';

const M6_MARKER_KEY = 'sdt-cards-m6-bag-rules-v2-seeded';

// definitions 值与 A3/m1 同为「卡形部分定义」（{ rules: {...} }），回填只取其 .rules。
const BAG = (use) => ({ rules: { version: 1, bag: { use } } });

// id → 结构化 rules.bag.use（有序 ops）。
const definitions = new Map([
  ['tt3-blue-potion', BAG([
    { op: 'heal', amountField: 'heal' },
    { op: 'energy', n: 1 },
  ])],
  ['tt3-demon-potion', BAG([{ op: 'blessing', key: 'spellUp', stacks: 2, duration: 1 }])],
  ['tt3-houyi-potion', BAG([{ op: 'blessing', key: 'atkUp', stacks: 2, duration: 1 }])],
  ['tt3-iceheart-potion', BAG([{ op: 'curse', curse: 'freeze', duration: 1 }])],
  ['tt3-mind-potion', BAG([{ op: 'draw', amountField: 'draw' }])],
  ['tt3-mixed-potion', BAG([
    { op: 'damage', amount: 2 },
    { op: 'curse', curse: 'bleed' },
  ])],
  ['tt3-python-potion', BAG([{ op: 'damage', amount: 2, dmgType: 'spell', target: 'allEnemies' }])],
  ['tt3-turnabout-potion', BAG([{ op: 'curse', curse: 'poison', stacks: 1, target: 'allEnemies' }])],
  ['tt3sp-doom', BAG([{ op: 'execute', cap: { atk: 5 }, count: 2 }])],
  ['cmtmvq6ss84l', BAG([{ op: 'acquire', pool: { kind: 'classAbility' } }])],
  ['tt-token-gold', BAG([{ op: 'acquire', pool: { kind: 'legendary' } }])],
  ['tt4-shine-token', BAG([{ op: 'discover', count: 1, pool: { kind: 'legendary' } }])],
  ['tt4-smoke-bomb', BAG([{ op: 'flee' }])],
]);

export const ensureM6BagRules = createRuleBackfiller({
  label: 'M6',
  markerKey: M6_MARKER_KEY,
  definitions,
  canonicalTableById: canonicalTables(definitions, 'TABLETOP10', {
    'cmtmvq6ss84l': 'TABLETOP11',
  }),
  previousRulesById: new Map([
    ['tt3-python-potion', BAG([{ op: 'damage', amount: 2, target: 'allEnemies' }]).rules],
  ]),
});
