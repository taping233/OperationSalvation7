import { subscribeStateBindings } from '../../core/live-bindings.js';
import { defaultBattleRuntime as runtime } from './battle.runtime.default.js';

// Derived ESM bindings preserve existing readers; mutable data lives in runtime.
export let {
  infusing, discovering, discoverQueue, handSelecting,
  choosing, interaction, pendingHint, viewingGrave,
  viewingDeck, viewingBag, selPool, selShaN,
  sel, lastDeckSel, selectingDeck, selDeckMax
} = runtime;
subscribeStateBindings(runtime, {
  infusing: value => { infusing = value; },
  discovering: value => { discovering = value; },
  discoverQueue: value => { discoverQueue = value; },
  handSelecting: value => { handSelecting = value; },
  choosing: value => { choosing = value; },
  interaction: value => { interaction = value; },
  pendingHint: value => { pendingHint = value; },
  viewingGrave: value => { viewingGrave = value; },
  viewingDeck: value => { viewingDeck = value; },
  viewingBag: value => { viewingBag = value; },
  selPool: value => { selPool = value; },
  selShaN: value => { selShaN = value; },
  sel: value => { sel = value; },
  lastDeckSel: value => { lastDeckSel = value; },
  selectingDeck: value => { selectingDeck = value; },
  selDeckMax: value => { selDeckMax = value; },
});
export const {
  set$infusing, set$discovering, set$discoverQueue, set$handSelecting,
  set$choosing, set$interaction, set$pendingHint, set$viewingGrave,
  set$viewingDeck, set$viewingBag, set$selPool, set$selShaN,
  set$sel, set$lastDeckSel, set$selectingDeck, set$selDeckMax,
  clearBattlePopups, closeBattleViews, clearTargetHint
} = runtime;
