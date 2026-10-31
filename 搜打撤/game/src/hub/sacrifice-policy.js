// Sacrifice payments use ordinary carried cards; protected and contained cards stay out.
export function canSacrificeCard(owned, filterType) {
  return !!owned?.card && !owned.safe && !owned.stored && !owned.pouchOf
    && (!filterType || owned.card.type === filterType);
}
