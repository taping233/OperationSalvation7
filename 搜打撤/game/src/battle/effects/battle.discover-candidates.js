// @ts-check
/** Pure candidate filtering and random selection rules for battle discoveries. */
import { isClassCard } from '../../cards/card-rarity.js';

/** @typedef {import('../battle.snapshot.types.js').BattleCardInput & { name: string, rarity?: string, cls?: string, type?: string }} DiscoverCandidateCard */
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
 *
 * 普通随机和指定发现池直接排除职业卡，不由目录回调重新放行。
 * 只有明确职业池（谓词 allowClassCards、otherCls 或职业稀有度）可放行。
 * 非职业卡按调用方的明确池谓词筛选，不额外叠加目录门。
 * @param {readonly DiscoverCandidateCard[]} catalog
 * @param {DiscoverPoolOptions} options
 * @returns {DiscoverCandidateCard[]}
 */
export function buildDiscoverPool(catalog, {
  myClass, pred, rarity, otherCls, isRandomObtainable,
}) {
  if (pred) {
    return catalog.filter(card =>
      card.rarity !== '衍生' && card.type !== '生物' && card.type !== '事件' && card.type !== '资源' &&
      isDiscoverClassAllowed(card, { pred, rarity, otherCls }) && pred(card));
  }
  return catalog.filter(card => isDiscoverClassAllowed(card, { rarity, otherCls }) && (
    card.rarity !== '衍生' && card.type !== '资源' && card.type !== '道具' && isRandomObtainable(card) &&
    (!rarity || card.rarity === rarity) &&
    (!otherCls || (card.cls && card.cls !== myClass)) ||
    (otherCls && card.rarity === '职业' && card.cls && card.cls !== myClass)));
}

/**
 * The same profession gate applies to generated and retained preview candidates.
 * @param {DiscoverCandidateCard} card
 * @param {{ pred?: DiscoverCardPredicate | null, rarity?: string | null, otherCls?: boolean | null }} [options]
 * @returns {boolean}
 */
export function isDiscoverClassAllowed(card, { pred, rarity, otherCls } = {}) {
  return !isClassCard(card) || !!otherCls || rarity === '职业'
    || /** @type {{ allowClassCards?: boolean } | null | undefined} */ (/** @type {unknown} */ (pred))?.allowClassCards === true;
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
