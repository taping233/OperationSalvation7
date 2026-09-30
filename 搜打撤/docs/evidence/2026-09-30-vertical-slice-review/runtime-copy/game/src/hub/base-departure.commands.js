// @ts-check
/** @typedef {{ id?: string, name: string, rarity?: string, type?: string, [key: string]: unknown }} DepartureCard */
/** @typedef {{ card: DepartureCard, count: number }} DepartureStack */
/** @typedef {{ stash?: DepartureStack[], pocket?: DepartureStack[], [key: string]: unknown }} DepartureState */
/** @typedef {{ ok: true, cards: Array<{ card: DepartureCard, count: number }>, rejectedClassNames: string[], pocketCleared: boolean, dispersedPocketCount: number } | { ok: false, why: 'save' }} DepartureResult */
/** @typedef {{ read(): DepartureState, mutate<T>(prepare: (draft: DepartureState) => T, failure: DepartureResult): T | DepartureResult }} DeparturePorts */

/** @param {DeparturePorts} ports */
export function createBaseDepartureCommands({ read, mutate }) {
  /** @param {Record<string, unknown> | null | undefined} picks @returns {DepartureResult} */
  function prepareDeparture(picks) {
    const state = read();
    const stash = Array.isArray(state.stash) ? state.stash : [];
    const pocket = Array.isArray(state.pocket) ? state.pocket : [];
    const requested = picks && typeof picks === 'object' && !Array.isArray(picks) ? picks : {};
    /** @type {Array<{ name: string, count: number }>} */
    const plan = [];
    /** @type {string[]} */
    const rejectedClassNames = [];

    for (const name of Object.keys(requested)) {
      const quantity = Math.max(0, Math.floor(Number(requested[name]) || 0));
      if (quantity <= 0) continue;
      const stack = stash.find(item => item?.card?.name === name);
      if (!stack) continue;
      if (stack.card.rarity === '职业') {
        rejectedClassNames.push(name);
        continue;
      }
      const count = Math.min(quantity, stack.count || 0);
      if (count <= 0) continue;
      plan.push({ name, count });
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
      for (const { name, count } of plan) {
        const index = draftStash.findIndex(item => item?.card?.name === name);
        if (index < 0) continue;
        const stack = draftStash[index];
        const actual = Math.min(count, stack.count || 0);
        if (actual <= 0) continue;
        cards.push({ card: stack.card, count: actual });
        stack.count -= actual;
        if (stack.count <= 0) draftStash.splice(index, 1);
      }
      draft.pocket = [];
      return { ok: true, cards, rejectedClassNames, pocketCleared: pocket.length > 0, dispersedPocketCount };
    }, failure);
  }

  return { prepareDeparture };
}
