// @ts-check
/** Pure, typed builders for the distinct discovery jobs and popup states. */

/** @typedef {import('./battle.snapshot.types.js').BattleCardInput & { rarity?: string, cls?: string, _pouch?: DiscoverCard[] }} DiscoverCard */
/** @typedef {(card: DiscoverCard) => boolean} DiscoverCardPredicate */
/** @typedef {{ kind: string, cost?: number }} StructuredDiscoverPool */

/**
 * Runtime jobs are produced by effects, structured card rules, and the deck-bottom flow.
 * Fields are optional only where the current producers omit them.
 * @typedef {object} DiscoverQueueJob
 * @property {number} n
 * @property {DiscoverCard[]} [explicit]
 * @property {string[]} [explicitUids]
 * @property {boolean} [deckBottom]
 * @property {string | null} [rarity]
 * @property {boolean | string | null} [otherCls]
 * @property {DiscoverCardPredicate | null} [pred]
 * @property {StructuredDiscoverPool | null} [pool]
 * @property {string | null} [act]
 * @property {boolean} [priceArmor]
 * @property {string | null} [pouchUid]
 * @property {boolean} [consumeTempAtTurn]
 * @property {string[]} [tempUids]
 * @property {string[] | null} [swapPair]
 * @property {boolean} [zeroCost]
 * @property {boolean} [decayEachTurn]
 * @property {number} [costDecayPerTurn]
 * @property {string | null} [sourceCardId]
 * @property {string | null} [dest]
 */

/** @typedef {DiscoverQueueJob & { explicit: DiscoverCard[] }} ExplicitDiscoverQueueJob */

/**
 * Fields shared by discovery states built from queued random or explicit jobs.
 * Array-valued tracking fields intentionally retain the job's original references.
 * @typedef {object} QueuedDiscoverStateBase
 * @property {DiscoverCard[]} options
 * @property {number} n
 * @property {string | null | undefined} rarity
 * @property {DiscoverCardPredicate | null | undefined} pred
 * @property {string | null} act
 * @property {boolean} priceArmor
 * @property {string | null} pouchUid
 * @property {boolean} consumeTempAtTurn
 * @property {string[]} tempUids
 * @property {string[] | null} swapPair
 * @property {boolean} zeroCost
 * @property {boolean} decayEachTurn
 * @property {number | undefined} costDecayPerTurn
 * @property {string | null} sourceCardId
 * @property {StructuredDiscoverPool | null} pool
 */

/** @typedef {QueuedDiscoverStateBase & { deckBottom: boolean, deckBottomUids: string[] }} ExplicitDiscoverState */
/** @typedef {QueuedDiscoverStateBase & { deckBottom?: never, deckBottomUids?: never }} RandomDiscoverState */
/** @typedef {{ options: DiscoverCard[], n: number, act: 'pouch', pouchUid: string, pred: null }} PouchDiscoverState */
/** @typedef {ExplicitDiscoverState | RandomDiscoverState | PouchDiscoverState | null} DiscoveringState */

/** @param {DiscoverQueueJob} job @returns {QueuedDiscoverStateBase} */
function queuedStateFields(job) {
  return {
    options: [],
    n: job.n,
    rarity: job.rarity,
    pred: job.pred,
    act: job.act || null,
    priceArmor: !!job.priceArmor,
    pouchUid: job.pouchUid || null,
    consumeTempAtTurn: !!job.consumeTempAtTurn,
    tempUids: job.tempUids || [],
    swapPair: job.swapPair || null,
    zeroCost: !!job.zeroCost,
    decayEachTurn: !!job.decayEachTurn,
    costDecayPerTurn: job.costDecayPerTurn,
    sourceCardId: job.sourceCardId || null,
    pool: job.pool || null,
  };
}

/**
 * Explicit candidates use the historical first-three slice and carry deck-bottom
 * metadata even when the job's UID array is absent.
 * @param {ExplicitDiscoverQueueJob} job
 * @returns {ExplicitDiscoverState}
 */
export function buildExplicitDiscoverState(job) {
  return {
    ...queuedStateFields(job),
    options: job.explicit.slice(0, 3),
    deckBottom: !!job.deckBottom,
    deckBottomUids: job.explicitUids || [],
  };
}

/** @param {DiscoverQueueJob} job @param {DiscoverCard[]} options @returns {RandomDiscoverState} */
export function buildRandomDiscoverState(job, options) {
  return { ...queuedStateFields(job), options };
}

/** @param {DiscoverCard[]} options @param {string} pouchUid @returns {PouchDiscoverState} */
export function buildPouchDiscoverState(options, pouchUid) {
  return { options, n: 1, act: 'pouch', pouchUid, pred: null };
}
