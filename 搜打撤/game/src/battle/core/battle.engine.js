// Stable compatibility commands always delegate to the currently configured engine.
import { createBattleEngine } from './battle.engine.factory.js';
import { createDefaultBattleContext } from './battle.default-context.js';

let engine = null;
function currentEngine() {
  if (!engine) throw new Error('Battle engine has not been configured');
  return engine;
}

/** @type {ReturnType<typeof createBattleEngine>['getCardPlayAvailability']} */
export const getCardPlayAvailability = (...args) => currentEngine().getCardPlayAvailability(...args);
/** @type {ReturnType<typeof createBattleEngine>['submitCardPlay']} */
export const submitCardPlay = (...args) => currentEngine().submitCardPlay(...args);
/** @type {ReturnType<typeof createBattleEngine>['awaitTriggeredActions']} */
export const awaitTriggeredActions = (...args) => currentEngine().awaitTriggeredActions(...args);
/** @type {ReturnType<typeof createBattleEngine>['emitBattlePresentation']} */
export const emitBattlePresentation = (...args) => currentEngine().emitBattlePresentation(...args);
/** @type {ReturnType<typeof createBattleEngine>['emitRecast']} */
export const emitRecast = (...args) => currentEngine().emitRecast(...args);
/** @type {ReturnType<typeof createBattleEngine>['settlePendingSelections']} */
export const settlePendingSelections = (...args) => currentEngine().settlePendingSelections(...args);
/** @type {ReturnType<typeof createBattleEngine>['requestBattleRender']} */
export const requestBattleRender = (...args) => currentEngine().requestBattleRender(...args);
/** @type {ReturnType<typeof createBattleEngine>['interactionOf']} */
export const interactionOf = (...args) => currentEngine().interactionOf(...args);
/** @type {ReturnType<typeof createBattleEngine>['cloneData']} */
export const cloneData = (...args) => currentEngine().cloneData(...args);
/** @type {ReturnType<typeof createBattleEngine>['cardIdentity']} */
export const cardIdentity = (...args) => currentEngine().cardIdentity(...args);
/** @type {ReturnType<typeof createBattleEngine>['R']} */
export const R = (...args) => currentEngine().R(...args);
/** @type {ReturnType<typeof createBattleEngine>['alive']} */
export const alive = (...args) => currentEngine().alive(...args);
/** @type {ReturnType<typeof createBattleEngine>['intentFor']} */
export const intentFor = (...args) => currentEngine().intentFor(...args);
/** @type {ReturnType<typeof createBattleEngine>['drawCards']} */
export const drawCards = (...args) => currentEngine().drawCards(...args);
/** @type {ReturnType<typeof createBattleEngine>['resolveFoeDefeat']} */
export const resolveFoeDefeat = (...args) => currentEngine().resolveFoeDefeat(...args);
/** @type {ReturnType<typeof createBattleEngine>['sweepDead']} */
export const sweepDead = (...args) => currentEngine().sweepDead(...args);
/** @type {ReturnType<typeof createBattleEngine>['nestPhase']} */
export const nestPhase = (...args) => currentEngine().nestPhase(...args);
/** @type {ReturnType<typeof createBattleEngine>['grantSha']} */
export const grantSha = (...args) => currentEngine().grantSha(...args);
/** @type {ReturnType<typeof createBattleEngine>['findCard']} */
export const findCard = (...args) => currentEngine().findCard(...args);
/** @type {ReturnType<typeof createBattleEngine>['findEffectiveCard']} */
export const findEffectiveCard = (...args) => currentEngine().findEffectiveCard(...args);
/** @type {ReturnType<typeof createBattleEngine>['infusionFuelReason']} */
export const infusionFuelReason = (...args) => currentEngine().infusionFuelReason(...args);
/** @type {ReturnType<typeof createBattleEngine>['infuseOf']} */
export const infuseOf = (...args) => currentEngine().infuseOf(...args);
/** @type {ReturnType<typeof createBattleEngine>['effCostOf']} */
export const effCostOf = (...args) => currentEngine().effCostOf(...args);
/** @type {ReturnType<typeof createBattleEngine>['swapCardCosts']} */
export const swapCardCosts = (...args) => currentEngine().swapCardCosts(...args);
/** @type {ReturnType<typeof createBattleEngine>['restore']} */
export const restore = (...args) => currentEngine().restore(...args);
/** @type {ReturnType<typeof createBattleEngine>['finish']} */
export const finish = (...args) => currentEngine().finish(...args);
/** @type {ReturnType<typeof createBattleEngine>['cancelInteraction']} */
export const cancelInteraction = (...args) => currentEngine().cancelInteraction(...args);
/** @type {ReturnType<typeof createBattleEngine>['flee']} */
export const flee = (...args) => currentEngine().flee(...args);
/** @type {ReturnType<typeof createBattleEngine>['handCurseSpecs']} */
export const handCurseSpecs = (...args) => currentEngine().handCurseSpecs(...args);
/** @type {ReturnType<typeof createBattleEngine>['getSnapshot']} */
export const getSnapshot = (...args) => currentEngine().getSnapshot(...args);
/** @type {ReturnType<typeof createBattleEngine>['snapshotSignature']} */
export const snapshotSignature = (...args) => currentEngine().snapshotSignature(...args);
/** @type {ReturnType<typeof createBattleEngine>['getBattleLiveness']} */
export const getBattleLiveness = (...args) => currentEngine().getBattleLiveness(...args);
/** @type {ReturnType<typeof createBattleEngine>['processDelayed']} */
export const processDelayed = (...args) => currentEngine().processDelayed(...args);
/** @type {ReturnType<typeof createBattleEngine>['accrueGrowth']} */
export const accrueGrowth = (...args) => currentEngine().accrueGrowth(...args);
/** @type {ReturnType<typeof createBattleEngine>['resolveCard']} */
export const resolveCard = (...args) => currentEngine().resolveCard(...args);
/** @type {ReturnType<typeof createBattleEngine>['resolveCardWithFeedback']} */
export const resolveCardWithFeedback = (...args) => currentEngine().resolveCardWithFeedback(...args);
/** @type {ReturnType<typeof createBattleEngine>['syncCurseCondEquips']} */
export const syncCurseCondEquips = (...args) => currentEngine().syncCurseCondEquips(...args);
/** @type {ReturnType<typeof createBattleEngine>['useEquipSkill']} */
export const useEquipSkill = (...args) => currentEngine().useEquipSkill(...args);
/** @type {ReturnType<typeof createBattleEngine>['applyKillRewards']} */
export const applyKillRewards = (...args) => currentEngine().applyKillRewards(...args);
/** @type {ReturnType<typeof createBattleEngine>['start']} */
export const start = (...args) => currentEngine().start(...args);
/** @type {ReturnType<typeof createBattleEngine>['fireTurnEndTriggers']} */
export const fireTurnEndTriggers = (...args) => currentEngine().fireTurnEndTriggers(...args);
/** @type {ReturnType<typeof createBattleEngine>['addTempCard']} */
export const addTempCard = (...args) => currentEngine().addTempCard(...args);
/** @type {ReturnType<typeof createBattleEngine>['fireConsumeTriggers']} */
export const fireConsumeTriggers = (...args) => currentEngine().fireConsumeTriggers(...args);
/** @type {ReturnType<typeof createBattleEngine>['toggleDeckCard']} */
export const toggleDeckCard = (...args) => currentEngine().toggleDeckCard(...args);
/** @type {ReturnType<typeof createBattleEngine>['cancelDeckSelection']} */
export const cancelDeckSelection = (...args) => currentEngine().cancelDeckSelection(...args);
/** @type {ReturnType<typeof createBattleEngine>['beginBoss']} */
export const beginBoss = (...args) => currentEngine().beginBoss(...args);
/** @type {ReturnType<typeof createBattleEngine>['targetSide']} */
export const targetSide = (...args) => currentEngine().targetSide(...args);
/** @type {ReturnType<typeof createBattleEngine>['unplayableReason']} */
export const unplayableReason = (...args) => currentEngine().unplayableReason(...args);
/** @type {ReturnType<typeof createBattleEngine>['handUnplayableReason']} */
export const handUnplayableReason = (...args) => currentEngine().handUnplayableReason(...args);
/** @type {ReturnType<typeof createBattleEngine>['play']} */
export const play = (...args) => currentEngine().play(...args);
/** @type {ReturnType<typeof createBattleEngine>['toggleInfusePick']} */
export const toggleInfusePick = (...args) => currentEngine().toggleInfusePick(...args);
/** @type {ReturnType<typeof createBattleEngine>['cancelInfuse']} */
export const cancelInfuse = (...args) => currentEngine().cancelInfuse(...args);
/** @type {ReturnType<typeof createBattleEngine>['beginInfuse']} */
export const beginInfuse = (...args) => currentEngine().beginInfuse(...args);
/** @type {ReturnType<typeof createBattleEngine>['confirmInfuse']} */
export const confirmInfuse = (...args) => currentEngine().confirmInfuse(...args);
/** @type {ReturnType<typeof createBattleEngine>['queueCardExecution']} */
export const queueCardExecution = (...args) => currentEngine().queueCardExecution(...args);
/** @type {ReturnType<typeof createBattleEngine>['aegisBlocked']} */
export const aegisBlocked = (...args) => currentEngine().aegisBlocked(...args);
/** @type {ReturnType<typeof createBattleEngine>['foeIdx']} */
export const foeIdx = (...args) => currentEngine().foeIdx(...args);
/** @type {ReturnType<typeof createBattleEngine>['hitFoe']} */
export const hitFoe = (...args) => currentEngine().hitFoe(...args);
/** @type {ReturnType<typeof createBattleEngine>['matchHandSelectKey']} */
export const matchHandSelectKey = (...args) => currentEngine().matchHandSelectKey(...args);
/** @type {ReturnType<typeof createBattleEngine>['skipHandSelect']} */
export const skipHandSelect = (...args) => currentEngine().skipHandSelect(...args);
/** @type {ReturnType<typeof createBattleEngine>['pickHandSelect']} */
export const pickHandSelect = (...args) => currentEngine().pickHandSelect(...args);
/** @type {ReturnType<typeof createBattleEngine>['useItem']} */
export const useItem = (...args) => currentEngine().useItem(...args);
/** @type {ReturnType<typeof createBattleEngine>['bagSlam']} */
export const bagSlam = (...args) => currentEngine().bagSlam(...args);
/** @type {ReturnType<typeof createBattleEngine>['resolveDart']} */
export const resolveDart = (...args) => currentEngine().resolveDart(...args);
/** @type {ReturnType<typeof createBattleEngine>['resolveSlam']} */
export const resolveSlam = (...args) => currentEngine().resolveSlam(...args);
/** @type {ReturnType<typeof createBattleEngine>['slamSkill']} */
export const slamSkill = (...args) => currentEngine().slamSkill(...args);
/** @type {ReturnType<typeof createBattleEngine>['addPlayerCurse']} */
export const addPlayerCurse = (...args) => currentEngine().addPlayerCurse(...args);
/** @type {ReturnType<typeof createBattleEngine>['usePotion']} */
export const usePotion = (...args) => currentEngine().usePotion(...args);
/** @type {ReturnType<typeof createBattleEngine>['openBag']} */
export const openBag = (...args) => currentEngine().openBag(...args);
/** @type {ReturnType<typeof createBattleEngine>['closeBag']} */
export const closeBag = (...args) => currentEngine().closeBag(...args);
/** @type {ReturnType<typeof createBattleEngine>['pickChoice']} */
export const pickChoice = (...args) => currentEngine().pickChoice(...args);
/** @type {ReturnType<typeof createBattleEngine>['pickDiscover']} */
export const pickDiscover = (...args) => currentEngine().pickDiscover(...args);
/** @type {ReturnType<typeof createBattleEngine>['playerTakeHit']} */
export const playerTakeHit = (...args) => currentEngine().playerTakeHit(...args);
/** @type {ReturnType<typeof createBattleEngine>['notifyPlayerDamaged']} */
export const notifyPlayerDamaged = (...args) => currentEngine().notifyPlayerDamaged(...args);
/** @type {ReturnType<typeof createBattleEngine>['frenzyCurse']} */
export const frenzyCurse = (...args) => currentEngine().frenzyCurse(...args);
/** @type {ReturnType<typeof createBattleEngine>['elCurse']} */
export const elCurse = (...args) => currentEngine().elCurse(...args);
/** @type {ReturnType<typeof createBattleEngine>['deferEndTurn']} */
export const deferEndTurn = (...args) => currentEngine().deferEndTurn(...args);
/** @type {ReturnType<typeof createBattleEngine>['hasPendingEndTurn']} */
export const hasPendingEndTurn = (...args) => currentEngine().hasPendingEndTurn(...args);
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
