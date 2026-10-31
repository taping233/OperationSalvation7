import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const schedule = vi.hoisted(() => vi.fn());
const cardResults = vi.hoisted(() => vi.fn());
vi.mock('../game/src/battle/runtime/battle.clock.js', () => ({ schedulePresentationMs: schedule }));
vi.mock('../game/src/battle/view/battle.frames.js', () => ({ play: vi.fn() }));
vi.mock('../game/src/battle/view/battle.card-results.js', () => ({ showBattleCardResults: cardResults }));
vi.mock('../game/src/battle/view/battle.effect-feedback.js', () => ({ showBattleEffectFeedback: vi.fn() }));
vi.mock('../game/src/battle/view/battle.turn-feedback.js', () => ({ showTurnFeedback: vi.fn() }));
vi.mock('../game/src/ui/ui-scale.js', () => ({ rect: () => ({ left: 0, top: 0, width: 1920, height: 1080 }) }));
const UI = { el: {} };
window.SDT = { UI, Sound: { sfx: vi.fn() } };
const { animateBattleTransition } = await import('../game/src/battle/view/battle.anim.view.js');
beforeEach(() => {
  vi.clearAllMocks();
  document.body.innerHTML = '<div id="overlay"><div id="body"><div class="battle-stage" data-phase="player"><div class="sts-hand"></div><div class="sts-hud-l"><div class="bt-pile"></div></div></div></div></div>';
  UI.el.overlay = document.querySelector('#overlay');
});
afterEach(() => { document.body.replaceChildren(); vi.restoreAllMocks(); });
it('forwards draw and shuffle events to current card feedback without dormant pile timers or observers', () => {
  const observe = vi.spyOn(MutationObserver.prototype, 'observe');
  const body = document.querySelector('#body');
  const events = [{ kind: 'draw', uid: 'new' }, { kind: 'shuffle', uid: 'stored' }];
  expect(animateBattleTransition(null, body, events)).toEqual({ flightMs: 0 });
  expect(cardResults).toHaveBeenCalledExactlyOnceWith(body.querySelector('.battle-stage'), events);
  expect(schedule).not.toHaveBeenCalled();
  // The current effect presenter watches its overlay owner for close/replacement.
  // No observer attaches to a pile or its subtree.
  expect(observe).toHaveBeenCalledExactlyOnceWith(UI.el.overlay, {
    childList: true, subtree: true, attributes: true, attributeFilter: ['hidden'],
  });
  expect(observe.mock.calls.every(([target]) => !target.closest('.bt-pile'))).toBe(true);
});
