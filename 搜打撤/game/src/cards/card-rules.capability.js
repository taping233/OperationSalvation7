// @ts-check
import { validateCardRules } from './card-rules.schema.js';

/** @typedef {import('./card-rules.capability.types.js').BattleOperationName} BattleOperationName */
/** @typedef {import('./card-rules.capability.types.js').OperationTarget} OperationTarget */
/** @typedef {import('./card-rules.capability.types.js').AcquireDestination} AcquireDestination */
/** @typedef {import('./card-rules.capability.types.js').AcquireAction} AcquireAction */
/** @typedef {import('./card-rules.capability.types.js').CardRuleIssue} CardRuleIssue */

// Only operation/target pairs consumed by the current battle resolver. Schema remains
// the shape authority; these finite types check the actual production capability table.
/** @type {Readonly<Record<BattleOperationName, readonly OperationTarget[]>>} */
const OPERATION_TARGETS = {
  damage: ['chosenEnemy', 'allEnemies', 'randomEnemy'],
  curse: ['chosenEnemy', 'allEnemies', 'randomEnemy', 'self'],
  status: ['allEnemies'],
  heal: [], armor: [], draw: [], discover: [], acquire: [], coins: [],
  blessing: [], energy: [], energyCap: [], maxHp: [], deckCap: [],
};
/** @type {Readonly<Record<AcquireDestination, readonly AcquireAction[]>>} */
const ACQUIRE_ACTIONS = {
  hand: ['dup', 'noInfuse'],
  deck: ['dup', 'zeroCost', 'noInfuse'],
  discover: ['play', 'playKeep', 'dup', 'zeroCost', 'decay'],
};

/** @param {unknown} value @returns {value is object} */
function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
/** @param {unknown} value @returns {value is readonly unknown[]} */
function isUnknownArray(value) {
  return Array.isArray(value);
}
/** Read external data without an open-index card/operation type.
 * @param {unknown} value @param {string} key @returns {unknown} */
function field(value, key) {
  return isObject(value) ? Reflect.get(value, key) : undefined;
}
/** @param {unknown} value @returns {value is BattleOperationName} */
function isBattleOperation(value) {
  return typeof value === 'string' && Object.hasOwn(OPERATION_TARGETS, value);
}
/** @param {unknown} value @returns {value is OperationTarget} */
function isOperationTarget(value) {
  return value === 'chosenEnemy' || value === 'allEnemies' || value === 'randomEnemy' || value === 'self';
}
/** @param {unknown} value @returns {value is AcquireDestination} */
function isAcquireDestination(value) {
  return value === 'hand' || value === 'deck' || value === 'discover';
}
/** @param {unknown} value @returns {value is AcquireAction} */
function isAcquireAction(value) {
  return value === 'play' || value === 'playKeep' || value === 'dup' || value === 'zeroCost' ||
    value === 'decay' || value === 'noInfuse';
}

/**
 * Pure, whole-card battle-entry preflight. `supported` does not claim base/bag/equip
 * execution or complete static typing of the resolver. No card data is changed.
 * @param {unknown} card
 * @returns {import('./card-rules.capability.types.js').CardRuleCapability}
 */
export function inspectCardRuleCapability(card) {
  const cardId = String(field(card, 'id') ?? '<missing id>');
  if (!isObject(card)) {
    return { kind: 'invalid', ok: false, issues: [{ cardId, path: 'card', message: 'expected a card object' }] };
  }
  const validation = validateCardRules(card);
  if (!validation.ok) return { kind: 'invalid', ok: false, issues: validation.errors };
  const rules = field(card, 'rules');
  if (rules === undefined) return { kind: 'legacy', ok: true };

  /** @type {CardRuleIssue[]} */
  const issues = [];
  /** @param {string} path @param {string} message */
  const reject = (path, message) => { issues.push({ cardId, path, message }); };
  if (isObject(rules) && Object.hasOwn(rules, 'equip')) {
    reject('rules.equip', 'Unsupported equipment rules: battle equipment interpreter is not connected');
  }
  const triggers = field(rules, 'triggers');
  if (isObject(triggers)) {
    for (const trigger of Object.keys(triggers)) {
      if (trigger !== 'onPlay') reject(`rules.triggers.${trigger}`, 'Unsupported trigger: battle interpreter is not connected');
    }
  }
  const onPlay = field(triggers, 'onPlay');
  // Validation above owns array/object shape checks. Still narrow unknown at this consumer.
  if (isUnknownArray(onPlay)) for (const [index, operation] of onPlay.entries()) {
    const path = `rules.triggers.onPlay[${index}]`;
    const op = field(operation, 'op');
    if (!isBattleOperation(op)) {
      reject(`${path}.op`, `Unsupported onPlay operation '${String(op)}'`);
      continue;
    }
    const target = field(operation, 'target');
    if (target !== undefined && (!isOperationTarget(target) || !OPERATION_TARGETS[op].includes(target))) {
      reject(`${path}.target`, `Unsupported onPlay ${op} target '${String(target)}'`);
    }
    const pendingKeys = op === 'damage' ? ['graveyard', 'schedule'] : op === 'draw' ? ['untilHandN', 'handOps'] : [];
    for (const key of pendingKeys) {
      if (isObject(operation) && key in operation) reject(`${path}.${key}`, `Unsupported onPlay ${op} parameter '${key}'`);
    }
    if (op === 'damage' && field(field(operation, 'hits'), 'perFoe') !== undefined) {
      reject(`${path}.hits.perFoe`, "Unsupported onPlay damage parameter 'hits.perFoe'");
    }
    if (op === 'acquire') {
      if (isObject(operation) && 'filter' in operation) {
        reject(`${path}.filter`, "Unsupported onPlay acquire parameter 'filter': filter is not consumed");
      }
      const dest = field(operation, 'dest') ?? 'discover';
      const act = field(operation, 'act');
      if (act !== undefined && (!isAcquireDestination(dest) || !isAcquireAction(act) || !ACQUIRE_ACTIONS[dest].includes(act))) {
        reject(`${path}.act`, `Unsupported acquire act '${String(act)}' for dest '${String(dest)}'`);
      }
    }
  }
  return issues.length ? { kind: 'unsupported', ok: false, issues } : { kind: 'supported', ok: true };
}
