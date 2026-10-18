import { afterEach, beforeEach, expect, it, vi } from 'vitest';

// Faithful ownership detail: Assets.load returns the same promise/Texture per URL,
// and Assets.unload destroys that cached Texture. No real Pixi, images or network.
const pixi = vi.hoisted(() => {
  class Application {
    constructor() {
      this.view = document.createElement('canvas');
      this.stage = { addChild() {} };
      this.ticker = { maxFPS: 30, add() {}, remove() {} };
      this.renderer = { type: 2, render() {} };
    }
    start() {}
    stop() {}
  }
  class Sprite {
    constructor() {
      this.anchor = this.scale = this.position = { set() {} };
      pixi.sprite = this;
    }
  }
  return { Application, Sprite, cache: new Map(), finished: new Map(), loaded: [], unloaded: [],
    blockedURL: null, gate: null, release: null, sprite: null };
});
vi.mock('pixi.js', () => ({
  utils: { isWebGLSupported: () => true },
  Application: pixi.Application, Sprite: pixi.Sprite,
  RENDERER_TYPE: { WEBGL: 1, CANVAS: 2 }, Texture: { EMPTY: { empty: true } },
  Assets: {
    load(url) {
      pixi.loaded.push(url);
      if (!pixi.cache.has(url)) {
        if (!url.includes('/neutral.webp') && !pixi.blockedURL) pixi.blockedURL = url;
        const pending = (async () => {
          if (url === pixi.blockedURL) await pixi.gate;
          const texture = { url, destroyed: false, baseTexture: { realWidth: 512, realHeight: 342 } };
          pixi.finished.set(url, texture);
          return texture;
        })();
        pixi.cache.set(url, pending);
      }
      return pixi.cache.get(url);
    },
    async unload(url) {
      pixi.unloaded.push(url);
      const pending = pixi.cache.get(url);
      if (!pending) return;
      const texture = await pending;
      texture.destroyed = true;
      if (pixi.cache.get(url) === pending) pixi.cache.delete(url);
    },
  },
}));
import SDT from '../game/src/core/sdt-facade.js';
import { attach, hide, cacheStats } from '../game/src/battle/view/battle.frames.js';

const flush = async () => { for (let i = 0; i < 60; i++) await Promise.resolve(); };
function mount(token) {
  if (!document.getElementById('overlay')) document.body.innerHTML = '<div id="overlay"><div id="ovBody"></div></div>';
  const body = document.getElementById('ovBody');
  body.innerHTML = '<div class="battle-stage sts"><div id="btSelf"><div class="sts-figure"><img data-asset-key="battle-xingyue" src="/assets/portraits/battle/xingyue.webp"></div></div></div>';
  body.querySelector('.battle-stage')._battleToken = token;
  return body;
}
let previousMotion;
beforeEach(() => {
  previousMotion = SDT.Motion;
  SDT.Motion = { reduceMotion: () => false };
  vi.stubGlobal('fetch', async () => { throw new Error('No network in frame ownership fixture'); });
  pixi.cache.clear(); pixi.finished.clear(); pixi.loaded.length = 0; pixi.unloaded.length = 0;
  pixi.blockedURL = null;
  pixi.gate = new Promise(resolve => { pixi.release = resolve; });
});
afterEach(async () => {
  // The gate stays unresolved throughout assertions, then settles only for teardown.
  // A failing ownership test must not strand the suite or its interval.
  pixi.release();
  await flush();
  await hide();
  SDT.Motion = previousMotion;
  vi.unstubAllGlobals();
});

it('hide releases completed textures even while one unrelated frame load never settles', async () => {
  expect(await attach(mount(1))).toBe(true);
  await flush();
  expect(pixi.blockedURL).toBeTruthy();
  const completed = [...pixi.finished.keys()];
  expect(completed.length).toBeGreaterThan(1);
  expect(completed).not.toContain(pixi.blockedURL);
  let released = false;
  void hide().then(() => { released = true; });
  await flush();
  // Expected red on current implementation: its complete barrier prevents all unloads.
  expect(pixi.unloaded).toEqual(expect.arrayContaining(completed));
  expect(released).toBe(true);
});

it('late cleanup from the old session cannot destroy a same-URL texture claimed by the new session', async () => {
  expect(await attach(mount(10))).toBe(true);
  await flush();
  const sharedURL = pixi.blockedURL;
  const sharedLoad = pixi.cache.get(sharedURL);
  const oldRelease = hide();
  const replacement = attach(mount(11));
  await flush();
  pixi.release();
  await oldRelease;
  expect(await replacement).toBe(true);
  // Fifty frames span sequential three-slot batches; await the actual phase,
  // rather than assuming a fixed microtask count means all batches finished.
  for (let i = 0; i < 20 && cacheStats().phase !== 'all-ready'; i++) await flush();
  expect(cacheStats()).toMatchObject({ phase: 'all-ready', activeFrameSessions: 1 });
  expect(pixi.loaded.filter(url => url === sharedURL).length).toBe(1);
  expect(pixi.cache.get(sharedURL)).toBe(sharedLoad);
  const shared = await pixi.cache.get(sharedURL);
  expect(shared).toBeTruthy();
  expect(shared.destroyed).toBe(false);
  expect(pixi.sprite.texture.destroyed).toBe(false);
});
