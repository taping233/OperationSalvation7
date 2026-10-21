import { defaultBattleRuntime as runtime } from './battle.runtime.default.js';

// Derived ESM bindings preserve existing readers; mutable data lives in runtime.
export let renderBattle = runtime.renderBattle;
export let floats = runtime.floats;
export let cardAnims = runtime.cardAnims;
export let presentationActionSeq = runtime.presentationActionSeq;
export let dreadShown = runtime.dreadShown;
export let snapCache = runtime.snapCache;
export let snapSig = runtime.snapSig;
runtime.subscribe((state, key) => {
  switch (key) {
    case 'renderBattle': renderBattle = state.renderBattle; break;
    case 'floats': floats = state.floats; break;
    case 'cardAnims': cardAnims = state.cardAnims; break;
    case 'presentationActionSeq': presentationActionSeq = state.presentationActionSeq; break;
    case 'dreadShown': dreadShown = state.dreadShown; break;
    case 'snapCache': snapCache = state.snapCache; break;
    case 'snapSig': snapSig = state.snapSig; break;
  }
});
export const bindBattleRenderer = runtime.bindBattleRenderer;
export const showDread = runtime.showDread;
export const hideDread = runtime.hideDread;
export const takeBattleFloats = runtime.takeBattleFloats;
export const takeBattleCardAnims = runtime.takeBattleCardAnims;
export const clearBattlePresentation = runtime.clearBattlePresentation;
export const resetBattlePresentation = runtime.resetBattlePresentation;
export const nextActionSeq = runtime.nextActionSeq;
export const storeBattleSnapshot = runtime.storeBattleSnapshot;
