// @ts-check
import { clone } from '../core/shared.js';
/** @typedef {{ id?: string, name: string, rarity?: string, type?: string, [key: string]: unknown }} DepartureCard */
/** @typedef {{ card: DepartureCard, count: number, stackKey?: string, variantKey?: string }} DepartureStack */
/** @typedef {{ stash?: DepartureStack[], pocket?: DepartureStack[], [key: string]: unknown }} DepartureState */
/** @typedef {{ ok: true, cards: Array<{ card: DepartureCard, count: number }>, rejectedClassNames: string[], pocketCleared: boolean, dispersedPocketCount: number } | { ok: false, why: 'save' }} DepartureResult */
/** @typedef {{ read(): DepartureState, mutate<T>(prepare: (draft: DepartureState) => T, failure: DepartureResult): T | DepartureResult }} DeparturePorts */

// Same stable identity as collection.stackKeyOf, without importing its Base command cycle.
// Name-only callers retain the historical first-match contract; new pages pass full keys.
/** @param {DepartureStack} stack @returns {string} */
export function departureStackKey(stack) {
  return stack && (stack.stackKey || (stack.card?.id
    ? `card:${stack.card.id}${stack.variantKey || stack.card.variantKey ? `:${stack.variantKey || stack.card.variantKey}` : ''}`
    : stack.card?.name || ''));
}
/** @param {DepartureStack[]} stash @param {string} key @returns {DepartureStack | null} */
export function findDepartureStack(stash, key) {
  const matching = stash.filter(stack => departureStackKey(stack) === key);
  if (matching.length) return matching.length === 1 || matching.every(stack => !stack.stackKey && !stack.card?.id) ? matching[0] : null;
  return stash.find(stack => stack?.card?.name === key) || null;
}

/** @param {DeparturePorts} ports */
export function createBaseDepartureCommands({ read, mutate }) {
  /** @param {Record<string, unknown> | null | undefined} picks @returns {DepartureResult} */
  function prepareDeparture(picks) {
    const state = read();
    const stash = Array.isArray(state.stash) ? state.stash : [];
    const pocket = Array.isArray(state.pocket) ? state.pocket : [];
    const requested = picks && typeof picks === 'object' && !Array.isArray(picks) ? picks : {};
    /** @type {Array<{ key: string, count: number }>} */
    const plan = [];
    /** @type {string[]} */
    const rejectedClassNames = [];

    for (const name of Object.keys(requested)) {
      const quantity = Math.max(0, Math.floor(Number(requested[name]) || 0));
      if (quantity <= 0) continue;
      const stack = findDepartureStack(stash, name);
      if (!stack) continue;
      if (stack.card.rarity === '职业') {
        rejectedClassNames.push(stack.card.name);
        continue;
      }
      const count = Math.min(quantity, stack.count || 0);
      if (count <= 0) continue;
      plan.push({ key: departureStackKey(stack), count });
    }

    const dispersedPocketCount = pocket.length
      ? pocket.reduce((total, stack) => total + stack.count, 0)
      : 0;
    if (!plan.length && !pocket.length) {
      return { ok: true, cards: [], rejectedClassNames, pocketCleared: false, dispersedPocketCount: 0 };
    }

    /** @type {DepartureResult} */
    const failure = { ok: false, why: 'save' };
    return mutate(draft => {
      const draftStash = Array.isArray(draft.stash) ? draft.stash : [];
      const cards = [];
      for (const { key, count } of plan) {
        const selected = findDepartureStack(draftStash, key);
        if (!selected) continue;
        const index = draftStash.indexOf(selected);
        if (index < 0) continue;
        const stack = draftStash[index];
        const actual = Math.min(count, stack.count || 0);
        if (actual <= 0) continue;
        // Run admission carries card snapshots, so preserve a warehouse-level
        // variant on that snapshot before its enclosing stack is discarded.
        const card = stack.variantKey ? { ...stack.card, variantKey: stack.variantKey } : stack.card;
        cards.push({ card, count: actual });
        stack.count -= actual;
        if (stack.count <= 0) draftStash.splice(index, 1);
      }
      draft.pocket = [];
      return { ok: true, cards, rejectedClassNames, pocketCleared: pocket.length > 0, dispersedPocketCount };
    }, failure);
  }

  return { prepareDeparture };
}

/** Plan the existing departure command without publishing or persisting its draft.
 * @param {DepartureState} state
 * @param {Record<string, unknown> | null | undefined} picks
 */
export function planBaseDeparture(state, picks) {
  const afterState = clone(state);
  const commands = createBaseDepartureCommands({
    read: () => state,
    mutate: prepare => prepare(afterState),
  });
  return { departure: commands.prepareDeparture(picks), afterState };
}
