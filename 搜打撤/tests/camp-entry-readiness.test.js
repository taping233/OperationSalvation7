import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createCityCut, playPreparedCut, prepareCityCut, cityCutDuration } from '../game/src/ui/camp-entry.js';

// Keep the real readiness modules; only emulate browser image delivery and clocks.
let finish;
beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal('requestAnimationFrame', fn => setTimeout(() => fn(performance.now()), 16));
  vi.stubGlobal('cancelAnimationFrame', clearTimeout);
  document.body.innerHTML = '<div id="overlay"><div class="card"><div id="ovBody"><main>Achievements</main></div></div></div>';
  window.SDT = {};
});
afterEach(() => {
  finish?.(); finish = null;
  document.body.replaceChildren();
  vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks();
});
function start() {
  const cut = createCityCut({ scene: 'achievement' });
  const image = cut.querySelector('img');
  Object.defineProperty(image, 'complete', { configurable: true, value: false });
  Object.defineProperty(image, 'naturalWidth', { configurable: true, value: 0 });
  const onFinish = vi.fn();
  finish = playPreparedCut(document.querySelector('main'), cut, cityCutDuration, onFinish);
  return { cut, image, onFinish };
}
it.each(['settings-page', 'achievement-gallery', 'cls-pool-page'])(
  'legacy cut adapters cannot mask the shared %s navigation surface', className => {
    const page = document.querySelector('main');
    page.className = className;
    const cut = createCityCut();
    const onFinish = vi.fn();
    finish = playPreparedCut(page, cut, cityCutDuration, onFinish);
    expect(document.querySelector('.camp-entry-cut')).toBeNull();
    expect(onFinish).toHaveBeenCalledOnce();
    finish();
    expect(onFinish).toHaveBeenCalledOnce();
  });
async function expectFinished(cut, onFinish) {
  await vi.advanceTimersByTimeAsync(cityCutDuration + 64);
  expect(cut.isConnected).toBe(false);
  expect(onFinish).toHaveBeenCalledOnce();
  finish();
  expect(onFinish).toHaveBeenCalledOnce();
  expect(vi.getTimerCount()).toBe(0);
}
describe('achievement curtain with real image-readiness implementation', () => {
  it('reveals after a successful image and removes the cut once', async () => {
    const { cut, image, onFinish } = start();
    Object.defineProperty(image, 'naturalWidth', { value: 640 });
    image.dispatchEvent(new Event('load'));
    await vi.advanceTimersByTimeAsync(64);
    expect(cut.classList.contains('page-cut-waiting')).toBe(false);
    expect(cut.dataset.scenery).toBeUndefined();
    await expectFinished(cut, onFinish);
  });
  it('reveals the opaque fallback after an image error and removes it once', async () => {
    const { cut, image, onFinish } = start();
    image.dispatchEvent(new Event('error'));
    await vi.advanceTimersByTimeAsync(64);
    expect(cut.dataset.scenery).toBe('fallback');
    expect(image.style.display).toBe('none');
    await vi.advanceTimersByTimeAsync(16);
    expect(cut.classList.contains('page-cut-waiting')).toBe(false);
    await expectFinished(cut, onFinish);
  });
  it('bounds an unresponsive image to 3000ms, then reveals fallback', async () => {
    const { cut, image, onFinish } = start();
    await vi.advanceTimersByTimeAsync(2999);
    expect(cut.classList.contains('page-cut-waiting')).toBe(true);
    expect(onFinish).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(cut.dataset.scenery).toBe('fallback');
    expect(image.style.display).toBe('none');
    await vi.advanceTimersByTimeAsync(16);
    expect(cut.classList.contains('page-cut-waiting')).toBe(false);
    await expectFinished(cut, onFinish);
  });
  it('falls back when browser decode rejects', async () => {
    const cut = createCityCut({ scene: 'achievement' });
    cut.querySelector('img').decode = () => Promise.reject(new Error('decode failed'));
    await expect(prepareCityCut(cut)).resolves.toBe(true);
    expect(cut.dataset.scenery).toBe('fallback');
    expect(vi.getTimerCount()).toBe(0);
  });
  it.each(['cancel', 'replace', 'closing', 'native-closing', 'hidden', 'detached'])('cleans on %s and ignores late load/error events', async action => {
    const { cut, image, onFinish } = start();
    if (action === 'cancel') finish();
    if (action === 'replace') document.querySelector('#ovBody').innerHTML = '<main>Replacement</main>';
    if (action === 'closing') document.querySelector('#overlay').dataset.uiClosing = '1';
    if (action === 'native-closing') document.querySelector('#overlay').classList.add('closing');
    if (action === 'detached') document.querySelector('#overlay').remove();
    if (action === 'hidden') document.querySelector('#overlay').hidden = true;
    await Promise.resolve();
    expect(cut.isConnected).toBe(false);
    Object.defineProperty(image, 'naturalWidth', { value: 640 });
    image.dispatchEvent(new Event('load'));
    image.dispatchEvent(new Event('error'));
    await vi.runAllTimersAsync();
    expect(onFinish).toHaveBeenCalledOnce();
    expect(document.querySelector('.camp-entry-cut')).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
  });
  it('does not let an old decode completion remove a new page curtain', async () => {
    const oldCut = createCityCut();
    let resolveDecode;
    oldCut.querySelector('img').decode = () => new Promise(resolve => { resolveDecode = resolve; });
    const oldFinish = vi.fn();
    playPreparedCut(document.querySelector('main'), oldCut, cityCutDuration, oldFinish);
    document.querySelector('#ovBody').innerHTML = '<main>New page</main>';
    await Promise.resolve();
    const { cut, image, onFinish } = start();
    resolveDecode();
    await vi.advanceTimersByTimeAsync(32);
    expect(oldFinish).toHaveBeenCalledOnce();
    expect(cut.isConnected).toBe(true);
    expect(onFinish).not.toHaveBeenCalled();
    image.dispatchEvent(new Event('error'));
    await vi.advanceTimersByTimeAsync(0);
    await expectFinished(cut, onFinish);
  });
});
