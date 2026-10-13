import { beforeAll, beforeEach, afterEach, expect, it, vi } from 'vitest';
import { pageMotionProfile, pageMotionBlocks } from '../game/src/ui/page-motion-profiles.js';

let ui, images, frames, overlayMethods;
beforeAll(async () => {
  window.SDT ||= {};
  ({ overlayMethods } = await import('../game/src/ui/overlay.js'));
});
beforeEach(() => {
  vi.useFakeTimers();
  document.body.innerHTML = '<main id="viewport"><div id="overlay" hidden><div class="card"><h2 id="ovTitle"></h2><div id="ovBody"></div></div></div></main>';
  Object.assign(window.SDT, { Icons: { rich: s => s }, Sound: { sfx() {}, scene() {} } });
  ui = { ...overlayMethods, _acts: {}, el: {
    overlay: document.getElementById('overlay'), ovBody: document.getElementById('ovBody'), ovTitle: document.getElementById('ovTitle'),
  } };
  images = []; frames = [];
  vi.stubGlobal('requestAnimationFrame', fn => { frames.push(fn); return frames.length; });
  vi.stubGlobal('Image', class {
    complete = false; naturalWidth = 0;
    constructor() { images.push(this); }
  });
});
afterEach(() => {
  ui.hideOverlay({ immediate: true });
  vi.clearAllTimers(); vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks();
  document.body.replaceChildren();
});

it('快速换页不让旧首焦点回调重新选择新页默认操作', () => {
  const resolve = vi.fn(() => null);
  ui._resolveOverlayInitialFocus = resolve;
  ui.showOverlay('事件', '<button id="old">旧操作</button>', 'page', { initialFocus: '#old' });
  ui.showOverlay('确认', '<button id="new">新操作</button>', 'glass', { initialFocus: '#new' });
  frames.forEach(fn => fn());
  expect(resolve).toHaveBeenCalledTimes(1);
  expect(resolve).toHaveBeenCalledWith('#new');
});

it('离页立即结束来源特写并清除结算装饰和背景隔离类', () => {
  ui.showOverlay('搜刮！', '<main>奖励</main>', 'chest');
  const card = ui.el.ovBody.parentElement;
  expect(card.classList.contains('fx-victory')).toBe(true);
  const zoom = document.createElement('div'); zoom.id = 'cardZoom';
  zoom._closeCardZoom = vi.fn(() => zoom.remove()); document.body.append(zoom);
  ui.showOverlay('商店', '<main>货架</main>', 'page');
  expect(zoom._closeCardZoom).toHaveBeenCalledWith(true);
  expect(card.classList.contains('fx-victory')).toBe(false);
  ui.hideOverlay({ immediate: true });
  expect(card.classList.contains('chest')).toBe(false);
  expect(ui.el.overlay.classList.contains('pick-veil')).toBe(false);
  expect(ui.el.overlay.classList.contains('room-view')).toBe(false);
});

const scene = key => `<main data-asset-key="${key}" style="background-image:url(/${key}.webp)">新场景</main>`;
it('旧场景加载的迟到回调不能清除当前加载或污染就绪缓存', () => {
  ui.showOverlay('一', scene('first'), 'page');
  const oldLoad = images[0].onload;
  ui.showOverlay('二', scene('second'), 'page');
  oldLoad();
  expect(ui.el.ovBody.firstElementChild.classList.contains('bg-loading')).toBe(true);
  expect(ui._bgReady.has('/first.webp')).toBe(false);
  images[1].onload();
  expect(ui.el.ovBody.firstElementChild.hasAttribute('aria-busy')).toBe(false);
  expect(ui._bgReady.has('/second.webp')).toBe(true);
});

it('图片解码结束后才标记就绪，超时或失败可以再次尝试', async () => {
  ui.showOverlay('一', scene('decode'), 'page');
  let ready;
  images[0].decode = () => new Promise(resolve => { ready = resolve; });
  images[0].onload();
  expect(ui.el.ovBody.firstElementChild.classList.contains('bg-loading')).toBe(true);
  ready(); await Promise.resolve();
  expect(ui._bgReady.has('/decode.webp')).toBe(true);
  ui.showOverlay('二', scene('timeout'), 'page');
  await vi.advanceTimersByTimeAsync(8000);
  expect(ui.el.ovBody.firstElementChild.classList.contains('bg-loading')).toBe(false);
  expect(ui._bgReady.has('/timeout.webp')).toBe(false);
  ui.showOverlay('二', scene('timeout'), 'page');
  expect(images).toHaveLength(3);
  images[2].onerror();
  expect(ui.el.ovBody.firstElementChild.hasAttribute('aria-busy')).toBe(false);
});

it('事件、奖励和商店共用短入场并只编排区域，不逐张卡牌排队', () => {
  ui.el.overlay.hidden = false;
  for (const markup of [
    '<main class="node-pg event-scene"><section class="event-story"></section><section class="node-main"></section><footer class="node-foot"></footer></main>',
    '<main class="node-pg shop-market"><header class="pg-head"></header><section class="shop-board"></section><aside class="shop-detail"></aside><nav class="shop-services"></nav></main>',
    '<main class="reward-v14"><header class="reward-head"></header><section class="reward-main"></section><footer class="loot-actions"></footer></main>',
  ]) {
    ui.el.ovBody.innerHTML = markup;
    const profile = pageMotionProfile(ui.el.ovBody);
    expect(profile.expedition).toBe(true);
    expect(profile.duration).toBe(240);
    expect(pageMotionBlocks(profile).length).toBeGreaterThanOrEqual(3);
    expect(profile.staggerMax).toBe(48);
  }
});
