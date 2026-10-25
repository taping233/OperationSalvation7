import { afterEach, describe, expect, it, vi } from 'vitest';
import { createGameBootInput } from '../game/src/core/game-boot-input.js';
import { createGameBootLoop } from '../game/src/core/game-boot-loop.js';
import { createGameTitleController } from '../game/src/ui/game-title-controller.js';

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers(); });
const target = () => {
  const listeners = new Map();
  return { listeners, addEventListener: vi.fn((name, callback) => listeners.set(name, callback)) };
};

describe('boot responsibility slices', () => {
  it('binds pointer ownership once, locks click world intent and keeps the eight-pixel drag threshold', () => {
    const canvas = { ...target(), style: {}, getBoundingClientRect: () => ({ left:0, top:0, right:100, bottom:100 }),
      setPointerCapture:vi.fn(), releasePointerCapture:vi.fn(), hasPointerCapture:() => true };
    const window = target(), game = { state:'idle' };
    let offset = 0;
    const cam = { screenToWorld:(x,y) => ({ x:x+offset, y }), cancelPan:vi.fn(), beginPan:vi.fn(), panBy:vi.fn(), endPan:vi.fn() };
    const node = { li:0, idx:1 }, pickNode = vi.fn(() => node), showTarget = vi.fn();
    const h = createGameBootInput({ readState:() => ({ canvas, cam, game }), window, document,
      UI:{ hideTooltip:vi.fn(), el:{ overlay:{ hidden:true } } }, renderScheduler:{ invalidate:vi.fn() },
      pickNode, isReachable:() => true, getExpeditionPreview:() => null, showTarget });
    const event = (x, extras = {}) => ({ button:0, pointerId:1, clientX:x, clientY:10, preventDefault() {}, ...extras });
    h.bindInput(); h.bindInput();
    expect(canvas.addEventListener.mock.calls.filter(([name]) => name === 'pointerdown')).toHaveLength(1);
    canvas.listeners.get('pointerdown')(event(10));
    offset = 30;
    canvas.listeners.get('pointerup')(event(10));
    expect(pickNode).toHaveBeenCalledExactlyOnceWith(10, 10, true);
    expect(showTarget).toHaveBeenCalledWith(node);
    canvas.listeners.get('pointerdown')(event(10));
    vi.stubGlobal('requestAnimationFrame', vi.fn(() => 1));
    canvas.listeners.get('pointermove')(event(18));
    expect(cam.beginPan).not.toHaveBeenCalled();
    canvas.listeners.get('pointermove')(event(19));
    expect(cam.beginPan).toHaveBeenCalledOnce();
    expect(cam.panBy).toHaveBeenCalledWith(9, 0);
  });

  it('keeps the loop dormant until startup, suppresses covered draws, and reads replacement state', () => {
    vi.useFakeTimers();
    const frames = [];
    vi.stubGlobal('requestAnimationFrame', vi.fn(callback => { frames.push(callback); return frames.length; }));
    const document = { ...target(), hidden:false, body:{ dataset:{}, classList:{ contains:() => true } } };
    const overlay = { hidden:true, classList:{ contains:() => false } };
    let game = { state:'idle', time:0, elapsed:0 };
    const original = game;
    const stats = { updateMs:0, renderMs:0, fps:0 };
    let renderer = { draw:vi.fn() };
    const originalRenderer = renderer, scheduler = { setWake:vi.fn(), invalidate:vi.fn(), shouldDraw:vi.fn(() => true) };
    const loop = createGameBootLoop({ readState:() => ({ game, cam:{} }), readRenderer:() => renderer, UI:{ el:{ overlay } },
      frameStats:() => stats, FX:{}, MAP:{}, renderScheduler:scheduler, setLobby:vi.fn(),
      window:{}, document, performance:{ now:() => 0 } });
    loop.requestLoopFrame();
    expect(frames).toHaveLength(0);
    const title = { hidden:false };
    loop.setCovers(title, null); loop.start(); loop.start();
    expect(frames).toHaveLength(1);
    frames.shift()(100);
    expect(renderer.draw).not.toHaveBeenCalled();
    expect(original.time).toBe(0);
    title.hidden = true;
    renderer = { draw:vi.fn() };
    game = { state:'moving', time:0, elapsed:0 };
    loop.requestLoopFrame(); frames.shift()(300);
    expect(game.time).toBeCloseTo(0.2);
    expect(game.elapsed).toBeCloseTo(0.2);
    expect(renderer.draw).toHaveBeenCalledWith(undefined, game);
    expect(originalRenderer.draw).not.toHaveBeenCalled();
    expect(original.time).toBe(0);
    expect(stats.loopTicks).toBe(2);
  });

  it('binds title actions once before initialization and saves only the current active run', () => {
    const doc = document.implementation.createHTMLDocument('title fixture');
    doc.body.innerHTML = '<div id="title"></div>' + ['mStart','mSettings','btnCardLib','mBack','btnHome','btnHelp','btnMute'].map(id => `<button id="${id}"></button>`).join('');
    const window = target(), UI = {}, startNewGame = vi.fn(), saveSession = vi.fn();
    let game = { runActive:false };
    let sound = { muted:false, setMuted:vi.fn() };
    const controller = createGameTitleController({ readState:() => ({ game }), readSound:() => sound, UI,
      document:doc, window, startNewGame, saveSession, saveGame:vi.fn(),
      openSettings:vi.fn(), openCardLibrary:vi.fn(), showTitle:vi.fn(), openLeaveMenu:vi.fn(), openTitleGuide:vi.fn(), slotBackgroundUrl:'about:blank' });
    controller.bindTitle(); controller.bindTitle();
    doc.getElementById('mStart').click();
    expect(startNewGame).toHaveBeenCalledOnce();
    expect(doc.getElementById('title').dataset.controlsBound).toBe('true');
    sound = { muted:true, setMuted:vi.fn() };
    doc.getElementById('btnMute').click();
    expect(sound.setMuted).toHaveBeenCalledExactlyOnceWith(false);
    window.listeners.get('pagehide')();
    expect(saveSession).not.toHaveBeenCalled();
    game = { runActive:true };
    window.listeners.get('pagehide')();
    expect(saveSession).toHaveBeenCalledOnce();
    UI._retrySave();
    expect(saveSession).toHaveBeenCalledTimes(2);
  });
});
