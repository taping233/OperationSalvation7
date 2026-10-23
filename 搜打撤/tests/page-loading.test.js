import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../game/src/core/motion.js', () => ({ reduceMotion: vi.fn(() => false) }));
vi.mock('../game/src/core/map-image-ready.js', () => ({ mapImageReady: vi.fn(async () => true) }));
import { reduceMotion } from '../game/src/core/motion.js';
import { mapImageReady } from '../game/src/core/map-image-ready.js';
import { runPageLoading } from '../game/src/ui/page-loading.js';

describe('shared page loading cover', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('requestAnimationFrame', fn => setTimeout(() => fn(performance.now()), 16));
    vi.stubGlobal('cancelAnimationFrame', clearTimeout);
    reduceMotion.mockReturnValue(false);
    mapImageReady.mockResolvedValue(true);
    document.body.innerHTML = '<main id="viewport"><button>进入</button></main>';
  });
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

  it('paints a cover before mounting and deduplicates repeated opening', async () => {
    const open = vi.fn(() => 'ready');
    const first = runPageLoading({ title: '照相馆', detail: '正在整理馆藏', open });
    const repeated = vi.fn();
    expect(runPageLoading({ title: '照相馆', detail: '', open: repeated })).toBe(first);
    expect(document.querySelectorAll('.page-loading')).toHaveLength(1);
    expect(document.querySelector('.page-loading--interface')).not.toBeNull();
    expect(document.querySelector('.camp-entry-cut')).toBeNull();
    expect(document.querySelector('.page-loading-copy h2').textContent).toBe('照相馆');
    expect(document.querySelector('[role="status"]').getAttribute('aria-label')).toContain('正在整理馆藏');
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

  it('releases shortcuts once the destination first frame is ready, before the cover finishes fading', async () => {
    const pending = runPageLoading({ title: '照相馆', detail: '', open: vi.fn() });
    await vi.advanceTimersByTimeAsync(32);
    const mounted = new KeyboardEvent('keydown', { key: 'Enter', cancelable: true });
    window.dispatchEvent(mounted);
    expect(mounted.defaultPrevented).toBe(true);   // 挂载后仍护键：等待目标首帧视觉就绪
    await vi.advanceTimersByTimeAsync(64);         // 视觉就绪检查（无 ovBody 立即放行）+ 一帧
    const key = new KeyboardEvent('keydown', { key: 'Enter', cancelable: true });
    window.dispatchEvent(key);
    expect(key.defaultPrevented).toBe(false);      // 揭幕开始即放行，不等淡出结束
    expect(document.querySelector('.page-loading').classList.contains('leaving')).toBe(true);
    await vi.runAllTimersAsync();
    await pending;
    expect(document.querySelector('.page-loading')).toBeNull();
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

  it('paints the prepared cut before mounting, holds until the page is ready, then reveals once', async () => {
    const controller = new AbortController();
    let mount;
    const reveal = vi.fn(() => expect(document.querySelector('.page-loading').classList.contains('leaving')).toBe(false));
    const pending = runPageLoading({ title: '照相馆', detail: '正在整理馆藏', presentation: 'city-cut',
      signal: controller.signal, onRevealStart: reveal, open: () => new Promise(resolve => { mount = resolve; }) });
    await vi.advanceTimersByTimeAsync(500);
    expect(reveal).not.toHaveBeenCalled();
    expect(document.querySelector('.page-loading--city')).not.toBeNull();
    expect(document.querySelector('.page-loading-copy')).toBeNull();
    expect(document.querySelector('.camp-entry-cut').classList.contains('page-cut-waiting')).toBe(true);
    mount('ready');
    await vi.advanceTimersByTimeAsync(48);   // 挂载后先过目标首帧视觉就绪，再揭幕一次
    expect(reveal).toHaveBeenCalledOnce();
    expect(document.querySelector('.camp-entry-cut')).not.toBeNull();
    expect(document.querySelector('.camp-entry-cut').classList.contains('page-cut-waiting')).toBe(false);
    expect(document.querySelector('.page-loading').classList.contains('leaving')).toBe(true);
    await vi.advanceTimersByTimeAsync(800);
    expect(document.querySelector('.page-loading')).not.toBeNull();
    controller.abort();
    await expect(pending).resolves.toBe('ready');
    expect(document.querySelector('.page-loading')).toBeNull();
    expect(document.getElementById('viewport').hasAttribute('aria-busy')).toBe(false);
  });

  it('uses the static city preparation route when reduced motion disables its cut', async () => {
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

  it('prepares the page under a waiting cold curtain and aborts before revealing it', async () => {
    let ready;
    mapImageReady.mockImplementationOnce(() => new Promise(resolve => { ready = resolve; }));
    const controller = new AbortController(), open = vi.fn(), reveal=vi.fn();
    const pending = runPageLoading({ title:'照相馆', detail:'正在准备', presentation:'city-cut', signal:controller.signal, open, onRevealStart:reveal });
    await vi.advanceTimersByTimeAsync(500);
    expect(open).toHaveBeenCalledOnce();
    expect(reveal).not.toHaveBeenCalled();
    expect(document.querySelector('.camp-entry-cut.page-cut-waiting')).not.toBeNull();
    controller.abort(); await expect(pending).resolves.toBe(false);
    ready(true); await Promise.resolve();
    expect(document.querySelector('.page-loading')).toBeNull();
    expect(reveal).not.toHaveBeenCalled();
  });

  it('keeps a failed decorative image on the opaque fallback and still opens the page', async () => {
    mapImageReady.mockResolvedValue(false);
    const open = vi.fn(() => {
      expect(document.querySelector('.camp-entry-cut').dataset.scenery).toBe('fallback');
      expect(document.querySelector('.camp-entry-scenery img').style.display).toBe('none');
      return 'ready';
    });
    const pending = runPageLoading({title:'照相馆',detail:'正在准备',presentation:'city-cut',open});
    await vi.runAllTimersAsync();
    await expect(pending).resolves.toBe('ready');
    expect(open).toHaveBeenCalledOnce();
    expect(document.querySelector('.page-loading')).toBeNull();
  });
});

describe('mounted destination ownership during readiness', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('requestAnimationFrame', fn => setTimeout(() => fn(performance.now()), 16));
    vi.stubGlobal('cancelAnimationFrame', clearTimeout);
    reduceMotion.mockReturnValue(false); mapImageReady.mockResolvedValue(true);
    document.body.innerHTML = '<main id="viewport"><div id="overlay"><div class="card"><div id="ovBody"></div></div></div></main>';
    window.SDT = {UI:{_pageBgReady:new Promise(() => {})}};
  });
  afterEach(() => { window.SDT = {}; vi.useRealTimers(); vi.unstubAllGlobals(); });
  it.each(['replace','hidden','closing','native-closing','detached'])('%s cancels old reveal and releases only its own cover', async change => {
    const reveal = vi.fn();
    const pending = runPageLoading({title:'旧页',detail:'准备中',onRevealStart:reveal,open:() => {
      document.getElementById('ovBody').innerHTML = '<main id="oldPage">旧页</main>'; return 'ready';
    }});
    await vi.advanceTimersByTimeAsync(64);
    expect(document.querySelector('.page-loading:not(.leaving)')).not.toBeNull();
    const overlay = document.getElementById('overlay');
    if (change === 'replace') document.getElementById('ovBody').innerHTML = '<main>新页</main>';
    if (change === 'hidden') overlay.hidden = true;
    if (change === 'closing') overlay.dataset.uiClosing = '1';
    if (change === 'native-closing') overlay.classList.add('closing');
    if (change === 'detached') overlay.remove();
    await Promise.resolve();
    await expect(pending).resolves.toBe(false);
    expect(reveal).not.toHaveBeenCalled();
    expect(document.querySelector('.page-loading')).toBeNull();
    if (change === 'replace') {
      window.SDT.UI._pageBgReady = Promise.resolve();
      const freshReveal = vi.fn();
      const fresh = runPageLoading({title:'新页',detail:'',open:() => 'fresh',onRevealStart:freshReveal});
      await vi.runAllTimersAsync();
      await expect(fresh).resolves.toBe('fresh');
      expect(freshReveal).toHaveBeenCalledOnce();
    } else await vi.runAllTimersAsync();
    expect(vi.getTimerCount()).toBe(0);
  });
  it('background readiness timeout remains a successful fallback, not cancellation', async () => {
    const reveal = vi.fn();
    const pending = runPageLoading({title:'页面',detail:'',onRevealStart:reveal,open:() => {
      document.getElementById('ovBody').innerHTML = '<main>页面</main>'; return 'ready';
    }});
    await vi.runAllTimersAsync();
    await expect(pending).resolves.toBe('ready');
    expect(reveal).toHaveBeenCalledOnce();
  });
});
