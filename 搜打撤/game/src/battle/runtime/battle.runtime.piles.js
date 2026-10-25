import { subscribeStateBindings } from '../../core/live-bindings.js';
import { defaultBattleRuntime as runtime } from './battle.runtime.default.js';

// Derived ESM bindings preserve existing readers; mutable data lives in runtime.
export let {
  drawPile, hand, discard, granted,
  played, consumed, grave, delayed,
  noDrawNext, lastDrawnUids, zeroFeeUntil, cardOverrides,
  equipped, freeCast
} = runtime;
subscribeStateBindings(runtime, {
  drawPile: value => { drawPile = value; },
  hand: value => { hand = value; },
  discard: value => { discard = value; },
  granted: value => { granted = value; },
  played: value => { played = value; },
  consumed: value => { consumed = value; },
  grave: value => { grave = value; },
  delayed: value => { delayed = value; },
  noDrawNext: value => { noDrawNext = value; },
  lastDrawnUids: value => { lastDrawnUids = value; },
  zeroFeeUntil: value => { zeroFeeUntil = value; },
  cardOverrides: value => { cardOverrides = value; },
  equipped: value => { equipped = value; },
  freeCast: value => { freeCast = value; },
});
export const {
  set$drawPile, set$hand, set$discard, set$consumed,
  set$grave, set$delayed, set$noDrawNext, set$lastDrawnUids,
  set$equipped, set$freeCast, clearBattlePiles, restoreBattlePiles,
  restorePilesBookkeeping, resetPilesCarryover, resetCastOverrides
} = runtime;
