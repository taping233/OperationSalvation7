// Shared live/preview card receipt rules. No game state, browser, grant or RNG access.
export const PEARL_BOX_ID = 'tt2-pearlbox';
export const PEARL_BOX_SLOTS = 9;
export const stackCapOf = card => card?.type === '装备' ? 1 : 3;

export function containerRuleOf(card) {
  const declared = card?.rules?.equip?.container;
  if (declared && Number.isInteger(declared.slots) && declared.slots > 0) return declared;
  if (card?.rules?.equip) return null;
  // Historical/custom cards without an explicit container domain keep the
  // existing identity adapter. Native cards declare their capacity directly.
  if (card?.id === PEARL_BOX_ID) return { slots:PEARL_BOX_SLOTS, accepts:'资源' };
  if (card?.id === 'tt7-stratagem') return { slots:3, accepts:'法术' };
  return null;
}
export const containerAccepts = (container, card) => {
  const rule = containerRuleOf(container);
  return !!rule && (!rule.accepts || card?.type === rule.accepts);
};
export const resourceContainerSlots = card => {
  const rule = containerRuleOf(card);
  return rule?.accepts === '资源' ? rule.slots : 0;
};
export const resourceContainerBonus = ownedCards => ownedCards.reduce((total, entry) => total + resourceContainerSlots(entry.card), 0);

const normalCardCount = (ownedCards, card) => ownedCards.filter(o => !o.safe && !o.stored && o.card.name === card.name).length;

// Non-card inventory has no resource-card type and therefore uses ordinary slots.
export function bagSlotUsage(ownedCards, usedSlots) {
  const groups = new Map();
  ownedCards.forEach(entry => {
    if (entry.safe || entry.stored) return;
    const name = entry.card.name;
    if (!groups.has(name)) groups.set(name, { card:entry.card, count:0 });
    groups.get(name).count++;
  });
  let resourceSlots = 0;
  groups.forEach(({ card, count }) => {
    if (card.type === '资源') resourceSlots += Math.ceil(count / stackCapOf(card));
  });
  return { usedSlots, ordinarySlots:usedSlots - resourceSlots, resourceSlots };
}

export function bagCapacityState({ usedSlots, ordinarySlots = usedSlots, baseCap, totalCap }) {
  return { usedSlots, ordinarySlots, resourceSlots:usedSlots - ordinarySlots, baseCap, totalCap,
    resourceBonus:Math.max(0, totalCap - baseCap),
    capacityOk:ordinarySlots <= baseCap && usedSlots <= totalCap,
    ordinaryFree:Math.max(0, Math.min(baseCap - ordinarySlots, totalCap - usedSlots)),
    resourceFree:ordinarySlots > baseCap ? 0 : Math.max(0, totalCap - usedSlots) };
}

export function canAcceptCardAtCapacity(card, { usedSlots, ordinarySlots, baseCap, totalCap }) {
  if (!card) return false;
  // Old callers supply only total usage; resource receipts keep that adapter.
  const ordinary = ordinarySlots ?? (card.type === '资源' ? Math.min(usedSlots, baseCap) : usedSlots);
  return bagCapacityState({ usedSlots:usedSlots + 1, ordinarySlots:ordinary + Number(card.type !== '资源'),
    baseCap, totalCap:totalCap + resourceContainerSlots(card) }).capacityOk;
}

export function canReceiveCardFromBag(card, { ownedCards, canAcceptCard }) {
  if (!card) return false;
  const owned = normalCardCount(ownedCards, card);
  if (owned > 0 && owned % stackCapOf(card) !== 0) return true;
  return canAcceptCard(card);
}

// Indices refer to this pendingCards array, not the caller's original reward indices.
// Only successful receipts advance the private projection, in the same order as a batch grant.
export function previewCardRewards(pendingCards, { ownedCards, usedSlots,
  ordinarySlots = bagSlotUsage(ownedCards, usedSlots).ordinarySlots, baseCap, totalCap }) {
  const projectedOwned = ownedCards.slice();
  const acceptedIndices = [], blockedIndices = [];
  const port = { ownedCards:projectedOwned, canAcceptCard:card=>canAcceptCardAtCapacity(card, { usedSlots, ordinarySlots, baseCap, totalCap }) };
  pendingCards.forEach((card, index) => {
    if (!canReceiveCardFromBag(card, port)) { blockedIndices.push(index); return; }
    if (normalCardCount(projectedOwned, card) % stackCapOf(card) === 0) {
      usedSlots++;
      ordinarySlots += Number(card.type !== '资源');
    }
    projectedOwned.push({ card });
    totalCap += resourceContainerSlots(card);
    acceptedIndices.push(index);
  });
  return { canTake:acceptedIndices.length, cant:blockedIndices.length, acceptedIndices, blockedIndices,
    usedSlots, ordinarySlots, resourceSlots:usedSlots - ordinarySlots, totalCap };
}

// Moving a whole named stack may merge into an already occupied destination slot.
export function stackTransferSlotDelta(ownedCards, name, toSafe, count, cap) {
  const sameSide = ownedCards.filter(o => !!o.safe === !!toSafe && !o.stored && o.card.name === name).length;
  return Math.ceil((sameSide + count) / cap) - Math.ceil(sameSide / cap);
}
