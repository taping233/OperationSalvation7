import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ snapshot: null, reads: 0 }));
const hit = vi.hoisted(() => ({ sync: vi.fn(), reset: vi.fn(), dispose: vi.fn() }));
const selection = vi.hoisted(() => ({ sync: vi.fn() }));
vi.mock('../game/src/battle/core/battle.core.js', () => ({
  commands: {}, getSnapshot: () => { state.reads++; return state.snapshot; },
  getBattleLiveness: () => ({}), findEffectiveCard: () => null,
  effCostOf: () => 0, targetSide: () => null, infuseOf: () => 0,
  unplayableReason: () => '', infusionFuelReason: () => '',
  AFFIX_META: {}, Combat: {}, aegisBlocked: () => false, handCurseSpecs: () => [],
}));
vi.mock('../game/src/battle/view/battle.hand-hit.js', () => ({ createHandHitController: () => hit }));
vi.mock('../game/src/battle/view/battle.selection-ui.js', () => ({ syncSelectionPrompt: selection.sync, cancelSelection: () => false }));
vi.mock('../game/src/battle/view/battle.hover.js', () => ({ showFoePreview() {}, clearFoePreview() {}, showThoughtBubble() {}, clearThoughtBubble() {} }));
vi.mock('../game/src/battle/view/battle.anim.view.js', () => ({ animateSafe() {} }));
vi.mock('../game/src/battle/view/battle.preview.js', () => ({ cardRuleHint: () => '' }));
vi.mock('../game/src/battle/view/battle.effect-feedback.js', () => ({ updateHandAcquisitionFeedback() {} }));
const UI = { el: {}, hideTooltip() {} };
window.SDT = { UI, Icons: { img: () => '', rich: text => text }, Motion: { reduceMotion: () => true } };
const { mountHandLayer, mountUnitLayer, updateHand } = await import('../game/src/battle/view/battle.layers.js');
const { updateClickSelectionUI } = await import('../game/src/battle/view/battle.aim.js');
let token = 0;
function owner() {
  const body = UI.el.ovBody;
  body.innerHTML = '<div class="battle-stage sts"><div class="sts-arena"><div data-unit-mount="self"></div><div class="sts-allies" data-unit-mount="allies"></div><div class="sts-foes" data-unit-mount="foes"></div></div><div class="sts-hud"><div class="sts-hand-tools"><button>skill</button></div><div class="bt-hand sts-hand"></div></div></div>';
  const stage = body.firstElementChild;
  stage._battleToken = ++token;
  return { body, token, stage, arena: stage.querySelector('.sts-arena'), hud: stage.querySelector('.sts-hud'),
    self: stage.querySelector('[data-unit-mount="self"]'), allies: stage.querySelector('[data-unit-mount="allies"]'),
    foes: stage.querySelector('[data-unit-mount="foes"]'), tools: stage.querySelector('.sts-hand-tools'), hand: stage.querySelector('.sts-hand') };
}
function mount(mounts) {
  const unitMounts = mountUnitLayer(mounts.body, mounts.token, mounts);
  const hand = mountHandLayer(mounts.body, '', mounts.token, () => {}, mounts);
  return { unitMounts, hand };
}
beforeEach(() => {
  vi.clearAllMocks(); state.reads = 0;
  document.body.innerHTML = '<div id="overlay"><div id="ovBody"></div></div>';
  UI.el = { overlay: document.getElementById('overlay'), ovBody: document.getElementById('ovBody') };
  state.snapshot = { battleToken: token, hand: [], drawPile: [], mode: 'normal' };
});
afterEach(() => { vi.restoreAllMocks(); });

it('validates cached mounts without any body-wide mount queries on warm updates', () => {
  const mounts = owner(); mount(mounts);
  const kept = { self: mounts.self, hand: mounts.hand, tools: mounts.tools, allies: mounts.allies, foes: mounts.foes };
  const query = vi.spyOn(mounts.body, 'querySelector');
  for (let i = 0; i < 20; i++) mount(mounts);
  expect(query).not.toHaveBeenCalled();
  for (const [key, node] of Object.entries(kept)) expect(mounts[key]).toBe(node);
  expect(mounts.tools.parentElement).toBe(mounts.self.querySelector('.sts-unit-actions'));
  expect(mounts.self.parentElement).toBe(mounts.arena);
  expect(mounts.hand.parentElement).toBe(mounts.hud);
});

it('keeps focus, temporary classes and independent mount calls on the same stage', () => {
  const mounts = owner(); mount(mounts);
  const focused = document.createElement('button'); mounts.hand.appendChild(focused); focused.focus();
  mounts.hand.classList.add('fx-hand'); mounts.self.classList.add('fx-hit');
  mount(mounts);
  expect(document.activeElement).toBe(focused);
  expect(mounts.hand.classList.contains('fx-hand')).toBe(true);
  expect(mounts.self.classList.contains('fx-hit')).toBe(true);
  expect(mountUnitLayer(mounts.body, mounts.token)?.foesMount).toBe(mounts.foes);
  expect(mountHandLayer(mounts.body, '', mounts.token)).toBe(mounts.hand);
});

it('preserves and repairs hand group semantics without unchanged attribute writes', () => {
  const mounts = owner(); mount(mounts);
  const hand = mounts.hand;
  expect(hand.getAttribute('role')).toBe('group');
  expect(hand.getAttribute('aria-label')).toBe('当前手牌');
  const writes = vi.spyOn(hand, 'setAttribute');
  for (let i = 0; i < 10; i++) mount(mounts);
  expect(writes).not.toHaveBeenCalled();
  hand.setAttribute('role', 'presentation'); hand.removeAttribute('aria-label'); writes.mockClear();
  mount(mounts);
  expect(mounts.hand).toBe(hand);
  expect(hand.getAttribute('role')).toBe('group');
  expect(hand.getAttribute('aria-label')).toBe('当前手牌');
  expect(writes.mock.calls).toEqual([['role', 'group'], ['aria-label', '当前手牌']]);
});

it('repairs removed and replaced mounts instead of freezing cached layers', () => {
  const mounts = owner(); mount(mounts);
  const kept = { self: mounts.self, hand: mounts.hand, tools: mounts.tools };
  mounts.self.remove(); mounts.hand.remove(); mounts.tools.remove(); mounts.allies.remove();
  const foes = document.createElement('div'); foes.dataset.unitMount = 'foes'; foes.className = 'sts-foes';
  mounts.foes.replaceWith(foes);
  mount(mounts);
  expect(mounts.foes).toBe(foes); expect(mounts.allies.parentElement).toBe(mounts.arena);
  for (const [key, node] of Object.entries(kept)) { expect(mounts[key]).toBe(node); expect(node.isConnected).toBe(true); }
  expect(mounts.tools.parentElement).toBe(mounts.self.querySelector('.sts-unit-actions'));
  const replacement = document.createElement('div'); replacement.className = 'bt-hand sts-hand';
  mounts.hand.replaceWith(replacement); mount(mounts);
  expect(mounts.hand).toBe(kept.hand); expect(replacement.isConnected).toBe(false);
});

it('recovers arena and HUD identity after external subtree replacement', () => {
  const mounts = owner(); mount(mounts);
  const originalSelf = mounts.self, originalHand = mounts.hand;
  const arena = document.createElement('div'); arena.className = 'sts-arena'; mounts.arena.replaceWith(arena);
  const hud = document.createElement('div'); hud.className = 'sts-hud'; mounts.hud.replaceWith(hud);
  mount(mounts);
  expect(mounts.arena).toBe(arena); expect(mounts.hud).toBe(hud);
  expect(mounts.self).toBe(originalSelf); expect(mounts.hand).toBe(originalHand);
  expect(mounts.self.parentElement).toBe(arena); expect(mounts.hand.parentElement).toBe(hud);
});

it('repairs controlled mount classes and identities in place without duplicate subtrees', () => {
  const mounts = owner(); mount(mounts);
  const kept = Object.fromEntries(['arena', 'hud', 'self', 'allies', 'foes', 'hand', 'tools'].map(key => [key, mounts[key]]));
  mounts.arena.className = 'fx-arena'; mounts.hud.className = 'fx-hud';
  mounts.self.id = 'broken-id'; mounts.self.className = 'fx-hit';
  mounts.allies.className = ''; mounts.allies.dataset.unitMount = 'wrong';
  mounts.foes.className = ''; mounts.foes.removeAttribute('data-unit-mount');
  mounts.hand.className = 'fx-hand'; mounts.tools.className = 'fx-tools';
  mount(mounts);
  for (const [key, node] of Object.entries(kept)) expect(mounts[key]).toBe(node);
  expect(mounts.stage.querySelectorAll('.sts-arena')).toHaveLength(1);
  expect(mounts.stage.querySelectorAll('.sts-hud')).toHaveLength(1);
  expect(mounts.stage.querySelectorAll('#btSelf')).toHaveLength(1);
  expect(mounts.stage.querySelectorAll('[data-unit-mount="allies"]')).toHaveLength(1);
  expect(mounts.stage.querySelectorAll('[data-unit-mount="foes"]')).toHaveLength(1);
  expect(mounts.stage.querySelectorAll('.sts-hand')).toHaveLength(1);
  expect(mounts.stage.querySelectorAll('.sts-hand-tools')).toHaveLength(1);
  expect(mounts.self.classList.contains('fx-hit')).toBe(true);
  expect(mounts.hand.classList.contains('fx-hand')).toBe(true);
  expect(mounts.tools.classList.contains('fx-tools')).toBe(true);
});

it('rejects stale stage, token and body owners without moving retained nodes', () => {
  const old = owner(); mount(old);
  const next = owner(); const query = vi.spyOn(next.body, 'querySelector');
  expect(mountUnitLayer(next.body, next.token, old)).toBeNull();
  expect(mountHandLayer(next.body, '', next.token, null, old)).toBeNull();
  expect(query).not.toHaveBeenCalled(); expect(next.self.parentElement).toBe(next.arena);
  mount(next); expect(next.self).not.toBe(old.self); expect(next.hand.children).toHaveLength(0);
  const disconnectedBody = document.createElement('div');
  expect(mountUnitLayer(disconnectedBody, next.token, next)).toBeNull();
  next.stage._battleToken = 'replaced'; expect(mountUnitLayer(next.body, next.token, next)).toBeNull();
});

it('uses explicit live interaction state rather than masked presentation and keeps fallback fresh', () => {
  const mounts = owner(); mount(mounts);
  const presentation = { battleToken: mounts.token, hand: [], drawPile: [], choosing: null, mode: 'normal' };
  const live = { ...presentation, choosing: { options: ['choice'] } };
  state.snapshot = live;
  updateHand(presentation, null, [], [], { mode: 'normal', liveInteractionSnapshot: live });
  expect(hit.sync).toHaveBeenLastCalledWith(mounts.token, live); expect(state.reads).toBe(0);
  state.snapshot = { ...live, choosing: null, infusing: { need: 1 } };
  updateHand(presentation, null, [], [], { mode: 'normal' });
  expect(hit.sync).toHaveBeenLastCalledWith(mounts.token, state.snapshot); expect(state.reads).toBe(1);
});

it('reuses only the selection sync input while later cancellation reads current state', () => {
  const mounts = owner(); mount(mounts);
  const first = { battleToken: mounts.token, phase: 'player' };
  updateClickSelectionUI(first);
  expect(selection.sync.mock.lastCall[1]).toBe(first); expect(state.reads).toBe(0);
  const current = { ...first, busy: true }; state.snapshot = current;
  expect(selection.sync.mock.lastCall[2].getCurrent().snapshot).toBe(current); expect(state.reads).toBe(1);
  updateClickSelectionUI(); expect(selection.sync.mock.lastCall[1]).toBe(current); expect(state.reads).toBe(2);
});
