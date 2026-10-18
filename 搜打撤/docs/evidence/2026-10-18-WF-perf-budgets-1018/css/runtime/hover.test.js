// @vitest-environment jsdom
import { expect, it, vi } from 'vitest';
import { writeFileSync } from 'node:fs';
const state = vi.hoisted(() => ({ snapshot: null, card: null }));
const commands = vi.hoisted(() => ({ getCardPlayAvailability: vi.fn(), submitCardPlay: vi.fn() }));
vi.mock('../../../../../game/src/battle/core/battle.core.js', () => ({
  commands, getSnapshot: vi.fn(() => state.snapshot),
  getBattleLiveness: () => ({ battleToken: 1, phase: 'player' }),
  findEffectiveCard: () => ({ card: state.card }), infuseOf: () => 0, targetSide: () => 'enemy', Combat: {},
  getPreviewContext: () => ({ card: state.card, legal: true, effectiveCost: 1, targetIndexes: [0,1,2,3], modifiers: {} }),
}));
vi.mock('../../../../../game/src/ui/ui-scale.js', () => ({ scale: () => 1, viewport: () => ({ width: 1920, height: 1080 }) }));
const UI = { el: {} };
window.SDT = { UI, Sound: { sfx: vi.fn() }, Motion: { reduceMotion: () => false } };
const Aim = await import('../../../../../game/src/battle/view/battle.aim.js');
const { getSnapshot } = await import('../../../../../game/src/battle/core/battle.core.js');

it('measures actual AOE hover, preserves all previews, and reads new state on re-entry', () => {
  const frames = new Map(); let clock = 0, id = 0;
  vi.stubGlobal('requestAnimationFrame', callback => { frames.set(++id, callback); return id; });
  vi.stubGlobal('cancelAnimationFrame', frame => frames.delete(frame));
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(new Proxy({}, { get: () => () => {} }));
  document.body.innerHTML = `<div id="overlay"><div id="body"><div class="battle-stage"><div class="sts-hand"><div class="bt-slot"><div class="bt-card" data-uid="area"></div></div></div>${[0,1,2,3].map(i => `<div class="bt-foe" data-eidx="${i}"></div>`).join('')}<div class="sts-hud"></div><div class="field"></div></div></div></div>`;
  UI.el = { overlay: document.getElementById('overlay'), ovBody: document.getElementById('body') };
  const card = document.querySelector('.bt-card'), field = document.querySelector('.field');
  card.getBoundingClientRect = () => ({ left: 200, top: 800, width: 220, height: 300 });
  UI.el.overlay.getBoundingClientRect = () => ({ left: 0, top: 0, width: 1920, height: 1080 });
  UI.el.overlay.setPointerCapture = () => {}; UI.el.overlay.hasPointerCapture = () => true; UI.el.overlay.releasePointerCapture = () => {};
  document.elementFromPoint = () => field;
  state.card = { id: 'audit-area', name: '群体预览审计', cost: 1, type: '法术', desc: '', side: 'enemy', rules: { battle: { target: { area: true } } } };
  state.snapshot = { battleToken: 1, phase: 'player', energy: 3, hand: ['area'], foes: [0,1,2,3].map(i => ({ id: `foe-${i}`, name: `敌人${i}`, hp: 20, dead: false })) };
  commands.getCardPlayAvailability.mockImplementation(() => state.snapshot.energy ? { status: 'ready' } : { status: 'rejected', reason: { message: '能量不足' } });
  const pointer = (type, x, y) => { const event = new MouseEvent(type, { clientX: x, clientY: y, button: 0, bubbles: true, cancelable: true }); Object.defineProperty(event, 'pointerId', { value: 1 }); return event; };
  const step = () => { clock += 16; const pending = [...frames.values()]; frames.clear(); pending.forEach(callback => callback(clock)); };
  Aim.startAim(pointer('pointerdown', 320, 950), card);
  getSnapshot.mockClear();
  window.dispatchEvent(pointer('pointermove', 800, 700)); step();
  const firstCalls = getSnapshot.mock.calls.length;
  const initial = [...document.querySelectorAll('.bt-fpreview')].map(node => node.outerHTML);
  expect(initial).toHaveLength(4); expect(commands.submitCardPlay).not.toHaveBeenCalled();
  // The same hovering frame has no new hover transition; this is not a per-frame snapshot poll.
  getSnapshot.mockClear(); step(); expect(getSnapshot).not.toHaveBeenCalled();
  document.elementFromPoint = () => document.querySelector('.sts-hud'); step();
  expect(document.querySelector('.bt-fpreview')).toBeNull();
  state.snapshot.energy = 0; state.snapshot.foes[1].dead = true;
  document.elementFromPoint = () => field; getSnapshot.mockClear(); step();
  const reentryCalls = getSnapshot.mock.calls.length;
  const refreshed = [...document.querySelectorAll('.bt-fpreview')].map(node => node.outerHTML);
  expect(refreshed).toHaveLength(3); expect(refreshed.every(html => html.includes('能量不足'))).toBe(true);
  const variant = process.env.SDT_HOVER_EXPERIMENT || 'baseline';
  expect([firstCalls, reentryCalls]).toEqual(variant === 'shared' ? [1,1] : [8,7]);
  const report = { variant, firstCalls, reentryCalls, stableHoverFrameCalls: 0, initial, refreshed, submitted: commands.submitCardPlay.mock.calls.length };
  writeFileSync(`${process.cwd()}/docs/evidence/2026-10-18-WF-perf-budgets-1018/css/runtime/${variant}.json`, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify({ variant, firstCalls, reentryCalls, initialPreviews: initial.length, refreshedPreviews: refreshed.length }));
  Aim.cancelAim(); for (let i = 0; i < 100 && frames.size; i++) step();
  expect(document.querySelector('.bt-fpreview')).toBeNull();
  vi.restoreAllMocks(); vi.unstubAllGlobals();
});
