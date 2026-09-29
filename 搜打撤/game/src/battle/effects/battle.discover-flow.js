// @ts-check
import { esc } from '../../core/shared.js';
import { buildDiscoverPool, pickRandomDiscoverCandidate } from './battle.discover-candidates.js';
import {
  buildExplicitDiscoverState,
  buildRandomDiscoverState,
} from './battle.discover-state.js';

/** @typedef {import('./battle.discover-state.js').DiscoverCard} DiscoverCard */
/** @typedef {import('./battle.discover-state.js').DiscoverCardPredicate} DiscoverCardPredicate */
/** @typedef {import('./battle.discover-state.js').DiscoverQueueJob} DiscoverQueueJob */
/** @typedef {import('./battle.discover-state.js').DiscoveringState} DiscoveringState */
/** @typedef {import('./battle.discover-state.js').StructuredDiscoverPool} StructuredDiscoverPool */

/** @typedef {{ card: DiscoverCard }} DiscoverCardEntry */
/**
 * @typedef {{
 *   special: 'ruleCostDecay', uid: string, sourceCardId?: string | null, amount: number
 * } | { special: 'costDecay', uid: string } | { special: 'consumeTemps', uids: string[], cardName: string }} DiscoverDelayedEffect
 */

/**
 * @typedef {object} DiscoverFlowPorts
 * @property {{
 *   all: () => DiscoverCard[],
 *   isRandomObtainable: DiscoverCardPredicate,
 *   sellPrice: (card: DiscoverCard) => number,
 *   findByUid: (uid: string) => DiscoverCardEntry | null,
 *   addTempCard: (card: DiscoverCard) => string,
 *   queueCardExecution: (uid: string, card: DiscoverCard, fuelUids: string[], target: unknown, freeCost: boolean) => unknown,
 *   fireCatGift: (card: DiscoverCard) => void
 * }} cards
 * @property {{ getJobs: () => DiscoverQueueJob[], get: () => DiscoveringState, set: (state: DiscoveringState) => void, requestRender: () => void }} interaction
 * @property {{ next: () => number }} random
 * @property {{ currentClass: () => string | null | undefined, battleActive?: () => boolean, firstAliveTarget: () => unknown, hasAliveFoes: () => boolean, sweepDead: () => void, finishVictory: () => void }} battle
 * @property {{ returnToDeckBottom: (uids: string[]) => void, addArmor: (amount: number) => number, setCardOverride: (uid: string, card: DiscoverCard) => void, enqueueDelayed: (effect: DiscoverDelayedEffect) => void, swapCardCosts: (firstUid: string, secondUid: string) => void, removeOwnedCard?: (uid: string) => void }} effects
 * @property {{ log: (message: string, kind?: string) => void }} output
 */

/**
 * Owns queued discovery generation and selection effects through narrow runtime ports.
 * @param {DiscoverFlowPorts} ports
 */
export function createBattleDiscoverFlow(ports) {
  const { cards, interaction, random, battle, effects, output } = ports;

  /**
   * Public compatibility path for one-off discovery calls: catalog is reread on
   * every call so custom predicates can observe dynamic catalog/class state.
   * @param {DiscoverCardPredicate | null | undefined} pred
   * @param {string | null | undefined} rarity
   * @param {boolean | string | null | undefined} otherCls
   * @returns {DiscoverCard | null | undefined}
   */
  function randomDiscoverCard(pred, rarity, otherCls) {
    const pool = buildDiscoverPool(cards.all(), {
      myClass: battle.currentClass(),
      pred,
      rarity,
      otherCls: !!otherCls,
      isRandomObtainable: cards.isRandomObtainable,
    });
    return pickRandomDiscoverCandidate(pool, random.next);
  }

  function processDiscoverQueue() {
    const jobs = interaction.getJobs();
    if (interaction.get() || !jobs.length) return;
    const job = jobs.shift();
    if (!job) return;

    /** @type {DiscoverCardPredicate | null} */
    const legacyPred = job.rarity ? (card => card.rarity === job.rarity)
      : job.otherCls ? (card => card.rarity === '职业' && !!card.cls && card.cls !== battle.currentClass())
      : null;
    const structuredPool = job.pool;
    /** @type {DiscoverCardPredicate | null} */
    const structuredPred = structuredPool?.kind === 'moves'
      ? card => card.type === '武术' && (structuredPool.cost === undefined || (Number(card.cost) || 0) === structuredPool.cost)
      : null;
    if (structuredPool && !structuredPred) {
      output.log(`[[icon:cross]] 无法发现：不支持的结构化卡池「${esc(structuredPool.kind || '未知')}」`, 'warn');
      return;
    }
    const pred = job.pred || structuredPred || legacyPred;

    // Explicit candidates are authoritative and keep their original card references.
    if (job.explicit && job.explicit.length) {
      const explicitJob = { ...job, explicit: job.explicit };
      interaction.set(buildExplicitDiscoverState(explicitJob));
      interaction.requestRender();
      return;
    }

    // Internal predicates are stable during this synchronous panel build; custom
    // predicates retain the old per-draw catalog read and invocation sequence.
    const batchPool = job.pred ? null : buildDiscoverPool(cards.all(), {
      myClass: battle.currentClass(),
      pred,
      rarity: job.rarity,
      otherCls: !job.pred && !job.rarity ? !!job.otherCls : null,
      isRandomObtainable: cards.isRandomObtainable,
    });
    const drawCandidate = () => batchPool
      ? pickRandomDiscoverCandidate(batchPool, random.next)
      : randomDiscoverCard(pred, job.rarity, !job.pred && !job.rarity ? job.otherCls : null);

    const options = [];
    const taken = new Set();
    const names = new Set();
    /** @param {DiscoverCard | null | undefined} card */
    const clash = card => !!card && (taken.has(card.id) || names.has(card.name));
    for (let i = 0; i < 3 && options.length < 3; i++) {
      let card = drawCandidate();
      let guard = 0;
      while (clash(card) && guard++ < 40) card = drawCandidate();
      if (card && !clash(card)) {
        taken.add(card.id);
        names.add(card.name);
        options.push(card);
      }
    }
    if (!options.length) {
      output.log('（没有符合条件的卡牌可发现）', 'dim');
      return;
    }
    interaction.set(buildRandomDiscoverState(job, options));
    interaction.requestRender();
  }

  /** @param {number | string} index */
  function pickDiscover(index) {
    // D-4（2026-09-29 U7）：终局入口守卫——STS2 CardSelectCmd 的 IsEnding 同位。战斗已收尾
    // （finish 后 stale 回调 / agent 自动选牌竞态）时静默拒绝，不再向拆空的战场加临时牌并入队
    // 出牌；口径同 battle.engine.js 请求时守卫（!G?.battleActive）。可选端口未接线时行为不变。
    if (battle.battleActive && !battle.battleActive()) return;
    const state = interaction.get();
    if (!state) return;
    const card = state.options[+index];
    if (!card) return;

    const queuedState = 'tempUids' in state;
    const n = state.n;
    const rarity = queuedState ? state.rarity : undefined;
    const pred = queuedState ? state.pred : undefined;
    const act = state.act;
    const options = state.options;
    const priceArmor = queuedState && state.priceArmor;
    const pouchUid = state.pouchUid;
    const consumeTempAtTurn = queuedState && state.consumeTempAtTurn;
    const tempUids = queuedState ? state.tempUids : [];
    const swapPair = queuedState ? state.swapPair : null;
    const deckBottom = 'deckBottom' in state ? state.deckBottom : false;
    const deckBottomUids = 'deckBottomUids' in state ? state.deckBottomUids || [] : [];
    const zeroCost = queuedState && state.zeroCost;
    const decayEachTurn = queuedState && state.decayEachTurn;
    const costDecayPerTurn = queuedState ? state.costDecayPerTurn : undefined;
    const sourceCardId = queuedState ? state.sourceCardId : null;
    const pool = queuedState ? state.pool : null;

    interaction.set(null);
    if (deckBottom && deckBottomUids.length) {
      const pickedUid = deckBottomUids[+index] != null ? deckBottomUids[+index] : null;
      const rest = deckBottomUids.filter(uid => uid !== pickedUid);
      if (rest.length) effects.returnToDeckBottom(rest);
    }

    const acquireTriggers = card.rules?.triggers?.onAcquire;
    const hasStructuredAcquire = Array.isArray(acquireTriggers) && acquireTriggers.length > 0;
    if (act !== 'pouch' && !hasStructuredAcquire) cards.fireCatGift(card);

    if (act === 'play' || act === 'potion') {
      const uid = cards.addTempCard(card);
      output.log(`[[icon:question]] 发现：【<b>${esc(card.name)}</b>】并直接施放（免费用 · 战斗内临时卡，战后消散）`, 'loot');
      const entry = cards.findByUid(uid);
      if (!entry) throw new Error(`Missing discovered card after add: ${uid}`);
      cards.queueCardExecution(uid, entry.card, [], battle.firstAliveTarget(), true);
    } else if (act === 'playKeep') {
      const uid = cards.addTempCard(card);
      output.log(`[[icon:question]] 发现：【<b>${esc(card.name)}</b>】并直接施放（战斗内临时卡，战后消散）`, 'loot');
      const entry = cards.findByUid(uid);
      if (!entry) throw new Error(`Missing discovered card after add: ${uid}`);
      cards.queueCardExecution(uid, entry.card, [], battle.firstAliveTarget(), true);
      options.filter(option => option.id !== card.id).forEach(option => {
        cards.addTempCard(option);
        output.log(`[[icon:cards]] 其余的【<b>${esc(option.name)}</b>】置入手牌`, 'loot');
      });
    } else if (act === 'pouch') {
      const pouchEntry = pouchUid ? cards.findByUid(pouchUid) : null;
      const pouch = pouchEntry?.card._pouch;
      if (Array.isArray(pouch)) {
        const pouchIndex = pouch.findIndex(pouchCard => pouchCard.id === card.id);
        if (pouchIndex >= 0) pouch.splice(pouchIndex, 1);
      }
      if (card.pouchUid && effects.removeOwnedCard) effects.removeOwnedCard(String(card.pouchUid));   // 09-29 双向同步：施放即消耗背包母本
      const uid = cards.addTempCard(card);
      output.log(`[[icon:question]] <b>法师锦囊</b>：施放其中的【<b>${esc(card.name)}</b>】（锦囊余 ${pouchEntry && Array.isArray(pouchEntry.card._pouch) ? pouchEntry.card._pouch.length : 0} 张）`, 'loot');
      const entry = cards.findByUid(uid);
      if (!entry) throw new Error(`Missing discovered card after add: ${uid}`);
      cards.queueCardExecution(uid, entry.card, [], battle.firstAliveTarget(), true);
    } else if (act === 'dup') {
      cards.addTempCard(card);
      cards.addTempCard(card);
      output.log(`[[icon:question]] 发现：【<b>${esc(card.name)}</b>】并额外获得 1 张复制（×2 置入手牌 · 战斗内临时卡，战后消散）`, 'loot');
    } else {
      const uid = cards.addTempCard(card);
      output.log(`[[icon:question]] 发现：【<b>${esc(card.name)}</b>】置入手牌（战斗内临时卡，战后消散）`, 'loot');
      if (priceArmor) {
        const price = cards.sellPrice(card);
        const armor = effects.addArmor(price);
        output.log(`[[icon:plate]] <b>挖宝</b>：【${esc(card.name)}】价格 ${price} → 获得 ${price} 点护甲（当前 ${armor}）`, 'sys');
      }
      if (consumeTempAtTurn) tempUids.push(uid);
      if (swapPair) swapPair.push(uid);
      if (zeroCost) {
        effects.setCardOverride(uid, { ...card, cost: 0, _baseCost: card.cost });
        output.log(`[[icon:bolt]] 发现：【<b>${esc(card.name)}</b>】费用变为 0`, 'loot');
      }
      if (costDecayPerTurn !== undefined && costDecayPerTurn > 0) {
        effects.enqueueDelayed({ special: 'ruleCostDecay', uid, sourceCardId, amount: costDecayPerTurn });
        output.log(`[[icon:hourglass]] 发现：【<b>${esc(card.name)}</b>】每回合开始费用 -${costDecayPerTurn}`, 'sys');
      } else if (decayEachTurn) {
        effects.enqueueDelayed({ special: 'costDecay', uid });
        output.log(`[[icon:hourglass]] 发现：【<b>${esc(card.name)}</b>】每回合开始费用 -1`, 'sys');
      }
    }

    battle.sweepDead();
    if (!battle.hasAliveFoes()) { battle.finishVictory(); return; }
    if (n > 1) {
      interaction.getJobs().unshift({
        n: n - 1, rarity, pred, act, priceArmor: !!priceArmor, pouchUid,
        consumeTempAtTurn: !!consumeTempAtTurn, tempUids, swapPair,
        zeroCost: !!zeroCost, decayEachTurn: !!decayEachTurn,
        costDecayPerTurn, sourceCardId, pool,
      });
    } else if (consumeTempAtTurn && tempUids.length) {
      effects.enqueueDelayed({ special: 'consumeTemps', uids: [...tempUids], cardName: '江湖救急' });
      output.log(`[[icon:hourglass]] <b>江湖救急</b>：置入的 ${tempUids.length} 张临时卡将在下个回合开始时消耗`, 'sys');
    } else if (swapPair && swapPair.length >= 2) {
      effects.swapCardCosts(swapPair[0], swapPair[1]);
    }
    processDiscoverQueue();
    interaction.requestRender();
  }

  return { randomDiscoverCard, processDiscoverQueue, pickDiscover };
}
