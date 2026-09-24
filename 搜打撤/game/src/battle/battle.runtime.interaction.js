/* 玩家抉择、选牌与弹层的瞬时状态。由 battle.runtime.js 转发活绑定。 */
export let infusing = null, discovering = null, discoverQueue = [];
export let handSelecting = null;
export let choosing = null;
export let interaction = null;
export let pendingHint = '';
export let viewingGrave = false;
export let viewingDeck = false;
export let viewingBag = false;
export let selPool = [], selShaN = 0, sel = new Set(), lastDeckSel = [], selectingDeck = false, selDeckMax = 15;

export function set$infusing(v) { infusing = v; }
export function set$discovering(v) { discovering = v; }
export function set$discoverQueue(v) { discoverQueue = v; }
export function set$handSelecting(v) { handSelecting = v; }
export function set$choosing(v) { choosing = v; }
export function set$interaction(v) { interaction = v; }
export function set$pendingHint(v) { pendingHint = v; }
export function set$viewingGrave(v) { viewingGrave = v; }
export function set$viewingDeck(v) { viewingDeck = v; }
export function set$viewingBag(v) { viewingBag = v; }
export function set$selPool(v) { selPool = v; }
export function set$selShaN(v) { selShaN = v; }
export function set$sel(v) { sel = v; }
export function set$lastDeckSel(v) { lastDeckSel = v; }
export function set$selectingDeck(v) { selectingDeck = v; }
export function set$selDeckMax(v) { selDeckMax = v; }
