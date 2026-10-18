import { expect, it, beforeEach, afterEach, afterAll, vi } from 'vitest';

const pixi = vi.hoisted(() => {
  const unloaded = [];
  const loaded = [];
  const sprites = [];
  const idleTexture = { id: 'idle-texture' };
  const extraTexture = { id: 'extra-texture' };
  const emptyTexture = { id: 'empty' };
  class Application {
    constructor() {
      if (pixi.failInit) throw new Error('WebGL unavailable (controlled stub)');
      this.view = document.createElement('canvas');
      this.stage = { addChild() {} };
      this.ticker = { maxFPS: 0, stop() {}, start() {}, add(fn) { pixi.tick = fn; } };
      this.renderer = { type: 1, render() { pixi.rendered += 1; } };
    }
    stop() { pixi.stopped += 1; }
    start() { pixi.started += 1; }
    destroy() { pixi.destroyed += 1; }
  }
  class Sprite {
    constructor() {
      if (pixi.failSprite) throw new Error('Sprite setup failed (controlled stub)');
      this.texture = emptyTexture;
      sprites.push(this);
      this.anchor = { set() {} };
      this.scale = { set() {} };
      this.position = { set() {} };
    }
  }
  return { unloaded, loaded, sprites, idleTexture, extraTexture, emptyTexture, Application, Sprite,
    unloadGate: null, finishUnload: null, loadGate: null, finishLoad: null,
    idleEnabled: true, idlePaths: new Set(), rendered: 0, loadDelayMs: 0, inFlight: 0, maxInFlight: 0, tick: null,
    blocked: null, missing: new Set(), failInit: false, failSprite: false, destroyed: 0, started: 0, stopped: 0 };
});

vi.mock('pixi.js', () => ({
  utils: { isWebGLSupported: () => true },
  RENDERER_TYPE: { WEBGL: 1, CANVAS: 2 },
  Application: pixi.Application,
  Sprite: pixi.Sprite,
  Texture: { EMPTY: pixi.emptyTexture },
  Assets: {
    load: async url => {
      pixi.loaded.push(url);
      pixi.inFlight += 1;
      pixi.maxInFlight = Math.max(pixi.maxInFlight, pixi.inFlight);
      try {
        if (pixi.loadGate) await pixi.loadGate;
        if (pixi.blocked) await pixi.blocked(url);
        if (pixi.loadDelayMs) await new Promise(resolve => setTimeout(resolve, pixi.loadDelayMs));
        if ([...pixi.missing].some(path => url.includes(path))) throw new Error('missing specific frame');
        if ([...pixi.idlePaths].some(path => url.includes(path))) {
          if (pixi.idleEnabled) return pixi.idleTexture;
          throw new Error('missing test idle frame');
        }
        if (url.includes('/sprite-v1/') && !url.includes('/neutral.webp')) return { id: url };
        if (url.includes('/atk-wind.webp')) return pixi.extraTexture;
        throw new Error('missing test frame');
      } finally { pixi.inFlight -= 1; }
    },
    unload: async url => {
      pixi.unloaded.push(url);
      if (pixi.unloadGate) await pixi.unloadGate;
    },
  },
}));

import { attach, cacheStats, hide, play, presentDeath } from '../game/src/battle/view/battle.frames.js';
import { WU_FRAME_SEQUENCES } from '../game/src/battle/view/battle.frame-catalog.js';
import { CHANGWUYU_FRAME_SEQUENCES } from '../game/src/battle/view/battle.frame-catalog-changwuyu.js';
import { THREE_ROLE_FRAME_SEQUENCES } from '../game/src/battle/view/battle.frame-catalog-three-role.js';

const runtimeSequences = { wu: WU_FRAME_SEQUENCES, changwuyu: CHANGWUYU_FRAME_SEQUENCES, ...THREE_ROLE_FRAME_SEQUENCES };
// 测试资产桩跟随已交付目录；常无语已使用 f000 等帧名，不能再假定 neutral/frame-001。
for (const [role, sequence] of Object.entries(runtimeSequences)) {
  for (const name of sequence.idle) pixi.idlePaths.add(`/${role}/${name}.webp`);
}
const deliveredNames = role => [...new Set(Object.values(runtimeSequences[role]).flat())];
const finishFrames = async role => {
  await vi.waitFor(() => expect(pixi.loaded.filter(url => url.includes(`/frames/${role}/`))).toHaveLength(deliveredNames(role).length));
  await vi.waitFor(() => expect(pixi.inFlight).toBe(0));
};


vi.stubGlobal('fetch', async () => { throw new Error('No network in targeted frame test'); });

const flush = async () => { for (let i = 0; i < 24; i++) await Promise.resolve(); };
const releaseProbes = new Set();
const probeFetchFallback = globalThis.fetch;
// Preserve the singleton app host while rebuilding only the battle stage, as production does.
function mount(token = 1) {
  if (!document.getElementById('overlay')) document.body.innerHTML = '<div id="overlay"><div id="ovBody"></div></div>';
  document.getElementById('overlay').hidden = false;
  document.getElementById('ovBody').innerHTML = '<div class="battle-stage sts"><div id="btSelf"><div class="sts-figure"><img src="/assets/portraits/battle/changwuyu.webp" /></div></div></div>';
  document.querySelector('.battle-stage')._battleToken = token;
  return document.getElementById('ovBody');
}
beforeEach(() => { pixi.loaded.length = 0; pixi.unloaded.length = 0; pixi.inFlight = 0; pixi.started = 0; pixi.stopped = 0; });
afterEach(async () => { for (const release of releaseProbes) release(); releaseProbes.clear(); globalThis.fetch = probeFetchFallback; pixi.finishLoad?.(); pixi.loadGate = null; await hide(); document.querySelectorAll('#unitFrames').forEach(host => { if (!host.querySelector('canvas')) host.remove(); }); vi.restoreAllMocks(); vi.useRealTimers(); });
it('does not leave failed Pixi hosts behind after repeated initialization failures', async () => {
  pixi.failInit = true;
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  const body = mount();
  expect(await attach(body)).toBe(false);
  expect(document.querySelectorAll('#unitFrames')).toHaveLength(0);
  expect(await attach(body)).toBe(false);
  expect(document.querySelectorAll('#unitFrames')).toHaveLength(0);
  pixi.failInit = false; pixi.failSprite = true;
  expect(await attach(body)).toBe(false);
  expect(document.querySelectorAll('#unitFrames')).toHaveLength(0); expect(pixi.destroyed).toBe(1);
  pixi.failSprite = false; expect(await attach(body)).toBe(true);
  expect(document.querySelectorAll('#unitFrames')).toHaveLength(1); warn.mockRestore();
});
it('releases frame ownership when the overlay is explicitly closed', async () => {
  pixi.failInit = false;
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'setTimeout', 'clearTimeout'] });
  const body = mount();
  await attach(body); await flush();
  expect(cacheStats().roleNames).toEqual(['changwuyu']);
  document.dispatchEvent(new CustomEvent('sdt-overlay-close'));
  document.getElementById('overlay').hidden = true; body.replaceChildren();
  await flush();
  expect(cacheStats().roles).toBe(0);
  expect(vi.getTimerCount()).toBe(0);
});
it('resets a same-role death presentation when a newer battle reuses the overlay', async () => {
  const clock = vi.spyOn(performance, 'now').mockReturnValue(1000);
  const body = mount(1);
  await attach(body); await finishFrames('changwuyu');
  let oldDeathDone = false;
  presentDeath().then(() => { oldDeathDone = true; });
  const oldStage = body.firstElementChild;
  const next = oldStage.cloneNode(true); next._battleToken = 2; next.inert = false; oldStage.replaceWith(next);
  expect(await attach(body)).toBe(true);
  expect(play('atk')).toBe(true);
  expect(document.getElementById('unitFrames').dataset.action).toBe('atk');
  await flush(); expect(oldDeathDone).toBe(true);
  expect(oldStage.inert).toBeFalsy(); expect(next.inert).toBeFalsy(); clock.mockRestore();
});

it('aborts pending alpha probes on close so a subsequent battle is not blocked on them', async () => {
  const normalFetch = globalThis.fetch;
  let probeSignal, probeStarted = false, cancelProbe;
  globalThis.fetch = vi.fn((url, options) => {
    probeStarted = true; probeSignal = options?.signal;
    return new Promise((resolve, reject) => { cancelProbe = () => reject(new Error('Probe cancelled')); releaseProbes.add(cancelProbe); probeSignal?.addEventListener('abort', cancelProbe, { once: true }); });
  });
  const body = mount(20), first = attach(body);
  await vi.waitFor(() => expect(probeStarted).toBe(true));
  document.dispatchEvent(new CustomEvent('sdt-overlay-close'));
  const aborted = probeSignal?.aborted; cancelProbe();
  globalThis.fetch = normalFetch;
  mount(21); const next = attach(body);
  expect(await first).toBe(false); expect(await next).toBe(true); expect(aborted).toBe(true);
});
it('does not restart rendering from a queued action wake after synchronous close', async () => {
  const body = mount(30); await attach(body); await vi.waitFor(() => expect(pixi.inFlight).toBe(0));
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'setTimeout', 'clearTimeout'] });
  expect(play('atk')).toBe(true);
  const startsBeforeClose = pixi.started;
  document.dispatchEvent(new CustomEvent('sdt-overlay-close'));
  await flush();
  expect(vi.getTimerCount()).toBe(0);
  expect(pixi.started).toBe(startsBeforeClose);
  expect(cacheStats().roles).toBe(0);
});

it('shares normal same-token rerenders without interrupting an attack', async () => {
  const body = mount(40); await attach(body); await finishFrames('changwuyu');
  expect(play('atk')).toBe(true);
  const texture = pixi.sprites.at(-1).texture;
  const loads = pixi.loaded.length;
  expect(await attach(body)).toBe(true);
  expect(document.getElementById('unitFrames').dataset.action).toBe('atk');
  expect(pixi.sprites.at(-1).texture).toBe(texture); expect(pixi.loaded).toHaveLength(loads);
});
it('shares a cancelled pending URL with its new owner and unloads only after that owner exits', async () => {
  const body = mount(50), oldImg = body.querySelector('img');
  pixi.loadGate = new Promise(resolve => { pixi.finishLoad = resolve; });
  const first = attach(body);
  await vi.waitFor(() => expect(pixi.inFlight).toBe(1));
  const oldLoad = pixi.loaded[0];
  document.dispatchEvent(new CustomEvent('sdt-overlay-close'));
  document.getElementById('overlay').hidden = true; body.replaceChildren();
  expect(oldImg.style.visibility).toBe(''); expect(cacheStats().roles).toBe(0);
  mount(51); const next = attach(body), img = body.querySelector('img');
  await flush(); expect(pixi.loaded).toHaveLength(1); expect(img.style.visibility).toBe('hidden');
  pixi.finishLoad(); pixi.loadGate = null;
  expect(await first).toBe(false); expect(await next).toBe(true);
  expect(pixi.unloaded).not.toContain(oldLoad); expect(img.style.visibility).toBe('hidden');
  expect(pixi.loaded.filter(url => url === oldLoad)).toHaveLength(1);
  expect(document.getElementById('unitFrames').hidden).toBe(false);
  expect(cacheStats().roleNames).toEqual(['changwuyu']);
  await hide();
  expect(pixi.unloaded).toContain(oldLoad);
});
it.each(['role', 'token'])('aborts an old pending alpha probe on %s replacement and does not share its attachment', async kind => {
  const normalFetch = globalThis.fetch;
  let probeSignal, releaseProbe;
  globalThis.fetch = vi.fn((url, options) => new Promise((resolve, reject) => {
    probeSignal = options?.signal;
    releaseProbe = () => reject(new Error('Old probe released')); releaseProbes.add(releaseProbe);
    probeSignal?.addEventListener('abort', releaseProbe, { once: true });
  }));
  const body = mount(60), first = attach(body);
  await vi.waitFor(() => expect(releaseProbe).toBeTypeOf('function'));
  if (kind === 'role') body.querySelector('img').setAttribute('data-asset-key', 'battle-baita');
  else body.querySelector('.battle-stage')._battleToken = 61;
  const next = attach(body); expect(next).not.toBe(first);
  globalThis.fetch = normalFetch;
  await flush(); const aborted = probeSignal?.aborted; releaseProbe();
  expect(await first).toBe(false); expect(await next).toBe(true); expect(aborted).toBe(true);
  expect(cacheStats().roleNames).toEqual([kind === 'role' ? 'baita' : 'changwuyu']);
});
it('settles a cancelled bitmap probe immediately and closes the late bitmap without changing the next role', async () => {
  const normalFetch = globalThis.fetch;
  let finishBitmap, bitmapStarted = false;
  globalThis.fetch = vi.fn(() => Promise.resolve({ blob: async () => new Blob() }));
  vi.stubGlobal('createImageBitmap', vi.fn(() => { bitmapStarted = true; return new Promise(resolve => { finishBitmap = resolve; releaseProbes.add(() => resolve({ close() {} })); }); }));
  const body = mount(70), first = attach(body);
  await vi.waitFor(() => expect(bitmapStarted).toBe(true));
  document.dispatchEvent(new CustomEvent('sdt-overlay-close'));
  globalThis.fetch = normalFetch;
  mount(71); body.querySelector('img').setAttribute('data-asset-key', 'battle-baita');
  const next = attach(body);
  let oldResult, nextResult; first.then(value => { oldResult = value; }); next.then(value => { nextResult = value; });
  await vi.waitFor(() => { expect(oldResult).toBe(false); expect(nextResult).toBe(true); });
  const currentTexture = pixi.sprites.at(-1).texture;
  const bitmap = { width: 512, height: 760, close: vi.fn() };
  finishBitmap(bitmap); await flush();
  expect(bitmap.close).toHaveBeenCalledOnce(); expect(pixi.sprites.at(-1).texture).toBe(currentTexture);
  expect(document.getElementById('unitFrames').dataset.role).toBe('baita');
});
afterAll(() => vi.unstubAllGlobals());

it('settles a dying old role and hides its frame layer while a replacement role loads', async () => {
  const body = mount(80); await attach(body); await finishFrames('changwuyu');
  let oldDeathDone = false; presentDeath().then(() => { oldDeathDone = true; });
  const stage = body.querySelector('.battle-stage');
  body.querySelector('img').setAttribute('data-asset-key', 'battle-baita');
  pixi.loadGate = new Promise(resolve => { pixi.finishLoad = resolve; });
  const next = attach(body);
  expect(document.getElementById('unitFrames').hidden).toBe(true);
  await flush(); expect(oldDeathDone).toBe(true); expect(stage.inert).toBeFalsy();
  pixi.finishLoad(); pixi.loadGate = null; expect(await next).toBe(true);
  expect(play('atk')).toBe(true); expect(document.getElementById('unitFrames').dataset.role).toBe('baita');
});

it.each(Object.keys(runtimeSequences))('measures only the geometry anchor for fixed-canvas %s, retaining all delivered texture frames', async role => {
  const bitmapBefore = globalThis.createImageBitmap;
  const bitmaps = [];
  globalThis.fetch = vi.fn(async () => ({ blob: async () => new Blob() }));
  globalThis.createImageBitmap = vi.fn(async () => {
    const bitmap = { width: 512, height: 342, close: vi.fn() }; bitmaps.push(bitmap); return bitmap;
  });
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
  try {
    const body = mount(200); body.querySelector('img').setAttribute('data-asset-key', `battle-${role}`);
    expect(await attach(body)).toBe(true); await finishFrames(role);
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    expect(globalThis.fetch.mock.calls[0][0]).toContain(runtimeSequences[role].idle[0]);
    expect(globalThis.createImageBitmap).toHaveBeenCalledTimes(1);
    expect(bitmaps[0].close).toHaveBeenCalledOnce();
    expect(new Set(pixi.loaded).size).toBe(deliveredNames(role).length);
    const firstLoads = pixi.loaded.length;
    play('atk'); play('cast'); play('hurt');
    expect(pixi.loaded).toHaveLength(firstLoads);
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  } finally { globalThis.createImageBitmap = bitmapBefore; }
});

it('measures the next available idle when the first texture is missing and releases all successful textures', async () => {
  const bitmapBefore = globalThis.createImageBitmap;
  const role = 'changwuyu', [missing, fallback] = runtimeSequences[role].idle;
  const bitmaps = [];
  globalThis.fetch = vi.fn(async () => ({ blob: async () => new Blob() }));
  globalThis.createImageBitmap = vi.fn(async () => {
    const bitmap = { width: 768, height: 512, close: vi.fn() }; bitmaps.push(bitmap); return bitmap;
  });
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
  pixi.missing.add(`/${role}/${missing}.webp`);
  try {
    const body = mount(201);
    expect(await attach(body)).toBe(true); await finishFrames(role);
    expect(globalThis.fetch).toHaveBeenCalledTimes(2);
    expect(globalThis.fetch.mock.calls[1][0]).toContain(fallback);
    expect(document.getElementById('unitFrames').dataset.frame).toBe(fallback);
    expect(bitmaps).toHaveLength(2);
    bitmaps.forEach(bitmap => expect(bitmap.close).toHaveBeenCalledOnce());
    await hide();
    expect(pixi.unloaded).toHaveLength(deliveredNames(role).length - 1);
    expect(pixi.unloaded.some(url => url.includes(`/${missing}.webp`))).toBe(false);
    expect(cacheStats().roles).toBe(0);
  } finally { pixi.missing.clear(); globalThis.createImageBitmap = bitmapBefore; }
});
