// 基地经济命令只准备业务草稿；活动档位、存储冲突和持久化由 Base 提供。
// 所有复合操作共用一次 mutate，避免先扣款再入库/先领奖再保存。
// @ts-check

/** @typedef {{ id: string, name?: string, [field: string]: unknown }} BaseEconomyCard */
/** @typedef {{ card: BaseEconomyCard, count: number }} BaseEconomyCardStack */
/** @typedef {{ card: BaseEconomyCard, count?: number }} BaseEconomyCardInput */
/** @typedef {{ coins: number, wood: number, rations: number, keys: number, stash: BaseEconomyCardStack[], achClaimed: Record<string, boolean>, collClaimed: Record<string, boolean>, backs: Record<string, boolean> }} BaseEconomyState */
/** @typedef {{ ok: false, why: 'save', msg: string }} BaseEconomySaveFailure */
/** @typedef {{ ok: false, why: 'invalid' | 'poor' | 'full' | 'empty' | 'claimed', msg?: string }} BaseEconomyFailure */
/** @typedef {{ ok: true }} BaseEconomySuccess */
/** @typedef {'wood' | 'rations' | 'keys'} BaseEconomyMaterial */
/** @typedef {{ wood?: number, rations?: number, keys?: number }} BaseEconomyReward */
/** @typedef {{ read(): BaseEconomyState, mutate<T>(prepare: (draft: BaseEconomyState) => T, failure: BaseEconomySaveFailure): T | BaseEconomySaveFailure, appendCards(draft: BaseEconomyState, cards: readonly BaseEconomyCardInput[], toPocket: boolean): void, room(): number }} BaseEconomyPorts */
/** @typedef {{ price: number, material?: BaseEconomyMaterial, card?: BaseEconomyCard | null }} PurchaseInput */
/** @typedef {{ kind: 'achievement' | 'collection', id: string, reward: BaseEconomyReward, cards?: readonly BaseEconomyCardInput[], back?: string }} GrantRewardInput */

/** @type {BaseEconomyMaterial[]} */
const RESOURCE_FIELDS = ['wood', 'rations', 'keys'];

/** @param {BaseEconomyPorts} ports */
export function createBaseEconomy({ read, mutate, appendCards, room }) {
  /** @type {BaseEconomySaveFailure} */
  const savedFailure = { ok: false, why: 'save', msg: '基地存档未保存，请重新载入后重试' };

  /** @param {PurchaseInput} input @returns {BaseEconomySuccess | BaseEconomyFailure | BaseEconomySaveFailure} */
  function purchase({ price, material, card }) {
    if (!Number.isFinite(price) || price < 0) return { ok: false, why: 'invalid' };
    if (material && !['wood', 'rations', 'keys'].includes(material)) return { ok: false, why: 'invalid' };
    if (!material && !card) return { ok: false, why: 'invalid' };
    if (read().coins < price) return { ok: false, why: 'poor' };
    if (!material && room() <= 0) return { ok: false, why: 'full' };
    return mutate(draft => {
      draft.coins -= price;
      if (material) draft[material] = (draft[material] || 0) + 1;
      else if (card) appendCards(draft, [{ card, count: 1 }], false);
      return { ok: true };
    }, savedFailure);
  }

  /** @param {string} cardId @param {readonly BaseEconomyCardInput[]} cards @returns {BaseEconomySuccess | BaseEconomyFailure | BaseEconomySaveFailure} */
  function openCardPack(cardId, cards) {
    const index = read().stash.findIndex(stack => stack.card.id === cardId);
    if (index < 0) return { ok: false, why: 'empty' };
    const count = cards.reduce((total, stack) => total + (stack.count || 1), 0);
    if (!count) return { ok: false, why: 'empty' };
    // The consumed pack releases one warehouse slot in the same draft.
    if (count > 0 && room() + 1 < count) return { ok: false, why: 'full' };
    return mutate(draft => {
      const source = draft.stash[index];
      source.count--;
      if (source.count <= 0) draft.stash.splice(index, 1);
      appendCards(draft, cards, false);
      return { ok: true };
    }, savedFailure);
  }

  /** @param {GrantRewardInput} input @returns {BaseEconomySuccess | BaseEconomyFailure | BaseEconomySaveFailure} */
  function grantReward({ kind, id, reward, cards = [], back }) {
    const field = kind === 'achievement' ? 'achClaimed' : kind === 'collection' ? 'collClaimed' : null;
    if (!field || !id) return { ok: false, why: 'invalid' };
    if (read()[field][id]) return { ok: false, why: 'claimed' };
    const count = cards.reduce((total, stack) => total + (stack.count || 1), 0);
    if (count > 0 && room() < count) return { ok: false, why: 'full' };
    return mutate(draft => {
      draft[field][id] = true;
      for (const resource of RESOURCE_FIELDS) {
        draft[resource] = (draft[resource] || 0) + (reward[resource] || 0);
      }
      appendCards(draft, cards, false);
      if (back) draft.backs[back] = true;
      return { ok: true };
    }, savedFailure);
  }

  return Object.freeze({ purchase, openCardPack, grantReward });
}
