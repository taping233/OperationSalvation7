import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import frames from '../game/data/card-frame-layout.json';
import manifest from '../game/src/generated/art-manifest.js';
import thumbnails from '../game/src/generated/thumb-manifest.js';
import { assetUrl } from '../game/src/core/asset-url.js';
import { createForegroundImageYield, planStartupArtPreload } from '../game/src/core/art-preload-plan.js';

let idle, Art, requests, now;
const flush = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };
const frameUrls = () => Object.values(frames).map(frame => assetUrl(`assets/${frame.path}`));
function foreground() {
  document.body.innerHTML = '<div id="overlay"><div id="ovBody"><main class="hub-page"><section><img src="visible.webp"></section></main></div></div>';
  const image = document.querySelector('img');
  Object.defineProperty(image, 'complete', { configurable: true, writable: true, value: false });
  image.getClientRects = vi.fn(() => [{ width: 80, height: 80 }]);
  image.getBoundingClientRect = vi.fn(() => ({ left: 20, top: 20, right: 100, bottom: 100, width: 80, height: 80 }));
  return image;
}
beforeEach(async () => {
  vi.resetModules(); vi.useFakeTimers(); idle = []; requests = []; now = 0;
  document.body.replaceChildren();
  vi.stubGlobal('scheduler', { postTask: vi.fn(() => Promise.resolve()) });
  vi.stubGlobal('requestIdleCallback', task => { idle.push(task); return idle.length; });
  vi.stubGlobal('fetch', vi.fn((url, options) => new Promise(resolve => requests.push({ url, options, resolve }))));
  vi.spyOn(performance, 'now').mockImplementation(() => now);
  await import('../game/src/core/art.js'); Art = window.SDT.Art;
});
afterEach(() => {
  document.body.replaceChildren(); vi.clearAllTimers(); vi.useRealTimers();
  vi.restoreAllMocks(); vi.unstubAllGlobals();
});

describe('启动预热集合与顺序', () => {
  it('保留旧清单完整集合，新增项仅是现行人物URL与现行卡框，且先于全缩略图', () => {
    const sceneUrls = ['current-scene.webp'];
    const figureUrls = Art.collectCardAssets([]);
    const thumbnailUrls = thumbnails.map(path => assetUrl(`assets/thumbs/${path}`));
    const manifestUrls = manifest.map(path => assetUrl(`assets/${path}`));
    const original = [...sceneUrls, ...thumbnailUrls, ...manifestUrls];
    const urls = planStartupArtPreload({ sceneUrls, figureUrls, thumbnailUrls, manifestUrls });
    expect(new Set(urls)).toEqual(new Set([...original, ...figureUrls, ...frameUrls()]));
    expect(urls).toHaveLength(new Set(urls).size);
    expect(urls[0]).toBe(sceneUrls[0]);
    const firstThumbnail = urls.indexOf(thumbnailUrls[0]);
    for (const url of [...figureUrls, ...frameUrls()]) expect(urls.indexOf(url)).toBeLessThan(firstThumbnail);
    expect(figureUrls.some(url => url.includes('portraits/frames/'))).toBe(false);
  });
  it('URL查询参数原样保留，不以路径相同为由丢失实际渲染版本，也不改输入数组', () => {
    const figureUrls = ['portrait.webp?art=current&v=release'];
    const manifestUrls = ['portrait.webp?v=release', 'scene.webp?v=release'];
    const urls = planStartupArtPreload({ figureUrls, manifestUrls, thumbnailUrls: ['thumb.webp', 'thumb.webp'] });
    expect(urls[0]).toBe(figureUrls[0]);
    expect(urls).toContain(manifestUrls[0]);
    expect(urls.filter(url => url === 'thumb.webp')).toHaveLength(1);
    expect(manifestUrls).toEqual(['portrait.webp?v=release', 'scene.webp?v=release']);
  });
  it('无人物或可选清单时仍包含全部现行卡框，不生成手写过期路径', () => {
    expect(planStartupArtPreload()).toEqual([...new Set(frameUrls())]);
  });
});

describe('前台未完成图片让路', () => {
  it.each(['load', 'error'])('%s后立即允许后台继续，不依赖额外全局busy状态', event => {
    const image = foreground(), pending = createForegroundImageYield(document, () => now);
    expect(pending()).toBe(true);
    image.complete = true; image.dispatchEvent(new Event(event));
    expect(pending()).toBe(false);
  });
  it('display:none、离屏或已脱离文档的旧图不阻塞，已加载图不读取布局', () => {
    const image = foreground(), pending = createForegroundImageYield(document, () => now);
    image.getClientRects.mockReturnValue([]); expect(pending()).toBe(false);
    expect(image.getBoundingClientRect).not.toHaveBeenCalled();
    image.getClientRects.mockReturnValue([{}]);
    image.getBoundingClientRect.mockReturnValue({ left: 5000, top: 0, right: 5080, bottom: 80, width: 80, height: 80 });
    expect(pending()).toBe(false);
    image.getBoundingClientRect.mockClear(); image.complete = true;
    expect(pending()).toBe(false); expect(image.getBoundingClientRect).not.toHaveBeenCalled();
    image.complete = false; image.remove(); expect(pending()).toBe(false);
  });
  it('单页坏图等待封顶，换页给新可见图新窗口，同页不反复扫描全图片集合', () => {
    foreground();
    const page = document.querySelector('.hub-page'), scan = vi.spyOn(page, 'querySelectorAll');
    const pending = createForegroundImageYield(document, () => now);
    expect(pending()).toBe(true); now = 1499; expect(pending()).toBe(true);
    expect(scan).toHaveBeenCalledTimes(1);
    now = 1500; expect(pending()).toBe(false); now = 5000; expect(pending()).toBe(false);
    const replacement = document.createElement('section');
    const image = document.createElement('img'); image.src = 'new-page.webp';
    Object.defineProperty(image, 'complete', { value: false });
    image.getClientRects = () => [{}];
    image.getBoundingClientRect = () => ({ left: 0, top: 0, right: 80, bottom: 80, width: 80, height: 80 });
    replacement.append(image); page.replaceChildren(replacement);
    expect(pending()).toBe(true); expect(scan).toHaveBeenCalledTimes(2);
  });
  it('只观察当前大卡或打开的页，隐藏overlay不阻塞', () => {
    foreground(); document.getElementById('overlay').hidden = true;
    const pending = createForegroundImageYield(document, () => now);
    expect(pending()).toBe(false);
    const zoom = document.createElement('div'); zoom.id = 'cardZoom';
    zoom.append(document.querySelector('img')); document.body.append(zoom);
    expect(pending()).toBe(true);
  });
});

describe('后台预取批次调度', () => {
  it('每批至多4条低优先级fetch，整批完成后才排下一批，不创建解码Image', async () => {
    const image = vi.fn(); vi.stubGlobal('Image', image);
    const progress = vi.fn(), urls = Array.from({ length: 9 }, (_, i) => `asset-${i}.webp`);
    const done = Art.prefetchBatched(urls, progress, 4);
    expect(fetch).not.toHaveBeenCalled(); idle.shift()();
    expect(requests).toHaveLength(4);
    expect(requests.every(request => request.options.cache === 'force-cache' && request.options.priority === 'low')).toBe(true);
    for (const request of requests.slice(0, 3)) request.resolve({ ok: true, arrayBuffer: async () => new ArrayBuffer(0) });
    await flush(); expect(idle).toHaveLength(0);
    requests[3].resolve({ ok: true, arrayBuffer: async () => new ArrayBuffer(0) });
    await flush(); idle.shift()(); expect(requests).toHaveLength(8);
    for (const request of requests.slice(4, 8)) request.resolve({ ok: true, arrayBuffer: async () => new ArrayBuffer(0) });
    await flush(); idle.shift()(); expect(requests).toHaveLength(9);
    requests[8].resolve({ ok: true, arrayBuffer: async () => new ArrayBuffer(0) });
    await flush(); idle.shift()(); await done;
    expect(progress.mock.calls.at(-1)).toEqual([9, 9]); expect(image).not.toHaveBeenCalled();
  });
  it('前台加载时不启动下一批，load后恢复；沿用卡牌库暂停，关闭后不漏URL', async () => {
    const visible = foreground(); document.body.classList.add('cardlib-open');
    const done = Art.prefetchBatched(['one.webp']);
    idle.shift()(); expect(requests).toHaveLength(0);
    document.body.classList.remove('cardlib-open');
    vi.advanceTimersByTime(160); idle.shift()(); expect(requests).toHaveLength(0);
    visible.complete = true; visible.dispatchEvent(new Event('load'));
    vi.advanceTimersByTime(160); idle.shift()(); expect(requests).toHaveLength(1);
    requests[0].resolve({ ok: true, arrayBuffer: async () => new ArrayBuffer(0) });
    await flush(); idle.shift()(); await done;
    expect(requests.map(request => request.url)).toEqual(['one.webp']);
  });
  it('前台坏图到达有界退路后继续；后台失败结算且后续可重试，成功项保持去重', async () => {
    foreground(); vi.spyOn(console, 'warn').mockImplementation(() => {});
    const done = Art.prefetchBatched(['bad.webp', 'ok.webp', 'ok.webp'], null, 4);
    idle.shift()(); expect(requests).toHaveLength(0);
    now = 1500; vi.advanceTimersByTime(160); idle.shift()(); expect(requests).toHaveLength(2);
    requests[0].resolve({ ok: false, status: 404 });
    requests[1].resolve({ ok: true, arrayBuffer: async () => new ArrayBuffer(0) });
    await flush(); idle.shift()(); await done;
    document.body.replaceChildren();
    const retry = Art.prefetchBatched(['bad.webp', 'ok.webp']); idle.shift()();
    expect(requests.map(request => request.url)).toEqual(['bad.webp', 'ok.webp', 'bad.webp']);
    requests[2].resolve({ ok: true, arrayBuffer: async () => new ArrayBuffer(0) });
    await flush(); idle.shift()(); await retry;
  });
});
