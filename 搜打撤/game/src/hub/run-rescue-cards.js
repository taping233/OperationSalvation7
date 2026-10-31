// Failure exits share safe-zone/container protection; callers choose their carried-card policy.
export function collectRescueCards(ownedCards, { pearlBoxId = 'tt2-pearlbox', includeBrought = true } = {}) {
  const boxSafe = ownedCards.some(owned => owned.safe && owned.card?.id === pearlBoxId);
  return ownedCards.filter(owned => owned.card && (includeBrought || !owned.brought)
    && (owned.safe || owned.stored && !owned.pouchOf && boxSafe))
    .map(owned => ({ card:owned.card, count:1 }));
}
