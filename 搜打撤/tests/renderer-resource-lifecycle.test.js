import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
let Renderer, game, ctx, images;
const context = () => new Proxy({ drawImage: vi.fn(), measureText: () => ({ width: 10 }) }, {
  get(target, key) {
    return target[key] ??= String(key).startsWith('create') ? () => ({ addColorStop() {} }) : vi.fn();
  },
});
const backdrop = () => { ctx.drawImage.mockClear(); Renderer.draw(ctx, game); return ctx.drawImage.mock.calls[0][0]; };
beforeEach(async () => {
  vi.resetModules(); vi.useFakeTimers(); images = [];
  vi.stubGlobal('Image', class { complete = false; naturalWidth = 0; constructor() { images.push(this); } });
  vi.stubGlobal('Path2D', class { moveTo() {} quadraticCurveTo() {} bezierCurveTo() {} lineTo() {} closePath() {} addPath() {} });
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(context);
  vi.stubGlobal('requestAnimationFrame', fn => setTimeout(() => fn(performance.now()), 16));
  vi.stubGlobal('cancelAnimationFrame', id => clearTimeout(id));
  Object.defineProperty(window, 'devicePixelRatio', { configurable: true, value: 1 });
  const node = { li: 0, idx: 0, x: 100, y: 100, def: { type: 'blank' } };
  game = { nodes: [node], layerIdx: 0, trackPos: 0, nodePos: [[node]],
    layerData: [{ logical: [{ next: [], def: node.def }] }], toggles: { index: false },
    cam: { viewW: 800, viewH: 600, zoom: 1, cx: 100, cy: 100, worldToScreen: () => ({ x: 400, y: 300 }) } };
  window.SDT = { Motion: { reduceMotion: () => false } };
  await import('../game/src/core/renderer.js'); Renderer = window.SDT.Renderer; ctx = context();
});
afterEach(() => { Renderer?.dispose?.(); vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers(); });

describe('Canvas背景缓存生命周期', () => {
  it('逻辑视口未变但DPR改变时重烘焙，后续相同输入复用', () => {
    const first = backdrop(); expect(first.width).toBe(800);
    Object.defineProperty(window, 'devicePixelRatio', { value: 2 });
    const high = backdrop(); expect(high.width).toBe(1200); expect(high).not.toBe(first);
    expect(backdrop()).toBe(high);
  });
  it('停止resize后持续draw不会延后150ms重烘焙', () => {
    const first = backdrop(); game.cam.viewW = 900; expect(backdrop()).toBe(first);
    for (let i = 0; i < 9; i++) { vi.advanceTimersByTime(16); expect(backdrop()).toBe(first); }
    vi.advanceTimersByTime(6); const resized = backdrop();
    expect(resized).not.toBe(first); expect(resized.width).toBe(900); expect(backdrop()).toBe(resized);
  });
  it('连续真实resize从最后一次尺寸变化防抖，只重烘焙最终尺寸', () => {
    const first = backdrop(); game.cam.viewW = 850; expect(backdrop()).toBe(first);
    vi.advanceTimersByTime(100); game.cam.viewW = 900; expect(backdrop()).toBe(first);
    vi.advanceTimersByTime(100); expect(backdrop()).toBe(first);
    vi.advanceTimersByTime(50); const final = backdrop(); expect(final.width).toBe(900); expect(final).not.toBe(first);
    expect(backdrop()).toBe(final); expect(vi.getTimerCount()).toBe(0);
  });
  it('pending resize期间DPR变化立即重烘焙，并取消过期resize计时器', () => {
    const first = backdrop(); game.cam.viewW = 900; expect(backdrop()).toBe(first);
    Object.defineProperty(window, 'devicePixelRatio', { value: 2 });
    const high = backdrop(); expect(high.width).toBe(1350); expect(vi.getTimerCount()).toBe(0);
    vi.advanceTimersByTime(500); expect(backdrop()).toBe(high);
  });
  it('resize回到原尺寸取消防抖，不无故重建', () => {
    const first = backdrop(); game.cam.viewW = 900; backdrop(); game.cam.viewW = 800;
    expect(backdrop()).toBe(first); expect(vi.getTimerCount()).toBe(0);
  });
  it('dispose取消换层fade的帧驱动，并停止旧实例绘制', () => {
    images[0].complete = true; images[0].naturalWidth = images[0].naturalHeight = 100;
    backdrop(); game.layerIdx = 1; backdrop(); expect(vi.getTimerCount()).toBeGreaterThan(0);
    Renderer.dispose(); expect(vi.getTimerCount()).toBe(0);
    ctx.drawImage.mockClear(); Renderer.draw(ctx, game); expect(ctx.drawImage).not.toHaveBeenCalled();
  });
  it('dispose取消pending resize，重复dispose无副作用，迟到图片不唤醒', async () => {
    const { renderScheduler } = await import('../game/src/core/render-scheduler.js');
    const wake = vi.fn(); renderScheduler.setWake(wake);
    backdrop(); game.cam.viewW = 900; backdrop(); wake.mockClear();
    expect(vi.getTimerCount()).toBeGreaterThan(0); expect(Renderer.dispose).toEqual(expect.any(Function));
    Renderer.dispose(); Renderer.dispose(); expect(vi.getTimerCount()).toBe(0);
    images.slice(0, 2).forEach(image => image.onload?.()); vi.advanceTimersByTime(1000); expect(wake).not.toHaveBeenCalled();
    renderScheduler.setWake(null);
  });
});


describe('地图玩家可见编号', () => {
  it.each([0, 7, 10])('内部索引 %i 绘制为同预览的一基编号，绘制不改索引', idx => {
    const node = { ...game.nodes[0], idx };
    game.nodes = [node]; game.nodePos = [[node]]; game.trackPos = idx;
    game.layerData[0].logical = Array.from({ length: idx + 1 }, () => ({ next: [], def: node.def }));
    game.toggles.index = true;
    Renderer.draw(ctx, game);
    expect(ctx.fillText.mock.calls.filter(([text]) => /^\d+$/.test(text)).map(([text]) => text)).toEqual([String(idx + 1)]);
    expect(node.idx).toBe(idx); expect(game.trackPos).toBe(idx);
    ctx.fillText.mockClear(); game.toggles.index = false; Renderer.draw(ctx, game);
    expect(ctx.fillText.mock.calls.filter(([text]) => /^\d+$/.test(text))).toEqual([]);
  });
});


it('quality changes rebuild only the backdrop sampling budget and keep node text', async () => {
  const { setPerformanceSettings } = await import('../game/src/core/performance-settings.js');
  Object.defineProperty(window, 'devicePixelRatio', { value: 3 });
  setPerformanceSettings({ quality: 'low' }); expect(backdrop().width).toBe(800);
  setPerformanceSettings({ quality: 'balanced' }); expect(backdrop().width).toBe(1200);
  setPerformanceSettings({ quality: 'high' }); expect(backdrop().width).toBe(1600);
  setPerformanceSettings({ quality: 'balanced' });
});
