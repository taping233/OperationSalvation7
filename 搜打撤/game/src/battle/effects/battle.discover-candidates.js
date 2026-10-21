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
 * 职业卡门（2026-10-21 反馈#2）：指定池（pred）历史上不叠 isRandomObtainable，
 * 因此「招式/武术/2费…」等随机池会漏出职业卡。现在指定池同样按职业卡口径收口：
 * isClassCard(card) 的卡必须再过一次目录门 isRandomObtainable（生产口径下职业卡恒 false），
 * 除非谓词显式声明职业池——显式职业池谓词（parsePoolNoun「本职业/其它职业」、
 * otherCls 发现任务）带 allowClassCards 标记跳过本门。
 * 非职业卡维持历史口径（不叠目录门），能力卡/棱彩特殊池（如「传说或能力卡」）不受影响。
 * @param {readonly DiscoverCandidateCard[]} catalog
 * @param {DiscoverPoolOptions} options
 * @returns {DiscoverCandidateCard[]}
 */
export function buildDiscoverPool(catalog, {
  myClass, pred, rarity, otherCls, isRandomObtainable,
}) {
  if (pred) {
    const allowClassCards =
      /** @type {{ allowClassCards?: boolean }} */ (/** @type {unknown} */ (pred)).allowClassCards === true;
    return catalog.filter(card =>
      card.rarity !== '衍生' && card.type !== '生物' && card.type !== '事件' && card.type !== '资源' &&
      (allowClassCards || !isClassCard(card) || isRandomObtainable(card)) && pred(card));
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
