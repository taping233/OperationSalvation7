import { namedBinding } from '../../core/live-bindings.js';
// Stable compatibility commands always delegate to the currently configured engine.
import { createBattleEngine } from './battle.engine.factory.js';
import { createDefaultBattleContext } from './battle.default-context.js';

let engine = null;
function currentEngine() {
  if (!engine) throw new Error('Battle engine has not been configured');
  return engine;
}
/** @typedef {ReturnType<typeof createBattleEngine>} ConfiguredEngine */
/** @typedef {{[K in keyof ConfiguredEngine]: ConfiguredEngine[K] extends (...args: never[]) => unknown ? K : never}[keyof ConfiguredEngine]} EngineMethod */
/** @template {EngineMethod} K @param {K} name @returns {ConfiguredEngine[K]} */
function forward(name) {
  return /** @type {ConfiguredEngine[K]} */ (namedBinding(name, (...args) => {
    const active = currentEngine();
    return active[name](...args);
  }));
}


export const getCardPlayAvailability = forward('getCardPlayAvailability');
export const submitCardPlay = forward('submitCardPlay');
export const awaitTriggeredActions = forward('awaitTriggeredActions');
export const emitBattlePresentation = forward('emitBattlePresentation');
export const emitRecast = forward('emitRecast');
export const settlePendingSelections = forward('settlePendingSelections');
export const requestBattleRender = forward('requestBattleRender');
export const interactionOf = forward('interactionOf');
export const cloneData = forward('cloneData');
export const cardIdentity = forward('cardIdentity');
export const R = forward('R');
export const alive = forward('alive');
export const intentFor = forward('intentFor');
export const drawCards = forward('drawCards');
export const resolveFoeDefeat = forward('resolveFoeDefeat');
export const sweepDead = forward('sweepDead');
export const nestPhase = forward('nestPhase');
export const grantSha = forward('grantSha');
export const findCard = forward('findCard');
export const findEffectiveCard = forward('findEffectiveCard');
export const infusionFuelReason = forward('infusionFuelReason');
export const infuseOf = forward('infuseOf');
export const effCostOf = forward('effCostOf');
export const swapCardCosts = forward('swapCardCosts');
export const restore = forward('restore');
export const finish = forward('finish');
export const endRun = forward('endRun');
export const cancelInteraction = forward('cancelInteraction');
export const flee = forward('flee');
export const handCurseSpecs = forward('handCurseSpecs');
export const getSnapshot = forward('getSnapshot');
export const snapshotSignature = forward('snapshotSignature');
export const getBattleLiveness = forward('getBattleLiveness');
export const processDelayed = forward('processDelayed');
export const accrueGrowth = forward('accrueGrowth');
export const resolveCard = forward('resolveCard');
export const resolveCardWithFeedback = forward('resolveCardWithFeedback');
export const syncCurseCondEquips = forward('syncCurseCondEquips');
export const useEquipSkill = forward('useEquipSkill');
export const applyKillRewards = forward('applyKillRewards');
export const start = forward('start');
export const fireTurnEndTriggers = forward('fireTurnEndTriggers');
export const addTempCard = forward('addTempCard');
export const fireConsumeTriggers = forward('fireConsumeTriggers');
export const toggleDeckCard = forward('toggleDeckCard');
export const cancelDeckSelection = forward('cancelDeckSelection');
export const beginBoss = forward('beginBoss');
export const targetSide = forward('targetSide');
export const unplayableReason = forward('unplayableReason');
export const handUnplayableReason = forward('handUnplayableReason');
export const play = forward('play');
export const toggleInfusePick = forward('toggleInfusePick');
export const cancelInfuse = forward('cancelInfuse');
export const beginInfuse = forward('beginInfuse');
export const confirmInfuse = forward('confirmInfuse');
export const queueCardExecution = forward('queueCardExecution');
export const aegisBlocked = forward('aegisBlocked');
export const foeIdx = forward('foeIdx');
export const hitFoe = forward('hitFoe');
export const matchHandSelectKey = forward('matchHandSelectKey');
export const skipHandSelect = forward('skipHandSelect');
export const pickHandSelect = forward('pickHandSelect');
export const useItem = forward('useItem');
export const bagSlam = forward('bagSlam');
export const resolveDart = forward('resolveDart');
export const resolveSlam = forward('resolveSlam');
export const slamSkill = forward('slamSkill');
export const addPlayerCurse = forward('addPlayerCurse');
export const usePotion = forward('usePotion');
export const openBag = forward('openBag');
export const closeBag = forward('closeBag');
export const pickChoice = forward('pickChoice');
export const pickDiscover = forward('pickDiscover');
export const playerTakeHit = forward('playerTakeHit');
export const notifyPlayerDamaged = forward('notifyPlayerDamaged');
export const frenzyCurse = forward('frenzyCurse');
export const elCurse = forward('elCurse');
export const deferEndTurn = forward('deferEndTurn');
export const hasPendingEndTurn = forward('hasPendingEndTurn');
resolveCard.steps = (...args) => currentEngine().resolveCard.steps(...args);

/** Only the inactive, drained engine may be replaced. Validation precedes rebinding. */
export function configureBattleEngine(ports) {
  if (engine && !engine.canReconfigure()) throw new Error('Cannot configure an active battle engine');
  const context = createDefaultBattleContext(ports);
  context.audio = { ...context.audio, sfx: ports.sound };
  const next = createBattleEngine(/** @type {typeof context & {sound: (name: string) => void, evaluateRunes: (slots: unknown[]) => object}} */ (context));
  if (!next.canReconfigure()) throw new Error('Cannot configure an active battle engine');
  engine = next;
  return next;
}

export const dealEffectDamage = forward('dealEffectDamage');
export const consumeBattleCard = forward('consumeBattleCard');
export const getTriggerSnapshot = () => currentEngine().getTriggerSnapshot();

export const recoverBattleFailure = forward('recoverBattleFailure');

export const cancelDiscover = roundId => currentEngine().cancelDiscover(roundId);
