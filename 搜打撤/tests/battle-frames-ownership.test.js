import { pixiFrameMocks } from './helpers/environment-fixtures.js';
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
      this.renderer = { type: 1, render() { pixi.rendered += 1; pixi.onRender?.(); } };
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
    idleEnabled: true, idlePaths: new Set(), rendered: 0, onRender: null, loadDelayMs: 0, inFlight: 0, maxInFlight: 0, tick: null,
    blocked: null, missing: new Set(), failInit: false, failSprite: false, destroyed: 0, started: 0, stopped: 0 };
});

vi.mock('pixi.js', () => ({
  ...pixiFrameMocks(pixi),
}));

import { setPerformanceSettings } from '../game/src/core/performance-settings.js';
import { emit as emitBattleEvent } from '../game/src/core/event-bus.js';
import { createBattleDecisionPresenter, restoreCombatScene } from '../game/src/battle/view/battle.decision-shell.js';
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
beforeEach(() => { pixi.onRender = null; pixi.loaded.length = 0; pixi.unloaded.length = 0; pixi.inFlight = 0; pixi.started = 0; pixi.stopped = 0; });
afterEach(async () => { pixi.finishUnload?.(); pixi.unloadGate = null; for (const release of releaseProbes) release(); releaseProbes.clear(); globalThis.fetch = probeFetchFallback; pixi.finishLoad?.(); pixi.loadGate = null; await hide(); document.querySelectorAll('#unitFrames').forEach(host => { if (!host.querySelector('canvas')) host.remove(); }); vi.restoreAllMocks(); vi.useRealTimers(); });
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
  await flush(); expect(pixi.loaded).toHaveLength(1); expect(img.style.visibility).toBe('');
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


function settingsPanel(body, mode = 'settings') {
  const scene = body.querySelector('.battle-stage');
  const UI = {
    el: { ovBody: body, overlay:body.closest('#overlay') },
    showOverlay(title, html, nextMode, options = {}) {
      this._overlayRevision = (this._overlayRevision || 0) + 1;
      if (options.battleBody) { if (!options.battleBody(html)) return; }
      else body.innerHTML = html;
      document.dispatchEvent(new CustomEvent('sdt-overlay-mode', { detail: nextMode }));
    },
  };
  const snapshot = { battleToken: scene._battleToken, turn: 1, energy: 2, maxEnergy: 2, opts: {} };
  const present = createBattleDecisionPresenter({ UI, getSnapshot: () => snapshot, R: () => ({ battleEnergy: 2 }) });
  const content = mode === true ? '<div class="bt-settings">音效设置</div>' : '<p>战斗规则</p>';
  present('规则与设置', content + '<div class="ov-btns"><button>返回战斗</button></div>', mode);
  return () => restoreCombatScene(UI, scene._battleToken);
}

it.each(['settings', true])('retains one role through repeated same-battle settings and releases it on actual close (mode: %s)', async mode => {
  const body = mount(100);
  await attach(body); await finishFrames('changwuyu');
  const baseline = { loads: pixi.loaded.length, unloads: pixi.unloaded.length };
  const textureCount = cacheStats().textureCount;
  const frame = pixi.sprites.at(-1).texture;
  for (let i = 0; i < 3; i++) {
    const back = settingsPanel(body, mode);
    await flush();
    expect(cacheStats()).toMatchObject({ roles: 1, textureCount, activeFrameSessions: 0 });
    expect(document.getElementById('unitFrames').hidden).toBe(true);
    expect(document.querySelector('#btSelf img').style.visibility).toBe('');
    const painted = pixi.rendered;
    pixi.tick();
    expect(pixi.rendered).toBe(painted);
    expect(play('atk')).toBe(false);
    expect(pixi.stopped).toBeGreaterThan(0);
    expect(back()).toBe(true);
    const ready = attach(body);
    // A retained, already-painted frame is visible before yielding to the return promise.
    expect(document.getElementById('unitFrames').hidden).toBe(false);
    expect(pixi.sprites.at(-1).texture).toBe(frame);
    expect(await ready).toBe(true);
    expect(cacheStats().activeFrameSessions).toBe(1);
  }
  expect(pixi.loaded).toHaveLength(baseline.loads);
  expect(pixi.unloaded).toHaveLength(baseline.unloads);
  document.dispatchEvent(new CustomEvent('sdt-overlay-close'));
  await flush();
  expect(cacheStats()).toMatchObject({ roles: 0, textureCount: 0, activeFrameSessions: 0 });
  expect(pixi.unloaded).toHaveLength(baseline.loads);
  console.info('[frame-settings-operation-counts]', JSON.stringify({ initial: baseline,
    repeatedSettings: 3, addedLoads: pixi.loaded.length - baseline.loads,
    addedSettingsUnloads: baseline.unloads, actualCloseUnloads: pixi.unloaded.length }));
});

it('does not resubmit an unchanged frame after a synchronous warm return paint', async () => {
  const clock = vi.spyOn(performance, 'now').mockReturnValue(1000);
  const body = mount(110);
  let left = 50;
  vi.spyOn(body.querySelector('.sts-figure'), 'getBoundingClientRect').mockImplementation(() => ({ left, top: 60, width: 100, height: 150 }));
  await attach(body); await finishFrames('changwuyu');
  pixi.tick(); // Settle the first paint before the separately measured warm return.
  const back = settingsPanel(body);
  left = 80; // Covered geometry changed: the mandatory warm paint must include it.
  await flush(); expect(back()).toBe(true);
  const before = pixi.rendered;
  const ready = attach(body);
  expect(pixi.rendered).toBe(before + 1);
  expect(await ready).toBe(true);
  clock.mockReturnValue(1017); // Next draw budget, still before the next idle frame.
  pixi.tick();
  expect(pixi.rendered).toBe(before + 1);
});

it.each(['invalidate', 'throw'])('retains new work during a warm paint (%s)', async behavior => {
  vi.spyOn(performance, 'now').mockReturnValue(1000);
  const body = mount(111);
  await attach(body); await finishFrames('changwuyu');
  const back = settingsPanel(body); await flush(); expect(back()).toBe(true);
  const error = new Error('warm paint failure');
  pixi.onRender = () => {
    pixi.onRender = null;
    if (behavior === 'throw') throw error;
    setPerformanceSettings({ quality: 'low', fps: 30 });
  };
  try {
    if (behavior === 'throw') expect(() => attach(body)).toThrow(error);
    else expect(await attach(body)).toBe(true);
    const painted = pixi.rendered;
    pixi.tick();
    expect(pixi.rendered).toBe(painted + 1);
  } finally { setPerformanceSettings({ quality: 'balanced', fps: 60 }); }
});

it('returns during a pending first-frame load without duplicate loads or old callback resurrection', async () => {
  const body = mount(101);
  pixi.loadGate = new Promise(resolve => { pixi.finishLoad = resolve; });
  const oldAttach = attach(body);
  await vi.waitFor(() => expect(pixi.inFlight).toBe(1));
  const back = settingsPanel(body);
  expect(back()).toBe(true);
  const resumed = attach(body);
  expect(resumed).not.toBe(oldAttach);
  pixi.finishLoad(); pixi.loadGate = null;
  expect(await oldAttach).not.toBe(true);
  expect(await resumed).toBe(true);
  await finishFrames('changwuyu');
  expect(new Set(pixi.loaded).size).toBe(pixi.loaded.length);
  expect(pixi.unloaded).toEqual([]);
  expect(document.getElementById('unitFrames').hidden).toBe(false);
  expect(cacheStats().activeFrameSessions).toBe(1);
});

it('keeps a completed pending load hidden under settings, including a second settings panel', async () => {
  const body = mount(102);
  pixi.loadGate = new Promise(resolve => { pixi.finishLoad = resolve; });
  const oldAttach = attach(body);
  await vi.waitFor(() => expect(pixi.inFlight).toBe(1));
  settingsPanel(body);
  const back = settingsPanel(body);
  pixi.finishLoad(); pixi.loadGate = null;
  expect(await oldAttach).not.toBe(true);
  await finishFrames('changwuyu');
  expect(cacheStats()).toMatchObject({ roles: 1, activeFrameSessions: 0 });
  expect(document.getElementById('unitFrames').hidden).toBe(true);
  expect(document.querySelector('#btSelf img').style.visibility).toBe('');
  expect(pixi.unloaded).toEqual([]);
  const loads = pixi.loaded.length;
  expect(back()).toBe(true);
  expect(await attach(body)).toBe(true);
  expect(pixi.loaded).toHaveLength(loads);
});

it('releases a suspended role when its retained stage is removed without a mode event', async () => {
  const body = mount(103);
  await attach(body); await finishFrames('changwuyu');
  settingsPanel(body);
  body.querySelector('.battle-stage').remove();
  await flush();
  expect(cacheStats()).toMatchObject({ roles: 0, activeFrameSessions: 0, textureCount: 0 });
  expect(pixi.unloaded).toHaveLength(pixi.loaded.length);
  expect(document.getElementById('unitFrames').hidden).toBe(true);
});

it('releases pending suspended ownership before a new battle and ignores the old completion', async () => {
  const body = mount(104);
  let finishOld;
  pixi.loadGate = new Promise(resolve => { finishOld = resolve; pixi.finishLoad = resolve; });
  const oldAttach = attach(body);
  await vi.waitFor(() => expect(pixi.inFlight).toBe(1));
  settingsPanel(body);
  const next = mount(105);
  pixi.loadGate = null;
  const currentAttach = attach(next);
  finishOld();
  expect(await oldAttach).not.toBe(true);
  expect(await currentAttach).toBe(true);
  await flush();
  expect(document.querySelector('.battle-stage')._battleToken).toBe(105);
  expect(cacheStats()).toMatchObject({ roles: 1, activeFrameSessions: 1 });
  expect(document.getElementById('unitFrames').hidden).toBe(false);
  expect(document.querySelector('#btSelf img').style.visibility).toBe('hidden');
});

it('still releases textures for a retained non-settings page', async () => {
  const body = mount(106);
  await attach(body); await finishFrames('changwuyu');
  settingsPanel(body, 'bag');
  await flush();
  expect(cacheStats()).toMatchObject({ roles: 0, activeFrameSessions: 0, textureCount: 0 });
  expect(pixi.unloaded).toHaveLength(pixi.loaded.length);
});


it('releases a settings-shaped page that does not actually restore the retained stage', async () => {
  const body = mount(107);
  await attach(body); await finishFrames('changwuyu');
  body.innerHTML = '<div class="battle-secondary-layer">Unretained settings</div>';
  document.dispatchEvent(new CustomEvent('sdt-overlay-mode', { detail: 'settings' }));
  await flush();
  expect(cacheStats()).toMatchObject({ roles: 0, activeFrameSessions: 0 });
  expect(pixi.unloaded).toHaveLength(pixi.loaded.length);
});

it('releases retained textures when the entire overlay is removed', async () => {
  const body = mount(108);
  await attach(body); await finishFrames('changwuyu');
  settingsPanel(body);
  const overlay = document.getElementById('overlay');
  overlay.remove();
  await flush();
  expect(cacheStats()).toMatchObject({ roles: 0, activeFrameSessions: 0 });
  expect(pixi.unloaded).toHaveLength(pixi.loaded.length);
  // Restore the singleton app host for the test fixture, not the disposed stage.
  overlay.querySelector('#ovBody').replaceChildren();
  document.body.append(overlay);
});


it('releases the suspended role immediately on the real battle-end event', async () => {
  const body = mount(109);
  await attach(body); await finishFrames('changwuyu');
  settingsPanel(body);
  emitBattleEvent('battle:end', { win: true });
  expect(cacheStats()).toMatchObject({ roles: 0, activeFrameSessions: 0 });
  expect(document.getElementById('unitFrames').hidden).toBe(true);
  await flush();
  expect(pixi.unloaded).toHaveLength(pixi.loaded.length);
});

it('counts complete settings roundtrips without repeated texture load or release operations', async () => {
  const body = mount(110);
  await attach(body); await finishFrames('changwuyu');
  const initialLoads = pixi.loaded.length;
  for (let i = 0; i < 3; i++) {
    const back = settingsPanel(body);
    await flush();
    back();
    await attach(body);
    await vi.waitFor(() => expect(cacheStats().phase).toBe('all-ready'));
  }
  const settingsLoads = pixi.loaded.length - initialLoads;
  const settingsUnloads = pixi.unloaded.length;
  emitBattleEvent('battle:end', { win: true });
  await flush();
  const afterExitUnloads = pixi.unloaded.length;
  console.info('[frame-settings-complete-roundtrips]', JSON.stringify({ initialLoads,
    roundtrips: 3, settingsLoads, settingsUnloads, actualExitUnloads: afterExitUnloads - settingsUnloads,
    totalUnloads: afterExitUnloads, remainingTextures: cacheStats().textureCount }));
  expect(settingsLoads).toBe(0);
  expect(settingsUnloads).toBe(0);
  expect(afterExitUnloads).toBe(initialLoads);
});


it.each(['settings', true])('stops geometry polling and queued renderer wakes for the entire settings suspension (mode: %s)', async mode => {
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'setTimeout', 'clearTimeout'] });
  const body = mount(111);
  await attach(body); await flush();
  expect(vi.getTimerCount()).toBeGreaterThan(0);
  const back = settingsPanel(body, mode);
  await flush();
  // The settings panel owns a finite entry transition; renderer polling must
  // remain stopped after that transition and throughout the suspension.
  await vi.advanceTimersByTimeAsync(1000);
  expect(vi.getTimerCount()).toBe(0);
  const started = pixi.started;
  window.dispatchEvent(new Event('resize'));
  document.dispatchEvent(new Event('visibilitychange'));
  await flush();
  expect(vi.getTimerCount()).toBe(0);
  expect(pixi.started).toBe(started);
  expect(back()).toBe(true);
  expect(await attach(body)).toBe(true);
  await flush();
  expect(vi.getTimerCount()).toBeGreaterThan(0);
  expect(pixi.started).toBeGreaterThan(started);
});


it('does not retain textures for a generic boolean-wide page without battle settings', async () => {
  const body = mount(112);
  await attach(body); await finishFrames('changwuyu');
  const scene = body.querySelector('.battle-stage'); scene.remove();
  body.innerHTML = '<div class="battle-secondary-layer">Other wide page</div>';
  document.dispatchEvent(new CustomEvent('sdt-overlay-mode', { detail: true }));
  body.prepend(scene);
  await flush();
  expect(cacheStats()).toMatchObject({ roles: 0, activeFrameSessions: 0 });
  expect(pixi.unloaded).toHaveLength(pixi.loaded.length);
});

it('reattaches a replaced image in the retained stage without leaving the frame host hidden', async () => {
  const body = mount(113);
  await attach(body); await finishFrames('changwuyu');
  const initialLoads = pixi.loaded.length;
  const back = settingsPanel(body, true);
  const img = body.querySelector('#btSelf img');
  img.replaceWith(img.cloneNode(true));
  await flush();
  expect(back()).toBe(true);
  expect(await attach(body)).toBe(true);
  await flush();
  expect(document.getElementById('unitFrames').hidden).toBe(false);
  expect(cacheStats()).toMatchObject({ roles: 1, activeFrameSessions: 1 });
  expect(pixi.loaded).toHaveLength(initialLoads);
  expect(pixi.unloaded).toEqual([]);
});

it('keeps the static portrait until reload first paint, including release/load/probe waits', async () => {
  const body = mount(301); await attach(body); await finishFrames('changwuyu');
  const initialLoads = pixi.loaded.length;
  pixi.unloadGate = new Promise(resolve => { pixi.finishUnload = resolve; });
  const release = hide();
  pixi.loadGate = new Promise(resolve => { pixi.finishLoad = resolve; });
  const img = body.querySelector('img');
  const pending = attach(body);
  expect(attach(body)).toBe(pending);
  expect(img.style.visibility).toBe('');
  expect(document.getElementById('unitFrames').hidden).toBe(true);
  let releaseProbe;
  globalThis.fetch = vi.fn(() => new Promise((resolve, reject) => {
    releaseProbe = () => reject(new Error('controlled probe fallback')); releaseProbes.add(releaseProbe);
  }));
  pixi.finishUnload(); pixi.unloadGate = null; await release;
  await vi.waitFor(() => expect(pixi.inFlight).toBe(1));
  expect(img.style.visibility).toBe('');
  pixi.finishLoad(); pixi.loadGate = null;
  await vi.waitFor(() => expect(releaseProbe).toBeTypeOf('function'));
  expect(img.style.visibility).toBe('');
  expect(document.getElementById('unitFrames').hidden).toBe(true);
  pixi.onRender = () => {
    expect(img.style.visibility).toBe('');
    expect(document.getElementById('unitFrames').hidden).toBe(true);
    pixi.onRender = null;
  };
  releaseProbe();
  expect(await pending).toBe(true);
  expect(img.style.visibility).toBe('hidden');
  expect(document.getElementById('unitFrames').hidden).toBe(false);
  globalThis.fetch = probeFetchFallback;
  await vi.waitFor(() => expect(pixi.loaded.length).toBe(initialLoads * 2));
  await vi.waitFor(() => expect(pixi.inFlight).toBe(0));
  expect(pixi.unloaded.length).toBe(initialLoads);
  console.info('[portrait-handoff-resource-counts]', JSON.stringify({ initialLoads, reloadLoads: pixi.loaded.length - initialLoads, unloads: pixi.unloaded.length }));
});

it.each(['cold', 'reattach', 'warm'])('keeps static fallback through a failed %s paint and hands off if a later ticker retry occurs', async mode => {
  vi.spyOn(performance, 'now').mockReturnValue(1000);
  const body = mount(302);
  if (mode !== 'cold') { await attach(body); await finishFrames('changwuyu'); }
  if (mode === 'reattach') mount(302);
  if (mode === 'warm') { const back = settingsPanel(body); await flush(); expect(back()).toBe(true); }
  const img = body.querySelector('img');
  const error = new Error('first paint rejected');
  pixi.onRender = () => { pixi.onRender = null; expect(img.style.visibility).toBe(''); throw error; };
  if (mode === 'warm') expect(() => attach(body)).toThrow(error);
  else await expect(attach(body)).rejects.toBe(error);
  expect(img.style.visibility).toBe('');
  // Explicitly drive a later tick: a thrown cold/stopped warm paint need not restart itself.
  pixi.tick();
  expect(img.style.visibility).toBe('hidden');
  expect(document.getElementById('unitFrames').hidden).toBe(false);
});

it.each(['hide', 'remove', 'token', 'figure', 'new-attach'])('does not hand off a paint whose owner changes during render (%s)', async change => {
  const body = mount(303), img = body.querySelector('img');
  let next;
  pixi.onRender = () => {
    pixi.onRender = null;
    if (change === 'hide') hide();
    if (change === 'remove') body.replaceChildren();
    if (change === 'token') body.querySelector('.battle-stage')._battleToken = 304;
    if (change === 'figure' || change === 'new-attach') {
      mount(304);
      if (change === 'new-attach') next = attach(body);
    }
  };
  expect(await attach(body)).not.toBe(true);
  expect(img.style.visibility).toBe('');
  if (next) {
    expect(await next).toBe(true);
    expect(body.querySelector('img').style.visibility).toBe('hidden');
  } else expect(document.getElementById('unitFrames').hidden).toBe(true);
});

it('does not repeat presentation DOM writes on subsequent animated paints', async () => {
  const clock = vi.spyOn(performance, 'now').mockReturnValue(1000);
  const body = mount(305); await attach(body); await finishFrames('changwuyu');
  const img = body.querySelector('img'), host = document.getElementById('unitFrames');
  const staticWrites = vi.spyOn(img.style, 'visibility', 'set');
  const hostWrites = vi.spyOn(host, 'hidden', 'set');
  const ownershipQueries = vi.spyOn(body.querySelector('.sts-figure'), 'querySelector');
  const mutations = [];
  const observer = new MutationObserver(records => mutations.push(...records));
  observer.observe(img, { attributes: true, attributeFilter: ['style'] });
  observer.observe(host, { attributes: true, attributeFilter: ['hidden'] });
  const rendered = pixi.rendered, loads = pixi.loaded.length, unloads = pixi.unloaded.length;
  for (let i = 1; i <= 4; i++) { play(i % 2 ? 'atk' : 'hurt'); clock.mockReturnValue(1000 + i * 200); pixi.tick(); }
  await flush(); observer.disconnect();
  expect(pixi.rendered).toBeGreaterThan(rendered);
  expect(mutations).toEqual([]);
  expect(staticWrites).not.toHaveBeenCalled();
  expect(hostWrites).not.toHaveBeenCalled();
  expect(ownershipQueries).not.toHaveBeenCalled();
  expect(pixi.loaded).toHaveLength(loads); expect(pixi.unloaded).toHaveLength(unloads);
});


it('keeps the fallback through a failed texture load and a later successful retry', async () => {
  const body = mount(306), img = body.querySelector('img');
  pixi.idleEnabled = false;
  pixi.loadGate = new Promise(resolve => { pixi.finishLoad = resolve; });
  try {
    const first = attach(body);
    await vi.waitFor(() => expect(pixi.inFlight).toBe(1));
    expect(img.style.visibility).toBe('');
    pixi.finishLoad(); pixi.loadGate = null;
    expect(await first).toBe(false);
    expect(img.style.visibility).toBe('');
    expect(document.getElementById('unitFrames').hidden).toBe(true);
    pixi.idleEnabled = true;
    // A failed set retains its existing cached result until the normal release boundary.
    expect(await attach(body)).toBe(false);
    await hide();
    expect(await attach(body)).toBe(true);
    expect(img.style.visibility).toBe('hidden');
  } finally { pixi.idleEnabled = true; }
});

it('counts unchanged complete release/reload operations for the same battle', async () => {
  const body = mount(307); await attach(body); await finishFrames('changwuyu');
  const loads = pixi.loaded.length;
  await hide();
  expect(await attach(body)).toBe(true);
  await vi.waitFor(() => expect(pixi.loaded).toHaveLength(loads * 2));
  await vi.waitFor(() => expect(pixi.inFlight).toBe(0));
  expect(pixi.unloaded).toHaveLength(loads);
  console.info('[portrait-reload-complete-counts]', JSON.stringify({ initialLoads: loads, reloadLoads: pixi.loaded.length - loads, unloads: pixi.unloaded.length }));
});
