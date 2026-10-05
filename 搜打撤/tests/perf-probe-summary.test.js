import { afterEach, describe, expect, it, vi } from 'vitest';
import { installPerfProbe, summarizePerfSample } from '../game/src/core/perf-probe.local.js';

describe('Vite 页面探针汇总', () => {
  it('分别报告 rAF 帧间隔、同步绘制耗时和长任务', () => {
    const result = summarizePerfSample({
      mode: 'pan', elapsed: 1000, gaps: [10, 10, 20, 30], draws: [1, 2, 9],
      longTasks: [55, 70], viewport: { cssWidth: 1280, cssHeight: 720, dpr: 1 }, loopTicks: 5,
    });
    expect(result.frameP95Ms).toBe(30);
    expect(result.frameMedianMs).toBe(15);
    expect(result.drawMedianMs).toBe(2);
    expect(result.screenFps).toBeNull();
    expect(result.rendererScope).toContain('SDT.Renderer.draw');
    expect(result.rafMetricLabel).toContain('not screen FPS');
    expect(result.over20msPercent).toBe(25);
    expect(result.drawP95Ms).toBe(9);
    expect(result.drawHz).toBe(3);
    expect(result.longTaskMaxMs).toBe(70);
  });

  it('空闲零绘制保留 null 耗时，不伪造为零毫秒绘制', () => {
    const result = summarizePerfSample({
      mode: 'idle', elapsed: 1000, gaps: [16, 17], draws: [], longTasks: [], viewport: {}, loopTicks: 4,
    });
    expect(result.drawCalls).toBe(0);
    expect(result.drawP95Ms).toBeNull();
    expect(result.drawMaxMs).toBeNull();
  });
});

describe('Vite 页面探针生命周期', () => {
  let overlayVisibilityObserver;
  afterEach(() => {
    overlayVisibilityObserver?.disconnect();
    overlayVisibilityObserver = null;
    document.body.innerHTML = '';
    delete document.visibilityState;
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('允许战斗页面使用通用采样，并在窗口隐藏时清理采样资源', async () => {
    document.body.innerHTML = '<div id="title" hidden></div><div id="viewport"><canvas id="game"></canvas></div><section id="overlay"><div class="card"><h2 id="ovTitle"></h2><div id="ovBody"><section class="battle-stage sts"></section></div></div></section>';
    const originalDraw = vi.fn();
    const observer = { observe: vi.fn(), disconnect: vi.fn() };
    vi.stubGlobal('PerformanceObserver', vi.fn(() => observer));
    let rafCallback;
    vi.stubGlobal('requestAnimationFrame', vi.fn(callback => { rafCallback = callback; return 7; }));
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    const renderer = { draw: originalDraw };
    installPerfProbe({ SDT: { Renderer: renderer }, game: { state: 'battle', battleActive: true },
      canvas: document.getElementById('game'), renderScheduler: { invalidate: vi.fn() } });

    const panel = document.getElementById('vitePerfProbe');
    const handle = document.querySelector('[data-perf-handle]');
    expect(panel.style.left).toBe('0px');
    expect(panel.style.top).toBe('50%');
    expect(panel.style.width).toBe('24px');
    expect(panel.style.height).toBe('64px');
    expect(document.querySelector('[data-perf-panel]').hidden).toBe(true);
    handle.click();
    expect(panel.style.right).toBe('10px');
    expect(panel.style.top).toBe('10px');
    expect(panel.style.width).toBe('330px');
    expect(handle.getAttribute('aria-expanded')).toBe('true');
    document.querySelector('button[data-perf-toggle]:not([data-perf-handle])').click();
    expect(panel.style.left).toBe('0px');
    expect(panel.style.width).toBe('24px');
    expect(handle.getAttribute('aria-expanded')).toBe('false');
    handle.click();
    document.querySelector('button[data-perf="page"]').click();
    expect(document.querySelector('#vitePerfResult').dataset.state).toBe('running');
    expect(renderer.draw).not.toBe(originalDraw);
    expect(rafCallback).toEqual(expect.any(Function));

    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
    document.dispatchEvent(new Event('visibilitychange'));
    await Promise.resolve();
    await Promise.resolve();

    expect(document.querySelector('#vitePerfResult').dataset.state).toBe('incomplete');
    expect(document.querySelector('#vitePerfResult').textContent).toContain('窗口不可见');
    expect(renderer.draw).toBe(originalDraw);
    expect(observer.disconnect).toHaveBeenCalledOnce();
    expect(cancelAnimationFrame).toHaveBeenCalledWith(7);
  });

  it('离开当前内容机制时标记 incomplete 并释放采样资源', async () => {
    document.body.innerHTML = '<div id="title" hidden></div><div id="viewport"><canvas id="game"></canvas></div><section id="overlay"><div class="card page"><h2 id="ovTitle"></h2><div id="ovBody"><div class="pg card-library-page"></div></div></div></section>';
    const originalDraw = vi.fn();
    const observer = { observe: vi.fn(), disconnect: vi.fn() };
    vi.stubGlobal('PerformanceObserver', vi.fn(() => observer));
    let rafCallback;
    vi.stubGlobal('requestAnimationFrame', vi.fn(callback => { rafCallback = callback; return 9; }));
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    const renderer = { draw: originalDraw };
    installPerfProbe({ SDT: { Renderer: renderer }, game: { state: 'idle' },
      canvas: document.getElementById('game'), renderScheduler: { invalidate: vi.fn() } });

    document.querySelector('[data-perf-handle]').click();
    document.querySelector('button[data-perf="page"]').click();
    expect(document.querySelector('#vitePerfResult').dataset.state).toBe('running');
    document.querySelector('.card-library-page').className = 'pg hub result-pg';
    document.querySelector('.hub.result-pg').id = 'exMain';
    rafCallback(100);
    await Promise.resolve();
    await Promise.resolve();

    expect(document.querySelector('#vitePerfResult').dataset.state).toBe('incomplete');
    expect(document.querySelector('#vitePerfResult').textContent).toContain('页面机制已变化');
    expect(renderer.draw).toBe(originalDraw);
    expect(observer.disconnect).toHaveBeenCalledOnce();
    expect(cancelAnimationFrame).toHaveBeenCalledWith(9);
  });

  it('overlay打开时把面板挂进前景并在隐藏后移回body，不解除外部inert', async () => {
    document.body.innerHTML = '<div id="title" hidden></div><div id="viewport" inert></div><section id="overlay"><div class="card page"><h2 id="ovTitle"></h2><div id="ovBody"><div id="hubMain" class="pg hub hub-classes"></div></div></div></section>';
    const NativeMutationObserver = MutationObserver;
    vi.stubGlobal('MutationObserver', class extends NativeMutationObserver {
      constructor(callback) { super(callback); overlayVisibilityObserver = this; }
    });
    const renderer = { draw: vi.fn() };
    const args = { SDT: { Renderer: renderer }, game: { state: 'idle' },
      canvas: document.createElement('canvas'), renderScheduler: { invalidate: vi.fn() } };
    installPerfProbe(args);

    const panel = document.getElementById('vitePerfProbe');
    const overlay = document.getElementById('overlay');
    expect(panel.parentElement).toBe(overlay);
    expect(panel.closest('[inert]')).toBeNull();
    expect(panel.inert).toBe(false);
    expect(document.getElementById('viewport').hasAttribute('inert')).toBe(true);
    panel.querySelector('[data-perf-handle]').click();
    expect(panel.dataset.collapsed).toBe('false');
    expect(overlay.hasAttribute('inert')).toBe(false);

    const observerAtInstall = overlayVisibilityObserver;
    installPerfProbe(args);
    expect(document.getElementById('vitePerfProbe')).toBe(panel);
    expect(overlayVisibilityObserver).toBe(observerAtInstall);
    panel.setAttribute('inert', '');
    overlay.hidden = true;
    await Promise.resolve();
    await Promise.resolve();

    expect(panel.parentElement).toBe(document.body);
    expect(panel.inert).toBe(false);
    expect(panel.hasAttribute('inert')).toBe(false);
    expect(document.getElementById('viewport').hasAttribute('inert')).toBe(true);
  });
});
