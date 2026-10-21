import { defaultBattleRuntime as runtime } from './battle.runtime.default.js';

// Derived ESM bindings preserve existing readers; mutable data lives in runtime.
export let drawPile = runtime.drawPile;
export let hand = runtime.hand;
export let discard = runtime.discard;
export let granted = runtime.granted;
export let played = runtime.played;
export let consumed = runtime.consumed;
export let grave = runtime.grave;
export let delayed = runtime.delayed;
export let noDrawNext = runtime.noDrawNext;
export let lastDrawnUids = runtime.lastDrawnUids;
export let zeroFeeUntil = runtime.zeroFeeUntil;
export let cardOverrides = runtime.cardOverrides;
export let equipped = runtime.equipped;
export let freeCast = runtime.freeCast;
runtime.subscribe((state, key) => {
  switch (key) {
    case 'drawPile': drawPile = state.drawPile; break;
    case 'hand': hand = state.hand; break;
    case 'discard': discard = state.discard; break;
    case 'granted': granted = state.granted; break;
    case 'played': played = state.played; break;
    case 'consumed': consumed = state.consumed; break;
    case 'grave': grave = state.grave; break;
    case 'delayed': delayed = state.delayed; break;
    case 'noDrawNext': noDrawNext = state.noDrawNext; break;
    case 'lastDrawnUids': lastDrawnUids = state.lastDrawnUids; break;
    case 'zeroFeeUntil': zeroFeeUntil = state.zeroFeeUntil; break;
    case 'cardOverrides': cardOverrides = state.cardOverrides; break;
    case 'equipped': equipped = state.equipped; break;
    case 'freeCast': freeCast = state.freeCast; break;
  }
});
export const set$drawPile = runtime.set$drawPile;
export const set$hand = runtime.set$hand;
export const set$discard = runtime.set$discard;
export const set$consumed = runtime.set$consumed;
export const set$grave = runtime.set$grave;
export const set$delayed = runtime.set$delayed;
export const set$noDrawNext = runtime.set$noDrawNext;
export const set$lastDrawnUids = runtime.set$lastDrawnUids;
export const set$equipped = runtime.set$equipped;
export const set$freeCast = runtime.set$freeCast;
export const clearBattlePiles = runtime.clearBattlePiles;
export const restoreBattlePiles = runtime.restoreBattlePiles;
export const restorePilesBookkeeping = runtime.restorePilesBookkeeping;
export const resetPilesCarryover = runtime.resetPilesCarryover;
export const resetCastOverrides = runtime.resetCastOverrides;
