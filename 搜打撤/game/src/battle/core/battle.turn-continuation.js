import { BATTLE_PHASES, transitionBattle } from '../runtime/battle.state.js';

/** Turn-end continuation and interactive triggered-action rendezvous.
 * Session owns cancellation; token checks prevent a previous battle transferring phase.
 */
export function createBattleTurnContinuation({ executionSession, readState, settlePendingSelections,
  set$battleState, set$busy, requestBattleRender, hasPendingAutomaticCasts = () => false }) {
  const { actionQueue, handSelectQueue, choiceQueue } = executionSession;
function hasPendingEndTurn() { return executionSession.turnEndPending; }
function deferEndTurn(resume) {
  const token = readState().battleState.token;
  executionSession.deferTurnEnd(resume, () => readState().G?.battleActive && readState().battleState.token === token &&
    (readState().battleState.phase === BATTLE_PHASES.PLAYER || readState().battleState.phase === BATTLE_PHASES.RESOLVING) &&
    !readState().infusing && !readState().handSelecting && !readState().choosing && !readState().discovering && !readState().interaction &&
    !handSelectQueue.length && !choiceQueue.length && !readState().discoverQueue.length && !hasPendingAutomaticCasts());
  executionSession.resumeTurnEnd();
}
// Pause the enemy continuation only at an owned async boundary. Interactive casts
// temporarily expose player selection controls, with turnEndPending blocking new plays.
let triggeredActionsWait = null;
function awaitTriggeredActions(resumePhase = BATTLE_PHASES.ENEMY) {
  const token = readState().battleState.token;
  if (triggeredActionsWait?.token === token && triggeredActionsWait.resumePhase === resumePhase) return triggeredActionsWait.promise;
  const promise = waitTriggeredActions(resumePhase).finally(() => {
    if (triggeredActionsWait?.promise === promise) triggeredActionsWait = null;
  });
  triggeredActionsWait = { token, resumePhase, promise };
  return promise;
}
async function waitTriggeredActions(resumePhase) {
  const token = readState().battleState.token;
  await actionQueue.idle();
  if (!readState().G?.battleActive || readState().battleState.token !== token || [BATTLE_PHASES.VICTORY, BATTLE_PHASES.DEFEAT].includes(readState().battleState.phase)) return;
  settlePendingSelections();
  const selectionsReady = () => !readState().infusing && !readState().handSelecting && !readState().choosing && !readState().discovering && !readState().interaction &&
    !handSelectQueue.length && !choiceQueue.length && !readState().discoverQueue.length;
  // Settling can start the next automatic UID. Drain it before exposing player input;
  // only a real selection hands control back while this phase owner is suspended.
  while (selectionsReady() && hasPendingAutomaticCasts()) {
    await actionQueue.idle();
    if (!readState().G?.battleActive || readState().battleState.token !== token || [BATTLE_PHASES.VICTORY, BATTLE_PHASES.DEFEAT].includes(readState().battleState.phase)) return;
    settlePendingSelections();
  }
  const ready = () => selectionsReady() && !hasPendingAutomaticCasts();
  if (ready()) return;
  await new Promise((/** @type {(value?: void) => void} */ resolve) => {
    const accepted = executionSession.deferTurnEnd(() => {
      if (readState().G?.battleActive && readState().battleState.token === token) {
        set$battleState(transitionBattle(readState().battleState, resumePhase));
        set$busy(true);
      }
      resolve();
    }, ready, resolve);
    // An existing continuation owns phase transfer; never steal it or leave a waiter pending.
    if (!accepted) { resolve(); return; }
    set$battleState(transitionBattle(readState().battleState, BATTLE_PHASES.PLAYER));
    set$busy(false);
    requestBattleRender();
    executionSession.resumeTurnEnd();
  });
}

  return { hasPendingEndTurn, deferEndTurn, awaitTriggeredActions };
}
