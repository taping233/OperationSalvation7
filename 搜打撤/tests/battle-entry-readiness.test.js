import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createBattleEntryGate, waitForBattleImages } from '../game/src/battle/view/battle.presentation-ready.js';
import { installRunTopBar, setRunTopBarBattleOptions, syncCommittedRunTopBar } from '../game/src/ui/run-top-bar.js';
import { readCssSource } from './helpers/css-source.js';

let gate, overlay, stage, style;
const battleCss = readCssSource('game/css/battle.css', 'utf8');
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
const flush = async () => { for (let i = 0; i < 5; i++) await Promise.resolve(); };
beforeEach(() => {
  vi.useFakeTimers();
  document.body.innerHTML = '<div id="overlay"><div class="battle-stage sts"><div class="sts-encounter"></div></div></div>';
  overlay = document.getElementById('overlay'); stage = overlay.firstElementChild; stage._battleToken = 1;
  gate = createBattleEntryGate({ timeoutMs: 8000 });
});
afterEach(() => { gate.dispose(); style?.remove(); style = null; vi.useRealTimers(); });

it.each(['ready','degraded'])('restores the options entry after the real entry gate releases inert (%s)', async state => {
  const body=document.createElement('div'); body.id='ovBody'; overlay.append(body); body.append(stage);
  stage.innerHTML='<div class="sts-topbar"><details class="sts-options"><summary>选项</summary><button>战斗规则</button></details></div>';
  const UI={el:{overlay,ovBody:body},_lastMode:'battle'}, bar=installRunTopBar(UI).bar;
  const action=vi.fn();UI._acts={btSettings:action};setRunTopBarBattleOptions(UI,stage);
  const button=bar.querySelector('#btnBattleOptions'); expect(button.hidden).toBe(false);
  gate.begin(stage,1,overlay); syncCommittedRunTopBar(UI);
  expect(stage.inert).toBe(true); expect(button.hidden).toBe(true);
  gate.wait(stage,1,[Promise.resolve(state==='ready')]); await flush();
  if(state==='degraded') overlay.querySelector('.battle-entry-status button').click();
  expect(await gate.ready(stage,1)).toBe(true); expect(stage.inert).toBe(false);
  expect(button.hidden).toBe(false); button.click();expect(action).toHaveBeenCalledOnce();
});

it('waits for actual readiness without mounting a second cutscene or reveal animation', async () => {
  const resource = deferred();
  gate.begin(stage, 1, overlay);
  const status = overlay.querySelector('.battle-entry-status');
  expect(status.hidden).toBe(true);
  expect(overlay.querySelector('.general-transition, .battle-entry-curtain, img')).toBeNull();
  gate.wait(stage, 1, [resource.promise]);
  const ready = gate.ready(stage, 1);
  await flush(); expect(stage.inert).toBe(true);
  resource.resolve(true); await flush();
  expect(await ready).toBe(true);
  expect(stage.inert).toBe(false); expect(stage.dataset.battleEntry).toBe('ready');
  expect(status.isConnected).toBe(false); expect(vi.getTimerCount()).toBe(0);
});

it('cancels pending readiness without letting late resources reveal a departed battle', async () => {
  const resource = deferred();
  gate.begin(stage, 1, overlay); gate.wait(stage, 1, [resource.promise]);
  const ready = gate.ready(stage, 1);
  gate.cancel(); resource.resolve(true); await flush();
  expect(await ready).toBe(false);
  expect(overlay.querySelector('.battle-entry-status')).toBeNull();
  expect(stage.hasAttribute('data-battle-entry')).toBe(false); expect(stage.inert).toBe(false);
});

it('shows only a compact resource failure notice with a usable simplified-display action', async () => {
  style = document.createElement('style'); style.textContent = battleCss; document.head.appendChild(style);
  gate.begin(stage, 1, overlay);
  const status = overlay.querySelector('.battle-entry-status'), button = status.querySelector('button');
  expect(status.parentElement).toBe(overlay);
  expect(getComputedStyle(status).display).toBe('none'); expect(button.hidden).toBe(true);
  gate.wait(stage, 1, [Promise.resolve(false)]); await flush();
  expect(status.hidden).toBe(false); expect(getComputedStyle(status).display).not.toBe('none');
  expect(status.querySelector('img')).toBeNull();
  const noticeStyle = getComputedStyle(status);
  expect(noticeStyle.position).toBe('absolute'); expect(noticeStyle.left).toBe('50%');
  expect(noticeStyle.color).toBe('rgb(245, 246, 243)');
  expect(Number(noticeStyle.zIndex)).toBeGreaterThan(900);
  expect(button.hidden).toBe(false); expect(getComputedStyle(button).display).toBe('inline-flex');
  expect(getComputedStyle(button).color).toBe('rgb(12, 13, 15)');
  expect(getComputedStyle(button).backgroundColor).toBe('rgb(242, 199, 92)');
  expect(getComputedStyle(button).minHeight).toBe('48px');
  expect(battleCss).toContain('.battle-entry-status button:focus-visible');
});

it('keeps keyboard focus on the available fallback without swallowing native Enter or Space activation', async () => {
  const gameplayKey = vi.fn(); document.addEventListener('keydown', gameplayKey);
  try {
    gate.begin(stage, 1, overlay); gate.wait(stage, 1, [Promise.resolve(false)]); await flush();
    const button = overlay.querySelector('.battle-entry-status button');
    for (const shiftKey of [false, true]) {
      const tab = new KeyboardEvent('keydown', { key: 'Tab', shiftKey, bubbles: true, cancelable: true });
      document.dispatchEvent(tab);
      expect(tab.defaultPrevented).toBe(true); expect(document.activeElement).toBe(button);
    }
    for (const key of ['Enter', ' ']) {
      const activation = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
      button.dispatchEvent(activation); expect(activation.defaultPrevented).toBe(false);
    }
    expect(gameplayKey).not.toHaveBeenCalled();
    button.click();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(gameplayKey).toHaveBeenCalledTimes(1); expect(stage.inert).toBe(false);
  } finally { document.removeEventListener('keydown', gameplayKey); }
});

it('keeps the simplified-display notice when a routine render replaces encounter information', async () => {
  stage.innerHTML = '<div class="sts-topbar"><div class="sts-encounter">第 1 回合</div><details class="sts-options"></details></div>';
  gate.begin(stage, 1, overlay); gate.wait(stage, 1, [Promise.resolve(false)]); await flush();
  overlay.querySelector('.battle-entry-status button').click();
  const note = stage.querySelector('.battle-entry-note');
  expect(note?.getAttribute('role')).toBe('status');
  const next = document.createElement('div'); next.className = 'sts-encounter'; next.textContent = '第 2 回合';
  stage.querySelector('.sts-encounter').replaceWith(next);
  expect(stage.querySelector('.battle-entry-note')).toBe(note);
  expect(note.isConnected).toBe(true); expect(note.textContent).toContain('简化显示');
  expect(note.nextElementSibling).toBe(stage.querySelector('.sts-options'));
});

it('preserves the explicit simplified choice when returning to a new stage with the same battle token', async () => {
  gate.begin(stage, 1, overlay); gate.wait(stage, 1, [Promise.resolve(false)]); await flush();
  overlay.querySelector('.battle-entry-status button').click();
  gate.cancel(); stage.remove();
  stage = document.createElement('div'); stage.className = 'battle-stage'; stage._battleToken = 1;
  stage.innerHTML = '<div class="sts-topbar"><div class="sts-encounter">第 2 回合</div><details class="sts-options"></details></div>';
  overlay.appendChild(stage); gate.begin(stage, 1, overlay);
  expect(stage.dataset.battleEntry).toBe('degraded'); expect(stage.inert).not.toBe(true);
  expect(gate.pending(stage)).toBe(false); expect(overlay.querySelector('.battle-entry-status')).toBeNull();
  expect(stage.querySelectorAll('.battle-entry-note')).toHaveLength(1);
  gate.begin(stage, 1, overlay); expect(stage.querySelectorAll('.battle-entry-note')).toHaveLength(1);
  stage._battleToken = 2; gate.begin(stage, 2, overlay);
  expect(stage.dataset.battleEntry).toBe('loading'); expect(stage.inert).toBe(true);
  expect(stage.querySelector('.battle-entry-note')).toBeNull();
  expect(overlay.querySelector('.battle-entry-status')).not.toBeNull();
});

it('waits for the new stage resources when returning from payment to an already ready battle token', async () => {
  gate.begin(stage, 1, overlay); gate.wait(stage, 1, [Promise.resolve(true)]); await flush();
  const previous = stage;
  gate.cancel(); previous.remove();
  stage = document.createElement('div'); stage.className = 'battle-stage sts'; stage._battleToken = 1;
  stage.innerHTML = '<div class="sts-encounter"></div><div class="battle-scene-world" hidden></div>';
  overlay.appendChild(stage);
  const scenery = deferred(), actor = deferred(), images = deferred();
  gate.begin(stage, 1, overlay);
  expect(gate.pending(stage)).toBe(true);
  gate.wait(stage, 1, [scenery.promise, actor.promise, images.promise]);
  const curtain = overlay.querySelector('.battle-entry-status');
  expect(curtain).not.toBeNull(); expect(stage.inert).toBe(true);
  expect(stage.dataset.battleEntry).toBe('loading');
  expect(stage.querySelector('.battle-scene-world').hidden).toBe(true);
  scenery.resolve(true); images.resolve(true); await flush();
  expect(stage.dataset.battleEntry).toBe('loading'); expect(curtain.isConnected).toBe(true);
  actor.resolve(true); await flush();
  expect(stage.dataset.battleEntry).toBe('ready'); expect(stage.inert).toBe(false);
  expect(overlay.querySelector('.battle-entry-status')).toBeNull(); expect(vi.getTimerCount()).toBe(0);
  gate.begin(stage, 1, overlay);
  expect(gate.pending(stage)).toBe(false); expect(overlay.querySelector('.battle-entry-status')).toBeNull();
});

it.each(['failure', 'timeout'])('keeps a same-token replacement covered after its own resource %s', async outcome => {
  gate.begin(stage, 1, overlay); gate.wait(stage, 1, [Promise.resolve(true)]); await flush();
  const previous = stage;
  gate.cancel(); previous.remove();
  stage = document.createElement('div'); stage.className = 'battle-stage sts'; stage._battleToken = 1;
  stage.innerHTML = '<div class="sts-encounter"></div>'; overlay.appendChild(stage);
  const resource = deferred(), fallback = vi.fn();
  gate.begin(stage, 1, overlay); gate.wait(stage, 1, [resource.promise], { onFallback: fallback });
  if (outcome === 'failure') { resource.resolve(false); await flush(); }
  else await vi.advanceTimersByTimeAsync(8000);
  expect(stage.dataset.battleEntry).toBe('waiting'); expect(stage.inert).toBe(true);
  expect(overlay.textContent).toContain(outcome === 'failure' ? '加载失败' : '仍未完成');
  const button = overlay.querySelector('.battle-entry-status button');
  expect(button.hidden).toBe(false); button.click();
  expect(fallback).toHaveBeenCalledTimes(1); expect(stage.dataset.battleEntry).toBe('degraded');
  expect(stage.inert).toBe(false);
});

it.each(['loading', 'waiting'])('restarts an unfinished %s gate after departure and ignores the old completion', async state => {
  const old = deferred(), next = deferred(), fallback = vi.fn();
  gate.begin(stage, 1, overlay); gate.wait(stage, 1, [old.promise], { onFallback: fallback });
  if (state === 'waiting') await vi.advanceTimersByTimeAsync(8000);
  const oldButton = overlay.querySelector('.battle-entry-status button');
  gate.cancel(); stage.remove();
  stage = document.createElement('div'); stage._battleToken = 1; overlay.appendChild(stage);
  gate.begin(stage, 1, overlay); gate.wait(stage, 1, [next.promise]);
  oldButton.click(); old.resolve(true); await flush();
  expect(fallback).not.toHaveBeenCalled(); expect(stage.dataset.battleEntry).toBe('loading');
  expect(stage.inert).toBe(true); expect(overlay.querySelector('.battle-entry-status')).not.toBeNull();
  next.resolve(true); await flush(); expect(stage.dataset.battleEntry).toBe('ready');
});

it('does not share completed entry state with a new gate after disposal', async () => {
  gate.begin(stage, 1, overlay); gate.wait(stage, 1, [Promise.resolve(true)]); await flush();
  gate.dispose(); gate = createBattleEntryGate(); gate.begin(stage, 1, overlay);
  expect(stage.dataset.battleEntry).toBe('loading'); expect(stage.inert).toBe(true);
  expect(overlay.querySelector('.battle-entry-status')).not.toBeNull();
});

it('reapplies simplified portrait placeholders after a restored stage mounts its units', async () => {
  gate.begin(stage, 1, overlay); gate.wait(stage, 1, [Promise.resolve(false)]); await flush();
  overlay.querySelector('.battle-entry-status button').click();
  const figure = document.createElement('div'); figure.className = 'sts-figure';
  figure.innerHTML = '<img src="/missing.webp" alt="失联角色">'; stage.appendChild(figure);
  gate.begin(stage, 1, overlay);
  expect(figure.querySelector('img').hidden).toBe(true);
  expect(figure.classList.contains('battle-figure-fallback')).toBe(true);
  expect(figure.dataset.fallbackLabel).toBe('失联角色');
  expect(stage.querySelectorAll('.battle-entry-note')).toHaveLength(1);
});

it('keeps gameplay locked until scenery, rendered actor and visible images are all ready', async () => {
  const scenery = deferred(), actor = deferred(), images = deferred();
  gate.begin(stage, 1, overlay); gate.wait(stage, 1, [scenery.promise, actor.promise, images.promise]);
  expect(stage.inert).toBe(true); expect(stage.dataset.battleEntry).toBe('loading');
  expect(overlay.querySelector('.battle-entry-status')).not.toBeNull();
  scenery.resolve(true); images.resolve(true); await flush();
  expect(stage.dataset.battleEntry).toBe('loading');
  actor.resolve(); await flush();
  expect(stage.dataset.battleEntry).toBe('ready'); expect(stage.inert).toBe(false);
  expect(overlay.querySelector('.battle-entry-status')).toBeNull(); expect(vi.getTimerCount()).toBe(0);
});

it('reveals cached resources without a minimum timer and does not gate routine rerenders again', async () => {
  gate.begin(stage, 1, overlay); gate.wait(stage, 1, [Promise.resolve(true)]);
  await flush();
  gate.begin(stage, 1, overlay);
  expect(stage.dataset.battleEntry).toBe('ready'); expect(gate.pending(stage)).toBe(false);
  expect(overlay.querySelector('.battle-entry-status')).toBeNull(); expect(vi.getTimerCount()).toBe(0);
});

it('cannot let an old resource callback reveal a newer battle', async () => {
  const old = deferred(), next = deferred();
  gate.begin(stage, 1, overlay); gate.wait(stage, 1, [old.promise]);
  const oldStage = stage; stage = oldStage.cloneNode(true); stage._battleToken = 2; oldStage.replaceWith(stage);
  stage.removeAttribute('data-battle-entry'); stage.inert = false;
  gate.begin(stage, 2, overlay); gate.wait(stage, 2, [next.promise]);
  old.resolve(true); await flush();
  expect(stage.dataset.battleEntry).toBe('loading'); expect(stage.inert).toBe(true);
  expect(overlay.querySelectorAll('.battle-entry-status')).toHaveLength(1);
  next.resolve(true); await flush(); expect(stage.dataset.battleEntry).toBe('ready');
});

it('reports timeout and requires an explicit simplified entry; late completion does not rewrite that choice', async () => {
  const resource = deferred(), fallback = vi.fn(), cancelImages = vi.fn();
  gate.begin(stage, 1, overlay); gate.wait(stage, 1, [resource.promise], { onFallback: fallback, cancelImages });
  await vi.advanceTimersByTimeAsync(8000);
  expect(stage.inert).toBe(true); expect(stage.dataset.battleEntry).toBe('waiting');
  expect(overlay.textContent).toContain('资源准备仍未完成');
  overlay.querySelector('.battle-entry-status button').click();
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
  expect(overlay.querySelector('.battle-entry-status')).toBeNull(); expect(stage.inert).toBe(false);
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

it('resolves a disconnected active stage as cancelled rather than holding readiness forever', async () => {
  const resource = deferred(), cancelImages = vi.fn();
  gate.begin(stage, 1, overlay); gate.wait(stage, 1, [resource.promise], { cancelImages });
  const pending = gate.ready(stage, 1);
  stage.remove();
  expect(await gate.ready(stage, 1)).toBe(false);
  expect(await pending).toBe(false); expect(cancelImages).toHaveBeenCalledTimes(1);
  resource.resolve(true); await flush();
  expect(await gate.ready(stage, 1)).toBe(false); expect(overlay.querySelector('.battle-entry-status')).toBeNull();
});

it('retains readiness for an explicit degraded choice only in its current stage and overlay', async () => {
  gate.begin(stage, 1, overlay); gate.wait(stage, 1, [Promise.resolve(false)]); await flush();
  const pending = gate.ready(stage, 1);
  overlay.querySelector('.battle-entry-status button').click(); expect(await pending).toBe(true);
  const previous = stage, newOverlay = document.createElement('div'); document.body.appendChild(newOverlay);
  stage = document.createElement('div'); stage._battleToken = 1;
  stage.innerHTML = '<div class="sts-encounter"></div>'; newOverlay.appendChild(stage);
  gate.begin(stage, 1, newOverlay);
  expect(stage.dataset.battleEntry).toBe('degraded'); expect(await gate.ready(stage, 1)).toBe(true);
  expect(await gate.ready(previous, 1)).toBe(false); expect(await gate.ready(stage, 2)).toBe(false);
  newOverlay.hidden = true; expect(await gate.ready(stage, 1)).toBe(false);
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
