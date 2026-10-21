/** Pure helpers for the requested card batch. Runtime state and RNG are supplied by callers. */
// 用户已确认：所列正午决斗指现有正午决战。
export const GUN_POOL_IDS = Object.freeze(['tt2-shoot', 'tt3-noon-duel', 'tt3-double-shot', 'cc-rapid-fire', 'tt13-snipe']);
const CHAOS_RARITIES = ['初始', '古朴', '稀有', '史诗', '传说'];
const CHAOS_TYPES = new Set(['武术', '法术', '装备']);

function pickIndex(length, random) {
  return Math.min(length - 1, Math.max(0, Math.floor(random() * length)));
}

/** Return an absent curse, or null when every allowed kind is already present. */
export function chooseMissingCurse(status, curseKeys, random) {
  const missing = [...new Set(curseKeys)].filter(key => !(Number(status?.[key]) > 0));
  return missing.length ? missing[pickIndex(missing.length, random)] : null;
}

/** Nonstandard rarities deliberately have no implicit promotion policy. */
export function nextChaosRarity(rarity) {
  const index = CHAOS_RARITIES.indexOf(rarity);
  return index < 0 ? null : CHAOS_RARITIES[Math.min(index + 1, CHAOS_RARITIES.length - 1)];
}

/** Candidate interpretation: replace eligible cards, then permute replacement costs.
 * Unsupported rarity and empty replacement pools remain unchanged and do not exchange costs.
 * The caller supplies eligibility (class/token/random-pool policy) and the exact deck scope.
 */
export function transformChaosDeck(cards, pool, { random, eligible = /** @type {(candidate: object, card: object) => boolean} */ (() => true) }) {
  const transformed = [];
  const result = cards.map((card, index) => {
    const rarity = nextChaosRarity(card.rarity);
    if (!rarity || !CHAOS_TYPES.has(card.type)) return { ...card };
    const candidates = pool.filter(candidate => candidate.type === card.type && candidate.rarity === rarity && eligible(candidate, card));
    if (!candidates.length) return { ...card };
    transformed.push(index);
    return { ...candidates[pickIndex(candidates.length, random)] };
  });
  const costs = transformed.map(index => result[index].cost);
  for (let index = costs.length - 1; index > 0; index--) {
    const other = pickIndex(index + 1, random);
    [costs[index], costs[other]] = [costs[other], costs[index]];
  }
  transformed.forEach((index, offset) => { result[index].cost = costs[offset]; });
  return result;
}

export function canMindControl(foe) {
  return !!foe && !foe.dead && !foe.boss && !foe.controlBoss && Number(foe.hp) > 0 && Number(foe.hp) < Number(foe.maxHp);
}

/** firstType is a required host choice, anchored at firstTurn (normally battle turn 1). */
export function advanceBiphasicAstrolabe(state, { turn, type, firstType, firstTurn = 1 }) {
  if (!['武术', '法术'].includes(firstType)) throw new Error('Astrolabe firstType must be specified');
  const requiredType = Math.abs(turn - firstTurn) % 2 === 0 ? firstType : (firstType === '武术' ? '法术' : '武术');
  const current = state?.turn === turn ? { ...state } : { turn, triggered: false };
  const refund = !current.triggered && type === requiredType ? 1 : 0;
  if (refund) current.triggered = true;
  return { state: current, refund };
}

/** A propagated hit is never a new root, even when multiple enemies carry the mark. */
export function soulContractTargets(source, foes, { isMarked, chain = false }) {
  if (chain || !source || !isMarked(source)) return [];
  return foes.filter(foe => foe !== source && !foe.dead && Number(foe.hp) > 0);
}

/** Apply after damage modifiers and mitigation, before subtracting HP. */
export function capNonLethalDamage(hp, damage) {
  const health = Number(hp), amount = Number(damage);
  if (!Number.isFinite(health) || !Number.isFinite(amount)) return 0;
  return Math.min(Math.max(0, amount), Math.max(0, health - 1));
}
