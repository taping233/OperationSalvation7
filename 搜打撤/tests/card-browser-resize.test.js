import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { bindCardBrowser, cardBrowserHTML } from '../game/src/ui/card-browser.js';

let notify, observers, frames, width, root, slot = 1000;
beforeEach(() => {
  observers = []; frames = []; width = 900;
  vi.stubGlobal('ResizeObserver', class {
    constructor(callback) { notify = callback; this.disconnect = vi.fn(); observers.push(this); }
    observe() {}
  });
  vi.stubGlobal('requestAnimationFrame', callback => { frames.push(callback); return frames.length; });
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
  window.SDT = { Base: { slot: ++slot } };
  document.body.innerHTML = cardBrowserHTML('layout', '收藏', Array.from({ length: 12 }, (_, i) =>
    `<button data-browser-key="${i}">${i}</button>`).join(''), { rows: 1 });
  root = document.body.firstElementChild;
  Object.defineProperty(root.querySelector('.card-browser-track'), 'clientWidth', { get: () => width });
  bindCardBrowser(root);
});
afterEach(async () => { document.body.replaceChildren(); await Promise.resolve(); vi.unstubAllGlobals(); });
const shown = () => [...root.querySelectorAll('[data-browser-key]')].filter(item => !item.hidden).map(item => item.dataset.browserKey);
const resize = value => { width = value; notify?.(); };
const flush = () => { const pending = frames.splice(0); pending.forEach(callback => callback()); };

describe('card browser container layout continuity', () => {
  it('updates after container-only resizing, keeping focused card and existing nodes', () => {
    const items = [...root.querySelectorAll('[data-browser-key]')];
    root.querySelector('[data-browser-page="next"]').click(); items[6].focus();
    resize(440); flush();
    expect(shown()).toEqual(['6', '7']);
    expect(document.activeElement).toBe(items[6]);
    expect([...root.querySelectorAll('[data-browser-key]')]).toEqual(items);
  });
  it('preserves reading position without stealing focus outside the browser', () => {
    root.querySelector('[data-browser-page="next"]').click();
    const search = document.createElement('input'); document.body.append(search); search.focus();
    resize(440); flush();
    expect(shown()).toEqual(['4', '5']); expect(document.activeElement).toBe(search);
  });
  it('keeps a selected card on the current page visible without stealing external focus', () => {
    root.querySelector('[data-browser-page="next"]').click();
    root.querySelector('[data-browser-key="6"]').setAttribute('aria-pressed', 'true');
    const search = document.createElement('input'); document.body.append(search); search.focus();
    resize(440); flush();
    expect(shown()).toEqual(['6', '7']); expect(document.activeElement).toBe(search);
  });
  it('ignores zero-width and duplicate notifications and coalesces layout bursts', () => {
    root.querySelector('[data-browser-page="next"]').click();
    resize(0); flush(); expect(shown()).toEqual(['4', '5', '6', '7']);
    resize(440); resize(440); resize(440); expect(frames).toHaveLength(1);
    flush(); expect(shown()).toEqual(['4', '5']);
    resize(440); expect(frames).toHaveLength(0);
  });
  it('retries layout when a scheduled resize is hidden before its frame', () => {
    resize(440); resize(0); flush();
    expect(shown()).toEqual(['0', '1', '2', '3']);
    resize(440); flush(); expect(shown()).toEqual(['0', '1']);
  });
  it('uses a removable window fallback without ResizeObserver', async () => {
    root.remove(); await Promise.resolve();
    vi.stubGlobal('ResizeObserver', undefined);
    document.body.innerHTML = cardBrowserHTML('fallback', '卡牌', Array.from({ length: 8 }, (_, i) => `<button data-browser-key="${i}">${i}</button>`).join(''), { rows: 1 });
    root = document.body.firstElementChild;
    Object.defineProperty(root.querySelector('.card-browser-track'), 'clientWidth', { get: () => width });
    bindCardBrowser(root);
    width = 440; window.dispatchEvent(new Event('resize')); flush();
    expect(shown()).toEqual(['0', '1']);
    root.remove(); await Promise.resolve();
    width = 900; window.dispatchEvent(new Event('resize')); expect(frames).toHaveLength(0);
  });
  it('disconnects and cancels pending work when the browser is removed', async () => {
    resize(440); root.remove(); await Promise.resolve();
    expect(observers).toHaveLength(1); expect(observers[0].disconnect).toHaveBeenCalledOnce();
    expect(cancelAnimationFrame).toHaveBeenCalled();
    flush(); expect(shown()).toEqual(['0', '1', '2', '3']);
  });
});
