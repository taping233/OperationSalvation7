import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mountCommDemo } from '../game/src/ui/comm-feed.js';

vi.mock('../game/src/core/motion.js', () => ({ reduceMotion: () => true }));
let observers;
beforeEach(() => {
  vi.useFakeTimers();
  observers = [];
  vi.stubGlobal('MutationObserver', class {
    observe = vi.fn();
    disconnect = vi.fn();
    constructor(callback) { this.callback = callback; observers.push(this); }
  });
});
afterEach(() => {
  document.querySelector('.comm-demo-close')?.click();
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  document.body.replaceChildren();
});

const panel = () => document.getElementById('commDemoPanel');
const mode = detail => document.dispatchEvent(new CustomEvent('sdt-overlay-mode', { detail }));

describe('communication demo lifecycle', () => {
  it('removes the exact mode listener on every close and remount', () => {
    const add = vi.spyOn(document, 'addEventListener');
    const remove = vi.spyOn(document, 'removeEventListener');
    for (let i = 0; i < 3; i++) {
      mountCommDemo();
      mountCommDemo(); // Already mounted is an idempotent no-op.
      expect(document.querySelectorAll('#commDemoPanel')).toHaveLength(1);
      panel().querySelector('.comm-demo-close').click();
    }
    const added = add.mock.calls.filter(([type]) => type === 'sdt-overlay-mode');
    const removed = remove.mock.calls.filter(([type]) => type === 'sdt-overlay-mode');
    expect(added).toHaveLength(3);
    expect(removed).toHaveLength(3);
    expect(removed.map(([, listener]) => listener)).toEqual(added.map(([, listener]) => listener));
  });

  it('disconnects its observer and clears the pending typing clock when closed between messages', () => {
    mountCommDemo();
    const oldPanel = panel();
    const oldFeed = oldPanel.querySelector('.comm-feed');
    Object.defineProperty(oldFeed, 'scrollHeight', { value: 200 });
    vi.advanceTimersByTime(1800);
    expect(oldPanel.querySelectorAll('.comm-row')).toHaveLength(2);
    expect(vi.getTimerCount()).toBe(2);
    oldPanel.querySelector('.comm-demo-close').click();
    expect(vi.getTimerCount()).toBe(0);
    expect(observers[0].disconnect).toHaveBeenCalledTimes(1);
    observers[0].callback(); // A previously queued observer callback is harmless too.
    expect(oldFeed.scrollTop).toBe(0);
    mode('battle');
    vi.advanceTimersByTime(10000);
    expect(oldPanel.style.display).toBe('');
    expect(oldPanel.querySelectorAll('.comm-row')).toHaveLength(2);
    expect(oldPanel.querySelector('.comm-typing')).toBeNull();
    expect(panel()).toBeNull();
  });

  it('keeps normal message progression, battle visibility, progress and scroll updates working', () => {
    mountCommDemo();
    const current = panel(), feed = current.querySelector('.comm-feed');
    Object.defineProperty(feed, 'scrollHeight', { value: 120 });
    observers[0].callback();
    expect(feed.scrollTop).toBe(120);
    expect(current.querySelector('.comm-typing')).not.toBeNull();
    mode('battle');
    expect(current.style.display).toBe('none');
    mode('page');
    expect(current.style.display).toBe('');
    vi.advanceTimersByTime(9000);
    expect(current.querySelectorAll('.comm-row')).toHaveLength(6);
    expect(current.querySelector('.comm-progress').getAttribute('aria-valuenow')).toBe('6');
    expect(current.querySelector('.comm-typing')).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
    current.querySelector('.comm-demo-close').click();
    expect(observers[0].disconnect).toHaveBeenCalledTimes(1);
  });

  it('releases the subscription when the host removes the panel without its close button', () => {
    const remove = vi.spyOn(document, 'removeEventListener');
    mountCommDemo();
    panel().remove();
    vi.advanceTimersByTime(1800);
    expect(vi.getTimerCount()).toBe(0);
    expect(observers[0].disconnect).toHaveBeenCalledTimes(1);
    expect(remove.mock.calls.filter(([type]) => type === 'sdt-overlay-mode')).toHaveLength(1);
  });
});
