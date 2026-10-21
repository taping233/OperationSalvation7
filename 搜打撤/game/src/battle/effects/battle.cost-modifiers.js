/** One battle-local absolute cost for one exact target turn.
 * Stored in zeroFeeUntil; owned/granted card definitions remain unchanged.
 * @typedef {{version: 1, kind: 'set', lifetime: 'targetTurn', amount: number,
 *   targetTurn: number, onlyReduce: boolean}} TargetTurnCostModifier
 */

const validTurn = turn => Number.isInteger(turn) && turn >= 0;
const validAmount = amount => typeof amount === 'number' && Number.isFinite(amount) && amount >= 0;

/** @returns {TargetTurnCostModifier} */
export function createTargetTurnCostModifier(amount, targetTurn, { onlyReduce = false } = {}) {
  if (!validAmount(amount) || !validTurn(targetTurn) || typeof onlyReduce !== 'boolean')
    throw new TypeError('Invalid target-turn cost modifier');
  return Object.freeze({ version: 1, kind: 'set', lifetime: 'targetTurn', amount, targetTurn, onlyReduce });
}

function targetTurnOf(modifier) {
  // Legacy battle saves store just the turn number, implicitly setting cost to zero.
  if (typeof modifier === 'number') return validTurn(modifier) ? modifier : null;
  if (!modifier || typeof modifier !== 'object' || Array.isArray(modifier) ||
      modifier.version !== 1 || modifier.kind !== 'set' || modifier.lifetime !== 'targetTurn' ||
      !validAmount(modifier.amount) || !validTurn(modifier.targetTurn) ||
      typeof modifier.onlyReduce !== 'boolean') return null;
  return modifier.targetTurn;
}

/** Pure lifecycle check: reading or playing a card never spends a target-turn effect.
 * @returns {'pending' | 'active' | 'expired' | 'invalid'} */
export function targetTurnCostStatus(modifier, turn) {
  const targetTurn = targetTurnOf(modifier);
  if (targetTurn === null || !validTurn(turn)) return 'invalid';
  return turn < targetTurn ? 'pending' : turn === targetTurn ? 'active' : 'expired';
}

/** Return null when this slot does not apply; existing higher/lower priority rules stay in charge. */
export function targetTurnCardCost(currentCost, modifier, turn) {
  if (targetTurnCostStatus(modifier, turn) !== 'active') return null;
  if (typeof modifier === 'number') return 0;
  if (!modifier.onlyReduce) return modifier.amount;
  const base = Number(currentCost);
  return Number.isFinite(base) ? Math.min(Math.max(0, base), modifier.amount) : null;
}
