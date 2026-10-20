import { hasStructuredTrigger, hasStructuredEquipField, triggerDeclarations, REGISTERED_TRIGGER_POINTS } from './card-trigger-contract.js';

/** Select a trigger's sole authority. Empty declarations still suppress legacy text.
 * Invalid declarations remain visible to preflight rather than becoming text fallback.
 * @param {import('./card-execution-plan.types').ExecutionCard} card
 * @param {import('./card-execution-plan.types').TriggerPoint} point
 * @returns {import('./card-execution-plan.types').ExecutionPlan} */
export function triggerExecutionPlan(card, point) {
  const declared = hasStructuredTrigger(card, point);
  // Migrated equipment retains its existing consume-text suppression contract.
  const structured = declared || (point === 'onConsume' && card?.rules?.equip != null);
  const declarations = triggerDeclarations(card);
  const explicit = declarations != null && Object.prototype.hasOwnProperty.call(declarations, point);
  return { kind: structured ? 'structured' : 'text',
    ops: explicit ? declarations[point] : [] };
}

/** Equipment actions use the same ownership rule as trigger actions.
 * @param {import('./card-execution-plan.types').ExecutionCard} card
 * @param {import('./card-execution-plan.types').EquipmentPoint} point
 * @returns {import('./card-execution-plan.types').ExecutionPlan} */
export function equipmentExecutionPlan(card, point) {
  const structured = hasStructuredEquipField(card, point);
  const equip = card.rules?.equip;
  const ops = point === 'skill' ? equip?.skill?.ops : equip?.[point];
  const explicit = equip != null && Object.prototype.hasOwnProperty.call(equip, point);
  return { kind: structured ? 'structured' : 'text',
    ops: explicit ? ops : [] };
}

/** Pure registration snapshot; direct trigger points never enter the registry.
 * @param {import('./card-execution-plan.types').ExecutionCard} card */
export function registeredExecutionPlan(card) {
  /** @type {Map<import('./card-execution-plan.types').TriggerPoint, import('./card-execution-plan.types').ExecutionOperation[]>} */
  const points = new Map();
  for (const point of REGISTERED_TRIGGER_POINTS) {
    const source = triggerExecutionPlan(card, point);
    if (source.kind === 'structured' && Array.isArray(source.ops) && source.ops.length) points.set(point, source.ops);
  }
  const duration = triggerDeclarations(card)?.duration;
  return { points, left: Number.isInteger(duration) ? duration : null };
}

/** Restore declarations stripped by play dispatch before whole-card preflight.
 * This entry precedes validation and must preserve invalid input for the schema checker.
 * @param {unknown} card @returns {unknown} */
export function cardRulePreflightView(card) {
  const source = /** @type {{ _registeredTriggers?:unknown; rules?:object } | null | undefined} */ (card);
  return source?._registeredTriggers == null ? card
    : { ...source, rules: { ...source.rules, triggers: source._registeredTriggers } };
}

/** The resolver consumes onPlay only; other trigger containers require registration.
 * @param {import('./card-execution-plan.types').ExecutionCard} card */
export function assertPlayExecutionView(card) {
  for (const point of Object.keys(card?.rules?.triggers ?? {})) {
    if (point !== 'onPlay' && point !== 'duration') {
      throw new TypeError(`Trigger '${point}' must be registered via battle.triggers.m2.js before resolution (card ${card.id || '<missing id>'})`);
    }
  }
}

/** Shared immediate-text and numeric-field ownership for a played card.
 * @param {import('./card-execution-plan.types').ExecutionCard} card */
export function cardPlayExecutionPlan(card) {
  const onPlay = triggerExecutionPlan(card, 'onPlay');
  /** @param {import('./card-execution-plan.types').EquipmentPoint} point */
  const equipment = point => equipmentExecutionPlan(card, point);
  /** @param {import('./card-execution-plan.types').NumericCardField} field */
  const ownsField = field => /** @type {const} */ (['onEquip', 'battleStart', 'skill']).some(point => {
    const { ops } = equipment(point);
    return Array.isArray(ops) && ops.some(operation => operation.op === field || operation.amountField === field);
  });
  const venomStaffPassive = card.id === 'tt2-venomstaff'
    && card.rules?.battle?.hosted?.includes('venom-staff')
    && !card.rules?.triggers && !card.rules?.equip && !card.rules?.bag;
  return { onPlay, equipment, ownsField,
    suppressImmediateText: onPlay.kind === 'structured' || equipment('onEquip').kind === 'structured' || !!venomStaffPassive };
}

/** Read an unvalidated declaration without claiming that its schema has passed.
 * @param {unknown} value @param {string} key @returns {unknown} */
function declarationField(value, key) {
  return value == null ? undefined : Reflect.get(Object(value), key);
}

/** Builds an unvalidated view; capability/schema preflight checks the result.
 * @param {object} card @param {readonly unknown[]} operations */
export function createCardRuleExecutionView(card, operations) {
  const ops = operations.map(operation => {
    const op = declarationField(operation, 'op');
    const field = declarationField(operation, 'amountField');
    if (!['heal', 'armor', 'draw'].some(name => name === op) || field === undefined) return operation;
    const source = /** @type {{ amountField?:unknown }} */ (operation);
    const { amountField, ...rest } = source;
    return { ...rest, amount: declarationField(card, String(amountField)) };
  });
  const damage = ops.some(operation => declarationField(operation, 'op') === 'damage');
  const enemy = ops.some(operation => operation && (['damage', 'stealAtk', 'execute', 'foeFight'].some(name => name === declarationField(operation, 'op')) ||
    ['chosenEnemy', 'randomEnemy', 'allEnemies'].some(name => name === declarationField(operation, 'target'))));
  const area = ops.some(operation => declarationField(operation, 'target') === 'allEnemies');
  const noSide = ops.some(operation => declarationField(operation, 'op') === 'status' || declarationField(operation, 'op') === 'discover');
  const cardType = declarationField(card, 'type');
  const ignoresSilence = declarationField(declarationField(declarationField(card, 'rules'), 'battle'), 'ignoresSilence') === true;
  const synthetic = { ...card, desc: '', infuse: 0,
    type: damage && !['武术', '法术'].some(name => name === cardType) ? '法术' : cardType,
    dmgType: damage ? declarationField(card, 'dmgType') || 'fixed' : undefined,
    rules: { version: 1, battle: { target: { side: noSide ? null : enemy ? 'enemy' : 'self', area },
      ...(ignoresSilence ? { ignoresSilence: true } : {}) },
      triggers: { onPlay: ops } } };
  Reflect.deleteProperty(synthetic, '_registeredTriggers');
  for (const field of /** @type {const} */ (['dmg', 'heal', 'armor', 'draw'])) {
    if (!ops.some(operation => declarationField(operation, 'amountField') === field)) Reflect.deleteProperty(synthetic, field);
  }
  return synthetic;
}

