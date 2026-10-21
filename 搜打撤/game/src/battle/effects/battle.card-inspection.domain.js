import { esc, clone as cloneData } from '../../core/shared.js';
import { calculateEffectiveCardCost, pocketSpellDiscountFor } from './battle.card-cost.js';
import { createInfusionDomain } from './battle.infusion.domain.js';

/** Instance-owned state and host services are captured explicitly. */
export function createInspectionDomain(context) {

const { hasInfusionWaiver } = createInfusionDomain(context);
/* battle.card-inspection.js —— 战斗中的卡实例查找与当前卡面信息。
 * 通过 readState 接收引擎运行态快照，不直接导入或持有 battle.runtime 状态。 */

const CURSE_SCAN = [
  { key: 'bleed',   re: /(?:附加|施加)\s*(?:(\d+)\s*层?)?\s*流血/, def: 1 },
  { key: 'poison',  re: /(?:附加|施加)\s*(?:(\d+)\s*层)?\s*中毒/, def: 1 },
  { key: 'freeze',  re: /附加冰冻|冰冻所有|冰冻\s*(?:\d+|[一两二三四五])?\s*名|冻结/, def: 1 },
  { key: 'silence', re: /沉默/, def: 1 },
  { key: 'abreak',  re: /破甲/, def: 2 },
  { key: 'healban', re: /禁疗/, def: 2 },
];

/** @param {{cards: import('../core/battle.core-ports.types.js').InspectionCards, readState: () => import('../core/battle.core-ports.types.js').InspectionState, curseMeta: Record<string, {stack?: boolean}>}} deps */
function createBattleCardInspection({ cards, readState, curseMeta }) {
  function repairLegacyTT7Card(card) {
    if (!card || !['tt7-thundergrudge', 'tt7-meteorrain'].includes(card.id)) return card;
    // Active battle snapshots may retain old card clones. The canonical card catalog
    // remains the sole source for their gameplay fields and structured rule contract.
    const definition = cards.TABLETOP10?.find(entry => entry.id === card.id);
    if (!definition?.rules) return card;
    card.dmg = definition.dmg;
    card.dmgType = definition.dmgType;
    if (JSON.stringify(card.rules) !== JSON.stringify(definition.rules))
      card.rules = cloneData(definition.rules);
    return card;
  }

  const findCardInState = (state, uid) => {
    const override = state.cardOverrides.get(uid);
    if (override) return { uid, card: repairLegacyTT7Card(override) };
    const entry = state.game.ownedCards.find(o => o.uid === uid) || state.granted.find(o => o.uid === uid) || null;
    if (entry) repairLegacyTT7Card(entry.card);
    return entry;
  };
  const findCard = uid => findCardInState(readState(), uid);

  // Keep UID/ownership and raw overrides intact: this is a battle-only query view.
  // Match the existing play-time order: per-UID override first, then the latest
  // starter transform rule. A non-starter override is never transformed again.
  // Provenance belongs to this query factory, never to saved card data. It lets
  // a captured effective face re-read its live UID at the final payment boundary,
  // without replacing an explicitly prepared custom execution candidate.
  const effectiveSources = new WeakMap();
  const findEffectiveCard = (uid, executionCard = null, normalize = null) => {
    const state = readState();
    const supplied = executionCard && typeof executionCard === 'object' ? executionCard : null;
    const provenance = supplied && effectiveSources.get(supplied);
    const knownSource = provenance?.uid === uid ? provenance : null;
    const current = findCardInState(state, uid);
    const liveUid = knownSource ? knownSource.liveUid : !supplied || supplied === current?.card;
    const found = liveUid ? current : { uid, card: knownSource?.card || supplied };
    if (!found?.card) return null;
    // Without an override, current already is the raw owned/granted entry.
    // Reuse it within this query only; the next query still reads live arrays.
    const base = state.cardOverrides.get(uid)
      ? state.game.ownedCards.find(entry => entry.uid === uid)
        || state.granted.find(entry => entry.uid === uid)
      : current;
    const entry = base && base !== found ? { ...base, ...found, uid } : found;
    const transform = state.shaTransform;
    let card = entry.card;
    if (transform && ['初始攻击', '杀'].includes(card.name)) {
      const template = cards.all?.().find(value => value.name === transform);
      card = template ? { ...template } : { ...card, _battleTransformMissing: transform };
    }
    // Array.map passes its source array as the third argument; only a function
    // is an execution normalizer. Track any clone it creates by the same source.
    if (typeof normalize === 'function') card = normalize(card);
    if (card === entry.card) {
      if (liveUid) effectiveSources.set(card, { uid, card: entry.card, liveUid: true });
      return entry;
    }
    effectiveSources.set(card, { uid, card: entry.card, liveUid });
    return { ...entry, card };
  };

  const infusionFuelReason = uid => {
    const state = readState();
    if (!state.hand.includes(uid)) return '这张牌已离开手牌';
    const entry = findEffectiveCard(uid);
    if (!entry) return '找不到这张手牌';
    if (entry.card._battleTransformMissing) return `转换目标「${entry.card._battleTransformMissing}」缺失，暂时无法使用`;
    if (entry.card.rules?.battle?.fuelAllowed === false) return '本牌无法用于注能';
    if (entry.card.rules?.triggers || entry.card.rules?.equip || entry.card.rules?.bag) return '';
    return /无法用于注能/.test(String(entry.card.desc || '')) ? '本牌无法用于注能' : '';
  };

  const drawOf = card => +(card.draw || 0) || cards.deriveDraw(card) || 0;
  const infuseOf = card => hasInfusionWaiver(card, readState().allSpellsInfused)
    ? 0 : (+(card.infuse || 0) || cards.deriveInfuse(card) || 0);

  const effCostOf = (card, uid) => {
    const state = readState();
    const pocketDiscount = pocketSpellDiscountFor(card);
    // Resolve only if the cost rules reach the consumed-spell discount. Higher
    // priority fixed/free costs never inspect the pocket or allocate a filter.
    const countConsumedSpells = () => {
      let count = 0;
      if (pocketDiscount) {
        const pile = state.getConsumedPile?.() || state.consumed;
        const seen = new Set();
        for (let i = 0; i < pile.length; i++) {
          if (!(i in pile)) continue; // Match Array.filter's sparse-array behavior.
          const uid = pile[i];
          if (seen.has(uid)) continue;
          seen.add(uid);
          const entry = findCardInState(state, uid);
          if (entry && entry.card.type === '法术') count++;
        }
      }
      return count;
    };
    return calculateEffectiveCardCost(card, uid, {
      unlimitedRune: state.unlimitedRune,
      temporaryCostModifier: uid ? state.zeroFeeUntil.get(uid) : undefined,
      turn: state.turn,
      cosmosForm: state.pstat && state.pstat.status && state.pstat.status.cosmosForm,
      spellCost1: state.spellCost1,
      meleeCost1: state.meleeCost1,
      lastPlayedType: state.lastPlayedType,
      playedMartialThisTurn: state.playedMartialThisTurn,
      playedMovesThisTurn: state.playedMovesThisTurn,
      armor: state.pdef ? (state.pdef.armor || 0) : null,
      pocketDiscount,
    }, countConsumedSpells);
  };

  function curseSpecsOfDesc(desc) {
    desc = String(desc || '');
    const out = [];
    CURSE_SCAN.forEach(({ key, re, def }) => {
      const match = desc.match(re);
      if (match) out.push({ key, n: Math.max(1, +(match[1] || def) || def) });
    });
    return out;
  }

  function handCurseSpecs() {
    const state = readState();
    const merged = new Map();
    state.hand.forEach(uid => {
      const entry = findCard(uid);
      const card = entry && entry.card;
      if (!card || !['武术', '法术'].includes(card.type)) return;
      curseSpecsOfDesc(card.desc).forEach(spec => {
        const stacks = curseMeta[spec.key] && curseMeta[spec.key].stack;
        merged.set(spec.key, stacks
          ? (merged.get(spec.key) || 0) + spec.n
          : Math.max(merged.get(spec.key) || 0, spec.n));
      });
    });
    return [...merged.entries()].map(([key, n]) => ({ key, n }));
  }

  function queueSwapCostDiscover() {
    const state = readState();
    const pool = cards.all().filter(card => ['武术', '法术'].includes(card.type) && cards.isRandomObtainable(card));
    if (pool.length < 2) {
      state.game.log('[[icon:cross]] <b>迷之匣</b>：卡牌库中没有足够的随机招式可供发现', 'warn');
      return;
    }
    const pair = [];
    const pred = card => ['武术', '法术'].includes(card.type);
    state.discoverQueue.push({ n: 1, pred, act: 'swapCost', swapPair: pair });
    state.discoverQueue.push({ n: 1, pred, act: 'swapCost', swapPair: pair });
    state.game.log('[[icon:question]] <b>迷之匣</b>：发现两张随机招式——它们打出前会交换费用', 'sys');
  }

  function swapCardCosts(uidA, uidB) {
    const state = readState();
    const a = findCard(uidA), b = findCard(uidB);
    if (!a || !b) return;
    const costA = Math.max(0, +(b.card.cost || 0));
    const costB = Math.max(0, +(a.card.cost || 0));
    state.cardOverrides.set(uidA, { ...a.card, cost: costA });
    state.cardOverrides.set(uidB, { ...b.card, cost: costB });
    state.game.log(`[[icon:sparkles]] <b>交换费用</b>：【${esc(a.card.name)}】费用变为 <b>${costA}</b>，【${esc(b.card.name)}】费用变为 <b>${costB}</b>`, 'sys');
  }

  return { findCard, findEffectiveCard, infusionFuelReason, drawOf, infuseOf, effCostOf, handCurseSpecs, queueSwapCostDiscover, swapCardCosts };
}
return { createBattleCardInspection };
}
