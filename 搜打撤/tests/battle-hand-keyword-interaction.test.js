import { afterEach, beforeEach, expect, it, vi } from 'vitest';

// Keep the rendered card, permanent hand-slot listener, aim controller and
// document tooltip delegation real. Only battle commands and layout are ports.
const state = vi.hoisted(() => ({ snap: null, card: null }));
const commands = vi.hoisted(() => ({
  getCardPlayAvailability: vi.fn(() => ({ status: 'ready' })),
  submitCardPlay: vi.fn(() => ({ status: 'needs-input' })),
  bagSlam: vi.fn(), slamSkill: vi.fn(), resolveSlam: vi.fn(), resolveDart: vi.fn(),
  useItem: vi.fn(), cancelPendingTarget: vi.fn(), selectInfusion: vi.fn(), cancelInfusion: vi.fn(),
}));
vi.mock('../game/src/battle/core/battle.core.js', () => ({
  commands, getSnapshot: () => state.snap,
  getBattleLiveness: () => ({ battleToken: state.snap.battleToken, phase: state.snap.phase }),
  findEffectiveCard: uid => state.snap.hand.includes(uid) ? { card: state.card } : null,
  effCostOf: card => card.cost, targetSide: card => card.side,
  infuseOf: card => card.infuse || 0, unplayableReason: () => '', infusionFuelReason: () => '',
  AFFIX_META: {}, Combat: {}, aegisBlocked: () => false, handCurseSpecs: () => [],
}));
vi.mock('../game/src/ui/ui-scale.js', () => ({
  BASE_W: 1920, BASE_H: 1080, scale: () => 1,
  viewport: () => ({ width: 1920, height: 1080 }), rect: el => el.getBoundingClientRect(),
}));
vi.mock('../game/src/battle/view/battle.hover.js', () => ({
  showFoePreview: vi.fn(), clearFoePreview: vi.fn(), showThoughtBubble: vi.fn(), clearThoughtBubble: vi.fn(),
}));
vi.mock('../game/src/battle/view/battle.anim.view.js', () => ({ animateSafe: vi.fn() }));
vi.mock('../game/src/battle/view/battle.preview.js', () => ({ cardRuleHint: () => '' }));

const UI = { el: {}, hideTooltip: vi.fn(), log: vi.fn() };
window.SDT = {
  UI, Sound: { sfx: vi.fn() }, Motion: { reduceMotion: () => true },
  Icons: { img: () => '', rich: text => text, TYPE_ART: {} },
};
await import('../game/src/cards/cards.js'); // Real cardHTML -> descRich -> data-term.
const { mountHandLayer, updateHand } = await import('../game/src/battle/view/battle.layers.js');
const Aim = await import('../game/src/battle/view/battle.aim.js');
const { BATTLE_PHASES } = await import('../game/src/battle/runtime/battle.state.js');

let card, foe, frames, clock, token = 0;
const term = () => card.querySelector('[data-term="poison"]');
const tip = () => document.querySelector('.term-tip');
function pointer(target, type, { x = 320, y = 950, id = 1, pointerType = 'touch' } = {}) {
  const event = new MouseEvent(type, { clientX: x, clientY: y, button: 0, bubbles: true, cancelable: true });
  Object.defineProperties(event, { pointerId: { value: id }, pointerType: { value: pointerType }, isPrimary: { value: true } });
  target.dispatchEvent(event);
  return event;
}
function step() {
  clock += 16;
  const ready = [...frames.values()]; frames.clear(); ready.forEach(callback => callback(clock));
}
function renderHand(uids = state.snap.hand) {
  updateHand(state.snap, null, [{ key: 'keyword-card', card: state.card, uids }], [], {});
  card = document.querySelector('.bt-card');
  card.getBoundingClientRect = () => ({ left: 200, top: 800, width: 220, height: 300, right: 420, bottom: 1100 });
  // jsdom does not reflect inert; use the browser property/attribute contract so
  // startAim's real inert write reaches term-tips.isLive's real [inert] check.
  Object.defineProperty(card, 'inert', {
    configurable: true, get() { return this.hasAttribute('inert'); },
    set(value) { this.toggleAttribute('inert', !!value); },
  });
}
beforeEach(() => {
  vi.clearAllMocks(); frames = new Map(); clock = 0;
  let frameId = 0;
  vi.stubGlobal('requestAnimationFrame', callback => { frames.set(++frameId, callback); return frameId; });
  vi.stubGlobal('cancelAnimationFrame', id => frames.delete(id));
  vi.spyOn(performance, 'now').mockImplementation(() => clock);
  vi.spyOn(Element.prototype, 'getClientRects').mockReturnValue([{ x: 200, y: 900, width: 80, height: 20 }]);
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(new Proxy({}, { get: () => () => {} }));
  document.body.innerHTML = '<div id="overlay"><div id="body"><div class="battle-stage"><div class="sts-hud"><div class="sts-hand"></div></div><div class="bt-foe" data-eidx="0"><div class="sts-figure"></div></div><div id="btSelf"></div><div class="field"></div></div></div></div>';
  UI.el = { overlay: document.getElementById('overlay'), ovBody: document.getElementById('body') };
  UI.el.overlay.getBoundingClientRect = () => ({ left: 0, top: 0, width: 1920, height: 1080 });
  UI.el.overlay.setPointerCapture = vi.fn(); UI.el.overlay.hasPointerCapture = () => true;
  UI.el.overlay.releasePointerCapture = vi.fn();
  foe = document.querySelector('.bt-foe');
  document.elementFromPoint = vi.fn((x, y) => x >= 1100 && y <= 650 ? foe : document.querySelector('.field'));
  state.card = { id: 'keyword-card', name: '词条测试牌', type: '法术', rarity: '普通', cost: 1, side: 'enemy', desc: '施加 1 层中毒。' };
  state.snap = { battleToken: `keyword-battle-${++token}`, phase: BATTLE_PHASES.PLAYER, energy: 3,
    hand: ['keyword-card'], foes: [{ hp: 20, dead: false }] };
  mountHandLayer(UI.el.ovBody, '', state.snap.battleToken);
  renderHand();
});
afterEach(() => {
  document.dispatchEvent(new CustomEvent('sdt-overlay-close'));
  Aim.cancelAim(); Aim.cancelClickSelection();
  for (let i = 0; frames.size && i < 200; i++) step();
  window.dispatchEvent(new Event('blur'));
  vi.restoreAllMocks(); vi.unstubAllGlobals();
});

it.each(['term', 'nested child'])('holds the %s explanation without aiming or submitting, then hides on release', route => {
  const keyword = term();
  expect(keyword).not.toBeNull();
  if (route === 'nested child') keyword.innerHTML = '<span>中毒</span>';
  const target = route === 'nested child' ? keyword.firstElementChild : keyword;
  pointer(target, 'pointerdown');
  expect(Aim.aim).toBeNull(); expect(card.inert).toBe(false);
  expect(tip()?.hidden).toBe(false); expect(tip().textContent).toContain('中毒');
  expect(UI.el.overlay.setPointerCapture).not.toHaveBeenCalled();
  for (let i = 0; i < 4; i++) step();
  expect(tip().hidden).toBe(false); expect(Aim.aim).toBeNull();
  // Leaving the hand over a valid enemy must still remain a reading gesture.
  pointer(foe, 'pointermove', { x: 1200, y: 450 });
  pointer(foe, 'pointerup', { x: 1200, y: 450 });
  expect(tip().hidden).toBe(true); expect(Aim.aim).toBeNull();
  const delegatedClick = vi.fn(); UI.el.ovBody.addEventListener('click', delegatedClick);
  const click = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0, detail: 1 });
  target.dispatchEvent(click);
  expect(click.defaultPrevented).toBe(true); expect(delegatedClick).not.toHaveBeenCalled();
  expect(commands.submitCardPlay).not.toHaveBeenCalled();
});

it('ends a keyword press on pointercancel and permits the next real card drag', () => {
  pointer(term(), 'pointerdown', { id: 7 });
  expect(tip()?.hidden).toBe(false);
  pointer(document, 'pointercancel', { id: 8 });
  expect(tip().hidden).toBe(false);
  pointer(document, 'pointercancel', { id: 7 });
  expect(tip().hidden).toBe(true); expect(Aim.aim).toBeNull();
  pointer(card.querySelector('.hsc-name'), 'pointerdown', { id: 9 });
  expect(Aim.aim?.pointerId).toBe(9); expect(card.inert).toBe(true);
  pointer(document, 'pointercancel', { id: 9 });
  expect(Aim.aim).toBeNull(); expect(commands.submitCardPlay).not.toHaveBeenCalled();
});

it.each(['face', 'slot bridge', 'dynamic action tip'])('keeps %s drag and intentional target release working', route => {
  let target = route === 'slot bridge' ? card.closest('.bt-slot') : card.querySelector('.hsc-name');
  if (route === 'dynamic action tip') {
    target.setAttribute('data-ui-tip', ''); target.setAttribute('data-ui-tip-text', '拖动出牌');
  }
  pointer(target, 'pointerdown');
  expect(Aim.aim?.uid).toBe('keyword-card'); expect(card.inert).toBe(true);
  expect(UI.el.overlay.setPointerCapture).toHaveBeenCalledWith(1);
  pointer(foe, 'pointermove', { x: 1200, y: 450 });
  pointer(foe, 'pointerup', { x: 1200, y: 450 });
  expect(commands.submitCardPlay).toHaveBeenCalledExactlyOnceWith('keyword-card', 0, false);
  expect(Aim.aim).toBeNull();
});

it('keeps pointerover and keyboard focus explanations readable without selecting a card', () => {
  const keyword = term();
  pointer(keyword, 'pointerover', { pointerType: 'mouse' });
  expect(tip()?.hidden).toBe(false); expect(Aim.aim).toBeNull();
  pointer(keyword, 'pointerout', { pointerType: 'mouse' });
  expect(tip().hidden).toBe(true);
  keyword.tabIndex = 0; keyword.focus();
  expect(tip().hidden).toBe(false);
  keyword.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
  expect(Aim.clickSelectedUid).toBeNull(); expect(commands.submitCardPlay).not.toHaveBeenCalled();
  keyword.blur(); expect(tip().hidden).toBe(true);
});

it.each(['Enter', ' '])('keeps explicit card-face %s selection and Escape cancellation', key => {
  card.querySelector('.hs-card').dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
  expect(Aim.clickSelectedUid).toBe('keyword-card'); expect(Aim.aim).toBeNull();
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
  expect(Aim.clickSelectedUid).toBeNull(); expect(commands.submitCardPlay).not.toHaveBeenCalled();
});

it('keeps dynamic button actions outside aiming', () => {
  state.card = { ...state.card, infuse: 1 }; renderHand();
  const button = card.querySelector('.bt-infchip'), action = vi.fn();
  button.setAttribute('data-ui-tip', ''); button.setAttribute('data-ui-tip-text', '选择注能材料');
  button.addEventListener('click', action);
  pointer(button, 'pointerdown'); expect(Aim.aim).toBeNull(); expect(tip()?.hidden).toBe(false);
  pointer(button, 'pointerup'); button.click();
  expect(action).toHaveBeenCalledTimes(1); expect(commands.submitCardPlay).not.toHaveBeenCalled();
});

it('does not preselect infusion material on either keyword reading or ordinary pointerdown', () => {
  state.snap.hand = ['keyword-card', 'keyword-copy'];
  state.snap.infusing = { uid: 'infusion-main', need: 2, picked: ['keyword-card'] };
  renderHand();
  pointer(term(), 'pointerdown');
  expect(card.dataset.uid).toBe('keyword-card'); expect(tip()?.hidden).toBe(false);
  pointer(document, 'pointerup');
  pointer(card.querySelector('.hsc-name'), 'pointerdown');
  expect(card.dataset.uid).toBe('keyword-card'); expect(card.closest('.bt-slot').dataset.uid).toBe('keyword-card');
  expect(commands.selectInfusion).not.toHaveBeenCalled();
  expect(Aim.aim).toBeNull(); expect(commands.submitCardPlay).not.toHaveBeenCalled();
});
