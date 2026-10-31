import { planBagTokenCraft } from './bag-token-craft-plan.js';
import { containerRuleOf, containerAccepts, previewCardRewards, resourceContainerBonus } from '../core/card-capacity.js';
import { cardStacksForZone } from '../core/bag-render-derivation.js';

const POUCH_ID = 'tt7-stratagem';
const PEARL_ID = 'tt2-pearlbox';
/**
 * @typedef {{ id?:string, name:string, type?:string }} InventoryCard
 * @typedef {{ ok:false, code:'inactive'|'protected'|'missing'|'container-not-empty' }} DiscardFailure
 * @typedef {{ card:InventoryCard, count:number, capacity:number, storedCount:number }} TransferDetails
 * @typedef {{ delta:number, limit:number, used:number }} RetrievalCapacity
 * @typedef {{stored:{present:boolean,value:unknown},pouchOf:{present:boolean,value:unknown}}} ContainerPosition
 * @typedef {{entry:{stored?:unknown,pouchOf?:unknown},before:ContainerPosition,after:ContainerPosition}} ContainerMove
 * @typedef {{ ok:false, code:'inactive'|'container'|'missing' }} TransferUnavailable
 * @typedef {TransferDetails & { ok:false, code:'container-full' }} ContainerFull
 * @typedef {TransferDetails & RetrievalCapacity & { ok:false, code:'bag-full' }} BagFull
 * @typedef {TransferDetails & { ok:true, moves:ContainerMove[] }} TransferSuccess
 * @typedef {TransferUnavailable|ContainerFull|BagFull|TransferSuccess} TransferResult
 */
/** @template {string} Code @param {Code} code @returns {{ ok:false, code:Code }} */
const rejected = code => ({ ok:false, code });
const unavailable = (state, current) => state.battleActive || (current && !current());
const containerPosition = entry => ({ stored:{present:Object.hasOwn(entry,'stored'),value:entry.stored},
  pouchOf:{present:Object.hasOwn(entry,'pouchOf'),value:entry.pouchOf} });

// Commands own inventory writes only. The caller owns confirmations, feedback,
// persistence and rendering, and can supply its captured view/run validity port.
/**
 * @param {{ name:string, fromSafe:boolean, uid?:string|null, current?:()=>boolean }} request
 * @returns {DiscardFailure|{ ok:true, card:InventoryCard, entry:object, index:number }}
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
  return { ok:true, card:entry.card, entry, index };
}

/**
 * @param {{ kind:string, sourceUid?:string, current?:()=>boolean }} request
 * @returns {{ ok:false, code:'inactive' }|{ ok:false, code:'recipe'|'bag-full', reason:string }|{ ok:true, card:InventoryCard, message:string, output:object, sources:{entry:object,index:number}[], fragmentsSpent:number }}
 */
export function craftInventoryToken(state, request, { cards, newUid, baseCap = null }) {
  const { kind, sourceUid, current } = request;
  if (unavailable(state, current)) return rejected('inactive');
  const plan = planBagTokenCraft(state, kind, cards(), sourceUid, baseCap ? baseCap() : null);
  if (!plan.ok) return { ok:false, code:'code' in plan && plan.code === 'bag-full' ? 'bag-full' : 'recipe', reason:plan.reason };
  // Consume exactly the planned entries: historical UIDs may be missing or shared by other cards.
  const sources = plan.sourceIndices.map(index => ({ entry:state.ownedCards[index], index }));
  const sourceEntries = new Set(sources.map(source => source.entry));
  const remaining = state.ownedCards.filter(entry => !sourceEntries.has(entry));
  // UID allocation can fail: allocate before consuming any material.
  const output = { uid:newUid(), card:plan.card };
  state.ownedCards = remaining;
  state.ownedCards.push(output);
  if (plan.fragments) state.fragments -= plan.fragments;
  return { ok:true, card:output.card, message:plan.message, output, sources, fragmentsSpent:plan.fragments || 0 };
}

/**
 * @param {{ kind:string, take:boolean, name:string, stackIndex?:number, stackCount?:number, current?:()=>boolean }} request
 * @returns {TransferResult}
 */
export function transferContainerStack(state, request, ports) {
  const { kind, take, name, stackIndex, stackCount, current } = request;
  if (unavailable(state, current)) return rejected('inactive');
  if (kind !== 'pouch' && kind !== 'pearl') return rejected('container');
  const pouch = kind === 'pouch';
  const containers = state.ownedCards.filter(entry => entry.card?.id === (pouch ? POUCH_ID : PEARL_ID));
  const activeContainers = pouch ? containers.slice(0, 1) : containers;
  const capacity = activeContainers.reduce((sum, entry) => sum + (containerRuleOf(entry.card)?.slots || 0), 0);
  if (!capacity) return rejected('container');
  const inContainer = entry => pouch ? entry.pouchOf === POUCH_ID : entry.stored && !entry.pouchOf;
  const stored = state.ownedCards.filter(inContainer);
  // Deposits select the observed rendered stack; legacy callers without an
  // index retain the first-stack selection. Retrieval releases the named group.
  const bagStacks = take ? [] : cardStacksForZone(state.ownedCards, false);
  const sourceIndex = stackIndex === undefined ? bagStacks.findIndex(item => item.card.name === name) : stackIndex;
  const stack = Number.isInteger(sourceIndex) && sourceIndex >= 0 ? bagStacks[sourceIndex] : null;
  if (!take && (!stack || stack.card.name !== name || (stackCount !== undefined && stack.count !== stackCount)
    || !activeContainers.some(container => containerAccepts(container.card, stack.card))
    || (pouch && stack.card.id === POUCH_ID))) return rejected('missing');
  const offset = bagStacks.slice(0, sourceIndex).reduce((sum, item) => sum + (item.card.name === name ? item.count : 0), 0);
  // Historical saves may have missing/duplicate UIDs. Select the visible zone
  // by entry and stack size so another zone can never join this transfer.
  const entries = take ? state.ownedCards.filter(entry => entry.card?.name === name && inContainer(entry))
    : state.ownedCards.filter(entry => !entry.safe && !entry.stored && !entry.pouchOf && entry.card?.name === stack?.card.name)
      .slice(offset, offset + (stack?.count || 0));
  if (!entries.length || (!take && entries.length !== stack.count)) return rejected('missing');
  const card = entries[0].card, count = entries.length;
  const result = { card, count, capacity, storedCount:stored.length };
  if (!take && stored.length + count > capacity) return { ...result, ...rejected('container-full') };
  if (take) {
    const cap = ports.stackCapOf(card);
    const sameBag = state.ownedCards.filter(entry => !entry.safe && !entry.stored && entry.card.name === name).length;
    const delta = Math.ceil((sameBag + count) / cap) - Math.ceil(sameBag / cap);
    const limit = !pouch || card.type === '资源' ? ports.bagCap() : ports.baseCap();
    const used = ports.usedSlots();
    const retrieval = Object.assign(result, { delta, limit, used });
    // The cards already contribute any container bonus while stored; the
    // receipt projection adds it back once as each card returns to the bag.
    const projected = previewCardRewards(entries.map(entry => entry.card), { ownedCards:state.ownedCards,
      usedSlots:used, baseCap:ports.baseCap(), totalCap:ports.bagCap() - resourceContainerBonus(entries) });
    if (projected.cant) return { ...retrieval, ...rejected('bag-full') };
  }
  const moves = entries.map(entry => ({entry,before:containerPosition(entry)}));
  for (const entry of entries) {
    if (take) { delete entry.stored; if (pouch) delete entry.pouchOf; }
    else { entry.stored = 1; if (pouch) entry.pouchOf = POUCH_ID; }
  }
  return { ...result, ok:true, moves:moves.map(move => ({...move,after:containerPosition(move.entry)})) };
}
