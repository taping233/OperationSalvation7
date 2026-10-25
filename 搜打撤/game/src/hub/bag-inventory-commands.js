import { planBagTokenCraft } from './bag-token-craft-plan.js';
import { containerRuleOf, containerAccepts, canReceiveCardFromBag, canAcceptCardAtCapacity } from '../core/card-capacity.js';
import { cardStacksForZone, deriveBagRenderState } from '../core/bag-render-derivation.js';

const POUCH_ID = 'tt7-stratagem';
const PEARL_ID = 'tt2-pearlbox';
/**
 * @typedef {{ id?:string, name:string, type?:string }} InventoryCard
 * @typedef {{ ok:false, code:'inactive'|'protected'|'missing'|'container-not-empty' }} DiscardFailure
 * @typedef {{ card:InventoryCard, count:number, capacity:number, storedCount:number }} TransferDetails
 * @typedef {{ delta:number, limit:number, used:number }} RetrievalCapacity
 * @typedef {{ ok:false, code:'inactive'|'container'|'missing' }} TransferUnavailable
 * @typedef {TransferDetails & { ok:false, code:'container-full' }} ContainerFull
 * @typedef {TransferDetails & RetrievalCapacity & { ok:false, code:'bag-full' }} BagFull
 * @typedef {TransferDetails & { ok:true }} TransferSuccess
 * @typedef {TransferUnavailable|ContainerFull|BagFull|TransferSuccess} TransferResult
 */
/** @template {string} Code @param {Code} code @returns {{ ok:false, code:Code }} */
const rejected = code => ({ ok:false, code });
const unavailable = (state, current) => state.battleActive || (current && !current());

// Commands own inventory writes only. The caller owns confirmations, feedback,
// persistence and rendering, and can supply its captured view/run validity port.
/**
 * @param {{ name:string, fromSafe:boolean, uid?:string|null, current?:()=>boolean }} request
 * @returns {DiscardFailure|{ ok:true, card:InventoryCard }}
 */
export function discardInventoryCard(state, request, sha) {
  const { name, fromSafe, uid = null, current } = request;
  if (unavailable(state, current)) return rejected('inactive');
  if (name === sha.id || name === sha.name) return rejected('protected');
  const index = state.ownedCards.findIndex(entry => !!entry.safe === !!fromSafe && !entry.stored && !entry.pouchOf
    && entry.card.name === name && (uid === null || entry.uid === uid));
  if (index < 0) return rejected('missing');
  const selected = state.ownedCards[index], containerId = selected.card.id;
  if (containerId === POUCH_ID || containerId === PEARL_ID) {
    const hasContents = state.ownedCards.some(entry => containerId === POUCH_ID
      ? entry.pouchOf === POUCH_ID : entry.stored && !entry.pouchOf);
    const hasRemainingContainer = state.ownedCards.some((entry, position) => position !== index
      && entry.card?.id === containerId && !entry.stored && !entry.pouchOf && containerRuleOf(entry.card));
    if (hasContents && !hasRemainingContainer) return rejected('container-not-empty');
  }
  const [entry] = state.ownedCards.splice(index, 1);
  return { ok:true, card:entry.card };
}

/**
 * @param {{ kind:string, sourceUid?:string, current?:()=>boolean }} request
 * @returns {{ ok:false, code:'inactive' }|{ ok:false, code:'recipe'|'bag-full', reason:string }|{ ok:true, card:InventoryCard, message:string }}
 */
export function craftInventoryToken(state, request, { cards, newUid, baseCap = null }) {
  const { kind, sourceUid, current } = request;
  if (unavailable(state, current)) return rejected('inactive');
  const plan = planBagTokenCraft(state, kind, cards(), sourceUid);
  if (!plan.ok) return { ok:false, code:'recipe', reason:plan.reason };
  // Consume exactly the planned entries: historical UIDs may be missing or shared by other cards.
  const sources = new Set(plan.sourceIndices.map(index => state.ownedCards[index]));
  const remaining = state.ownedCards.filter(entry => !sources.has(entry));
  if (baseCap) {
    const projected = deriveBagRenderState({ ownedCards:remaining, inventory:state.inventory || [] }, baseCap());
    if (!canReceiveCardFromBag(plan.card, { ownedCards:remaining,
      canAcceptCard:card => canAcceptCardAtCapacity(card, { usedSlots:projected.used, baseCap:projected.baseCap, totalCap:projected.cap }) })) {
      return { ok:false, code:'bag-full', reason:'背包空间不足，合成材料与碎片未消耗，请先腾出通用格' };
    }
  }
  // UID allocation can fail: allocate before consuming any material.
  const output = { uid:newUid(), card:plan.card };
  state.ownedCards = remaining;
  state.ownedCards.push(output);
  if (plan.fragments) state.fragments -= plan.fragments;
  return { ok:true, card:output.card, message:plan.message };
}

/**
 * @param {{ kind:string, take:boolean, name:string, current?:()=>boolean }} request
 * @returns {TransferResult}
 */
export function transferContainerStack(state, request, ports) {
  const { kind, take, name, current } = request;
  if (unavailable(state, current)) return rejected('inactive');
  if (kind !== 'pouch' && kind !== 'pearl') return rejected('container');
  const pouch = kind === 'pouch';
  const containers = state.ownedCards.filter(entry => entry.card?.id === (pouch ? POUCH_ID : PEARL_ID));
  const activeContainers = pouch ? containers.slice(0, 1) : containers;
  const capacity = activeContainers.reduce((sum, entry) => sum + (containerRuleOf(entry.card)?.slots || 0), 0);
  if (!capacity) return rejected('container');
  const inContainer = entry => pouch ? entry.pouchOf === POUCH_ID : entry.stored && !entry.pouchOf;
  const stored = state.ownedCards.filter(inContainer);
  // Deposits select the first rendered stack (at most its stack limit),
  // whereas retrieval releases the whole named group held by that container.
  const stack = take ? null : cardStacksForZone(state.ownedCards, false).find(item => item.card.name === name
    && activeContainers.some(container => containerAccepts(container.card, item.card))
    && (!pouch || item.card.id !== POUCH_ID));
  // Historical saves may have missing/duplicate UIDs. Select the visible zone
  // by entry and stack size so another zone can never join this transfer.
  const entries = take ? state.ownedCards.filter(entry => entry.card?.name === name && inContainer(entry))
    : state.ownedCards.filter(entry => !entry.safe && !entry.stored && !entry.pouchOf && entry.card?.name === stack?.card.name)
      .slice(0, stack?.count || 0);
  if (!entries.length) return rejected('missing');
  const card = entries[0].card, count = entries.length;
  const result = { card, count, capacity, storedCount:stored.length };
  if (!take && stored.length + count > capacity) return { ...result, ...rejected('container-full') };
  if (take) {
    const cap = ports.stackCapOf(card);
    const sameBag = state.ownedCards.filter(entry => !entry.safe && !entry.stored && entry.card.name === name).length;
    const delta = Math.ceil((sameBag + count) / cap) - Math.ceil(sameBag / cap);
    const limit = !pouch || card.type === '资源' ? ports.bagCap() : ports.baseCap();
    const used = ports.usedSlots();
    Object.assign(result, { delta, limit, used });
    if ((!pouch || delta > 0) && used + delta > limit) return { ...result, delta, limit, used, ...rejected('bag-full') };
  }
  for (const entry of entries) {
    if (take) { delete entry.stored; if (pouch) delete entry.pouchOf; }
    else { entry.stored = 1; if (pouch) entry.pouchOf = POUCH_ID; }
  }
  return { ...result, ok:true };
}
