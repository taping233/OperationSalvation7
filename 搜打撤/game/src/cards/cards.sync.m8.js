// @ts-check
// M8 规则迁移；逐卡依据见 docs/archive/card-migration-2026-09-27/M8-RESULT.md。
import { createRuleBackfiller } from './cards.sync.backfiller.js';
import { canonicalTables, triggerDefinition } from './card-rule-definitions.js';

const M8_MARKER_KEY = 'sdt-cards-m8-rule-backfill-v1-seeded';

const SELF = { target: { side: 'self', area: false } };
const ENEMY_ONE = { target: { side: 'enemy', area: false } };
// onPlay: [] 抑制文本重复执行；卡面由 canonical 来源及 face-refresh 维护。
const definitions = new Map([
  ['cmtn1r10xnl1', triggerDefinition({ onPlay: [{ op: 'registerRule', rule: 'discoverPlus' }] })],
  ['tt7-elementstorm', triggerDefinition({ onPlay: [{ op: 'registerRule', rule: 'doubleNextSpell' }] })],
  ['tt3-petal', triggerDefinition({
    onTurnStart: [{ op: 'draw', amountField: 'draw' }, { op: 'heal', amountField: 'heal' }],
    duration: 3,
    onPlay: [],
  })],
  ['tt7-swordimmortal', triggerDefinition({
    onTurnStart: [{ op: 'draw', amountField: 'draw' }], onPlay: [],
  })],
  ['tt7-goldencicada', triggerDefinition({
    onPlay: [{ op: 'draw', amount: 3, handOps: [{ op: 'consumeHand' }] }],
  }, SELF)],
  ['cmtn0pbkmnvc', triggerDefinition({
    onPlay: [{ op: 'execute', what: 'starterAttack', perCurseStacks: true }],
  }, ENEMY_ONE)],
  ['cmtn2jc142dj', triggerDefinition({
    onTurnStart: [{ op: 'copyRandom' }], onPlay: [],
  })],
  ['tt3-grope', triggerDefinition({ onPlay: [{ op: 'draw', range: [2, 3] }] }, SELF)],
  ['tt7-abysscurse', triggerDefinition({ onPlay: [
    { op: 'damage', amountField: 'dmg', target: 'chosenEnemy' },
    { op: 'curse', curse: 'healban', duration: 1, target: 'chosenEnemy' },
    { op: 'draw', perCurseKinds: true },
  ] }, ENEMY_ONE)],
  ['tt7-demonbreaker', triggerDefinition({ onPlay: [
    { op: 'damage', amountField: 'dmg', target: 'chosenEnemy', onKill: { armor: 4 } },
    { op: 'curse', curse: 'abreak', duration: 2, target: 'chosenEnemy' },
  ] }, ENEMY_ONE)],
]);

export const ensureM8RuleBackfill = createRuleBackfiller({
  label: 'M8',
  markerKey: M8_MARKER_KEY,
  definitions,
  canonicalTableById: canonicalTables(definitions, 'TABLETOP10', {
    'cmtn1r10xnl1': 'TABLETOP11',
    'tt7-elementstorm': 'CARDS_SYNC',
    'tt3-petal': 'TABLETOP11',
    'tt7-demonbreaker': 'CARDS_SYNC',
  }),
});
