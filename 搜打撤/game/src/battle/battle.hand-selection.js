// @ts-check
/** Pure hand-selection rules and state contracts shared by battle producers and consumers. */

/** @typedef {import('./battle.snapshot.types.js').BattleCardInput} HandSelectionCard */

/**
 * A hand-selection payment job created while a card is queued for play.
 * @typedef {object} HandSelectionPayment
 * @property {string} uid UID of the card being played.
 * @property {HandSelectionCard} card
 * @property {string[]} fuelUids
 * @property {unknown} target
 * @property {boolean} freeCost
 * @property {(() => void) | null} onResolved
 */

/**
 * @typedef {object} HandSelectionBase
 * @property {number} n Number of remaining cards to select.
 * @property {string | null} type Required card type, or null for any card.
 */

/**
 * Selection created by an effect or equipment action.
 * @typedef {HandSelectionBase & {
 *   act: 'play' | 'copy' | 'zero' | 'consume',
 *   mandatory: boolean,
 *   thenText: string,
 *   target: unknown,
 *   srcCard: HandSelectionCard | null,
 *   onDone: (() => void) | null
 * }} HandSelectionEffect
 */

/**
 * Mandatory selection used to pay a card's hand-card requirement.
 * @typedef {HandSelectionBase & {
 *   act: 'payment',
 *   mandatory: true,
 *   excludedUids: string[],
 *   selectedUids: string[],
 *   payment: HandSelectionPayment
 * }} HandSelectionPaymentState
 */

/** @typedef {HandSelectionEffect | HandSelectionPaymentState | null} HandSelectionState */

/** @typedef {{ name?: string, type?: string } | null | undefined} HandSelectionRuleCard */

/**
 * Preserve the existing hand-selection key rules: no key and "牌" match any card;
 * "杀" and "初始攻击" match those names; every other key matches card.type.
 * @param {HandSelectionRuleCard} card
 * @param {string | null | undefined} key
 * @returns {boolean}
 */
export function matchesHandSelectKey(card, key) {
  if (!key || key === '牌') return true;
  if (!card) return false;
  if (key === '杀' || key === '初始攻击') return /^(杀|初始攻击)$/.test(card.name || '');
  return card.type === key;
}

/**
 * Decide whether a hand entry can be selected as payment. Shared by the picker,
 * payment preflight, and the rendered candidate list so exclusions stay aligned.
 * @param {{ uid: string, handUids: ReadonlySet<string>, card: HandSelectionRuleCard, type: string | null | undefined, excludedUids?: ReadonlySet<string>, selectedUids?: ReadonlySet<string> }} input
 * @returns {boolean}
 */
export function isHandPaymentCandidate({ uid, handUids, card, type, excludedUids = new Set(), selectedUids = new Set() }) {
  return !!card &&
    handUids.has(uid) &&
    !excludedUids.has(uid) &&
    !selectedUids.has(uid) &&
    matchesHandSelectKey(card, type);
}
