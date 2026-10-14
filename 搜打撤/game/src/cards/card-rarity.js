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
  const visitedSources = new Set();
  let current = card;
  while (true) {
    if (isHeroLine(current, findById)) return '棱彩';
    if (current.rarity !== '衍生' || !current.tokenOf) return current.rarity;
    // Old custom catalogs may contain cyclic sources. Keep the same derived
    // fallback as a missing source, without changing the catalog or valid chains.
    if (visitedSources.has(current.tokenOf)) return current.rarity;
    visitedSources.add(current.tokenOf);
    const source = findById(current.tokenOf);
    if (!source) return current.rarity;
    current = source;
  }
}
