// Builds the immutable view model for battle rendering. All inputs are values
// captured by the engine at call time; this module owns no runtime state.
const freezeObject = value => value ? Object.freeze({ ...value }) : value;
const statusOf = value => value ? Object.freeze({ ...value.status }) : null;

// The cache key follows the same inputs as createBattleSnapshot. Walk the values
// instead of relying on object identity: combat units and selection sets mutate
// in place between renders.
function signatureValue(value, ancestors = new WeakSet()) {
  if (value === null || typeof value !== 'object') return `${typeof value}:${JSON.stringify(String(value))}`;
  if (ancestors.has(value)) return 'circular';
  ancestors.add(value);
  let result;
  if (Array.isArray(value)) result = `array:[${value.map(item => signatureValue(item, ancestors)).join(',')}]`;
  else if (value instanceof Set) result = `set:[${[...value].map(item => signatureValue(item, ancestors)).join(',')}]`;
  else if (value instanceof Map) result = `map:[${[...value].map(([key, item]) => `${signatureValue(key, ancestors)}=${signatureValue(item, ancestors)}`).join(',')}]`;
  else result = `object:{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}=${signatureValue(value[key], ancestors)}`).join(',')}}`;
  ancestors.delete(value);
  return result;
}

function createBattleSnapshotSignature(input, renderDependencies) {
  return signatureValue([input, renderDependencies]);
}

function createBattleSnapshot(input) {
  const {
    battleToken, mode, turn, energy, maxEnergy, busy, phase, actionQueueLength,
    opts, player, pdef, pstat, foes, deathFxPending, allies, hand, drawPile, discard, grave,
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
    card: freezeObject(infusing.card),
    picked: Object.freeze([...infusing.picked]),
  }) : null;
  const readonlyDiscovering = discovering ? Object.freeze({
    ...discovering,
    options: Object.freeze(discovering.options.map(freezeObject)),
  }) : null;
  const readonlyHandSelecting = handSelecting ? Object.freeze({ ...handSelecting }) : null;
  const readonlyChoosing = choosing ? Object.freeze({ ...choosing, options: Object.freeze(choosing.options.slice()) }) : null;
  const deckSelection = selectingDeck ? Object.freeze({
    need: deckNeed,
    max: selDeckMax,
    starterCount: selShaN,
    selected: Object.freeze([...sel]),
    cards: Object.freeze(selPool.map(entry => Object.freeze({ uid: entry.uid, card: freezeObject(entry.card) }))),
    boss: readonlyFoes[0] || null,
  }) : null;
  return Object.freeze({
    battleToken, mode, turn, energy, maxEnergy, busy, phase, actionQueueLength,
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
    infusing: readonlyInfusing,
    discovering: readonlyDiscovering,
    handSelecting: readonlyHandSelecting,
    choosing: readonlyChoosing,
    pendingTarget: pendingTarget ? Object.freeze({ ...pendingTarget, card: freezeObject(pendingTarget.card) }) : null,
    pendingHint, viewingGrave, viewingDeck, viewingBag, dreadShown, deckSelection,
    potionBar: potionBar ? Object.freeze(potionBar.map(freezeObject)) : null,
    pendingItem: pendingItem ? Object.freeze({ ...pendingItem, card: freezeObject(pendingItem.card) }) : null,
    slamPending, dartPending,
    equipped: Object.freeze(equipped.map(e => Object.freeze({ ...e, card: freezeObject(e.card) }))),
  });
}

export { createBattleSnapshot, createBattleSnapshotSignature };
