// @ts-check
// M11：M 批剩余普通卡的命名 hosted 声明；执行文本由 battle.hosted 固定 canonical identity adapter 提供。
import { KEY } from './cards.consts.js';
import { validateCardRules } from './card-rules.schema.js';
import { inspectCardRuleCapability } from './card-rules.capability.js';

export const M11_HOSTED_BY_ID = Object.freeze({
  'cmtn1wnhhym': 'temporary-hand-cards',
  'cmtn233trmeg': 'keep-self-in-hand',
  'tt3-fatal-pierce': 'bleed-gated-armor-break',
  'tt3-frostfall': 'choose-and-cast-melee',
  'tt3-qi-wave': 'draw-and-price-damage',
  'tt7-bloodpoison': 'double-target-poison-daggers',
  'tt7-ghostblade': 'stealth-break-bonus',
  'tt7-marchrush': 'last-hand-repeat-all',
  'cc-poison-burst': 'burst-existing-poison',
  'tt12-felguard': 'infused-immune-spell',
  'tt12-freezeray': 'untouched-target-freeze',
  'tt12-raydragon': 'infused-ray',
  'tt3-magic-lamp': 'three-choice-lamp',
  'tt7-holyheal': 'infused-price-heal',
  'tt7-meteorstrong': 'infused-fireball-burst',
  'tt7-provoke': 'foe-fight-select',
  'tt3sp-bloodstorm': 'infused-repeating-lifesteal',
  'tt3sp-flowerzhen': 'double-and-burst-poison',
  'tt3sp-silverthorn': 'infused-damage-bonus',
  'tt-token-color': 'class-ability-acquire',
  'tt-medneedle': 'delayed-heal-item',
  'tt7-arcanebolt': 'damage-and-draw',
});
const MARKER = 'sdt-cards-m11-hosted-rules-v1-seeded';
const definitions = new Map(Object.entries(M11_HOSTED_BY_ID).map(([id, hosted]) =>
  [id, id === 'tt-token-color'
    ? { rules: { version: 1, bag: { use: [{ op: 'acquire', pool: { kind: 'classAbility' } }] } } }
    : { rules: { version: 1, battle: { hosted: [hosted] } } }]));

function canonicalCard(library, id) {
  for (const tableName of ['CARDS_SYNC', 'TABLETOP12', 'TABLETOP11', 'TABLETOP10', 'TABLETOP7']) {
    const found = library[tableName]?.find?.(card => card?.id === id);
    if (found) return found;
  }
  return null;
}
function sameSnapshot(left, right) {
  if (left === right) return true;
  if (!left || !right || typeof left !== 'object' || typeof right !== 'object') return false;
  if (Array.isArray(left) !== Array.isArray(right)) return false;
  if (Array.isArray(left) && left.length !== right.length) return false;
  const keys = Object.keys(left);
  return keys.length === Object.keys(right).length && keys.every(key =>
    Object.prototype.hasOwnProperty.call(right, key) && sameSnapshot(left[key], right[key]));
}

/** M11 保守回填入口；仅绑定固定卡 ID 和同名宿主声明。 */
export function ensureM11HostedRules(deps = {}) {
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
    if (!Array.isArray(stored) || !stored.length || stored.some(card => !card || typeof card !== 'object'
      || Array.isArray(card) || typeof card.id !== 'string' || !card.id)) return;
    if (new Set(stored.map(card => card.id)).size !== stored.length || !sameSnapshot(library.all(), stored)) return;
    const canonical = new Map();
    for (const id of definitions.keys()) {
      const found = canonicalCard(library, id);
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
      const migrated = { ...card, rules: definition.rules };
      const validation = validateCardRules(migrated);
      if (!validation.ok) throw new Error(`M11 schema rejected ${card.id}: ${validation.errors.map(e => `${e.path}: ${e.message}`).join('; ')}`);
      const capability = inspectCardRuleCapability(migrated);
      if (!capability.ok) throw new Error(`M11 capability rejected ${card.id}: ${capability.issues.map(e => `${e.path}: ${e.message}`).join('; ')}`);
      dirty = true;
      return migrated;
    });
    if (foundIds.size !== definitions.size) return;
    if (dirty) {
      if (!library.saveAll(next) || storage.getItem(storeKey) !== JSON.stringify(next)) return;
    } else if (storage.getItem(storeKey) !== raw) return;
    storage.setItem(MARKER, '1');
  } catch (error) {
    console.error('[cards] M11 hosted migration failed; marker was not written:', error?.message ?? error);
  }
}
