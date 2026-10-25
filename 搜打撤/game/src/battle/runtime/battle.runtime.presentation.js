import { subscribeStateBindings } from '../../core/live-bindings.js';
import { defaultBattleRuntime as runtime } from './battle.runtime.default.js';

// Derived ESM bindings preserve existing readers; mutable data lives in runtime.
export let {
  renderBattle, floats, cardAnims, presentationActionSeq,
  dreadShown, snapCache, snapSig
} = runtime;
subscribeStateBindings(runtime, {
  renderBattle: value => { renderBattle = value; },
  floats: value => { floats = value; },
  cardAnims: value => { cardAnims = value; },
  presentationActionSeq: value => { presentationActionSeq = value; },
  dreadShown: value => { dreadShown = value; },
  snapCache: value => { snapCache = value; },
  snapSig: value => { snapSig = value; },
});
export const {
  bindBattleRenderer, showDread, hideDread, takeBattleFloats,
  takeBattleCardAnims, clearBattlePresentation, resetBattlePresentation, nextActionSeq,
  storeBattleSnapshot
} = runtime;
