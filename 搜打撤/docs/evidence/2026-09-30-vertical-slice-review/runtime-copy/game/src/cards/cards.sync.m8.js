// @ts-check
/* M8 回迁：接收执行器收编后有真实消费端的普通武术/法术规则。
 * 每张卡都以 live canonical 整卡深相等为迁移前提，双门通过后才保存。
 * 花瓣法阵依据 2026-09-29 老板裁决 heal:3（覆盖 09-27 保留 heal:2 的旧裁决）；持续 3 次回合开始触发。
 * 卡面数值以 TABLETOP11 定版为真源（本文件不再携带 face 副本）；已回填老档的卡面刷新
 * 由 cards.sync.face-refresh.js ensureCanonicalFaceRefresh 幂等处理（cards.js 接线）。
 *
 * 2026-09-29 重构：入口骨架收敛到 cards.sync.backfiller.js createRuleBackfiller，
 * 本文件只保留 definitions 数据与批次参数；迁移数据行为不变（m8-data.test.js 守护）。 */
import { createRuleBackfiller } from './cards.sync.backfiller.js';

export const M8_MARKER_KEY = 'sdt-cards-m8-rule-backfill-v1-seeded';

const definitions = new Map([
  ['cmtn1r10xnl1', { rules: { version: 1, triggers: { onPlay: [{ op: 'registerRule', rule: 'discoverPlus' }] } } }],
  ['tt7-elementstorm', { rules: { version: 1, triggers: { onPlay: [{ op: 'registerRule', rule: 'doubleNextSpell' }] } } }],
  ['tt3-petal', {
    rules: {
      version: 1,
      triggers: {
        onTurnStart: [{ op: 'draw', amountField: 'draw' }, { op: 'heal', amountField: 'heal' }],
        duration: 3,
        onPlay: [],
      },
    },
  }],
  ['tt7-swordimmortal', { rules: { version: 1, triggers: {
    onTurnStart: [{ op: 'draw', amountField: 'draw' }], onPlay: [],
  } } }],
  ['tt7-goldencicada', { rules: { version: 1, battle: { target: { side: 'self', area: false } }, triggers: {
    onPlay: [{ op: 'draw', amount: 3, handOps: [{ op: 'consumeHand' }] }],
  } } }],
  ['cmtn0pbkmnvc', { rules: { version: 1, battle: { target: { side: 'enemy', area: false } }, triggers: {
    onPlay: [{ op: 'execute', what: 'starterAttack', perCurseStacks: true }],
  } } }],
  ['cmtn2jc142dj', { rules: { version: 1, triggers: {
    onTurnStart: [{ op: 'copyRandom' }], onPlay: [],
  } } }],
  ['tt3-grope', { rules: { version: 1, battle: { target: { side: 'self', area: false } }, triggers: {
    onPlay: [{ op: 'draw', range: [2, 3] }],
  } } }],
  ['tt7-abysscurse', { rules: { version: 1, battle: { target: { side: 'enemy', area: false } }, triggers: {
    onPlay: [
      { op: 'damage', amountField: 'dmg', target: 'chosenEnemy' },
      { op: 'curse', curse: 'healban', duration: 1, target: 'chosenEnemy' },
      { op: 'draw', perCurseKinds: true },
    ],
  } } }],
  ['tt7-demonbreaker', { rules: { version: 1, battle: { target: { side: 'enemy', area: false } }, triggers: {
    onPlay: [
      { op: 'damage', amountField: 'dmg', target: 'chosenEnemy', onKill: { armor: 4 } },
      { op: 'curse', curse: 'abreak', duration: 2, target: 'chosenEnemy' },
    ],
  } } }],
]);
const CANONICAL_TABLE_BY_ID = new Map([
  ['cmtn1r10xnl1', 'TABLETOP11'],
  ['tt7-elementstorm', 'CARDS_SYNC'],
  ['tt3-petal', 'TABLETOP11'],
  ['tt7-swordimmortal', 'TABLETOP10'],
  ['tt7-goldencicada', 'TABLETOP10'],
  ['cmtn0pbkmnvc', 'TABLETOP10'],
  ['cmtn2jc142dj', 'TABLETOP10'],
  ['tt3-grope', 'TABLETOP10'],
  ['tt7-abysscurse', 'TABLETOP10'],
  ['tt7-demonbreaker', 'CARDS_SYNC'],
]);

export const ensureM8RuleBackfill = createRuleBackfiller({
  label: 'M8',
  markerKey: M8_MARKER_KEY,
  definitions,
  canonicalTableById: CANONICAL_TABLE_BY_ID,
});
