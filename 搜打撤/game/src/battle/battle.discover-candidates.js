// @ts-check
/** Pure candidate filtering and random selection rules for battle discoveries. */

/** @typedef {import('./battle.snapshot.types.js').BattleCardInput & { rarity?: string, cls?: string }} DiscoverCandidateCard */
/** @typedef {(card: DiscoverCandidateCard) => boolean} DiscoverCardPredicate */
/**
 * @typedef {object} DiscoverPoolOptions
 * @property {string | null | undefined} myClass
 * @property {DiscoverCardPredicate | null | undefined} [pred]
 * @property {string | null | undefined} [rarity]
 * @property {boolean | null | undefined} [otherCls]
 * @property {DiscoverCardPredicate} isRandomObtainable
 */

/**
 * Build a discovery pool while preserving catalog order and card object identity.
 * Specified predicates use the historical restricted-pool rules. General pools
 * retain the historical `otherCls` fallback's operator precedence.
 * @param {readonly DiscoverCandidateCard[]} catalog
 * @param {DiscoverPoolOptions} options
 * @returns {DiscoverCandidateCard[]}
 */
export function buildDiscoverPool(catalog, {
  myClass, pred, rarity, otherCls, isRandomObtainable,
}) {
  if (pred) {
    return catalog.filter(card =>
      card.rarity !== '衍生' && card.type !== '生物' && card.type !== '事件' && card.type !== '资源' && pred(card));
  }
  return catalog.filter(card =>
    card.rarity !== '衍生' && card.type !== '资源' && card.type !== '道具' && isRandomObtainable(card) &&
    (!rarity || card.rarity === rarity) &&
    (!otherCls || (card.cls && card.cls !== myClass)) ||
    (otherCls && card.rarity === '职业' && card.cls && card.cls !== myClass));
}

/**
 * Choose one candidate using the caller's battle random stream. Empty pools do
 * not consume randomness; non-empty pools perform exactly one draw without
 * removing or copying the chosen card.
 * @param {readonly DiscoverCandidateCard[]} pool
 * @param {() => number} random01
 * @returns {DiscoverCandidateCard | null | undefined}
 */
export function pickRandomDiscoverCandidate(pool, random01) {
  if (!pool.length) return null;
  return pool[Math.floor(random01() * pool.length)];
}
