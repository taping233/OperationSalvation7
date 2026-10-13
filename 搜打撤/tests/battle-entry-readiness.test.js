import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createBattleEntryGate, waitForBattleImages } from '../game/src/battle/view/battle.presentation-ready.js';

let gate, overlay, stage;
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
const flush = async () => { for (let i = 0; i < 5; i++) await Promise.resolve(); };
beforeEach(() => {
  vi.useFakeTimers();
  document.body.innerHTML = '<div id="overlay"><div class="battle-stage"><div class="sts-encounter"></div></div></div>';
  overlay = document.getElementById('overlay'); stage = overlay.firstElementChild; stage._battleToken = 1;
  gate = createBattleEntryGate({ timeoutMs: 8000 });
});
afterEach(() => { gate.dispose(); vi.useRealTimers(); });

it('keeps the first frame covered until scenery, rendered actor and visible images are all ready', async () => {
  const scenery = deferred(), actor = deferred(), images = deferred();
  gate.begin(stage, 1, overlay); gate.wait(stage, 1, [scenery.promise, actor.promise, images.promise]);
  expect(stage.inert).toBe(true); expect(stage.dataset.battleEntry).toBe('loading');
  expect(overlay.querySelector('.battle-entry-curtain')).not.toBeNull();
  scenery.resolve(true); images.resolve(true); await flush();
  expect(stage.dataset.battleEntry).toBe('loading');
  actor.resolve(); await flush();
  expect(stage.dataset.battleEntry).toBe('ready'); expect(stage.inert).toBe(false);
  expect(overlay.querySelector('.battle-entry-curtain')).toBeNull(); expect(vi.getTimerCount()).toBe(0);
});

it('reveals cached resources without a minimum timer and does not gate routine rerenders again', async () => {
  gate.begin(stage, 1, overlay); gate.wait(stage, 1, [Promise.resolve(true)]);
  await flush();
  gate.begin(stage, 1, overlay);
  expect(stage.dataset.battleEntry).toBe('ready'); expect(gate.pending(stage)).toBe(false);
  expect(overlay.querySelector('.battle-entry-curtain')).toBeNull(); expect(vi.getTimerCount()).toBe(0);
});

it('cannot let an old resource callback reveal a newer battle', async () => {
  const old = deferred(), next = deferred();
  gate.begin(stage, 1, overlay); gate.wait(stage, 1, [old.promise]);
  const oldStage = stage; stage = oldStage.cloneNode(true); stage._battleToken = 2; oldStage.replaceWith(stage);
  stage.removeAttribute('data-battle-entry'); stage.inert = false;
  gate.begin(stage, 2, overlay); gate.wait(stage, 2, [next.promise]);
  old.resolve(true); await flush();
  expect(stage.dataset.battleEntry).toBe('loading'); expect(stage.inert).toBe(true);
  expect(overlay.querySelectorAll('.battle-entry-curtain')).toHaveLength(1);
  next.resolve(true); await flush(); expect(stage.dataset.battleEntry).toBe('ready');
});

it('reports timeout and requires an explicit simplified entry; late completion does not rewrite that choice', async () => {
  const resource = deferred(), fallback = vi.fn(), cancelImages = vi.fn();
  gate.begin(stage, 1, overlay); gate.wait(stage, 1, [resource.promise], { onFallback: fallback, cancelImages });
  await vi.advanceTimersByTimeAsync(8000);
  expect(stage.inert).toBe(true); expect(stage.dataset.battleEntry).toBe('waiting');
  expect(overlay.textContent).toContain('资源准备仍未完成');
  overlay.querySelector('.battle-entry-curtain button').click();
  expect(fallback).toHaveBeenCalledTimes(1); expect(cancelImages).toHaveBeenCalledTimes(1);
  expect(stage.inert).toBe(false); expect(stage.dataset.battleEntry).toBe('degraded');
  expect(stage.textContent).toContain('简化显示');
  resource.resolve(true); await flush(); expect(stage.dataset.battleEntry).toBe('degraded');
});

it('reports an actual asset failure and permits a delayed success after a timeout without extra waiting', async () => {
  gate.begin(stage, 1, overlay); gate.wait(stage, 1, [Promise.resolve(false)]); await flush();
  expect(overlay.textContent).toContain('加载失败'); gate.cancel();
  const resource = deferred(); gate.begin(stage, 1, overlay); gate.wait(stage, 1, [resource.promise]);
  await vi.advanceTimersByTimeAsync(8000); resource.resolve(true); await flush();
  expect(stage.dataset.battleEntry).toBe('ready'); expect(stage.inert).toBe(false);
});

it('cancels synchronously on explicit departure and on hidden overlay, releasing listeners and inert state', async () => {
  const resource = deferred(), cancelImages = vi.fn();
  gate.begin(stage, 1, overlay); gate.wait(stage, 1, [resource.promise], { cancelImages });
  overlay.hidden = true; await flush();
  expect(overlay.querySelector('.battle-entry-curtain')).toBeNull(); expect(stage.inert).toBe(false);
  expect(cancelImages).toHaveBeenCalledTimes(1); expect(vi.getTimerCount()).toBe(0);
  resource.resolve(true); await flush(); expect(stage.hasAttribute('data-battle-entry')).toBe(false);
});

it('waits for image decode and accepts a cutout error that switches to the original image', async () => {
  stage.innerHTML = '<div class="sts-figure"><img src="/cut.webp" alt="角色"></div>';
  const image = stage.querySelector('img'), decode = deferred();
  let loaded = false;
  Object.defineProperty(image, 'complete', { get: () => loaded });
  Object.defineProperty(image, 'naturalWidth', { get: () => loaded ? 200 : 0 });
  image.decode = vi.fn(() => decode.promise);
  image.onerror = () => { image.onerror = null; image.src = '/original.webp'; };
  const waiting = waitForBattleImages(stage); let result;
  waiting.promise.then(value => { result = value; });
  image.dispatchEvent(new Event('error')); await flush(); expect(result).toBeUndefined();
  loaded = true; image.dispatchEvent(new Event('load')); await flush(); expect(result).toBeUndefined();
  decode.resolve(); await flush(); expect(result).toBe(true);
  expect(image.dataset.battleAsset).toBe('ready'); expect(image.loading).toBe('eager');
});

it('treats a broken critical image as failure instead of a ready asset', async () => {
  stage.innerHTML = '<div class="sts-figure"><img src="/missing.webp"></div>';
  const image = stage.querySelector('img');
  Object.defineProperty(image, 'complete', { value: true });
  Object.defineProperty(image, 'naturalWidth', { value: 0 });
  expect(await waitForBattleImages(stage).promise).toBe(false);
  expect(image.dataset.battleAsset).toBe('failed');
});

it('does not count a late decode of the replaced image source as ready', async () => {
  stage.innerHTML = '<div class="sts-figure"><img src="/old.webp"></div>';
  const image = stage.querySelector('img'), old = deferred(), next = deferred();
  Object.defineProperty(image, 'complete', { value: false });
  Object.defineProperty(image, 'naturalWidth', { value: 200 });
  image.decode = vi.fn().mockReturnValueOnce(old.promise).mockReturnValueOnce(next.promise);
  const waiting = waitForBattleImages(stage); let result;
  waiting.promise.then(value => { result = value; });
  image.dispatchEvent(new Event('load')); image.src = '/new.webp';
  old.resolve(); await flush(); expect(result).toBeUndefined();
  image.dispatchEvent(new Event('load')); next.resolve(); await flush(); expect(result).toBe(true);
});
