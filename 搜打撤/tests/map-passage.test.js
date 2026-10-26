import { afterEach, beforeEach, expect, it, vi } from 'vitest';
vi.mock('../game/src/core/motion.js', () => ({reduceMotion:vi.fn(() => false)}));
vi.mock('../game/src/core/turbo.js', () => ({isTurbo:vi.fn(() => false)}));
vi.mock('../game/src/core/map-image-ready.js', () => ({mapImageReady:vi.fn(async () => true)}));
import { reduceMotion } from '../game/src/core/motion.js';
import { isTurbo } from '../game/src/core/turbo.js';
import { showLayerPassage, cancelLayerPassage, isLayerPassageActive } from '../game/src/ui/map-passage.js';
let game;
beforeEach(() => {
  vi.useFakeTimers(); vi.stubGlobal('requestAnimationFrame', fn => setTimeout(fn,16)); vi.stubGlobal('cancelAnimationFrame',clearTimeout);
  reduceMotion.mockReturnValue(false); isTurbo.mockReturnValue(false);
  document.body.innerHTML = '<button id="mapAction">移动</button>';
  game = {runActive:true,state:'idle',layerIdx:0,layerData:[{},{}],discoveredPairs:new Set(),turn:7};
  window.SDT = {Renderer:{prepare:vi.fn(async () => true)}};
});
afterEach(() => { cancelLayerPassage(); vi.useRealTimers(); vi.unstubAllGlobals(); document.body.replaceChildren(); });
it.each([
  [1,0,'layer-descent-v1.webp','layer-descent'],
  [0,1,'layer-watchline-v2.webp','layer-watchline'],
  [1,2,'layer-ruins-v2.webp','layer-ruins'],
  [2,3,'layer-core-v2.webp','layer-core'],
  [3,2,'layer-ruins-v2.webp','layer-ruins'],
])('%i→%i 由目标层选择插画和演出，兼容旧档回程', async (from,to,asset,motion) => {
  game.layerData=[{},{},{},{}]; game.layerIdx=from;
  const passage=showLayerPassage(game,from,to); game.layerIdx=to;
  expect(document.querySelector('.map-layer-passage .silent-node-art').src).toContain(asset);
  expect(document.querySelector('.map-layer-passage [data-film-motion]').dataset.filmMotion).toBe(motion);
  expect(document.querySelector('.layer-passage-caption h2').textContent).toBe(`第 ${to+1} 层`);
  await vi.runAllTimersAsync(); await passage.done;
  expect(isLayerPassageActive(game)).toBe(false);
});
it('插画展示3.6秒并用700毫秒退场，播放期间保持输入保护', async () => {
  const passage=showLayerPassage(game,0,1); game.layerIdx=1;
  const image=document.querySelector('.map-layer-passage .silent-node-art');
  expect(image.src).toContain('layer-watchline-v2.webp');
  expect(document.querySelector('.layer-passage-caption h2').textContent).toBe('第 2 层');
  expect(document.querySelector('.layer-passage-caption small').textContent).toBe('继续深入');
  await vi.advanceTimersByTimeAsync(3500);
  expect(document.querySelector('.map-layer-passage.leaving')).toBeNull();
  expect(isLayerPassageActive(game)).toBe(true);
  await vi.advanceTimersByTimeAsync(200);
  expect(document.querySelector('.map-layer-passage.leaving')).not.toBeNull();
  await vi.advanceTimersByTimeAsync(700); await passage.done;
  expect(isLayerPassageActive(game)).toBe(false);
});
it.each([[0,1],[1,0]])('%i→%i 同一幕先锁输入，首帧准备后揭幕，不更改业务状态', async (from,to) => {
  game.layerIdx=from; let prepared;
  window.SDT.Renderer.prepare.mockImplementation(() => new Promise(resolve => {prepared=resolve;}));
  const passage=showLayerPassage(game,from,to); game.layerIdx=to;
  const click=vi.fn(); document.querySelector('button').addEventListener('click',click);
  document.querySelector('button').click(); expect(click).not.toHaveBeenCalled();
  const key=new KeyboardEvent('keydown',{key:'Escape',cancelable:true}); window.dispatchEvent(key); expect(key.defaultPrevented).toBe(true);
  expect(isLayerPassageActive(game)).toBe(true);
  await vi.advanceTimersByTimeAsync(1000);
  expect(document.querySelector('.map-layer-passage.leaving')).toBeNull();
  prepared(true); await vi.runAllTimersAsync(); await passage.done;
  expect(isLayerPassageActive(game)).toBe(false); expect(game).toMatchObject({layerIdx:to,state:'idle',turn:7});
  expect(document.querySelector('.map-layer-passage')).toBeNull();
  document.querySelector('button').click(); expect(click).toHaveBeenCalledOnce();
});
it('插值移动不重置相机/调用Renderer.prepare，完成后仅释放自己', async () => {
  game.state='moving'; const old=showLayerPassage(game,0,1); game.layerIdx=1;
  await vi.runAllTimersAsync(); await old.done;
  expect(window.SDT.Renderer.prepare).not.toHaveBeenCalled(); expect(game.state).toBe('moving');
});
it.each(['reduce','turbo','same'])('%s 不添加额外动画或锁', mode => {
  reduceMotion.mockReturnValue(mode==='reduce'); isTurbo.mockReturnValue(mode==='turbo');
  expect(showLayerPassage(game,0,mode==='same'?0:1)).toBeNull();
  expect(isLayerPassageActive(game)).toBe(false); expect(document.querySelector('.map-layer-passage')).toBeNull();
});
it('旧准备迟到不会拆新幕，换局时只取消表现不逆转位置', async () => {
  let ready; window.SDT.Renderer.prepare.mockImplementationOnce(() => new Promise(resolve => {ready=resolve;}));
  const old=showLayerPassage(game,0,1); game.layerIdx=1; await vi.advanceTimersByTimeAsync(32);
  const fresh=showLayerPassage(game,1,0); game.layerIdx=0; ready(true); await old.done;
  expect(document.querySelectorAll('.map-layer-passage')).toHaveLength(1);
  game.discoveredPairs=new Set(); expect(isLayerPassageActive(game)).toBe(false);
  await fresh.done; expect(game.layerIdx).toBe(0); await vi.runAllTimersAsync(); expect(vi.getTimerCount()).toBe(0);
});
it('首帧准备挂起最多6.5秒释放输入，失败不回滚已跨层位置', async () => {
  window.SDT.Renderer.prepare.mockImplementation(() => new Promise(() => {}));
  const passage=showLayerPassage(game,0,1); game.layerIdx=1;
  await vi.advanceTimersByTimeAsync(6500); await passage.done;
  expect(isLayerPassageActive(game)).toBe(false); expect(game.layerIdx).toBe(1); expect(vi.getTimerCount()).toBe(0);
});
