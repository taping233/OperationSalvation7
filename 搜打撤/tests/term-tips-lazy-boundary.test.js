import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';

let resolveLoad, rejectLoad, load, renderer, factory, documentListeners, windowListeners;
const term = () => document.getElementById('term');
const second = () => document.getElementById('second');
function pointer(target, type, { id = 1, relatedTarget = null, pointerType = 'touch' } = {}) {
  const event = new MouseEvent(type, { bubbles:true, cancelable:true, button:0, relatedTarget });
  Object.defineProperties(event, { pointerId:{ value:id }, pointerType:{ value:pointerType } });
  target.dispatchEvent(event);
  return event;
}
async function settleLoad() {
  resolveLoad({ createTermTipRenderer:factory });
  await vi.dynamicImportSettled();
}

beforeEach(async () => {
  vi.resetModules();
  window.SDT = {}; // Do not inherit a previous module instance's eager registrations.
  renderer = { show:vi.fn(), hide:vi.fn(), resize:vi.fn() };
  factory = vi.fn(() => renderer);
  const pending = new Promise((resolve, reject) => { resolveLoad = resolve; rejectLoad = reject; });
  load = vi.fn(() => pending);
  vi.doMock('../game/src/ui/term-tips.runtime.js', () => load());
  vi.spyOn(Element.prototype, 'getClientRects').mockReturnValue([{ width:80, height:20 }]);
  document.body.innerHTML = '<div id="card" tabindex="0"><span id="term" tabindex="0" data-term="poison"><b>中毒</b></span><span id="second" tabindex="0" data-term="bleed">流血</span></div><button id="action" data-ui-tip data-ui-tip-text="发动">发动</button>';
  // Every fresh module gets its own listeners; remove exactly those in teardown.
  documentListeners = vi.spyOn(document, 'addEventListener');
  windowListeners = vi.spyOn(window, 'addEventListener');
  await import('../game/src/ui/term-tips.js');
});
afterEach(async () => {
  document.dispatchEvent(new CustomEvent('sdt-overlay-close'));
  // Release any outstanding import after cancellation; no abandoned show may run.
  resolveLoad({ createTermTipRenderer:factory });
  await vi.dynamicImportSettled();
  for (const args of documentListeners.mock.calls) document.removeEventListener(...args);
  for (const args of windowListeners.mock.calls) window.removeEventListener(...args);
  vi.doUnmock('../game/src/ui/term-tips.runtime.js');
  vi.restoreAllMocks();
});

describe('term tooltip cold boundary', () => {
  it('keeps aliases synchronous and does not load or preload on entry', async () => {
    const { termKeyFor } = await import('../game/src/ui/term-tips.js');
    expect(termKeyFor('中毒')).toBe('poison');
    expect(termKeyFor('未知')).toBeNull();
    expect(load).not.toHaveBeenCalled();
    expect(document.querySelector('link[rel="preload"], link[rel="modulepreload"]')).toBeNull();
    const shell = readFileSync('game/src/ui/term-tips.js', 'utf8');
    expect(shell).toMatch(/import\('\.\/term-tips\.runtime\.js'\)/);
    expect(shell).not.toMatch(/import\s+.*from\s+['"].*term-tips\.runtime/);
    expect(shell).not.toContain('requestIdleCallback');
  });

  it('keeps UiScale eager for synchronous card zoom before any tooltip runtime request', async () => {
    expect(window.SDT.UiScale?.rect).toBeTypeOf('function');
    expect(load).not.toHaveBeenCalled();
    window.SDT.Icons = { img:() => '', rich:String, TYPE_ART:{} };
    window.SDT.Sound = { sfx:vi.fn() };
    await import('../game/src/cards/cards.js');
    const { UI } = await import('../game/src/ui/ui.js');
    const rect = vi.spyOn(window.SDT.UiScale, 'rect'); // Call through the real scale implementation.
    const source = document.getElementById('card');
    const card = { id:'cold-zoom', name:'冷启动卡牌', type:'法术', rarity:'普通', cost:1, desc:'施加 1 层中毒。' };
    try {
      expect(() => UI.showCardZoom(card, { from:source })).not.toThrow();
      expect(document.querySelector('#cardZoom .cz-card').textContent).toContain('冷启动卡牌');
      expect(rect).toHaveBeenCalledWith(source);
      expect(load).not.toHaveBeenCalled();
      expect(document.querySelector('.term-tip')).toBeNull();
    } finally { document.getElementById('cardZoom')?._closeCardZoom?.(true); }
  });

  it('synchronously blocks nested keyword clicks and keyboard activation before parent card handlers', () => {
    const parent = document.getElementById('card'), action = vi.fn();
    parent.addEventListener('click', action);
    parent.addEventListener('keydown', action);
    pointer(term(), 'pointerdown');
    const click = new MouseEvent('click', { bubbles:true, cancelable:true });
    term().firstElementChild.dispatchEvent(click);
    expect(click.defaultPrevented).toBe(true);
    for (const key of ['Enter', ' ']) {
      const event = new KeyboardEvent('keydown', { key, bubbles:true, cancelable:true });
      term().dispatchEvent(event);
      expect(event.defaultPrevented).toBe(true);
    }
    expect(action).not.toHaveBeenCalled();
    expect(renderer.show).not.toHaveBeenCalled();
  });

  it('renders the latest held target once without replaying input events', async () => {
    const actions = vi.fn(), parent = document.getElementById('card');
    parent.addEventListener('pointerdown', actions);
    pointer(term(), 'pointerover');
    pointer(term(), 'pointerdown');
    pointer(second(), 'pointerover');
    pointer(second(), 'pointerdown', { id:2 });
    pointer(document, 'pointerup', { id:1 });
    await settleLoad();
    expect(load).toHaveBeenCalledTimes(1);
    expect(factory).toHaveBeenCalledTimes(1);
    expect(renderer.show).toHaveBeenCalledExactlyOnceWith(second());
    expect(actions).toHaveBeenCalledTimes(2);
    pointer(document, 'pointerup', { id:2 });
    expect(renderer.hide).toHaveBeenCalledTimes(1);
  });

  it.each(['pointerup', 'pointercancel', 'pointermove'])('does not show a touch after cold %s outside the term', async type => {
    pointer(term(), 'pointerdown');
    pointer(document, type);
    await settleLoad();
    expect(renderer.show).not.toHaveBeenCalled();
  });

  it('cancels a cold touch moved outside even under implicit pointer capture', async () => {
    const hitTest = vi.fn(() => document.body);
    const previousHitTest = document.elementFromPoint;
    document.elementFromPoint = hitTest;
    try {
      pointer(term(), 'pointerdown');
      // Real touch capture retains the original event target after the finger leaves.
      pointer(term(), 'pointermove');
      await settleLoad();
      expect(hitTest).toHaveBeenCalledTimes(1);
      expect(renderer.show).not.toHaveBeenCalled();
    } finally { document.elementFromPoint = previousHitTest; }
  });

  it.each(['sdt-overlay-close', 'sdt-overlay-mode', 'Escape', 'blur', 'scroll', 'hidden', 'detach', 'inert', 'pointerout', 'focusout'])(
    'does not revive the cold trigger after %s', async reason => {
      if (reason === 'focusout') term().focus();
      else pointer(term(), 'pointerover');
      if (reason.startsWith('sdt-')) document.dispatchEvent(new CustomEvent(reason));
      else if (reason === 'Escape') document.dispatchEvent(new KeyboardEvent('keydown', { key:'Escape', bubbles:true }));
      else if (reason === 'blur' || reason === 'scroll') window.dispatchEvent(new Event(reason));
      else if (reason === 'hidden') {
        vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
        document.dispatchEvent(new Event('visibilitychange'));
      } else if (reason === 'detach') term().remove();
      else if (reason === 'inert') document.getElementById('card').setAttribute('inert', '');
      else if (reason === 'pointerout') pointer(term(), 'pointerout');
      else term().blur();
      // Mutation cancellation runs before the asynchronous module continuation.
      await Promise.resolve();
      await settleLoad();
      expect(renderer.show).not.toHaveBeenCalled();
    });

  it('ignores the ended first gesture when a second term is also clicked and released', async () => {
    pointer(term(), 'pointerdown');
    pointer(document, 'pointerup');
    pointer(second(), 'pointerdown', { id:2 });
    second().click();
    pointer(document, 'pointerup', { id:2 });
    await settleLoad();
    expect(renderer.show).not.toHaveBeenCalled();
  });

  it('keeps dynamic button actions usable while loading and never replays their click', async () => {
    const button = document.getElementById('action'), action = vi.fn();
    button.addEventListener('click', action);
    pointer(button, 'pointerdown');
    pointer(button, 'pointerup');
    button.click();
    expect(action).toHaveBeenCalledTimes(1);
    await settleLoad();
    expect(action).toHaveBeenCalledTimes(1);
    expect(renderer.show).not.toHaveBeenCalled();
  });

  it('catches a failed chunk, clears stale intent, and retries only on a fresh interaction', async () => {
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => {});
    pointer(term(), 'pointerdown');
    rejectLoad(new Error('offline'));
    await vi.dynamicImportSettled();
    expect(warning).toHaveBeenCalledTimes(1);
    expect(renderer.show).not.toHaveBeenCalled();
    // Vitest caches rejected mock factories; remock the same module to model the
    // next actual import attempt succeeding after a temporary transport failure.
    vi.doMock('../game/src/ui/term-tips.runtime.js', () => ({ createTermTipRenderer:factory }));
    pointer(second(), 'pointerdown', { id:2 });
    await vi.dynamicImportSettled();
    expect(renderer.show).toHaveBeenCalledExactlyOnceWith(second());
    pointer(document, 'pointerup', { id:1 });
    expect(renderer.hide).not.toHaveBeenCalled();
    pointer(document, 'pointerup', { id:2 });
    expect(renderer.hide).toHaveBeenCalledTimes(1);
  });

  it('keeps warmed rendering and resize synchronous without adding new release listeners', async () => {
    pointer(term(), 'pointerover');
    await settleLoad();
    renderer.show.mockClear();
    const listenersBefore = documentListeners.mock.calls.length;
    pointer(second(), 'pointerover');
    expect(renderer.show).toHaveBeenCalledExactlyOnceWith(second());
    window.dispatchEvent(new Event('resize'));
    expect(renderer.resize).toHaveBeenCalledTimes(1);
    expect(documentListeners.mock.calls.length).toBe(listenersBefore);
  });
});
