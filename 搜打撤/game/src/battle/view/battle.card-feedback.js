import { emitBattleArt, clearBattleArt } from './battle.fx-art.js';
export { clearBattleArt as clearCardFeedback } from './battle.fx-art.js';

// Battle uses image-only settled-event effects. Other screens retain their own card feedback.
const seen = new WeakMap();
export function showCardFeedback(stage, events = []) {
  if (!stage?.isConnected) return;
  let state = seen.get(stage);
  if (!state || state.token !== stage._battleToken) {
    if (state) clearBattleArt();
    state = { token: stage._battleToken, events: new WeakSet() }; seen.set(stage, state);
  }
  for (const event of events) {
    if (event.battleToken != null && event.battleToken !== state.token || state.events.has(event)) continue;
    if (!['bag', 'shuffle', 'surge', 'recast', 'draw'].includes(event.kind)) continue;
    if (event.kind === 'draw' && !event.acquired || event.kind === 'recast') continue;
    state.events.add(event);
    const target = Number.isInteger(event.target)
      ? stage.querySelector(`.sts-foe[data-eidx="${event.target}"] .sts-figure`) : null;
    const anchor = target || (event.kind === 'shuffle' ? stage.querySelector('.sts-hud-l .bt-pile')
      : stage.querySelector('.sts-hand'));
    emitBattleArt(stage, event.kind === 'surge' ? 'magic' : 'draw', { anchor, size: 165, duration: 680 });
  }
}
