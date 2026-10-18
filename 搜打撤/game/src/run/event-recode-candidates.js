const RECODE_TYPES = new Set(['武术', '法术', '装备']);
const groupKey = card => `${card.type}\0${card.rarity}`;

// This index belongs to one page opening, so mutable card data is read afresh
// whenever the event is reopened. Confirmation still checks its current pool.
export function recodeEligibleCards(ownedCards, cards, myClass, isRandomObtainable) {
  const owned = ownedCards.filter(entry => entry?.card && !entry.safe && !entry.stored && RECODE_TYPES.has(entry.card.type));
  const groups = new Map(owned.map(entry => [groupKey(entry.card), []]));
  if (!groups.size) return [];
  for (const card of cards) {
    if (!card) continue;
    const group = groups.get(groupKey(card));
    if (!group) continue;
    if (isRandomObtainable(card) || card.rarity === '职业' && card.cls === myClass && !card.hero) group.push(card);
  }
  return owned.filter(entry => groups.get(groupKey(entry.card)).some(card => card.id !== entry.card.id && card.name !== entry.card.name));
}
