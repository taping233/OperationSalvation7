// @ts-check
import { validateCardRules, createCardRuleExecutionView, HOSTED_BATTLE_RULES, HOSTED_CARD_RULES, BAG_SUPPORTED_OPS } from './card-rules.schema.js';
import { BATTLE_TRIGGER_POINTS } from './card-trigger-contract.js';
import { cardRulePreflightView } from './card-execution-plan.js';
import { SEMANTIC_OPERATION_TARGETS } from './card-semantic-contract.js';

/** @typedef {import('./card-rules.capability.types.js').BattleOperationName} BattleOperationName */
/** @typedef {import('./card-rules.capability.types.js').OperationTarget} OperationTarget */
/** @typedef {import('./card-rules.capability.types.js').AcquireDestination} AcquireDestination */
/** @typedef {import('./card-rules.capability.types.js').AcquireAction} AcquireAction */
/** @typedef {import('./card-rules.capability.types.js').CardRuleIssue} CardRuleIssue */

// Only operation/target pairs consumed by the current battle resolver. Schema remains
// the shape authority; these finite types check the actual production capability table.
/** @type {Readonly<Record<BattleOperationName, readonly OperationTarget[]>>} */
const OPERATION_TARGETS = {
  ...SEMANTIC_OPERATION_TARGETS,
  damage: ['chosenEnemy', 'allEnemies', 'randomEnemy'],
  curse: ['chosenEnemy', 'allEnemies', 'randomEnemy', 'self'],
  status: ['allEnemies'],
  heal: [], armor: [], draw: [], discover: [], acquire: [], coins: [],
  blessing: [], energy: [], refillEnergy: [], energyCap: [], maxHp: [], deckCap: [],
  // M1（2026-09-27）：净化——Wave1 仅支持净化自身
  cleanse: ['self'],
  // M2（2026-09-27）：execute/summon/extraTurn/registerRule/transform 键位已定族全量接线；
  // stealAtk 偷取攻击（enemy 域）、noDrawNext 下回合禁抽（无参）
  stealAtk: ['chosenEnemy', 'allEnemies', 'randomEnemy'],
  noDrawNext: [], extraTurn: [], execute: [], summon: [], registerRule: [], transform: [],
  // M3：敌对敌互殴（扰敌）/ 随机复制手牌（刀剑形态）
  foeFight: [], copyRandom: [],
};
/** M1：draw.handOps 已接线的手牌操作（金蝉脱壳「消耗所有手牌」/ 弃置）；其余 entry op 仍待后续批次。 */
const SUPPORTED_HAND_OPS = new Set(['consumeHand', 'dumpHand']);
/** M1：acquire.filter 已消费的基础键（费用等于 / 费用上限；type 过滤与池名词重叠不放行）。
 * 未知键仍拒绝防静默不生效（E6 回归口径：未消费的 filter 必须在结算前拒绝）。 */
const SUPPORTED_ACQUIRE_FILTER_KEYS = new Set(['cost', 'costMax', 'exceptIds']);
/** @type {Readonly<Record<AcquireDestination, readonly AcquireAction[]>>} */
const ACQUIRE_ACTIONS = {
  hand: ['dup', 'noInfuse', 'zeroCost'],
  deck: ['dup', 'zeroCost', 'costMinusOne', 'noInfuse'],
  discover: ['play', 'playKeep', 'dup', 'zeroCost', 'decay', 'noInfuse'],
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
  return value === 'chosenEnemy' || value === 'allEnemies' || value === 'randomEnemy' || value === 'self' || value === 'allAllies';
}
/** @param {unknown} value @returns {value is AcquireDestination} */
function isAcquireDestination(value) {
  return value === 'hand' || value === 'deck' || value === 'discover';
}
/** @param {unknown} value @returns {value is AcquireAction} */
function isAcquireAction(value) {
  return value === 'play' || value === 'playKeep' || value === 'dup' || value === 'zeroCost' ||
    value === 'costMinusOne' || value === 'decay' || value === 'noInfuse';
}

/**
 * Pure, whole-card battle-entry preflight. `supported` does not claim base/bag/equip
 * execution or complete static typing of the resolver. No card data is changed.
 * @param {unknown} card
 * @returns {import('./card-rules.capability.types.js').CardRuleCapability}
 */
export function inspectCardRuleCapability(card) {
  return inspectPreparedCard(cardRulePreflightView(card));
}

/** Analyze one migration candidate without validating its unchanged root twice.
 * The receipt is local to this call; no caller-supplied validation is accepted.
 * Registered-trigger views remain separate inputs and must be validated again.
 * @param {unknown} card
 * @returns {{validation: ReturnType<typeof validateCardRules>, capability: import('./card-rules.capability.types.js').CardRuleCapability}}
 */
export function analyzeCardRules(card) {
  const validation = validateCardRules(card);
  if (!validation.ok) return { validation, capability: { kind: 'invalid', ok: false, issues: validation.errors } };
  const prepared = cardRulePreflightView(card);
  return { validation, capability: inspectPreparedCard(prepared, prepared === card ? validation : undefined) };
}

/** @param {unknown} card
 * @param {ReturnType<typeof validateCardRules>} [validation]
 * @returns {import('./card-rules.capability.types.js').CardRuleCapability}
 */
function inspectPreparedCard(card, validation) {
  const cardId = String(field(card, 'id') ?? '<missing id>');
  if (!isObject(card)) {
    return { kind: 'invalid', ok: false, issues: [{ cardId, path: 'card', message: 'expected a card object' }] };
  }
  validation ??= validateCardRules(card);
  if (!validation.ok) return { kind: 'invalid', ok: false, issues: validation.errors };
  const rules = field(card, 'rules');
  if (rules === undefined) return { kind: 'legacy', ok: true };

  /** @type {CardRuleIssue[]} */
  const issues = [];
  /** @param {string} path @param {string} message */
  const reject = (path, message) => { issues.push({ cardId, path, message }); };
  // M2：装备域（G5）接线——onEquip/battleStart/passive/skill 由 battle.equipment.js +
  // battle.triggers.m2.js 消费；container 容量声明属背包容器域（battle.bag.js），仍拒绝。
  if (isObject(rules) && Object.hasOwn(rules, 'equip')) {
    const equipRules = field(rules, 'equip');
    if (isObject(equipRules) && Object.hasOwn(equipRules, 'container') &&
      !['资源', '法术'].includes(String(field(field(equipRules, 'container'), 'accepts')))) {
      reject('rules.equip.container', 'Unsupported equipment container: bag container domain is not connected');
    }
  }
  // M3：bag.use op 支持集收口（schema 形状之上的消费进度门）
  if (isObject(rules) && isObject(field(rules, 'bag'))) {
    const useOps = field(field(rules, 'bag'), 'use');
    for (const [index, operation] of (isUnknownArray(useOps) ? useOps : []).entries()) {
      const bagOp = field(operation, 'op');
      if (typeof bagOp !== 'string' || !BAG_SUPPORTED_OPS.has(bagOp)) {
        reject(`rules.bag.use[${index}].op`, `Unsupported bag use operation '${String(bagOp)}'`);
      }
    }
  }
  // M2：G13 时点触发器七时点全量接线（battle.triggers.m2.js runner），不再按未接线拒绝。
  const triggers = field(rules, 'triggers');
  const battleRules = field(rules, 'battle');
  const hosted = field(battleRules, 'hosted');
  if (isUnknownArray(hosted)) for (const [index, name] of hosted.entries()) {
    // Schema checks spelling; capability asserts an actual named dispatch exists.
    const registeredName = typeof name === 'string' && Object.entries(HOSTED_CARD_RULES)
      .some(([id, fixedName]) => id === cardId && fixedName === name);
    if (!registeredName || !HOSTED_BATTLE_RULES.has(/** @type {import('./card-rules.capability.types.js').HostedBattleRuleName} */ (name))) {
      reject(`rules.battle.hosted[${index}]`, `Unsupported hosted rule '${String(name)}'`);
    }
  }
  // Preflight every executable array before a player can pay its cost. Trigger and
  // equipment runners use the same resolver, so unsupported ops there are just as
  // dangerous as unsupported onPlay ops.
  /** @param {unknown} operations @param {string} path */
  const inspectOperationList = (operations, path) => {
    if (!isUnknownArray(operations)) return;
    if (path !== 'rules.triggers.onPlay') {
      // Reject at entry if the isolated batch would fail the resolver's onPlay contract.
      const view = createCardRuleExecutionView(card, operations);
      const checked = validateCardRules(view);
      for (const issue of checked.errors) {
        if (issue.path.startsWith('rules.triggers.onPlay') || issue.path.startsWith('rules.battle.target')) {
          reject(issue.path.replace('rules.triggers.onPlay', path), issue.message);
        }
      }
    }
    for (const [index, operation] of operations.entries()) {
      const operationPath = `${path}[${index}]`;
      const op = field(operation, 'op');
      if (!isBattleOperation(op)) {
        reject(`${operationPath}.op`, `Unsupported operation '${String(op)}'`);
        continue;
      }
      if (op === 'choice') {
        const options = field(operation, 'options');
        for (const [optionIndex, option] of (isUnknownArray(options) ? options : []).entries()) {
          inspectOperationList(field(option, 'ops'), `${operationPath}.options[${optionIndex}].ops`);
        }
      } else if (op === 'schedule') inspectOperationList(field(operation, 'ops'), `${operationPath}.ops`);
      if (op === 'transform' && field(operation, 'what') !== 'starterAttacks') {
        reject(`${operationPath}.op`, "Unsupported operation 'transform': no battle resolver branch is connected");
        continue;
      }
      const target = field(operation, 'target');
      if (target !== undefined && (!isOperationTarget(target) || !OPERATION_TARGETS[op].includes(target))) {
        reject(`${operationPath}.target`, `Unsupported ${op} target '${String(target)}'`);
      }
      if (op === 'damage' && field(field(operation, 'hits'), 'perFoe') !== undefined) {
        reject(`${operationPath}.hits.perFoe`, "Unsupported damage parameter 'hits.perFoe'");
      }
      if (op === 'curse' && field(operation, 'target') === 'self' && field(operation, 'curse') === 'atkDown') {
        reject(`${operationPath}.target`, 'Player attack loss and restoration are not connected for self atkDown');
      }
      if (op === 'draw' && field(operation, 'untilHandN') !== undefined && field(operation, 'filter') !== undefined) {
        reject(`${operationPath}.filter`, 'Unsupported filtered draw until hand size: the hand-size resolver does not consume filter');
      }
      if (op === 'acquire') {
        const filter = field(operation, 'filter');
        for (const key of isObject(filter) ? Object.keys(filter) : []) {
          if (!SUPPORTED_ACQUIRE_FILTER_KEYS.has(key)) reject(`${operationPath}.filter.${key}`, `Unsupported acquire filter key '${key}'`);
        }
        const dest = field(operation, 'dest') ?? 'discover';
        const act = field(operation, 'act');
        if (dest === 'hand' && act === 'zeroCost' && !['ids', 'types'].includes(String(field(field(operation, 'pool'), 'kind')))) {
          reject(`${operationPath}.act`, 'Direct zero-cost acquisition requires an explicit structured pool');
        }
        if (act !== undefined && (!isAcquireDestination(dest) || !isAcquireAction(act) || !ACQUIRE_ACTIONS[dest].includes(act))) {
          reject(`${operationPath}.act`, `Unsupported acquire act '${String(act)}' for dest '${String(dest)}'`);
        }
      }
      if (op === 'draw' && isObject(operation) && 'handOps' in operation) {
        const handOps = field(operation, 'handOps');
        for (const [entryIndex, entry] of (isUnknownArray(handOps) ? handOps : []).entries()) {
          const entryOp = field(entry, 'op');
          if (typeof entryOp !== 'string' || !SUPPORTED_HAND_OPS.has(entryOp)) {
            reject(`${operationPath}.handOps[${entryIndex}].op`, `Unsupported draw hand operation '${String(entryOp)}'`);
          }
        }
      }
    }
  };
  for (const point of BATTLE_TRIGGER_POINTS) {
    inspectOperationList(field(triggers, point), `rules.triggers.${point}`);
  }
  const equip = field(rules, 'equip');
  const passive = field(equip, 'passive');
  const condition = field(passive, 'cond');
  const aura = field(passive, 'aura');
  if (condition !== undefined && field(aura, 'deckCap') !== undefined) {
    reject('rules.equip.passive.aura.deckCap', 'Conditional deck capacity has no consumer');
  }
  if (field(condition, 'vsFreeze') !== undefined && field(condition, 'hasCurse') !== true &&
      ['atk', 'spellPower', 'focus'].some(key => field(aura, key) !== undefined)) {
    reject('rules.equip.passive.aura', 'Target freeze damage bonuses cannot condition player stat or energy auras');
  }
  for (const point of ['onEquip', 'battleStart']) inspectOperationList(field(equip, point), `rules.equip.${point}`);
  inspectOperationList(field(field(equip, 'skill'), 'ops'), 'rules.equip.skill.ops');
  return issues.length ? { kind: 'unsupported', ok: false, issues } : { kind: 'supported', ok: true };
}
