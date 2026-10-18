import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import frames from '../game/data/card-frame-layout.json';
import manifest from '../game/src/generated/art-manifest.js';
import thumbnails from '../game/src/generated/thumb-manifest.js';
import { assetUrl } from '../game/src/core/asset-url.js';
import { PRELOAD_SCENES } from '../game/src/run/game.run.data.js';
import { STARTUP_SCENE_KEYS } from '../game/src/core/performance-budgets.js';
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
  it('battle card-only collection excludes unrelated portraits while general collectors remain available', () => {
    const cards = [{ id: 'starter-attack', name: '杀', type: '武术' }];
    const allPortraits = Art.collectCardAssets([]);
    expect(allPortraits.some(url => url.includes('portraits/enemies/'))).toBe(true);
    expect(allPortraits.some(url => url.includes('portraits/full/'))).toBe(true);
    const cardsOnly = Art.collectCardAssets(cards, { includePortraits: false });
    const expectedUrl = /src="([^"]+)"/.exec(Art.cardIcon(cards[0]))[1];
    expect(cardsOnly).toEqual([expectedUrl]);
    expect(Art.collectCardAssets([], { includePortraits: false })).toEqual([]);
    expect(Art.collectCardAssets(cards)).toEqual([...allPortraits, expectedUrl]);
  });
  it.each(['https:', 'http:', 'app:'])('%s startup keeps only six common scenes and thirteen current card frames', protocol => {
    const sceneUrls = STARTUP_SCENE_KEYS.map(key => PRELOAD_SCENES[key]);
    const figureUrls = Art.collectCardAssets([]);
    const thumbnailUrls = thumbnails.map(path => assetUrl(`assets/thumbs/${path}`));
    const manifestUrls = manifest.map(path => assetUrl(`assets/${path}`));
    const urls = planStartupArtPreload({ protocol, sceneUrls, figureUrls, thumbnailUrls, manifestUrls });
    expect(sceneUrls).toHaveLength(6);
    expect(frameUrls()).toHaveLength(13);
    expect(urls).toEqual([...sceneUrls, ...frameUrls()]);
    expect(urls).toHaveLength(19);
    expect(urls.some(url => url.includes('/thumbs/') || url.includes('/portraits/'))).toBe(false);
  });
  it('keeps final versioned scene URLs, deduplicates equal URLs and does not mutate inputs', () => {
    const sceneUrls = ['scene.webp?art=current&v=release', 'scene.webp?v=release', 'scene.webp?v=release', frameUrls()[0]];
    const before = [...sceneUrls];
    const urls = planStartupArtPreload({ sceneUrls });
    expect(urls).toEqual([...new Set([...sceneUrls, ...frameUrls()])]);
    expect(urls).toContain('scene.webp?art=current&v=release');
    expect(urls).toContain('scene.webp?v=release');
    expect(sceneUrls).toEqual(before);
  });
  it('no optional catalogue fallback: an empty scene plan still includes only current card frames', () => {
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
  it('重叠调用共享同一未完成请求，各自进度仍完整结算', async () => {
    const firstProgress = vi.fn(), secondProgress = vi.fn();
    const first = Art.prefetchBatched(['shared.webp'], firstProgress);
    const second = Art.prefetchBatched(['shared.webp'], secondProgress);
    idle.shift()(); idle.shift()();
    expect(requests.map(request => request.url)).toEqual(['shared.webp']);
    requests[0].resolve({ ok: true, arrayBuffer: async () => new ArrayBuffer(0) });
    await flush(); while (idle.length) idle.shift()(); await Promise.all([first, second]);
    expect(firstProgress.mock.calls.at(-1)).toEqual([1, 1]);
    expect(secondProgress.mock.calls.at(-1)).toEqual([1, 1]);
  });
  it('重叠失败结算后释放in-flight，下次调用可重试', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const first = Art.prefetchBatched(['retry-shared.webp']);
    const second = Art.prefetchBatched(['retry-shared.webp']);
    idle.shift()(); idle.shift()(); expect(requests).toHaveLength(1);
    requests[0].resolve({ ok: false, status: 503 });
    await flush(); while (idle.length) idle.shift()(); await Promise.all([first, second]);
    const retry = Art.prefetchBatched(['retry-shared.webp']); idle.shift()();
    expect(requests).toHaveLength(2);
    requests[1].resolve({ ok: true, arrayBuffer: async () => new ArrayBuffer(0) });
    await flush(); while (idle.length) idle.shift()(); await retry;
  });
  it('较晚执行的旧队列复核已完成集合，不重复预取', async () => {
    const first = Art.prefetchBatched(['queued.webp']);
    const queued = Art.prefetchBatched(['queued.webp']);
    const firstStart = idle.shift(), queuedStart = idle.shift(); firstStart();
    requests[0].resolve({ ok: true, arrayBuffer: async () => new ArrayBuffer(0) });
    await flush(); while (idle.length) idle.shift()(); await first;
    queuedStart(); await flush(); while (idle.length) idle.shift()(); await queued;
    expect(requests).toHaveLength(1);
  });

  it.each(['hidden', 'moving', 'input'])('%s期间让出后台批次，恢复后继续原清单', async reason => {
    const hidden = vi.spyOn(document, 'hidden', 'get').mockReturnValue(reason === 'hidden');
    document.body.dataset.state = reason === 'moving' ? 'moving' : 'idle';
    const input = vi.fn(() => reason === 'input');
    Object.defineProperty(navigator, 'scheduling', { configurable: true, value: { isInputPending: input } });
    try {
      const done = Art.prefetchBatched(['deferred.webp']);
      idle.shift()(); expect(requests).toHaveLength(0);
      hidden.mockReturnValue(false); document.body.dataset.state = 'idle'; input.mockReturnValue(false);
      vi.advanceTimersByTime(160); idle.shift()(); expect(requests).toHaveLength(1);
      requests[0].resolve({ ok: true, arrayBuffer: async () => new ArrayBuffer(0) });
      await flush(); idle.shift()(); await done;
    } finally { delete navigator.scheduling; delete document.body.dataset.state; }
  });
  it('流式耗尽响应后才计入完成，不分配完整ArrayBuffer，失败释放reader并可重试', async () => {
    const read = vi.fn().mockResolvedValueOnce({ done: false, value: new Uint8Array(4) }).mockResolvedValueOnce({ done: true });
    const releaseLock = vi.fn(), arrayBuffer = vi.fn(), progress = vi.fn();
    const done = Art.prefetchBatched(['stream.webp'], progress);
    idle.shift()();
    requests[0].resolve({ ok: true, body: { getReader: () => ({ read, releaseLock }) }, arrayBuffer });
    await flush(); idle.shift()(); await done;
    expect(read).toHaveBeenCalledTimes(2); expect(releaseLock).toHaveBeenCalledTimes(1);
    expect(arrayBuffer).not.toHaveBeenCalled(); expect(progress.mock.calls.at(-1)).toEqual([1, 1]);
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const failedRead = vi.fn().mockRejectedValue(new Error('disconnected'));
    const failed = Art.prefetchBatched(['broken-stream.webp']); idle.shift()();
    requests[1].resolve({ ok: true, body: { getReader: () => ({ read: failedRead, releaseLock }) } });
    await flush(); idle.shift()(); await failed;
    expect(releaseLock).toHaveBeenCalledTimes(2);
    const retry = Art.prefetchBatched(['stream.webp', 'broken-stream.webp']); idle.shift()();
    expect(requests.map(r => r.url)).toEqual(['stream.webp','broken-stream.webp','broken-stream.webp']);
    requests[2].resolve({ ok: true, arrayBuffer: async () => new ArrayBuffer(0) });
    await flush(); idle.shift()(); await retry;
  });
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
