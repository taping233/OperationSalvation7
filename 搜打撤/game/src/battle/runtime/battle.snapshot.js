// Builds the immutable view model for battle rendering. All inputs are values
// captured by the engine at call time; this module owns no runtime state.
// @ts-check
/** @typedef {import('../battle.snapshot.types.js').BattleSnapshotInput} BattleSnapshotInput */
/** @typedef {import('../battle.snapshot.types.js').BattleSnapshot} BattleSnapshot */
/** @typedef {import('../battle.snapshot.types.js').BattleCardInput} BattleCardInput */
/** @typedef {import('../battle.snapshot.types.js').SnapshotBattleCard} SnapshotBattleCard */
/** @typedef {import('../battle.snapshot.types.js').BattleCardValue} BattleCardValue */
/** @typedef {import('../battle.snapshot.types.js').SnapshotCardValue} SnapshotCardValue */

/**
 * @template {object} T
 * @overload
 * @param {T} value
 * @returns {Readonly<T>}
 */
/**
 * @template {object} T
 * @overload
 * @param {T | null} value
 * @returns {Readonly<T> | null}
 */
/**
 * @template {object} T
 * @overload
 * @param {T | undefined} value
 * @returns {Readonly<T> | undefined}
 */
/**
 * @template {object} T
 * @overload
 * @param {T | null | undefined} value
 * @returns {Readonly<T> | null | undefined}
 */
/** @param {object | null | undefined} value @returns {Readonly<object> | null | undefined} */
function freezeObject(value) { return value ? Object.freeze({ ...value }) : value; }
/** @param {{ status?: Record<string, unknown> | null }} value @returns {Readonly<Record<string, unknown>>} */
const statusOf = value => Object.freeze({ ...value.status });

// Card data supports recursive primitives/undefined, ordinary arrays, and plain-object enumerable own string data properties.
// Exotic prototypes and cycles are rejected; this is not a general object-graph serializer.
/**
 * @overload
 * @param {BattleCardInput} value
 * @param {WeakSet<object>} [ancestors]
 * @returns {SnapshotBattleCard}
 */
/**
 * @overload
 * @param {BattleCardInput | null | undefined} value
 * @param {WeakSet<object>} [ancestors]
 * @returns {SnapshotBattleCard | null | undefined}
 */
/**
 * @overload
 * @param {BattleCardValue} value
 * @param {WeakSet<object>} [ancestors]
 * @returns {SnapshotCardValue}
 */
/**
 * @overload
 * @param {BattleCardValue | null | undefined} value
 * @param {WeakSet<object>} [ancestors]
 * @returns {SnapshotCardValue | null | undefined}
 */
/**
 * @param {BattleCardInput | BattleCardValue | null | undefined} value
 * @param {WeakSet<object>} [ancestors]
 * @returns {SnapshotBattleCard | SnapshotCardValue | null | undefined}
 */
function cloneCardData(value, ancestors = new WeakSet()) {
  if (value === null || value === undefined || typeof value === 'string'
    || typeof value === 'number' || typeof value === 'boolean') return value;
  if (typeof value !== 'object') {
    throw new TypeError(`Battle snapshot card data must be plain data; received ${typeof value}`);
  }
  if (ancestors.has(value)) throw new TypeError('Battle snapshot card data cannot contain cycles');

  ancestors.add(value);
  let copy;
  if (Array.isArray(value)) {
    copy = value.map(item => cloneCardData(item, ancestors));
  } else {
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      throw new TypeError('Battle snapshot card data must use plain objects and arrays');
    }
    copy = {};
    for (const key of Object.keys(value)) {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor || !('value' in descriptor)) {
        throw new TypeError('Battle snapshot card data cannot contain accessor properties');
      }
      Object.defineProperty(copy, key, {
        value: cloneCardData(descriptor.value, ancestors),
        enumerable: descriptor.enumerable,
        configurable: true,
        writable: true,
      });
    }
  }
  ancestors.delete(value);
  return Object.freeze(copy);
}

// The cache key follows the same inputs as createBattleSnapshot. Walk the values
// instead of relying on object identity: combat units and selection sets mutate
// in place between renders.
/** @param {unknown} value @param {WeakSet<object>} [ancestors] @returns {string} */
function signatureValue(value, ancestors = new WeakSet()) {
  if (value === null || typeof value !== 'object') return `${typeof value}:${JSON.stringify(String(value))}`;
  if (ancestors.has(value)) return 'circular';
  ancestors.add(value);
  let result;
  if (Array.isArray(value)) result = `array:[${value.map(item => signatureValue(item, ancestors)).join(',')}]`;
  else if (value instanceof Set) result = `set:[${[...value].map(item => signatureValue(item, ancestors)).join(',')}]`;
  else if (value instanceof Map) result = `map:[${[...value].map(([key, item]) => `${signatureValue(key, ancestors)}=${signatureValue(item, ancestors)}`).join(',')}]`;
  else {
    const record = /** @type {Record<string, unknown>} */ (value);
    result = `object:{${Object.keys(record).sort().map(key => `${JSON.stringify(key)}=${signatureValue(record[key], ancestors)}`).join(',')}}`;
  }
  ancestors.delete(value);
  return result;
}

/** @param {BattleSnapshotInput} input @param {unknown} renderDependencies @returns {string} */
function createBattleSnapshotSignature(input, renderDependencies) {
  return signatureValue([input, renderDependencies]);
}

/**
 * @param {BattleSnapshotInput} input
 * @returns {BattleSnapshot}
 */
function createBattleSnapshot(input) {
  const {
    battleToken, mode, turn, energy, maxEnergy, busy, phase, actionQueueLength,
    opts, player, pdef, pstat, foes, deathFxPending, allies, hand, drawPile, discard, grave, consumed = [], playedMovesThisTurn, endTurnContext, playerEffects = [],
    infusing, discovering, handSelecting, choosing, pendingTarget, pendingHint,
    viewingGrave, viewingDeck, viewingBag, dreadShown, selectingDeck, deckNeed, selDeckMax,
    selShaN, sel, selPool, potionBar, pendingItem, slamPending, dartPending,
    equipped,
  } = input;
  const playerStatus = pstat ? Object.freeze({ ...pstat, status: statusOf(pstat) }) : null;
  const playerDefense = freezeObject(pdef);
  const readonlyFoes = foes.map((foe, index) => Object.freeze({
    ...foe,
    deathFxPending: !!deathFxPending?.[index],
    status: statusOf(foe),
    defense: freezeObject(foe.defense),
    intent: freezeObject(foe.intent),
  }));
  const readonlyInfusing = infusing ? Object.freeze({
    ...infusing,
    card: cloneCardData(infusing.card),
    picked: Object.freeze([...infusing.picked]),
  }) : null;
  const readonlyDiscovering = discovering ? Object.freeze({
    ...discovering,
    options: Object.freeze(discovering.options.map(card => cloneCardData(card))),
  }) : null;
  /** @type {BattleSnapshot['handSelecting']} */
  let readonlyHandSelecting = null;
  if (handSelecting) {
    /** @type {NonNullable<BattleSnapshot['handSelecting']>} */
    const handSelectingCopy = {
      ...handSelecting,
      ...(Object.hasOwn(handSelecting, 'srcCard')
        ? { srcCard: cloneCardData(handSelecting.srcCard) }
        : {}),
      ...(handSelecting.payment && Object.hasOwn(handSelecting.payment, 'card')
        ? { payment: { ...handSelecting.payment, card: cloneCardData(handSelecting.payment.card) } }
        : {}),
    };
    readonlyHandSelecting = Object.freeze(handSelectingCopy);
  }
  const readonlyChoosing = choosing ? Object.freeze({ ...choosing, options: Object.freeze(choosing.options.slice()) }) : null;
  const deckSelection = selectingDeck ? Object.freeze({
    need: deckNeed,
    max: selDeckMax,
    starterCount: selShaN,
    selected: Object.freeze([...sel]),
    cards: Object.freeze(selPool.map(entry => Object.freeze({ uid: entry.uid, card: cloneCardData(entry.card) }))),
    boss: readonlyFoes[0] || null,
  }) : null;
  return Object.freeze({
    battleToken, mode, turn, energy, maxEnergy, busy, phase, actionQueueLength,
    playedMovesThisTurn: playedMovesThisTurn || 0, endTurnContext: freezeObject(endTurnContext),
    playerEffects: Object.freeze(playerEffects.map(effect => Object.freeze({ ...effect }))),
    opts: freezeObject(opts),
    player: player ? Object.freeze({ ...player }) : null,
    pdef: playerDefense,
    pstat: playerStatus,
    foes: Object.freeze(readonlyFoes),
    allies: Object.freeze(allies.map(a => Object.freeze({ ...a, status: statusOf(a), defense: freezeObject(a.defense) }))),
    hand: Object.freeze(hand.slice()),
    drawPile: Object.freeze(drawPile.slice()),
    discard: Object.freeze(discard.slice()),
    grave: Object.freeze(grave.slice()),
    consumed: Object.freeze(consumed.slice()),
    infusing: readonlyInfusing,
    discovering: readonlyDiscovering,
    handSelecting: readonlyHandSelecting,
    choosing: readonlyChoosing,
    pendingTarget: pendingTarget ? Object.freeze({ ...pendingTarget, card: cloneCardData(pendingTarget.card) }) : null,
    pendingHint, viewingGrave, viewingDeck, viewingBag, dreadShown, deckSelection,
    potionBar: potionBar ? Object.freeze(potionBar.map(entry => freezeObject(entry))) : null,
    pendingItem: pendingItem ? Object.freeze({ ...pendingItem, card: cloneCardData(pendingItem.card) }) : null,
    slamPending, dartPending,
    equipped: Object.freeze(equipped.map(e => Object.freeze({ ...e, card: cloneCardData(e.card) }))),
  });
}

export { createBattleSnapshot, createBattleSnapshotSignature };
