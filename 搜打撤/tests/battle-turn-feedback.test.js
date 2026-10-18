import { readFileSync } from 'node:fs';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
const timers = vi.hoisted(() => []);
vi.mock('../game/src/battle/runtime/battle.clock.js', () => ({ schedulePresentationMs: (fn, ms) => {
  const entry = { fn, ms, cancelled: false }; timers.push(entry); return () => { entry.cancelled = true; };
} }));
const { showTurnFeedback, clearTurnFeedback } = await import('../game/src/battle/view/battle.turn-feedback.js');
let stage, animations;
const event = (kind = 'player-turn-start', overrides = {}) => ({ kind, battleToken: 7, eventId: 1, turn: 2, ...overrides });
beforeEach(() => {
  document.body.innerHTML = '<div id="overlay"><div class="battle-stage"><span class="sts-energy">3</span><div class="bt-card" data-uid="new"></div><div class="bt-card" data-uid="old"></div></div></div>';
  document.body.dataset.renderQuality = 'balanced';
  window.SDT = { Motion: { reduceMotion: () => false }, Sound: { sfx: vi.fn() } };
  stage = document.querySelector('.battle-stage'); stage._battleToken = 7;
  animations = [];
  Element.prototype.animate = vi.fn(function (frames, options) { const a = { cancel: vi.fn(), frames, options, target: this }; animations.push(a); return a; });
  timers.length = 0;
});
afterEach(() => { clearTurnFeedback(); delete Element.prototype.animate; delete document.body.dataset.renderQuality; });
it('shows a large real-turn title without interaction locks and highlights only actual incoming cards', () => {
  showTurnFeedback(stage, [event(), { kind: 'draw', uid: 'new' }]);
  expect(document.querySelector('.bt-turn-title b').textContent).toBe('你的回合');
  expect(document.querySelector('.bt-turn-title small').textContent).toBe('第 2 回合');
  expect(animations.map(a => a.target.className)).toEqual(['bt-turnbanner bt-turn-title sdt-feedback-theme self','sts-energy','bt-card']);
  expect(animations[2].target.dataset.uid).toBe('new');
  expect(stage.inert).not.toBe(true);
  expect(timers[0].ms).toBe(1450);
});
it('render and restore without events never synthesize a banner, stale tokens and repeated IDs do not replay', () => {
  showTurnFeedback(stage); expect(document.querySelector('.bt-turn-title')).toBeNull();
  showTurnFeedback(stage, [event('player-turn-start', { battleToken: 6 })]); expect(animations).toHaveLength(0);
  showTurnFeedback(stage, [event()]); const count = animations.length;
  showTurnFeedback(stage, [event()]); expect(animations).toHaveLength(count);
});
it('rapid enemy/player/extra starts replace the one banner, cancel old cleanup and never invent a count', () => {
  showTurnFeedback(stage, [event('enemy-turn-start')]);
  expect(document.querySelector('.bt-turn-title b').textContent).toBe('敌方回合');
  showTurnFeedback(stage, [event('extra-turn-start', { eventId: 2, turn: 3 })]);
  expect(document.querySelectorAll('.bt-turn-title')).toHaveLength(1);
  expect(document.querySelector('.bt-turn-title').textContent).toBe('第 3 回合额外回合');
  expect(timers[0].cancelled).toBe(true); expect(animations[0].cancel).toHaveBeenCalled();
  expect(window.SDT.Sound.sfx).toHaveBeenCalledTimes(1);
});
it.each(['low', 'reduce'])('%s keeps readable semantics and omits decorative movement', mode => {
  if (mode === 'low') document.body.dataset.renderQuality = 'low'; else window.SDT.Motion.reduceMotion = () => true;
  showTurnFeedback(stage, [event()]); expect(document.querySelector('.bt-turn-title').dataset.reducedMotion).toBe('true'); expect(animations).toHaveLength(0);
});
it('defers initial event until existing readiness, without starting a new readiness wait', async () => {
  stage.dataset.battleEntry = 'loading'; showTurnFeedback(stage, [event()]);
  expect(document.querySelector('.bt-turn-title')).toBeNull(); expect(timers).toHaveLength(0);
  stage.dataset.battleEntry = 'ready'; await Promise.resolve();
  expect(document.querySelector('.bt-turn-title b').textContent).toBe('你的回合');
  showTurnFeedback(stage, [event()]); expect(document.querySelectorAll('.bt-turn-title')).toHaveLength(1);
});
it.each(['close','mode','hidden','detach'])('%s cleans all presentation and scheduled callbacks', async action => {
  showTurnFeedback(stage, [event()]);
  if (action === 'close') document.dispatchEvent(new CustomEvent('sdt-overlay-close'));
  if (action === 'mode') document.dispatchEvent(new CustomEvent('sdt-overlay-mode', { detail: 'bag' }));
  if (action === 'hidden') document.querySelector('#overlay').hidden = true;
  if (action === 'detach') stage.remove();
  await Promise.resolve(); expect(document.querySelector('.bt-turn-title')).toBeNull();
  expect(timers[0].cancelled).toBe(true); expect(animations[0].cancel).toHaveBeenCalled();
});

it('keeps title styling positioned, readable and above card feedback without hit testing', () => {
  const css = readFileSync('game/css/feedback-theme.css','utf8');
  expect(css).toMatch(/\.bt-turn-title \{[^}]*position:absolute;[^}]*z-index:86;[^}]*pointer-events:none/);
  expect(css).toMatch(/\.sdt-feedback-theme b \{[^}]*animation:none;[^}]*font-size:54px/);
  expect(css).toContain('font-size:20px');
  expect(css).toContain('--feedback-ink:#eef1ed');
});
