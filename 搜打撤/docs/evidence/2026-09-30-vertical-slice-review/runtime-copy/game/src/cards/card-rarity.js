// @ts-check

/** @typedef {'初始' | '古朴' | '稀有' | '史诗' | '传说' | '衍生' | '职业' | '棱彩' | (string & {})} CardRarity */
/** @typedef {{ readonly id?: string, readonly rarity?: CardRarity, readonly hero?: boolean, readonly tokenOf?: string }} CardRarityInput */
/** @typedef {(id: string) => CardRarityInput | undefined} CardLookup */

// Shared card rarity rules. Callers choose their lookup strategy while this
// module remains the single source for hero-line and token inheritance rules.
/** @param {CardRarityInput | null | undefined} card @param {CardLookup} findById @returns {boolean} */
export function isHeroLine(card, findById) {
  if (!card) return false;
  if (card.hero) return true;
  if (card.tokenOf) {
    const source = findById(card.tokenOf);
    if (source && source.hero) return true;
  }
  return false;
}

/** @param {CardRarityInput} card @param {CardLookup} findById @returns {CardRarity | undefined} */
export function rarityOf(card, findById) {
  if (isHeroLine(card, findById)) return '棱彩';
  if (card.rarity === '衍生' && card.tokenOf) {
    const source = findById(card.tokenOf);
    if (source) return rarityOf(source, findById);
  }
  return card.rarity;
}
