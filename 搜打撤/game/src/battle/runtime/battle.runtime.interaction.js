import { defaultBattleRuntime as runtime } from './battle.runtime.default.js';

// Derived ESM bindings preserve existing readers; mutable data lives in runtime.
export let infusing = runtime.infusing;
export let discovering = runtime.discovering;
export let discoverQueue = runtime.discoverQueue;
export let handSelecting = runtime.handSelecting;
export let choosing = runtime.choosing;
export let interaction = runtime.interaction;
export let pendingHint = runtime.pendingHint;
export let viewingGrave = runtime.viewingGrave;
export let viewingDeck = runtime.viewingDeck;
export let viewingBag = runtime.viewingBag;
export let selPool = runtime.selPool;
export let selShaN = runtime.selShaN;
export let sel = runtime.sel;
export let lastDeckSel = runtime.lastDeckSel;
export let selectingDeck = runtime.selectingDeck;
export let selDeckMax = runtime.selDeckMax;
runtime.subscribe((state, key) => {
  switch (key) {
    case 'infusing': infusing = state.infusing; break;
    case 'discovering': discovering = state.discovering; break;
    case 'discoverQueue': discoverQueue = state.discoverQueue; break;
    case 'handSelecting': handSelecting = state.handSelecting; break;
    case 'choosing': choosing = state.choosing; break;
    case 'interaction': interaction = state.interaction; break;
    case 'pendingHint': pendingHint = state.pendingHint; break;
    case 'viewingGrave': viewingGrave = state.viewingGrave; break;
    case 'viewingDeck': viewingDeck = state.viewingDeck; break;
    case 'viewingBag': viewingBag = state.viewingBag; break;
    case 'selPool': selPool = state.selPool; break;
    case 'selShaN': selShaN = state.selShaN; break;
    case 'sel': sel = state.sel; break;
    case 'lastDeckSel': lastDeckSel = state.lastDeckSel; break;
    case 'selectingDeck': selectingDeck = state.selectingDeck; break;
    case 'selDeckMax': selDeckMax = state.selDeckMax; break;
  }
});
export const set$infusing = runtime.set$infusing;
export const set$discovering = runtime.set$discovering;
export const set$discoverQueue = runtime.set$discoverQueue;
export const set$handSelecting = runtime.set$handSelecting;
export const set$choosing = runtime.set$choosing;
export const set$interaction = runtime.set$interaction;
export const set$pendingHint = runtime.set$pendingHint;
export const set$viewingGrave = runtime.set$viewingGrave;
export const set$viewingDeck = runtime.set$viewingDeck;
export const set$viewingBag = runtime.set$viewingBag;
export const set$selPool = runtime.set$selPool;
export const set$selShaN = runtime.set$selShaN;
export const set$sel = runtime.set$sel;
export const set$lastDeckSel = runtime.set$lastDeckSel;
export const set$selectingDeck = runtime.set$selectingDeck;
export const set$selDeckMax = runtime.set$selDeckMax;
export const clearBattlePopups = runtime.clearBattlePopups;
export const closeBattleViews = runtime.closeBattleViews;
export const clearTargetHint = runtime.clearTargetHint;
