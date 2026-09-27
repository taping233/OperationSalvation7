// @ts-check
/* M8 回迁：接收执行器收编后有真实消费端的普通武术/法术规则。
 * 每张卡都以 live canonical 整卡深相等为迁移前提，双门通过后才保存。
 * 花瓣法阵依据 2026-09-27 老板裁决保留 heal:2，并同步描述为回复 2；持续 3 次回合开始触发。 */
import { KEY } from './cards.consts.js';
import { validateCardRules } from './card-rules.schema.js';
import { inspectCardRuleCapability } from './card-rules.capability.js';

const MARKER = 'sdt-cards-m8-rule-backfill-v1-seeded';
const definitions = new Map([
  ['cmtn1r10xnl1', { rules: { version: 1, triggers: { onPlay: [{ op: 'registerRule', rule: 'discoverPlus' }] } } }],
  ['tt7-elementstorm', { rules: { version: 1, triggers: { onPlay: [{ op: 'registerRule', rule: 'doubleNextSpell' }] } } }],
  ['tt3-petal', {
    desc: '回合开始时额外抽1张牌并回复 2 点生命，持续 3 回合。',
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

function sameSnapshot(left, right) {
  if (left === right) return true;
  if (!left || !right || typeof left !== 'object' || typeof right !== 'object') return false;
  if (Array.isArray(left) !== Array.isArray(right)) return false;
  if (Array.isArray(left) && left.length !== right.length) return false;
  const keys = Object.keys(left);
  return keys.length === Object.keys(right).length && keys.every(key =>
    Object.prototype.hasOwnProperty.call(right, key) && sameSnapshot(left[key], right[key]));
}

/** M8 保守回填入口；生产无参调用，deps 只供定向数据迁移测试注入。 */
export function ensureM8RuleBackfill(deps = {}) {
  const storage = deps.storage !== undefined ? deps.storage
    : (typeof localStorage !== 'undefined' ? localStorage : null);
  const library = deps.library !== undefined ? deps.library
    : (typeof window !== 'undefined' ? window.SDT?.Cards : null);
  const storeKey = deps.storeKey ?? KEY;
  try {
    if (!storage || !library || storage.getItem(MARKER) === '1') return;
    const raw = storage.getItem(storeKey);
    if (raw == null) return;
    const stored = JSON.parse(raw);
    if (!Array.isArray(stored) || !stored.length || stored.some(card => !card || typeof card.id !== 'string')) return;
    if (new Set(stored.map(card => card.id)).size !== stored.length || !sameSnapshot(library.all(), stored)) return;

    const canonical = new Map();
    for (const [id, tableName] of CANONICAL_TABLE_BY_ID) {
      const found = library[tableName]?.find?.(card => card?.id === id);
      if (!found) return;
      canonical.set(id, found);
    }
    const foundIds = new Set();
    let dirty = false;
    const next = library.all().map(card => {
      const definition = definitions.get(card.id);
      if (!definition) return card;
      foundIds.add(card.id);
      if (Object.prototype.hasOwnProperty.call(card, 'rules') || !sameSnapshot(card, canonical.get(card.id))) return card;
      const migrated = { ...card, ...(definition.desc ? { desc: definition.desc } : {}), rules: definition.rules };
      const validation = validateCardRules(migrated);
      if (!validation.ok) throw new Error(`M8 schema rejected ${card.id}: ${validation.errors.map(e => `${e.path}: ${e.message}`).join('; ')}`);
      const capability = inspectCardRuleCapability(migrated);
      if (!capability.ok) throw new Error(`M8 capability rejected ${card.id}: ${capability.issues.map(e => `${e.path}: ${e.message}`).join('; ')}`);
      dirty = true;
      return migrated;
    });
    if (foundIds.size !== definitions.size) return;
    if (dirty) {
      if (!library.saveAll(next) || storage.getItem(storeKey) !== JSON.stringify(next)) return;
    } else if (storage.getItem(storeKey) !== raw) return;
    storage.setItem(MARKER, '1');
  } catch (error) {
    console.error('[cards] M8 rule migration failed; marker was not written:', error?.message ?? error);
  }
}
