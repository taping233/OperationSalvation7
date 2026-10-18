import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ snap: null, card: null, scale: 1 }));
const commands = vi.hoisted(() => ({ getCardPlayAvailability: vi.fn(), submitCardPlay: vi.fn(() => ({ status: 'needs-input' })), playCard: vi.fn(), bagSlam: vi.fn(), slamSkill: vi.fn(), resolveSlam: vi.fn(), useItem: vi.fn(), cancelPendingTarget: vi.fn() }));
const inspect = vi.hoisted(() => vi.fn());
vi.mock('../game/src/battle/core/battle.core.js', () => ({
  commands, getSnapshot: () => state.snap,
  getBattleLiveness: () => ({ battleToken: state.snap.battleToken, phase: state.snap.phase }),
  effCostOf: card => card.cost || 0, findCard: uid => uid === 'drag-card' ? { card: state.card } : null,
  findEffectiveCard: uid => uid === 'drag-card' ? { card: state.card } : null,
  targetSide: card => card.side, infuseOf: () => null, unplayableReason: () => '',
}));
vi.mock('../game/src/ui/ui-scale.js', () => ({ scale: () => state.scale, viewport: () => ({ width: 1920, height: 1080 }) }));
vi.mock('../game/src/battle/view/battle.hand-inspector.js', () => ({ openHandInspector: inspect, closeHandInspector: vi.fn() }));
vi.mock('../game/src/battle/view/battle.hover.js', () => ({ showFoePreview: vi.fn(), clearFoePreview: vi.fn(), showThoughtBubble: vi.fn(), clearThoughtBubble: vi.fn() }));
const UI = { el: {} };
let reduced = false;
window.SDT = { UI, Sound: { sfx: vi.fn() }, Motion: { reduceMotion: () => reduced } };
const Aim = await import('../game/src/battle/view/battle.aim.js');
const { BATTLE_PHASES } = await import('../game/src/battle/runtime/battle.state.js');
let frames, clock, card, foe, surface;
function pointer(type, x, y, id = 1) {
  const event = new MouseEvent(type, { clientX: x, clientY: y, button: 0, bubbles: true, cancelable: true });
  Object.defineProperty(event, 'pointerId', { value: id });
  return event;
}
function step(ms = 16) {
  clock += ms;
  const ready = [...frames.values()]; frames.clear(); ready.forEach(fn => fn(clock));
}
function begin(x = 320, y = 950) { Aim.startAim(pointer('pointerdown', x, y), card); }
function move(x, y, id) { window.dispatchEvent(pointer('pointermove', x, y, id)); }
function release(x, y, id) { window.dispatchEvent(pointer('pointerup', x, y, id)); }

beforeEach(() => {
  vi.clearAllMocks(); state.scale = 1; reduced = false; clock = 0; frames = new Map();
  let frameId = 0;
  vi.stubGlobal('requestAnimationFrame', fn => { frames.set(++frameId, fn); return frameId; });
  vi.stubGlobal('cancelAnimationFrame', id => frames.delete(id));
  vi.spyOn(performance, 'now').mockImplementation(() => clock);
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(new Proxy({}, { get: () => () => {} }));
  document.body.innerHTML = '<div id="overlay"><div id="body"><div class="battle-stage"><div class="sts-hand"><div class="bt-slot"><div class="bt-card" data-uid="drag-card"></div></div></div><div class="bt-foe" data-eidx="0"><div class="sts-figure"></div></div><div id="btSelf"></div><div class="sts-hud"></div><div class="field"></div></div></div></div>';
  UI.el = { overlay: document.getElementById('overlay'), ovBody: document.getElementById('body') };
  card = document.querySelector('.bt-card'); foe = document.querySelector('.bt-foe'); surface = document.querySelector('.field');
  card.getBoundingClientRect = () => ({ left: 200, top: 800, width: 220, height: 300 });
  UI.el.overlay.getBoundingClientRect = () => ({ left: 0, top: 0, width: 1920, height: 1080 });
  UI.el.overlay.setPointerCapture = vi.fn(); UI.el.overlay.hasPointerCapture = () => true; UI.el.overlay.releasePointerCapture = vi.fn();
  document.elementFromPoint = vi.fn((x, y) => x >= 1100 && x <= 1300 && y >= 300 && y <= 650 ? foe : surface);
  state.card = { name: '测试牌', cost: 1, side: 'enemy' };
  state.snap = { battleToken: 'drag-battle', phase: BATTLE_PHASES.PLAYER, energy: 3, hand: ['drag-card'], foes: [{ hp: 20, dead: false }] };
  commands.getCardPlayAvailability.mockImplementation(() => state.snap.energy < state.card.cost
    ? { status:'rejected', reason:{ message:'能量不足' } } : { status:'ready' });
});
function settleReturn() { for (let i = 0; frames.size && i < 200; i++) step(); }
afterEach(() => { Aim.cancelAim(); Aim.cancelClickSelection(); settleReturn(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

it('picks a hand card up immediately and keeps following after an in-hand release', () => {
  begin(); expect(card.classList.contains('aim-lift')).toBe(true);
  move(323, 951); step(); expect(card.style.transform).toContain('translate3d');
  release(323, 951); expect(inspect).not.toHaveBeenCalled();
  expect(Aim.aim.leftDown).toBe(false); expect(Aim.aim.mode).toBe('drag');
  expect(commands.submitCardPlay).not.toHaveBeenCalled();
  Aim.cancelAim(); settleReturn(); settleReturn(); expect(card.style.transform).toBe('');
});

it('anchors at the card centre and follows with the source position rate instead of teleporting', () => {
  begin(210, 950); move(610, 850); step(); step();
  expect(Aim.aim.motion.x).toBeGreaterThan(310); expect(Aim.aim.motion.x).toBeLessThan(610);
  expect(Aim.aim.motion.y).toBeLessThan(950);
});

it('keeps screen-space following and suppresses pickup flash with reduced motion at scale two', () => {
  state.scale = 2; reduced = true; begin(); move(610, 850); step();
  expect(Aim.aim.motion.x).toBeGreaterThan(310); expect(Aim.aim.motion.x).toBeLessThan(610);
  expect(card.classList.contains('card-pickup-flash')).toBe(false);
});

it('enters source play zone before a target is hovered and highlights only the real target', () => {
  begin(); move(800, 700); step(); expect(Aim.aim.mode).toBe('target');
  expect(Aim.aim.hover).toBeNull(); expect(document.getElementById('aimArrow')).not.toBeNull();
  move(1200, 450); step(); expect(foe.classList.contains('drag-over')).toBe(true);
  move(1050, 450); step(); expect(foe.classList.contains('drag-over')).toBe(false);
  release(1050, 450); expect(commands.submitCardPlay).not.toHaveBeenCalled();
  expect(Aim.aim.mode).toBe('clickTarget');
  Aim.cancelAim(); settleReturn(); expect(card.style.transform).toBe('');
});

it('commits a fast valid release even when no queued pointer frame has run', () => {
  begin(); move(1200, 450); release(1200, 450);
  expect(commands.submitCardPlay).toHaveBeenCalledExactlyOnceWith('drag-card', 0, false);
  expect(Aim.aim).toBeNull(); expect(document.getElementById('aimArrow')).toBeNull();
  release(1200, 450); expect(commands.submitCardPlay).toHaveBeenCalledTimes(1);
});

it('does not play stale, dead, blocked or foreign-pointer drops', () => {
  begin(); move(1200, 450, 2); release(1200, 450, 2); expect(Aim.aim).toMatchObject({ lastX:320, lastY:950 });
  state.snap.foes[0].dead = true; release(1200, 450); expect(commands.submitCardPlay).not.toHaveBeenCalled();
  Aim.cancelAim(); settleReturn();
  state.snap.foes[0].dead = false; state.snap.energy = 0; begin(); release(1200, 450);
  expect(commands.submitCardPlay).not.toHaveBeenCalled();
  state.snap.energy = 3; begin(); state.snap = { ...state.snap, battleToken: 'new-battle' }; release(1200, 450);
  expect(commands.submitCardPlay).not.toHaveBeenCalled(); expect(Aim.aim).toBeNull();
});

it('processes fast untargeted drops before cancelling the target session and excludes the hand/HUD', () => {
  state.card.side = null; begin(); release(800, 700);
  expect(commands.submitCardPlay).toHaveBeenCalledExactlyOnceWith('drag-card', undefined, false);
  commands.submitCardPlay.mockClear(); begin(); document.elementFromPoint.mockReturnValue(card); release(800, 700);
  expect(commands.submitCardPlay).not.toHaveBeenCalled();
  begin(); document.elementFromPoint.mockReturnValue(document.querySelector('.sts-hud')); release(800, 700);
  expect(commands.submitCardPlay).not.toHaveBeenCalled();
});

it('casts self-target cards from the battlefield centre or directly on the player', () => {
  state.card.side = 'self'; begin(); release(800, 700);
  expect(commands.submitCardPlay).toHaveBeenCalledExactlyOnceWith('drag-card', 'self', false);
  commands.submitCardPlay.mockClear();
  begin(); document.elementFromPoint.mockReturnValue(document.getElementById('btSelf')); release(800, 700);
  expect(commands.submitCardPlay).toHaveBeenCalledExactlyOnceWith('drag-card', 'self', false);
});

it('casts area attacks from empty battlefield space using a live enemy for resolution', () => {
  state.card.rules = { battle: { target: { area: true } } };
  state.snap.foes = [{ hp: 0, dead: true }, { hp: 20, dead: false }];
  begin(); release(800, 700);
  expect(commands.submitCardPlay).toHaveBeenCalledExactlyOnceWith('drag-card', 1, false);
});

it('previews every living enemy over legal area-drop space and clears on invalid space or cancellation', async () => {
  const { showFoePreview, clearFoePreview } = await import('../game/src/battle/view/battle.hover.js');
  state.card.rules = { battle: { target: { area: true } } };
  const second = foe.cloneNode(true); second.dataset.eidx = '1'; foe.after(second);
  state.snap.foes.push({ hp: 20, dead: false });
  begin(); move(800, 700); step();
  expect(showFoePreview).toHaveBeenCalledWith(foe, 0, 'drag-card', state.card, 'drag', state.snap);
  expect(showFoePreview).toHaveBeenCalledWith(second, 1, 'drag-card', state.card, 'drag', state.snap);
  expect(showFoePreview).toHaveBeenCalledTimes(2);
  expect(showFoePreview.mock.calls[0][5]).toBe(state.snap);
  expect(showFoePreview.mock.calls[1][5]).toBe(showFoePreview.mock.calls[0][5]);
  expect(commands.submitCardPlay).not.toHaveBeenCalled();
  document.elementFromPoint.mockReturnValue(document.querySelector('.sts-hud'));
  move(800, 650); step();
  expect(clearFoePreview).toHaveBeenCalledWith(foe, expect.anything(), expect.anything());
  expect(clearFoePreview).toHaveBeenCalledWith(second, expect.anything(), expect.anything());
  Aim.cancelAim();
  expect(commands.submitCardPlay).not.toHaveBeenCalled();
});

it.each(['self', 'enemy'])('keeps field-cast %s cards out of hand and HUD drop zones', side => {
  state.card.side = side;
  state.card.rules = { battle: { target: { area: true } } };
  begin(); document.elementFromPoint.mockReturnValue(document.querySelector('.sts-hud')); release(800, 700);
  expect(commands.submitCardPlay).not.toHaveBeenCalled();
});

it.each(['pointercancel', 'lostpointercapture', 'blur', 'resize', 'compositionstart'])('cleans up safely on %s', type => {
  begin(); move(1200, 450); step();
  const target = type === 'lostpointercapture' ? UI.el.overlay : type === 'compositionstart' ? document : window;
  target.dispatchEvent(type.includes('pointer') ? pointer(type, 1200, 450) : new Event(type));
  expect(Aim.aim).toBeNull(); settleReturn(); expect(card.style.transform).toBe('');
  expect(foe.classList.contains('drag-over')).toBe(false); expect(frames.size).toBe(0);
  expect(commands.submitCardPlay).not.toHaveBeenCalled();
});

it('does not leak Escape/Tab to other combat handlers, but respects IME composition', () => {
  begin(); const composed = new KeyboardEvent('keydown', { key: 'Escape', isComposing: true, cancelable: true, bubbles: true });
  document.dispatchEvent(composed); expect(Aim.aim).not.toBeNull(); expect(composed.defaultPrevented).toBe(false);
  const tab = new KeyboardEvent('keydown', { key: 'Tab', cancelable: true, bubbles: true });
  document.dispatchEvent(tab); expect(tab.defaultPrevented).toBe(true); expect(Aim.aim).toBeNull();
});

it('cancels when returning to the source bottom cancel zone and when the active card detaches', () => {
  begin(); move(1200, 450); step(); move(1200, 1060); step(); expect(Aim.aim).toBeNull();
  expect(commands.submitCardPlay).not.toHaveBeenCalled();
  begin(); card.remove(); move(1200, 450); step(); expect(Aim.aim).toBeNull();
});

it('also cancels an untargeted card after it passes back through the intermediate zone', () => {
  state.card.side = null; begin(); move(800, 700); step();
  move(800, 880); step(); expect(Aim.aim.mode).toBe('multi');
  move(800, 1060); step(); expect(Aim.aim).toBeNull(); expect(commands.submitCardPlay).not.toHaveBeenCalled();
});

it('refreshes target data across a compatible redraw and cancels a changed hand slot', () => {
  begin(); move(1200, 450); step(); expect(Aim.canPreserveAim(state.snap)).toBe(true);
  Aim.resumeAimAfterRender({ ...state.snap }); step(); expect(Aim.aim.hover?.idx).toBe(0);
  card.parentElement.style.setProperty('--fx', 'changed'); Aim.resumeAimAfterRender(state.snap);
  expect(Aim.aim).toBeNull(); expect(commands.submitCardPlay).not.toHaveBeenCalled();
});
