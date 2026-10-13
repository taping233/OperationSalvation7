import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../game/src/core/motion.js', () => ({ reduceMotion: vi.fn(() => false) }));
import { reduceMotion } from '../game/src/core/motion.js';
import { runPageLoading } from '../game/src/ui/page-loading.js';

describe('shared page loading cover', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('requestAnimationFrame', fn => setTimeout(() => fn(performance.now()), 16));
    vi.stubGlobal('cancelAnimationFrame', clearTimeout);
    reduceMotion.mockReturnValue(false);
    document.body.innerHTML = '<main id="viewport"><button>进入</button></main>';
  });
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

  it('paints a cover before mounting and deduplicates repeated opening', async () => {
    const open = vi.fn(() => 'ready');
    const first = runPageLoading({ title: '照相馆', detail: '正在整理馆藏', open });
    const repeated = vi.fn();
    expect(runPageLoading({ title: '照相馆', detail: '', open: repeated })).toBe(first);
    expect(document.querySelectorAll('.page-loading')).toHaveLength(1);
    expect(document.querySelector('[role="status"]').textContent).toContain('正在整理馆藏');
    expect(open).not.toHaveBeenCalled();
    expect(document.getElementById('viewport').getAttribute('aria-busy')).toBe('true');
    await vi.runAllTimersAsync();
    await expect(first).resolves.toBe('ready');
    expect(open).toHaveBeenCalledOnce();
    expect(repeated).not.toHaveBeenCalled();
    expect(document.querySelector('.page-loading')).toBeNull();
    expect(document.getElementById('viewport').hasAttribute('aria-busy')).toBe(false);
  });

  it('keeps source shortcuts from firing and releases guards after a failed mount', async () => {
    document.getElementById('viewport').setAttribute('aria-busy', 'false');
    const failure = new Error('mount failed');
    const pending = runPageLoading({ title: '照相馆', detail: '', open: () => { throw failure; } });
    const outcome = pending.catch(error => error);
    const blocked = new KeyboardEvent('keydown', { key: 'Enter', cancelable: true });
    window.dispatchEvent(blocked);
    expect(blocked.defaultPrevented).toBe(true);
    await vi.runAllTimersAsync();
    expect(await outcome).toBe(failure);
    expect(document.querySelector('.page-loading')).toBeNull();
    expect(document.getElementById('viewport').getAttribute('aria-busy')).toBe('false');
    const allowed = new KeyboardEvent('keydown', { key: 'Enter', cancelable: true });
    window.dispatchEvent(allowed);
    expect(allowed.defaultPrevented).toBe(false);
  });

  it('finishes in suspended previews without waiting indefinitely for a frame', async () => {
    vi.stubGlobal('requestAnimationFrame', () => 123);
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    reduceMotion.mockReturnValue(true);
    const open = vi.fn();
    const pending = runPageLoading({ title: '照相馆', detail: '', open });
    await vi.runAllTimersAsync();
    await pending;
    expect(open).toHaveBeenCalledOnce();
    expect(document.querySelector('.page-loading')).toBeNull();
  });

  it('releases shortcuts as soon as content is ready, before the cover finishes fading', async () => {
    const pending = runPageLoading({ title: '照相馆', detail: '', open: vi.fn() });
    await vi.advanceTimersByTimeAsync(32);
    const key = new KeyboardEvent('keydown', { key: 'Enter', cancelable: true });
    window.dispatchEvent(key);
    expect(key.defaultPrevented).toBe(false);
    await vi.runAllTimersAsync();
    await pending;
  });

  it('cancels a delayed destination without blocking a fresh request', async () => {
    const controller = new AbortController();
    let resolveOld;
    const pending = runPageLoading({ title: '旧馆页', detail: '', signal: controller.signal,
      open: () => new Promise(resolve => { resolveOld = resolve; }) });
    await vi.advanceTimersByTimeAsync(32);
    const back = new KeyboardEvent('keydown', { key: 'Escape', cancelable: true });
    const quickNav = new KeyboardEvent('keydown', { key: '2', altKey: true, cancelable: true });
    window.dispatchEvent(back); window.dispatchEvent(quickNav);
    expect(back.defaultPrevented).toBe(false);
    expect(quickNav.defaultPrevented).toBe(false);
    controller.abort();
    expect(document.querySelector('.page-loading')).toBeNull();
    const open = vi.fn(() => 'new');
    const fresh = runPageLoading({ title: '新馆页', detail: '', open });
    await expect(pending).resolves.toBe(false);
    resolveOld('old');
    await vi.runAllTimersAsync();
    await expect(fresh).resolves.toBe('new');
    expect(open).toHaveBeenCalledOnce();
    expect(document.querySelector('.page-loading')).toBeNull();
  });

  it('keeps preparation free of a cut, then reveals once and allows immediate cancellation', async () => {
    const controller = new AbortController();
    let mount;
    const reveal = vi.fn(() => expect(document.querySelector('.page-loading').classList.contains('leaving')).toBe(false));
    const pending = runPageLoading({ title: '照相馆', detail: '正在整理馆藏', presentation: 'city-cut',
      signal: controller.signal, onRevealStart: reveal, open: () => new Promise(resolve => { mount = resolve; }) });
    await vi.advanceTimersByTimeAsync(500);
    expect(reveal).not.toHaveBeenCalled();
    expect(document.querySelector('.page-loading--city')).not.toBeNull();
    expect(document.querySelector('.page-loading-copy')).toBeNull();
    expect(document.querySelector('.camp-entry-cut')).toBeNull();
    mount('ready');
    await vi.advanceTimersByTimeAsync(20);
    expect(reveal).toHaveBeenCalledOnce();
    expect(document.querySelector('.camp-entry-cut')).not.toBeNull();
    expect(document.querySelector('.page-loading').classList.contains('leaving')).toBe(true);
    await vi.advanceTimersByTimeAsync(800);
    expect(document.querySelector('.page-loading')).not.toBeNull();
    controller.abort();
    await expect(pending).resolves.toBe('ready');
    expect(document.querySelector('.page-loading')).toBeNull();
    expect(document.getElementById('viewport').hasAttribute('aria-busy')).toBe(false);
  });

  it('uses the transparent city preparation route when reduced motion disables its cut', async () => {
    reduceMotion.mockReturnValue(true);
    const reveal = vi.fn();
    const pending = runPageLoading({ title: '照相馆', detail: '正在整理馆藏', presentation: 'city-cut',
      onRevealStart: reveal, open: () => 'ready' });
    expect(document.querySelector('.page-loading--city')).not.toBeNull();
    expect(document.querySelector('.page-loading-copy')).toBeNull();
    expect(document.querySelector('.camp-entry-cut')).toBeNull();
    await vi.runAllTimersAsync();
    await expect(pending).resolves.toBe('ready');
    expect(reveal).toHaveBeenCalledOnce();
    expect(document.querySelector('.page-loading')).toBeNull();
  });
});
