const RECODE_TYPES = new Set(['武术', '法术', '装备']);
/** @param {import('./run-domain-commands.types').RunCard} card */
const groupKey = card => `${card.type}\0${card.rarity}`;

/** @param {import('./run-domain-commands.types').RunOwnedCard} entry */
export function recodeSourceSnapshot(entry) {
  return { uid:entry.uid, id:entry.card.id, name:entry.card.name, type:entry.card.type, rarity:entry.card.rarity };
}

/** @param {import('./run-domain-commands.types').RunOwnedCard} entry
 * @param {import('./run-domain-commands.types').RecodeSource | undefined} expected */
export function recodeSourceMatches(entry, expected) {
  return !!entry?.card && !entry.safe && !entry.stored && RECODE_TYPES.has(entry.card.type || '')
    && (!expected || expected.uid === entry.uid && /** @type {const} */ (['id','name','type','rarity']).every(key => expected[key] === entry.card[key]));
}

// This index belongs to one page opening, so mutable card data is read afresh
// whenever the event is reopened. Confirmation still checks its current pool.
/** @param {import('./run-domain-commands.types').RunOwnedCard[]} ownedCards
 * @param {import('./run-domain-commands.types').RunCard[]} cards
 * @param {string | null | undefined} myClass
 * @param {(card:import('./run-domain-commands.types').RunCard) => boolean} isRandomObtainable */
export function recodeEligibleCards(ownedCards, cards, myClass, isRandomObtainable) {
  const owned = ownedCards.filter(entry => entry?.card && !entry.safe && !entry.stored && RECODE_TYPES.has(entry.card.type || ''));
  /** @type {Map<string, import('./run-domain-commands.types').RunCard[]>} */
  const groups = new Map(owned.map(entry => [groupKey(entry.card), []]));
  if (!groups.size) return [];
  for (const card of cards) {
    if (!card) continue;
    const group = groups.get(groupKey(card));
    if (!group) continue;
    if (isRandomObtainable(card) || card.rarity === '职业' && card.cls === myClass && !card.hero) group.push(card);
  }
  return owned.filter(entry => groups.get(groupKey(entry.card))?.some(card => card.id !== entry.card.id && card.name !== entry.card.name));
}
