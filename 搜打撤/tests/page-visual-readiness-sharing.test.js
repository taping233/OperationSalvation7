import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { waitPageVisual, stagePageVisual, cancelPageVisual } from '../game/src/ui/page-visual-ready.js';
import { createCityCut, playPreparedCut, enterCamp, clearCampEntry, cityCutDuration } from '../game/src/ui/camp-entry.js';
import { runPageLoading } from '../game/src/ui/page-loading.js';

// Motion playback is outside the resource gate; readiness and curtain logic stay real.
vi.mock('../game/src/core/motion.js', () => ({ reduceMotion: () => false }));

let ui;
let finishCut;
let abortLoading;
const visible = { width: 160, height: 160, top: 0, left: 0, right: 160, bottom: 160 };
const body = () => document.getElementById('ovBody');
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};
function portrait(host = body(), source = '/portrait.webp') {
  const image = document.createElement('img');
  image.src = source;
  Object.defineProperty(image, 'naturalWidth', { configurable: true, value: 160 });
  image.getBoundingClientRect = vi.fn(() => visible);
  const decoded = deferred();
  image.decode = vi.fn(() => decoded.promise);
  host.append(image);
  return { image, decoded };
}
function readyArtwork(cut) {
  const image = cut.querySelector('img');
  Object.defineProperty(image, 'naturalWidth', { configurable: true, value: 640 });
  image.dispatchEvent(new Event('load'));
}
function expectSinglePass(scan, image) {
  expect({
    scans: scan.mock.calls.filter(([selector]) => selector === 'img').length,
    measurements: image.getBoundingClientRect.mock.calls.length,
    decodes: image.decode.mock.calls.length,
  }).toEqual({ scans: 1, measurements: 1, decodes: 1 });
}
beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal('requestAnimationFrame', fn => setTimeout(() => fn(performance.now()), 16));
  vi.stubGlobal('cancelAnimationFrame', clearTimeout);
  document.body.innerHTML = '<div id="viewport"></div><div id="overlay"><div class="card"><div id="ovBody"><main class="settings-page"></main></div></div></div>';
  ui = { _overlayRevision: 1, _pageBgReady: Promise.resolve(),
    el: { overlay: document.getElementById('overlay'), ovBody: body() } };
  window.SDT = { UI: ui };
});
afterEach(async () => {
  abortLoading?.abort(); abortLoading = null;
  finishCut?.(); finishCut = null;
  cancelPageVisual(); clearCampEntry();
  await vi.runAllTimersAsync();
  document.body.replaceChildren();
  delete window.SDT;
  vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers();
});

describe('one resource pass per mounted destination', () => {
  it.each([2, 3])('shares scanning, measurement and decode across %i simultaneous gates', async count => {
    const { image, decoded } = portrait(document.querySelector('main'));
    const scan = vi.spyOn(Element.prototype, 'querySelectorAll');
    const waits = Array.from({ length: count }, () => waitPageVisual(body()));
    await vi.advanceTimersByTimeAsync(16);
    expectSinglePass(scan, image);
    decoded.resolve();
    await vi.advanceTimersByTimeAsync(16);
    expect(await Promise.all(waits)).toEqual(Array(count).fill(true));
    expect(vi.getTimerCount()).toBe(0);
  });
  it('shares warm settings cut and visual handoff without shortening the 980ms cut', async () => {
    const { image, decoded } = portrait(document.querySelector('main'));
    const scan = vi.spyOn(Element.prototype, 'querySelectorAll');
    const reveal = vi.fn(), onFinish = vi.fn();
    stagePageVisual(ui, reveal);
    const cut = createCityCut({ scene: 'general' });
    finishCut = playPreparedCut(document.querySelector('main'), cut, cityCutDuration, onFinish);
    readyArtwork(cut);
    await vi.advanceTimersByTimeAsync(48);
    expectSinglePass(scan, image);
    expect(reveal).not.toHaveBeenCalled();
    decoded.resolve(); await vi.advanceTimersByTimeAsync(16);
    expect(reveal).toHaveBeenCalledOnce();
    expect(cut.classList.contains('page-cut-waiting')).toBe(false);
    await vi.advanceTimersByTimeAsync(979);
    expect(cut.isConnected).toBe(true); expect(onFinish).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(cut.isConnected).toBe(false); expect(onFinish).toHaveBeenCalledOnce();
  });
  it('shares all three cold-settings gates through the real loading wrapper', async () => {
    const { image, decoded } = portrait(document.querySelector('main'));
    const scan = vi.spyOn(Element.prototype, 'querySelectorAll');
    const reveal = vi.fn();
    abortLoading = new AbortController();
    const loading = runPageLoading({ title: '设置', detail: '准备设置', signal: abortLoading.signal, open: () => {
      stagePageVisual(ui, reveal);
      const cut = createCityCut({ scene: 'general' });
      finishCut = playPreparedCut(document.querySelector('main'), cut);
      readyArtwork(cut);
      return 'settings';
    } });
    await vi.advanceTimersByTimeAsync(80);
    expectSinglePass(scan, image);
    expect(reveal).not.toHaveBeenCalled();
    decoded.resolve(); await vi.advanceTimersByTimeAsync(240);
    expect(await loading).toBe('settings'); expect(reveal).toHaveBeenCalledOnce();
  });
  it('shares camp entry and loading while excluding the archive ghost and curtain', async () => {
    body().innerHTML = '<main id="hubMain"><div class="hub-page"></div></main>';
    const { image, decoded } = portrait(document.querySelector('#hubMain'));
    const scan = vi.spyOn(Element.prototype, 'querySelectorAll');
    const ghost = document.createElement('div');
    const ghostPortrait = portrait(ghost);
    abortLoading = new AbortController();
    const loading = runPageLoading({ title: '基地', detail: '准备基地', signal: abortLoading.signal, open: () => {
      enterCamp(ui.el.overlay, ghost, false);
      readyArtwork(document.querySelector('.camp-entry-cut'));
      return 'camp';
    } });
    await vi.advanceTimersByTimeAsync(80);
    expectSinglePass(scan, image);
    expect(ghostPortrait.image.getBoundingClientRect).not.toHaveBeenCalled();
    expect(ghostPortrait.image.decode).not.toHaveBeenCalled();
    decoded.resolve(); await vi.advanceTimersByTimeAsync(240);
    expect(await loading).toBe('camp'); expect(ui.el.overlay.dataset.campEntry).toBe('1');
  });
  it.each(['page', 'artwork'])('follows an asynchronous hub refresh while waiting for %s', async waiting => {
    body().innerHTML = '<main id="hubMain"><div class="hub-page"></div></main>';
    const old = portrait(document.querySelector('#hubMain'));
    enterCamp(ui.el.overlay, null, false);
    const cut = document.querySelector('.camp-entry-cut');
    if (waiting === 'page') readyArtwork(cut);
    else old.decoded.resolve();
    await vi.advanceTimersByTimeAsync(48);
    expect(ui.el.overlay.dataset.campEntry).toBe('preparing');
    // The overlay renderer increments revision and replaces the body on refreshHub.
    ui._overlayRevision++;
    body().innerHTML = '<main id="hubMain"><div class="hub-page">Updated base</div></main>';
    const next = portrait(document.querySelector('#hubMain'));
    await vi.advanceTimersByTimeAsync(32);
    expect(next.image.decode).toHaveBeenCalledOnce();
    expect(document.querySelector('.camp-entry-cut')).toBe(cut);
    old.decoded.resolve(); readyArtwork(cut); await vi.advanceTimersByTimeAsync(32);
    expect(ui.el.overlay.dataset.campEntry).toBe('preparing');
    next.decoded.resolve(); await vi.advanceTimersByTimeAsync(16);
    expect(ui.el.overlay.dataset.campEntry).toBe('1');
    await vi.advanceTimersByTimeAsync(979); expect(cut.isConnected).toBe(true);
    await vi.advanceTimersByTimeAsync(1);
    expect(cut.isConnected).toBe(false); expect(ui.el.overlay.dataset.campEntry).toBeUndefined();
  });
  it('cleans an abandoned camp without an old completion clearing a newer camp marker', async () => {
    body().innerHTML = '<main id="hubMain"><div class="hub-page"></div></main>';
    const old = portrait(document.querySelector('#hubMain'));
    enterCamp(ui.el.overlay, null, false);
    const oldCut = document.querySelector('.camp-entry-cut'); readyArtwork(oldCut);
    await vi.advanceTimersByTimeAsync(16);
    ui._overlayRevision++; body().innerHTML = '<main>Other page</main>';
    await vi.advanceTimersByTimeAsync(0);
    expect(oldCut.isConnected).toBe(false); expect(ui.el.overlay.dataset.campEntry).toBeUndefined();
    body().innerHTML = '<main id="hubMain"><div class="hub-page"></div></main>';
    const next = portrait(document.querySelector('#hubMain'));
    enterCamp(ui.el.overlay, null, false);
    const nextCut = document.querySelector('.camp-entry-cut'); readyArtwork(nextCut);
    old.decoded.resolve(); await vi.advanceTimersByTimeAsync(32);
    expect(nextCut.isConnected).toBe(true); expect(ui.el.overlay.dataset.campEntry).toBe('preparing');
    next.decoded.resolve(); await vi.advanceTimersByTimeAsync(16);
    expect(ui.el.overlay.dataset.campEntry).toBe('1');
  });
});

describe('subscriber cancellation and deadlines', () => {
  it('cancels one subscriber without aborting the remaining resource wait', async () => {
    const { image, decoded } = portrait();
    const controller = new AbortController();
    const first = waitPageVisual(body(), { signal: controller.signal });
    const secondDone = vi.fn();
    const second = waitPageVisual(body()).then(secondDone);
    await vi.advanceTimersByTimeAsync(16);
    controller.abort(); await vi.advanceTimersByTimeAsync(32);
    expect(await first).toBe(false); expect(secondDone).not.toHaveBeenCalled();
    decoded.resolve(); await vi.advanceTimersByTimeAsync(16); await second;
    expect(secondDone).toHaveBeenCalledWith(true); expect(image.decode).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });
  it('keeps unequal deadlines independent, including a later subscriber', async () => {
    const { image, decoded } = portrait();
    const firstDone = vi.fn(), secondDone = vi.fn();
    const first = waitPageVisual(body(), { timeout: 40, frameReady: true }).then(firstDone);
    await vi.advanceTimersByTimeAsync(20);
    const second = waitPageVisual(body(), { timeout: 100, frameReady: true }).then(secondDone);
    await vi.advanceTimersByTimeAsync(36);
    await first; expect(firstDone).toHaveBeenCalledWith(true); expect(secondDone).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(30); expect(secondDone).not.toHaveBeenCalled();
    decoded.resolve(); await vi.advanceTimersByTimeAsync(16); await second;
    expect(secondDone).toHaveBeenCalledWith(true); expect(image.decode).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });
  it('does not cache a timed-out wait or let its late decode resolve the next wait', async () => {
    const { image, decoded } = portrait();
    const first = waitPageVisual(body(), { timeout: 20, frameReady: true });
    await vi.advanceTimersByTimeAsync(36); expect(await first).toBe(true);
    const nextDecode = deferred(); image.decode.mockReturnValueOnce(nextDecode.promise);
    const nextDone = vi.fn();
    const next = waitPageVisual(body(), { frameReady: true }).then(nextDone);
    decoded.resolve(); await vi.advanceTimersByTimeAsync(32);
    expect(nextDone).not.toHaveBeenCalled(); expect(image.decode).toHaveBeenCalledTimes(2);
    nextDecode.resolve(); await vi.advanceTimersByTimeAsync(16); await next;
    expect(nextDone).toHaveBeenCalledWith(true);
  });
  it('releases listeners when all subscribers cancel and starts a fresh wait on reentry', async () => {
    const { image } = portrait();
    delete image.decode;
    Object.defineProperty(image, 'complete', { configurable: true, value: false });
    const add = vi.spyOn(image, 'addEventListener'), remove = vi.spyOn(image, 'removeEventListener');
    const one = new AbortController(), two = new AbortController();
    const waits = [waitPageVisual(body(), { signal: one.signal }), waitPageVisual(body(), { signal: two.signal })];
    await vi.advanceTimersByTimeAsync(16);
    expect(add).toHaveBeenCalledTimes(2);
    one.abort(); expect(remove).not.toHaveBeenCalled();
    two.abort(); expect(remove).toHaveBeenCalledTimes(2);
    expect(await Promise.all(waits)).toEqual([false, false]);
    const next = waitPageVisual(body(), { frameReady: true });
    expect(add).toHaveBeenCalledTimes(4);
    image.dispatchEvent(new Event('load')); await vi.advanceTimersByTimeAsync(16);
    expect(await next).toBe(true); expect(vi.getTimerCount()).toBe(0);
  });
  it('waits for each subscriber background and fonts without repeating image work', async () => {
    const { image, decoded } = portrait();
    const background = deferred(), fonts = deferred();
    const previous = Object.getOwnPropertyDescriptor(document, 'fonts');
    Object.defineProperty(document, 'fonts', { configurable: true, value: { ready: fonts.promise } });
    try {
      const firstDone = vi.fn(), secondDone = vi.fn();
      const first = waitPageVisual(body()).then(firstDone);
      const second = waitPageVisual(body(), { background: background.promise }).then(secondDone);
      await vi.advanceTimersByTimeAsync(16); decoded.resolve(); await vi.advanceTimersByTimeAsync(32);
      expect(firstDone).not.toHaveBeenCalled(); expect(secondDone).not.toHaveBeenCalled();
      fonts.resolve(); await vi.advanceTimersByTimeAsync(16); await first;
      expect(firstDone).toHaveBeenCalledWith(true); expect(secondDone).not.toHaveBeenCalled();
      background.resolve(); await vi.advanceTimersByTimeAsync(16); await second;
      expect(secondDone).toHaveBeenCalledWith(true); expect(image.decode).toHaveBeenCalledOnce();
    } finally {
      if (previous) Object.defineProperty(document, 'fonts', previous);
      else delete document.fonts;
    }
  });
});

describe('page identity and representative image boundaries', () => {
  it('isolates a revision change even when the page DOM instance is reused', async () => {
    const { image, decoded } = portrait();
    const first = waitPageVisual(body(), { frameReady: true });
    ui._overlayRevision++;
    const nextDecode = deferred(); image.decode.mockReturnValueOnce(nextDecode.promise);
    const nextDone = vi.fn();
    const next = waitPageVisual(body(), { frameReady: true }).then(nextDone);
    decoded.resolve(); await vi.advanceTimersByTimeAsync(16);
    expect(await first).toBe(false); expect(nextDone).not.toHaveBeenCalled();
    nextDecode.resolve(); await vi.advanceTimersByTimeAsync(16); await next;
    expect(nextDone).toHaveBeenCalledWith(true); expect(image.decode).toHaveBeenCalledTimes(2);
  });
  it('captures the page before the layout frame and refuses a replacement', async () => {
    const old = waitPageVisual(body());
    body().innerHTML = '<main>Replacement</main>';
    const { image, decoded } = portrait();
    const next = waitPageVisual(body());
    await vi.advanceTimersByTimeAsync(16); expect(await old).toBe(false);
    decoded.resolve(); await vi.advanceTimersByTimeAsync(16);
    expect(await next).toBe(true); expect(image.decode).toHaveBeenCalledOnce();
  });
  it('isolates a replaced page even without a revision increment', async () => {
    const firstPortrait = portrait(document.querySelector('main'));
    const first = waitPageVisual(body(), { frameReady: true });
    body().innerHTML = '<main>Replacement</main>';
    const secondPortrait = portrait(document.querySelector('main'));
    const secondDone = vi.fn();
    const second = waitPageVisual(body(), { frameReady: true }).then(secondDone);
    firstPortrait.decoded.resolve(); await vi.advanceTimersByTimeAsync(16);
    expect(await first).toBe(false); expect(secondDone).not.toHaveBeenCalled();
    secondPortrait.decoded.resolve(); await vi.advanceTimersByTimeAsync(16); await second;
    expect(secondDone).toHaveBeenCalledWith(true);
  });
  it('does not share scans when extra roots differ', async () => {
    const one = document.createElement('aside'), two = document.createElement('aside');
    document.body.append(one, two);
    const a = portrait(one), b = portrait(two);
    const firstDone = vi.fn(), secondDone = vi.fn();
    const first = waitPageVisual(body(), { extraRoots: [one] }).then(firstDone);
    const second = waitPageVisual(body(), { extraRoots: [two] }).then(secondDone);
    await vi.advanceTimersByTimeAsync(16);
    a.decoded.resolve(); await vi.advanceTimersByTimeAsync(16); await first;
    expect(firstDone).toHaveBeenCalledWith(true); expect(secondDone).not.toHaveBeenCalled();
    b.decoded.resolve(); await vi.advanceTimersByTimeAsync(16); await second;
    expect(secondDone).toHaveBeenCalledWith(true);
  });
  it('keeps the 12-image cap and lazy, hidden, grid and viewport exclusions', async () => {
    const lazy = portrait(), hidden = portrait(), grid = portrait(), outside = portrait();
    lazy.image.loading = 'lazy';
    hidden.image.hidden = true;
    grid.image.className = 'lib-grid';
    outside.image.getBoundingClientRect.mockReturnValue({ ...visible, top: window.innerHeight });
    const portraits = Array.from({ length: 14 }, () => portrait());
    const wait = waitPageVisual(body());
    await vi.advanceTimersByTimeAsync(16);
    for (const { image } of [lazy, hidden, grid, outside, ...portraits.slice(12)]) expect(image.decode).not.toHaveBeenCalled();
    for (const { image, decoded } of portraits.slice(0, 12)) {
      expect(image.decode).toHaveBeenCalledOnce(); decoded.resolve();
    }
    await vi.advanceTimersByTimeAsync(16); expect(await wait).toBe(true);
  });
  it('accepts image errors as settled resources without extending the wait', async () => {
    const { image, decoded } = portrait();
    const waits = [waitPageVisual(body()), waitPageVisual(body())];
    await vi.advanceTimersByTimeAsync(16); decoded.reject(new Error('decode failed'));
    await vi.advanceTimersByTimeAsync(16);
    expect(await Promise.all(waits)).toEqual([true, true]); expect(image.decode).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });
});
