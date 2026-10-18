import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const timers = vi.hoisted(() => []);
vi.mock('../game/src/battle/runtime/battle.clock.js', () => ({
  schedulePresentationMs: (callback, ms) => {
    const entry = { callback, ms, cancelled: false }; timers.push(entry);
    return () => { entry.cancelled = true; };
  },
}));
vi.mock('../game/src/battle/view/battle.frames.js', () => ({ play: vi.fn() }));
vi.mock('../game/src/battle/view/battle.card-results.js', () => ({ showBattleCardResults: vi.fn() }));
vi.mock('../game/src/battle/view/battle.effect-feedback.js', () => ({ retainBattleFeedback: vi.fn(), showBattleEffectFeedback: vi.fn() }));
vi.mock('../game/src/ui/ui-scale.js', () => ({ rect: () => ({ left: 0, top: 0, width: 1920, height: 1080 }) }));
const UI = { el: {} };
window.SDT = { UI, Sound: { sfx: vi.fn() } };
const { animateBattleTransition } = await import('../game/src/battle/view/battle.anim.view.js');
let body, pile;
const draw = () => animateBattleTransition(null, body, [{ kind: 'draw', uid: 'new' }]);
const shuffle = () => animateBattleTransition(null, body, [{ kind: 'shuffle' }]);
beforeEach(() => {
  document.dispatchEvent(new CustomEvent('sdt-overlay-close'));
  timers.length = 0;
  document.body.innerHTML = '<div id="overlay"><div id="body"><div class="battle-stage"><div class="sts-hand"></div><div class="sts-hud-l"><div class="bt-pile"></div></div></div></div></div>';
  body = document.querySelector('#body'); pile = body.querySelector('.bt-pile');
  UI.el.overlay = document.querySelector('#overlay');
  Element.prototype.animate = vi.fn(() => ({ cancel: vi.fn() }));
});
afterEach(() => {
  document.dispatchEvent(new CustomEvent('sdt-overlay-close'));
  delete Element.prototype.animate;
});
it('cancels the earlier draw cleanup and keeps the full 1600ms replay', () => {
  draw(); draw();
  expect(timers.map(t => t.ms)).toEqual([1600, 1600]);
  expect(timers[0].cancelled).toBe(true);
  // Even a callback already queued before cancellation cannot clear the replay.
  timers[0].callback(); expect(pile.classList.contains('pile-pulse')).toBe(true);
  timers[1].callback(); expect(pile.classList.contains('pile-pulse')).toBe(false);
});
it('keeps draw and shuffle lifecycles independent without the old blocking shuffle flight', () => {
  draw(); shuffle(); draw();
  expect(timers.map(t => t.ms)).toEqual([1600, 900, 1600]);
  expect(timers[0].cancelled).toBe(true);
  expect(timers[1].cancelled).toBe(false);
  timers[2].callback();
  expect(pile.classList.contains('pile-pulse')).toBe(false);
  expect(pile.classList.contains('pile-shuffle')).toBe(true);
  timers[1].callback(); expect(pile.classList.contains('pile-shuffle')).toBe(false);
});
it.each(['close', 'mode', 'hidden', 'detach', 'replace'])('cancels pending cleanup on %s', async reason => {
  draw();
  if (reason === 'close') document.dispatchEvent(new CustomEvent('sdt-overlay-close'));
  if (reason === 'mode') document.dispatchEvent(new CustomEvent('sdt-overlay-mode', { detail: 'reward' }));
  if (reason === 'hidden') UI.el.overlay.hidden = true;
  if (reason === 'detach') pile.remove();
  if (reason === 'replace') pile.replaceWith(document.createElement('div'));
  await Promise.resolve();
  expect(timers[0].cancelled).toBe(true);
  expect(pile.classList.contains('pile-pulse')).toBe(false);
});
it('keeps active effects when staying in battle and allows a fresh cycle after expiry', () => {
  draw(); document.dispatchEvent(new CustomEvent('sdt-overlay-mode', { detail: 'battle' }));
  expect(timers[0].cancelled).toBe(false);
  timers[0].callback(); draw();
  expect(pile.classList.contains('pile-pulse')).toBe(true);
  timers[1].callback(); expect(pile.classList.contains('pile-pulse')).toBe(false);
});
it('releases its observer after expiry and does not affect a replacement pile', async () => {
  const disconnect = vi.spyOn(MutationObserver.prototype, 'disconnect');
  draw(); timers[0].callback();
  expect(disconnect).toHaveBeenCalledTimes(1);
  draw();
  const oldPile = pile;
  pile = pile.cloneNode(false); oldPile.replaceWith(pile);
  draw(); await Promise.resolve();
  expect(timers[1].cancelled).toBe(true);
  expect(timers[2].cancelled).toBe(false);
  timers[1].callback(); expect(pile.classList.contains('pile-pulse')).toBe(true);
  timers[2].callback();
  expect(disconnect).toHaveBeenCalledTimes(3);
  disconnect.mockRestore();
});
