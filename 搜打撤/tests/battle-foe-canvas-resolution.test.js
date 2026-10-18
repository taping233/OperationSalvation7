import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ scale: 1, pace: 1, floats: [], queue: [], cleanup: [] }));
vi.mock('../game/src/battle/core/battle.core.js', () => ({ takeFloats: () => state.floats.splice(0) }));
vi.mock('../game/src/battle/view/battle.frames.js', () => ({ play: () => false }));
vi.mock('../game/src/battle/runtime/battle.pace.js', () => ({ demoMs: ms => ms / state.pace, getPace: () => state.pace }));
vi.mock('../game/src/battle/runtime/battle.clock.js', () => ({
  schedulePresentation: (fn, ms) => state.cleanup.push({ fn, ms }),
  schedulePresentationMs: () => {}, waitHitStop: () => Promise.resolve(),
}));
vi.mock('../game/src/battle/view/battle.feedback.js', () => ({
  FEEDBACK_DELTA_MS: 100, enqueueFeedback: fn => state.queue.push(fn),
  feedbackClass: () => '', feedbackDelay: () => 0, feedbackShakeDuration: () => 100,
  waitMs: () => Promise.resolve(),
}));
vi.mock('../game/src/ui/ui-scale.js', () => ({
  // Match uiRect's viewport -> logical conversion, including nonzero overlay offsets.
  scale: () => state.scale,
  rect: el => Object.fromEntries(Object.entries(el.getBoundingClientRect()).map(([key, value]) => [key, value / state.scale])),
}));
const UI = { el: {} };
window.SDT = { UI, Motion: { reduceMotion: () => false }, Sound: { sfx: vi.fn() } };
const { spawnFloats } = await import('../game/src/battle/view/battle.vfx.js');
let ctx, animation;
beforeEach(() => {
  state.scale = 1; state.pace = 1; state.floats = []; state.queue = []; state.cleanup = [];
  document.body.innerHTML = '<div id="overlay"><div id="battleBody"><div id="btSelf"><div class="sts-figure"></div></div><div class="sts-foe" data-eidx="0"><div class="sts-figure"></div></div></div></div>';
  UI.el.overlay = document.getElementById('overlay');
  const rectangles = [[UI.el.overlay, 100, 40, 1920, 1080], [document.querySelector('.sts-foe .sts-figure'), 1300, 240, 200, 400], [document.querySelector('#btSelf .sts-figure'), 300, 340, 200, 400]];
  rectangles.forEach(([el, left, top, width, height]) => {
    el.getBoundingClientRect = () => ({ left: left * state.scale, top: top * state.scale, width: width * state.scale, height: height * state.scale });
  });
  ctx = Object.fromEntries(['setTransform', 'beginPath', 'moveTo', 'quadraticCurveTo', 'stroke', 'lineTo', 'closePath', 'fill'].map(name => [name, vi.fn()]));
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx);
  animation = {};
  Element.prototype.animate = vi.fn(function () { return this.tagName === 'CANVAS' ? animation : {}; });
});
afterEach(() => { delete Element.prototype.animate; vi.restoreAllMocks(); vi.unstubAllGlobals(); document.body.replaceChildren(); });
async function attack(scale, dpr) {
  state.scale = scale; vi.stubGlobal('devicePixelRatio', dpr);
  state.floats.push({ unit: 0, text: '', cls: 'lungefx' });
  spawnFloats(document.getElementById('battleBody'));
  await state.queue[0](new AbortController().signal);
  return document.querySelector('canvas.sts-attack-line');
}
it.each([[0.615, 1], [0.615, 2], [1, 1], [1, 2], [2, 1], [2, 2]])('uses displayed DPR pixels at zoom %s / DPR %s with logical geometry unchanged', async (scale, dpr) => {
  const canvas = await attack(scale, dpr);
  expect(canvas.width).toBe(Math.round(1920 * scale * dpr));
  expect(canvas.height).toBe(Math.round(1080 * scale * dpr));
  expect(canvas.style.width).toBe('1920px'); expect(canvas.style.height).toBe('1080px');
  expect(ctx.setTransform).toHaveBeenCalledWith(scale * dpr, 0, 0, scale * dpr, 0, 0);
  expect(ctx.moveTo.mock.calls).toEqual([[1270, 368], [1270, 368], [330, 468]]);
  expect(ctx.quadraticCurveTo.mock.calls).toEqual([[800, 372, 330, 468], [800, 372, 330, 468]]);
  const length = Math.hypot(-470, 96), ux = -470 / length, uy = 96 / length;
  expect(ctx.lineTo.mock.calls).toEqual([[330 - ux * 13 - uy * 6, 468 - uy * 13 + ux * 6], [330 - ux * 13 + uy * 6, 468 - uy * 13 - ux * 6]]);
  expect(ctx.lineWidth).toBe(3); expect(ctx.fillStyle).toBe('#ff6659');
});
it.each([1, 2])('preserves fade and fallback removal contracts at pace %s', async pace => {
  state.pace = pace;
  const canvas = await attack(0.615, 1);
  expect(canvas.animate).toHaveBeenCalledWith([{ opacity: 1 }, { opacity: 0 }], { duration: 420 / pace, easing: 'ease-out', fill: 'forwards' });
  const fallback = state.cleanup.find(entry => entry.ms === 580);
  expect(fallback).toBeDefined();
  animation.onfinish(); expect(canvas.isConnected).toBe(false);
  UI.el.overlay.appendChild(canvas);
  fallback.fn(); expect(canvas.isConnected).toBe(false);
});
