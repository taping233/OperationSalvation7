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

export function canAcceptCardAtCapacity(card, { usedSlots, baseCap, totalCap }) {
  if (!card) return false;
  return usedSlots < baseCap || (card.type === '资源' && usedSlots < totalCap);
}

export function canReceiveCardFromBag(card, { ownedCards, canAcceptCard }) {
  if (!card) return false;
  const owned = normalCardCount(ownedCards, card);
  if (owned > 0 && owned % stackCapOf(card) !== 0) return true;
  return canAcceptCard(card);
}

// Indices refer to this pendingCards array, not the caller's original reward indices.
// Only successful receipts advance the private projection, in the same order as a batch grant.
export function previewCardRewards(pendingCards, { ownedCards, usedSlots, baseCap, totalCap }) {
  const projectedOwned = ownedCards.slice();
  const acceptedIndices = [], blockedIndices = [];
  const port = { ownedCards:projectedOwned, canAcceptCard:card=>canAcceptCardAtCapacity(card, { usedSlots, baseCap, totalCap }) };
  pendingCards.forEach((card, index) => {
    if (!canReceiveCardFromBag(card, port)) { blockedIndices.push(index); return; }
    if (normalCardCount(projectedOwned, card) % stackCapOf(card) === 0) usedSlots++;
    projectedOwned.push({ card });
    totalCap += resourceContainerSlots(card);
    acceptedIndices.push(index);
  });
  return { canTake:acceptedIndices.length, cant:blockedIndices.length, acceptedIndices, blockedIndices, usedSlots, totalCap };
}

// Moving a whole named stack may merge into an already occupied destination slot.
export function stackTransferSlotDelta(ownedCards, name, toSafe, count, cap) {
  const sameSide = ownedCards.filter(o => !!o.safe === !!toSafe && !o.stored && o.card.name === name).length;
  return Math.ceil((sameSide + count) / cap) - Math.ceil(sameSide / cap);
}
