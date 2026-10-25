import { saveRunCheckpoint } from '../core/run-checkpoint.js';
import { createCardInstance } from '../cards/card-instance.js';

// A quote keeps object identity as well as the displayed terms. Page lifetime is
// supplied by the caller; currency, capacity and UID are checked again at commit.
/** @param {import('./run-domain-commands.types').ShopPorts} ports */
export function createShopCommands({ state, canReceive, newUid, isSellable, sellPrice, save, prepareAcquiredReward }) {
  let executing = false;
  /** @param {string} reason @returns {import('./run-domain-commands.types').TradeRejected} */
  const reject = reason => ({ ok:false, reason });
  /** @param {() => Promise<import('./run-domain-commands.types').TradeResult>} run */
  const execute = async run => {
    if (executing) return reject('busy');
    executing = true;
    try { return await run(); } finally { executing = false; }
  };
  /** @param {import('./run-domain-commands.types').BuyInput} input */
  function buy({ index, quote, replenish = false, current = () => true }) {
    return execute(async () => {
      const stock = state.shopStock, owned = state.ownedCards;
      const matches = () => current() && state.shopStock === stock && state.ownedCards === owned
        && Number.isInteger(index) && index >= 0 && stock[index] === quote?.slot
        && quote.slot.card === quote.card && quote.slot.price === quote.price && quote.slot.free === quote.free
        && quote.replenish === replenish && (quote.slot.shaReplenish != null) === replenish
        && quote.card && !quote.slot.empty && !quote.slot.sold && Number.isFinite(quote.price) && quote.price >= 0
        && (!replenish || typeof quote.slot.shaReplenish === 'number' && Number.isInteger(quote.slot.shaReplenish) && quote.slot.shaReplenish > 0);
      if (!matches()) return reject('stale');
      if (!Number.isFinite(state.coins) || state.coins < quote.price) return reject('coins');
      const card = quote.card;
      if (!card || !canReceive(card)) return reject('capacity');
      let uid;
      try { uid = newUid(); } catch { return reject('uid'); }
      if (typeof uid !== 'string' || !uid || owned.some(entry => entry.uid === uid)) return reject('uid');
      const entry = createCardInstance(card, uid);
      let acquiredReward = null;
      try { if (quote.slot.mystery) acquiredReward = prepareAcquiredReward?.(card) || null; }
      catch { return reject('reward'); }
      // Preparing an identity/capacity may call application ports synchronously.
      // Never trust the resources observed before those calls.
      if (!matches()) return reject('stale');
      if (!canReceive(card)) return reject('capacity');
      if (!matches() || !Number.isFinite(state.coins) || state.coins < quote.price) return reject('coins');
      if (owned.some(item => item.uid === uid)) return reject('uid');
      if (acquiredReward?.current && !acquiredReward.current()) return reject('reward');
      state.coins -= quote.price;
      if (replenish) quote.slot.shaReplenish = /** @type {number} */ (quote.slot.shaReplenish) - 1;
      else quote.slot.sold = true;
      owned.push(entry);
      acquiredReward?.commit();
      return { ok:true, entry, price:quote.price, bonusReward:acquiredReward?.snapshot,
        saved:await saveRunCheckpoint(save) };
    });
  }
  /** @param {import('./run-domain-commands.types').SellInput} input */
  function sell({ uid, quote, current = () => true }) {
    return execute(async () => {
      const owned = state.ownedCards;
      const matches = () => current() && state.ownedCards === owned && quote?.owned?.uid === uid
        && owned.includes(quote.owned) && quote.owned.card === quote.card && !quote.owned.stored
        && owned.filter(entry => entry.uid === uid).length === 1;
      if (!matches() || !isSellable(quote.card)) return reject('stale');
      const price = sellPrice(quote.card);
      if (!Number.isFinite(price) || price < 0 || !Number.isFinite(state.coins) || !matches()) return reject('stale');
      owned.splice(owned.indexOf(quote.owned), 1);
      state.coins += price;
      return { ok:true, entry:quote.owned, price, saved:await saveRunCheckpoint(save) };
    });
  }
  return { buy, sell };
}

/** @param {import('./run-domain-commands.types').ShopSlot[]} stock @param {import('./run-domain-commands.types').RunCard | undefined} starter */
export function commissionEligibleSlots(stock, starter) {
  return stock.map((slot,index) => ({slot,index})).filter(({slot}) => slot.card && !slot.empty && !slot.sold
    && !slot.free && slot.price > 0 && slot.shaReplenish == null && slot.card.id !== starter?.id
    && slot.card.name !== starter?.name);
}

// A commission discount is a saved draft, before any goods have been received.
// Preserve its existing retry contract: an unsuccessful draft save restores all
// price fields and status together while retaining the deterministic dice slots.
/** @param {import('./run-domain-commands.types').CommissionInput} input */
export async function applyCommissionDiscount({ stock, pending, starter, quotes, current, save }) {
  const eligible = commissionEligibleSlots(stock, starter).map(entry => entry.index);
  /** @param {number} index */
  const sameSlot = index => Number.isInteger(index) && quotes[index] && stock[index] === quotes[index].slot
    && stock[index].card === quotes[index].card;
  if (!current() || pending.status !== 'pending' || pending.slots.length !== 2
    || new Set(pending.slots).size !== 2 || !pending.slots.every(index => sameSlot(index) && eligible.includes(index))) return 'stale';
  const before = pending.slots.map(index => ({ slot:stock[index], price:stock[index].price,
    free:stock[index].free, commissionFree:stock[index].commissionFree,
    hadFree:Object.hasOwn(stock[index], 'free'), hadCommissionFree:Object.hasOwn(stock[index], 'commissionFree') }));
  before.forEach(({slot}) => Object.assign(slot, { price:0, free:true, commissionFree:true }));
  const oldStatus = pending.status;
  pending.status = 'applied';
  if (await saveRunCheckpoint(save)) return 'applied';
  before.forEach(({slot, price, free, commissionFree, hadFree, hadCommissionFree}) => {
    slot.price = price;
    if (hadFree) slot.free = free; else delete slot.free;
    if (hadCommissionFree) slot.commissionFree = commissionFree; else delete slot.commissionFree;
  });
  pending.status = oldStatus;
  return 'unsaved';
}
