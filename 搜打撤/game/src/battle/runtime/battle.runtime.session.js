import { subscribeStateBindings } from '../../core/live-bindings.js';
import { defaultBattleRuntime as runtime } from './battle.runtime.default.js';

// Derived ESM bindings preserve existing readers; mutable data lives in runtime.
export let {
  battleState, G, foes, opts,
  mode, energy, maxEnergy, turn,
  pdef, pstat, busy, allies,
  battleRestartCheckpoint, restoringRestartCheckpoint, tmpSeq, activeActionSignal,
  surgeWaiter, lastPersistAt
} = runtime;
subscribeStateBindings(runtime, {
  battleState: value => { battleState = value; },
  G: value => { G = value; },
  foes: value => { foes = value; },
  opts: value => { opts = value; },
  mode: value => { mode = value; },
  energy: value => { energy = value; },
  maxEnergy: value => { maxEnergy = value; },
  turn: value => { turn = value; },
  pdef: value => { pdef = value; },
  pstat: value => { pstat = value; },
  busy: value => { busy = value; },
  allies: value => { allies = value; },
  battleRestartCheckpoint: value => { battleRestartCheckpoint = value; },
  restoringRestartCheckpoint: value => { restoringRestartCheckpoint = value; },
  tmpSeq: value => { tmpSeq = value; },
  activeActionSignal: value => { activeActionSignal = value; },
  surgeWaiter: value => { surgeWaiter = value; },
  lastPersistAt: value => { lastPersistAt = value; },
});
export const {
  set$G, set$opts, set$mode, set$battleState,
  set$foes, set$energy, set$maxEnergy, set$turn,
  set$busy, set$pdef, set$pstat, set$allies,
  set$battleRestartCheckpoint, set$restoringRestartCheckpoint, set$activeActionSignal, set$surgeWaiter,
  set$lastPersistAt, transitionTo, cancelTargetingState, nextTmpSeq,
  clearActionSignals, restoreBattleSession, restoreBattleCombatants, resetBattlePlayerState
} = runtime;
