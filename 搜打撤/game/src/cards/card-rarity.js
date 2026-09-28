// Shared card rarity rules. Callers choose their lookup strategy while this
// module remains the single source for hero-line and token inheritance rules.
export function isHeroLine(card, findById) {
  if (!card) return false;
  if (card.hero) return true;
  if (card.tokenOf) {
    const source = findById(card.tokenOf);
    if (source && source.hero) return true;
  }
  return false;
}

export function rarityOf(card, findById) {
  if (isHeroLine(card, findById)) return '棱彩';
  if (card.rarity === '衍生' && card.tokenOf) {
    const source = findById(card.tokenOf);
    if (source) return rarityOf(source, findById);
  }
  return card.rarity;
}
