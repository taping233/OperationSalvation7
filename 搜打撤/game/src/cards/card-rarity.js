// @ts-check

/** @typedef {'初始' | '古朴' | '稀有' | '史诗' | '传说' | '衍生' | '职业' | '棱彩' | (string & {})} CardRarity */
/** @typedef {{ readonly id?: string, readonly rarity?: CardRarity, readonly hero?: boolean, readonly tokenOf?: string }} CardRarityInput */
/** @typedef {(id: string) => CardRarityInput | undefined} CardLookup */
/** @typedef {{ readonly rarity?: CardRarity | null, readonly cls?: string | null, readonly type?: string | null }} ClassCardInput */

// Shared card rarity rules. Callers choose their lookup strategy while this
// module remains the single source for hero-line and token inheritance rules.

/**
 * 职业卡判定（2026-10-21 老板反馈#2「随机获得卡牌不能获得职业卡」的统一口径）：
 *   - 「职业」稀有度 = 黑棱形职业卡，一律按职业卡处理；
 *   - 带 cls 归属但稀有度未迁移/自制的卡同样按职业卡处理（反馈原文「带 cls 的卡/职业稀有度」）；
 *   - 能力卡（hero）带 cls 但走棱彩/能力卡自己的池规则，不算职业卡。
 * 职业卡只能经 classPool / randomClassCard 或文本明确声明的职业池发放。
 * @param {ClassCardInput | null | undefined} card
 * @returns {boolean}
 */
export function isClassCard(card) {
  if (!card) return false;
  if (card.rarity === '职业') return true;
  return !!card.cls && card.type !== '能力卡';
}
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
