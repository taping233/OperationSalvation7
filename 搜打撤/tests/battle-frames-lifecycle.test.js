import { pixiFrameMocks } from './helpers/environment-fixtures.js';
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';

const pixi = vi.hoisted(() => {
  const unloaded = [];
  const loaded = [];
  const sprites = [];
  const idleTexture = { id: 'idle-texture' };
  const extraTexture = { id: 'extra-texture' };
  const emptyTexture = { id: 'empty' };
  class Application {
    constructor(options) {
      pixi.lastApp = this;
      this.options = options;
      this.view = document.createElement('canvas');
      this.stage = { addChild() {} };
      this.ticker = { maxFPS: 0, remove: vi.fn(), stop() {}, start() {}, add(fn) { pixi.tick = fn; } };
      const view = this.view;
      this.renderer = { type: 1, resolution: options.resolution,
        get width() { return view.width; }, get height() { return view.height; },
        resize: vi.fn(function(width, height) {
          view.width = Math.round(width * this.resolution);
          view.height = Math.round(height * this.resolution);
          this.screen = { width: view.width / this.resolution, height: view.height / this.resolution };
        }),
        render() { pixi.rendered += 1; pixi.onRender?.(); } };
    }
    stop() {}
    start() {}
  }
  class Sprite {
    constructor() {
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
    blocked: null, missing: new Set() };
});

vi.mock('pixi.js', () => ({
  ...pixiFrameMocks(pixi),
}));

import * as Flight from '../game/src/core/flight-recorder.local.js';
import { setPerformanceSettings } from '../game/src/core/performance-settings.js';
import { scale as uiScale } from '../game/src/ui/ui-scale.js';
import { attach, cacheStats, isLiveBattleFigure, hide, play, presentDeath, actionImpactRemaining } from '../game/src/battle/view/battle.frames.js';
import { WU_FRAME_SEQUENCES, wuTimeline } from '../game/src/battle/view/battle.frame-catalog.js';
import { CHANGWUYU_FRAME_SEQUENCES, changwuyuTimeline } from '../game/src/battle/view/battle.frame-catalog-changwuyu.js';
import { THREE_ROLE_FRAME_SEQUENCES, threeRoleTimeline } from '../game/src/battle/view/battle.frame-catalog-three-role.js';

const runtimeSequences = { wu: WU_FRAME_SEQUENCES, changwuyu: CHANGWUYU_FRAME_SEQUENCES, ...THREE_ROLE_FRAME_SEQUENCES };
// 测试资产桩跟随已交付目录；常无语已使用 f000 等帧名，不能再假定 neutral/frame-001。
for (const [role, sequence] of Object.entries(runtimeSequences)) {
  for (const name of sequence.idle) pixi.idlePaths.add(`/${role}/${name}.webp`);
}
const timelineFor = (role, action) => role === 'wu' ? wuTimeline(action) : role === 'changwuyu' ? changwuyuTimeline(action) : threeRoleTimeline(role, action);
const changwuyuIdlePath = `/changwuyu/${CHANGWUYU_FRAME_SEQUENCES.idle[0]}.webp`;
const changwuyuActionPath = `/changwuyu/${CHANGWUYU_FRAME_SEQUENCES.atk.find(name => !CHANGWUYU_FRAME_SEQUENCES.idle.includes(name))}.webp`;
const deliveredNames = role => [...new Set(Object.values(runtimeSequences[role]).flat())];
const finishFrames = async role => {
  await vi.waitFor(() => expect(pixi.loaded.filter(url => url.includes(`/frames/${role}/`))).toHaveLength(deliveredNames(role).length));
  await vi.waitFor(() => expect(pixi.inFlight).toBe(0));
};

describe('battle frame lifecycle', () => {
  beforeEach(() => {
    pixi.unloaded.length = 0;
    pixi.loaded.length = 0;
    pixi.unloadGate = null;
    pixi.finishUnload = null;
    pixi.loadGate = null;
    pixi.finishLoad = null;
    pixi.idleEnabled = true;
    pixi.loadDelayMs = 0;
    pixi.inFlight = 0;
    pixi.maxInFlight = 0;
    pixi.rendered = 0;
    pixi.onRender = null;
    pixi.blocked = null;
    pixi.missing.clear();
    document.body.innerHTML = '<div id="overlay"><div id="ovBody"><div class="battle-stage sts"><div id="btSelf"><div class="sts-figure"><img /></div></div></div></div><div id="unitFrames"></div></div>';
    Object.defineProperties(document.getElementById('overlay'), {
      clientWidth: { configurable: true, value: 1920 }, clientHeight: { configurable: true, value: 1080 },
    });
    document.querySelector('#btSelf img').setAttribute('src', '/assets/portraits/battle/changwuyu.webp');
  });
  afterEach(async () => { pixi.finishLoad?.(); pixi.finishUnload?.(); await hide(); setPerformanceSettings({ quality: 'balanced', fps: 60 }); vi.restoreAllMocks(); });

  it('diagnostic static gate keeps neutral art and skips Pixi loads without global reduced motion', async () => {
    await hide();
    const stages = vi.spyOn(Flight, 'recordFrameStage');
    const previousURL = location.href;
    expect(cacheStats().liveApps).toBe(0);
    history.replaceState(null, '', '?perfProbe=1&flightRecord=1&framesDiagnostic=static');
    try {
      expect(await attach(document.getElementById('ovBody'))).toBe(true);
      expect(await attach(document.getElementById('ovBody'))).toBe(true);
      expect(stages.mock.calls.map(call => call[0])).toEqual(['static']);
      expect(pixi.loaded).toEqual([]);
      expect(document.querySelector('#btSelf img').style.visibility).toBe('');
      expect(document.querySelector('#btSelf img').src).toContain('/sprite-v1/neutral.webp');
      expect(cacheStats()).toMatchObject({ phase: 'static', staticDiagnostic: true, liveApps: 0,
        textureCount: 0, activeFrameSessions: 0, pendingAttach: 0 });
    } finally { history.replaceState(null, '', previousURL); }
  });

  it('applies the frame limit to a live character and preserves action timing', async () => {
    const stages = vi.spyOn(Flight, 'recordFrameStage');
    const clock = vi.spyOn(performance, 'now').mockReturnValue(1000);
    await attach(document.getElementById('ovBody')); await finishFrames('changwuyu');
    expect(pixi.lastApp.options.resizeTo).toBeNull();
    expect(stages.mock.calls.map(call => call[0])).toEqual(['renderer-loading', 'app-init', 'app-ready', 'idle-loading', 'idle-ready', 'frame-batch', 'all-ready']);
    setPerformanceSettings({ quality: 'low', fps: 30 });
    expect(pixi.lastApp.ticker.maxFPS).toBe(60);
    expect(pixi.lastApp.ticker.remove).toHaveBeenCalledWith(pixi.lastApp.render, pixi.lastApp);
    expect(pixi.lastApp.renderer.resolution).toBe(Math.min(1, window.devicePixelRatio * uiScale()));
    expect(play('atk')).toBe(true);
    clock.mockReturnValue(1001 + timelineFor('changwuyu', 'atk').dur[0]); pixi.tick();
    expect(document.getElementById('unitFrames').dataset.action).toBe('atk');
    setPerformanceSettings({ fps: 120 });
    expect(pixi.lastApp.ticker.maxFPS).toBe(60);
  });

  it.each(['cold', 'reattach'])('does not resubmit an unchanged frame after synchronous %s paint', async path => {
    vi.spyOn(performance, 'now').mockReturnValue(1000);
    const body = document.getElementById('ovBody');
    vi.spyOn(body.querySelector('.sts-figure'), 'getBoundingClientRect').mockReturnValue({ left: 50, top: 60, width: 100, height: 150 });
    await attach(body); await finishFrames('changwuyu');
    if (path === 'reattach') await attach(body);
    const painted = pixi.rendered;
    expect(painted).toBe(path === 'cold' ? 1 : 2);
    pixi.tick();
    expect(pixi.rendered).toBe(painted);
  });

  it.each(['cold', 'reattach', 'ticker'])('preserves invalidation raised during %s paint', async path => {
    const clock = vi.spyOn(performance, 'now').mockReturnValue(1000);
    const body = document.getElementById('ovBody');
    if (path !== 'cold') { await attach(body); await finishFrames('changwuyu'); }
    pixi.onRender = () => { pixi.onRender = null; setPerformanceSettings({ quality: path === 'ticker' ? 'high' : 'low', fps: 30 }); };
    if (path === 'ticker') { play('atk'); setPerformanceSettings({ quality: 'low', fps: 30 }); clock.mockReturnValue(1000); pixi.tick(); }
    else { await attach(body); await finishFrames('changwuyu'); }
    const painted = pixi.rendered;
    // Still before the next animation frame; the quality change nevertheless needs repaint.
    clock.mockReturnValue(path === 'ticker' ? 1040 : 1000); pixi.tick();
    expect(pixi.rendered).toBe(painted + 1);
  });

  it.each(['cold', 'reattach', 'ticker'])('retains retry work and the original error when %s paint throws', async path => {
    const clock = vi.spyOn(performance, 'now').mockReturnValue(1000);
    const body = document.getElementById('ovBody');
    if (path !== 'cold') { await attach(body); await finishFrames('changwuyu'); }
    const error = new Error('controlled render failure');
    pixi.onRender = () => { pixi.onRender = null; throw error; };
    if (path === 'ticker') { play('atk'); setPerformanceSettings({ quality: 'low', fps: 30 }); clock.mockReturnValue(1000); expect(() => pixi.tick()).toThrow(error); }
    else await expect(attach(body)).rejects.toBe(error);
    const painted = pixi.rendered;
    clock.mockReturnValue(path === 'ticker' ? 1040 : 1000); pixi.tick();
    expect(pixi.rendered).toBe(painted + 1);
    expect(document.getElementById('unitFrames').hidden).toBe(false);
  });

  it('does not revive a frame owner released by a throwing paint hook', async () => {
    vi.spyOn(performance, 'now').mockReturnValue(1000);
    const body = document.getElementById('ovBody');
    await attach(body); await finishFrames('changwuyu');
    const error = new Error('departed renderer');
    let released;
    pixi.onRender = () => { pixi.onRender = null; released = hide(); throw error; };
    await expect(attach(body)).rejects.toBe(error);
    await released;
    const painted = pixi.rendered;
    pixi.tick();
    expect(pixi.rendered).toBe(painted);
    expect(cacheStats().activeFrameSessions).toBe(0);
    expect(document.getElementById('unitFrames').hidden).toBe(true);
  });

  it('continues a live combo action and reads its remaining contact time from the player clock', async () => {
    const clock = vi.spyOn(performance, 'now').mockReturnValue(1000);
    const body = document.getElementById('ovBody');
    const stage = document.querySelector('.battle-stage'); stage._battleToken = 'timing-battle';
    await attach(body); await finishFrames('changwuyu');
    const cue = { attacker: 'player-attack' };
    expect(play('atk')).toBe(true);
    expect(actionImpactRemaining(cue, 'timing-battle')).toBe(125);
    clock.mockReturnValue(1100); pixi.tick();
    const frame = document.getElementById('unitFrames').dataset.frame;
    expect(play('atk', { continueActive: true })).toBe(true);
    expect(document.getElementById('unitFrames').dataset.frame).toBe(frame);
    expect(actionImpactRemaining(cue, 'timing-battle')).toBe(25);
    expect(actionImpactRemaining(cue, 'old-battle')).toBeNull();
    expect(actionImpactRemaining({ attacker: 'player-spell' }, 'timing-battle')).toBeNull();
    hide(); expect(actionImpactRemaining(cue, 'timing-battle')).toBeNull();
  });

  it('stops hidden geometry polling and resumes only one interval for a live figure', async () => {
    const hidden = vi.spyOn(document, 'hidden', 'get').mockReturnValue(false);
    const interval = vi.spyOn(globalThis, 'setInterval');
    const clear = vi.spyOn(globalThis, 'clearInterval');
    await attach(document.getElementById('ovBody')); await finishFrames('changwuyu');
    const pollCalls = () => interval.mock.calls.filter(args => args[1] === 200);
    expect(pollCalls()).toHaveLength(1);
    const pollIndex = interval.mock.calls.findIndex(args => args[1] === 200);
    const first = interval.mock.results[pollIndex].value;
    hidden.mockReturnValue(true); document.dispatchEvent(new Event('visibilitychange'));
    expect(clear).toHaveBeenCalledWith(first);
    document.dispatchEvent(new Event('visibilitychange'));
    expect(pollCalls()).toHaveLength(1);
    hidden.mockReturnValue(false); document.dispatchEvent(new Event('visibilitychange'));
    document.dispatchEvent(new Event('visibilitychange'));
    expect(pollCalls()).toHaveLength(2);
    await hide();
    document.dispatchEvent(new Event('visibilitychange'));
    expect(pollCalls()).toHaveLength(2);
  });

  it('syncs output pixels on resize, DPR-only ticks, visible recovery and app reuse', async () => {
    vi.stubGlobal('innerWidth', 1180);
    vi.stubGlobal('innerHeight', 595);
    vi.stubGlobal('devicePixelRatio', 1);
    const hidden = vi.spyOn(document, 'hidden', 'get').mockReturnValue(false);
    try {
      window.dispatchEvent(new Event('resize'));
      await attach(document.getElementById('ovBody'));
      expect(cacheStats()).toMatchObject({ backingWidth: 1058, backingHeight: 595 });
      const app = pixi.lastApp;
      app.renderer.resize.mockClear();
      pixi.tick();
      expect(app.renderer.resize).not.toHaveBeenCalled();

      vi.stubGlobal('devicePixelRatio', 2); // No resize event: active tick must detect it.
      pixi.tick();
      expect(cacheStats()).toMatchObject({ backingWidth: 2116, backingHeight: 1190 });
      expect(app.renderer.resize).toHaveBeenLastCalledWith(1920, 1080);

      vi.stubGlobal('innerHeight', 540);
      app.renderer.resize.mockClear();
      const beforeResize = pixi.rendered;
      window.dispatchEvent(new Event('resize'));
      expect(cacheStats()).toMatchObject({ backingWidth: 1920, backingHeight: 1080 });
      expect(app.renderer.resize).toHaveBeenCalledTimes(1);
      expect(pixi.rendered).toBe(beforeResize); // Resize does not bypass the draw gate.
      pixi.tick();
      expect(pixi.rendered).toBe(beforeResize + 1); // Cleared backing is repainted.
      expect(app.renderer.resize).toHaveBeenCalledTimes(1);
      window.dispatchEvent(new Event('resize'));
      expect(app.renderer.resize).toHaveBeenCalledTimes(1); // Equal target is a no-op.

      hidden.mockReturnValue(true);
      document.dispatchEvent(new Event('visibilitychange'));
      vi.stubGlobal('devicePixelRatio', 1);
      const beforeVisible = pixi.rendered;
      const start = vi.spyOn(app, 'start');
      hidden.mockReturnValue(false);
      document.dispatchEvent(new Event('visibilitychange'));
      expect(cacheStats()).toMatchObject({ backingWidth: 960, backingHeight: 540 });
      await Promise.resolve();
      expect(start).toHaveBeenCalled();
      expect(pixi.rendered).toBe(beforeVisible);
      pixi.tick();
      expect(pixi.rendered).toBe(beforeVisible + 1);

      await hide();
      vi.stubGlobal('devicePixelRatio', 2); // Reuse the existing app without resize.
      await attach(document.getElementById('ovBody'));
      expect(pixi.lastApp).toBe(app);
      expect(cacheStats()).toMatchObject({ backingWidth: 1920, backingHeight: 1080, liveApps: 1 });

      // Preserve Pixi's resizeTo:window dimensions when the container is absent.
      const overlay = document.getElementById('overlay');
      overlay.id = 'temporarily-detached-overlay';
      try {
        window.dispatchEvent(new Event('resize'));
        expect(app.renderer.resize).toHaveBeenLastCalledWith(1180, 540);
      } finally { overlay.id = 'overlay'; }
    } finally {
      vi.unstubAllGlobals();
      window.dispatchEvent(new Event('resize'));
    }
  });

  it.each([30, 60, 120])('keeps the death completion deadline at %i FPS', async fps => {
    const clock = vi.spyOn(performance, 'now').mockReturnValue(1000);
    await attach(document.getElementById('ovBody')); await finishFrames('changwuyu');
    setPerformanceSettings({ fps });
    const total = timelineFor('changwuyu', 'death').dur.reduce((sum, ms) => sum + ms, 0);
    let done = false; const result = presentDeath({ maxHp: 20 });
    expect(result).toBeInstanceOf(Promise); result.then(() => { done = true; });
    clock.mockReturnValue(1000 + total - 1); pixi.tick(); await Promise.resolve();
    expect(done).toBe(false);
    clock.mockReturnValue(1000 + total); pixi.tick(); await Promise.resolve();
    expect(done).toBe(true);
    expect(pixi.lastApp.ticker.maxFPS).toBe(60);
  });

  it('limits actual render submissions even while geometry updates every 60 Hz tick', async () => {
    const clock = vi.spyOn(performance, 'now').mockReturnValue(1000);
    await attach(document.getElementById('ovBody')); await finishFrames('changwuyu');
    setPerformanceSettings({ fps: 30 });
    let left = 0;
    vi.spyOn(document.querySelector('.sts-figure'), 'getBoundingClientRect').mockImplementation(() => ({ left: left++, top: 0, width: 100, height: 150 }));
    pixi.rendered = 0;
    for (let sample = 0; sample < 60; sample++) { clock.mockReturnValue(1000 + sample * 1000 / 60); pixi.tick(); }
    expect(pixi.rendered).toBe(30);
  });

  it('measures the figure once when a ticker update advances a frame', async () => {
    const clock = vi.spyOn(performance, 'now').mockReturnValue(1000);
    await attach(document.getElementById('ovBody'));
    await finishFrames('changwuyu');
    expect(play('atk')).toBe(true);
    const reads = vi.spyOn(document.querySelector('.sts-figure'), 'getBoundingClientRect');
    reads.mockClear();
    clock.mockReturnValue(1001 + timelineFor('changwuyu','atk').dur[0]);
    pixi.tick();
    expect(reads).toHaveBeenCalledTimes(1);
    expect(document.getElementById('unitFrames').dataset.action).toBe('atk');
  });

  it.each(Object.entries(runtimeSequences).map(([role, sequence]) =>
    [role, [...new Set(Object.values(sequence).flat())].map(name => name.split('/').at(-1))],
  ))('requests only the delivered %s frame URLs, in declared loading order', async (role, names) => {
    hide();
    const img = document.querySelector('#btSelf img');
    img.setAttribute('data-asset-key', `battle-${role}`);
    img.setAttribute('src', '/assets/new-version/portrait.webp');
    await attach(document.getElementById('ovBody'));
    await finishFrames(role);
    expect(pixi.loaded.map(url => new URL(url, 'http://localhost').pathname.split('/').at(-1))).toEqual(names.map(name => `${name}.webp`));
    expect(pixi.loaded.every(url => url.includes(`/frames/${role}/`))).toBe(true);
    expect(pixi.sprites.at(-1).texture).toBe(pixi.idleTexture);
    hide();
  });

  it('keeps characters without delivered frames visible, even with an old supported URL', async () => {
    hide();
    const img = document.querySelector('#btSelf img');
    img.setAttribute('data-asset-key', 'battle-unsupported');
    await attach(document.getElementById('ovBody'));
    expect(img.style.visibility).toBe('');
    expect(pixi.loaded).toEqual([]);
  });

  it.each(Object.keys(runtimeSequences))('holds %s fallen after death and ignores later hurt/attack interruptions', async role => {
    hide();
    const clock = vi.spyOn(performance, 'now').mockReturnValue(1000);
    const img = document.querySelector('#btSelf img');
    img.setAttribute('data-asset-key', `battle-${role}`);
    await attach(document.getElementById('ovBody'));
    await Promise.resolve();
    await finishFrames(role);
    const done = presentDeath();
    expect(done).toBeInstanceOf(Promise);
    expect(document.querySelector('.battle-stage').inert).toBe(true);
    expect(play('hurt')).toBe(false);
    expect(play('atk')).toBe(false);
    clock.mockReturnValue(1000 + timelineFor(role, 'death').dur.reduce((sum, duration) => sum + duration, 0) + 1);
    pixi.tick();
    await done;
    expect(pixi.sprites.at(-1).texture.id).toContain(runtimeSequences[role].death.at(-1));
    const last = pixi.sprites.at(-1).texture;
    clock.mockReturnValue(10000); pixi.tick();
    expect(pixi.sprites.at(-1).texture).toBe(last);
    hide();
    expect(document.querySelector('.battle-stage').inert).toBeFalsy();
    clock.mockRestore();
  });

  it.each(Object.keys(runtimeSequences))('returns %s to the shared initial idle texture after an attack', async role => {
    hide();
    const clock = vi.spyOn(performance, 'now').mockReturnValue(1000);
    document.querySelector('#btSelf img').setAttribute('data-asset-key', `battle-${role}`);
    await attach(document.getElementById('ovBody'));
    await Promise.resolve();
    await finishFrames(role);
    expect(play('atk')).toBe(true);
    clock.mockReturnValue(1000 + timelineFor(role, 'atk').dur.reduce((sum, duration) => sum + duration, 0) + 1); pixi.tick();
    expect(pixi.sprites.at(-1).texture).toBe(pixi.idleTexture);
    hide(); clock.mockRestore();
  });

  it('restores the portrait when a pending attach loses its battle DOM', async () => {
    hide();
    const body = document.getElementById('ovBody');
    const img = body.querySelector('#btSelf img');
    pixi.loadGate = new Promise(resolve => { pixi.finishLoad = resolve; });
    const pending = attach(body);
    await vi.waitFor(() => expect(pixi.inFlight).toBe(1));
    body.replaceWith(document.createElement('div'));
    pixi.finishLoad();
    pixi.loadGate = null;
    await pending;
    expect(img.style.visibility).toBe('');
    hide();
  });

  it('rejects a late resource callback after hide or overlay replacement', () => {
    const body = document.getElementById('ovBody');
    const fig = body.querySelector('.sts-figure');
    // attach is not active in this isolated test until a real battle render marks it wanted;
    // the lifecycle predicate must remain closed, so a stale callback cannot show frames.
    expect(isLiveBattleFigure(body, fig)).toBe(false);
    hide();
    expect(document.getElementById('unitFrames').hidden).toBe(true);
    const replacement = body.cloneNode(true);
    document.getElementById('ovBody').replaceWith(replacement);
    expect(isLiveBattleFigure(body, fig)).toBe(false);
  });

  it('unloads the active frame texture set on hide and allows a later battle to reload it', async () => {
    const body = document.getElementById('ovBody');
    await attach(body);
    expect(cacheStats().roleNames).toContain('changwuyu');

    pixi.unloadGate = new Promise(resolve => { pixi.finishUnload = resolve; });
    hide();
    await vi.waitFor(() => expect(pixi.unloaded).toContainEqual(expect.stringContaining(changwuyuIdlePath)));
    expect(cacheStats()).toMatchObject({ roles: 0, roleNames: [], textureCount: 0, baseTextures: 0, basePixels: 0, activeFrameSessions: 0 });
    expect(document.querySelector('#btSelf img').style.visibility).toBe('');
    expect(document.getElementById('unitFrames').hidden).toBe(true);

    const loadsBeforeReattach = pixi.loaded.length;
    const reattach = attach(body);
    await Promise.resolve();
    expect(pixi.loaded).toHaveLength(loadsBeforeReattach);
    pixi.finishUnload();
    pixi.unloadGate = null;
    await reattach;
    expect(cacheStats().roleNames).toContain('changwuyu');
    hide();
  });

  it('probes only idle when none is usable and clears a sprite even after the cache is empty', async () => {
    const body = document.getElementById('ovBody');
    const sprite = pixi.sprites.at(-1);
    expect(cacheStats()).toMatchObject({ roles: 0, roleNames: [], textureCount: 0, baseTextures: 0, basePixels: 0, activeFrameSessions: 0 });
    sprite.texture = pixi.extraTexture;
    hide();
    expect(sprite.texture).toBe(pixi.emptyTexture);

    pixi.idleEnabled = false;
    expect(await attach(body)).toBe(false);
    expect(cacheStats().roleNames).toContain('changwuyu');
    expect(pixi.loaded).not.toContainEqual(expect.stringContaining(changwuyuActionPath));

    // Ensure hide clears the sprite reference in addition to releasing the failed set.
    sprite.texture = pixi.extraTexture;
    hide();
    expect(sprite.texture).toBe(pixi.emptyTexture);
    expect(cacheStats()).toMatchObject({ roles: 0, roleNames: [], textureCount: 0, baseTextures: 0, basePixels: 0, activeFrameSessions: 0 });
  });

  it('bounds simultaneous frame loads while preserving a usable idle frame', async () => {
    hide();
    pixi.loadDelayMs = 1;
    const body = document.getElementById('ovBody');
    await attach(body);
    await finishFrames('changwuyu');
    expect(pixi.maxInFlight).toBeGreaterThan(1);
    expect(pixi.maxInFlight).toBeLessThanOrEqual(3);
    expect(pixi.sprites.at(-1).texture).toBe(pixi.idleTexture);
    hide();
  });

  it('commits a drawable first idle before background frames finish, and can play a partial action', async () => {
    await hide();
    let finishBackground;
    const background = new Promise(resolve => { finishBackground = resolve; });
    pixi.blocked = url => url.includes(changwuyuIdlePath) ? Promise.resolve() : background;
    const body = document.getElementById('ovBody');
    body.querySelector('.sts-figure').getBoundingClientRect = () => ({ left: 100, top: 100, width: 240, height: 180 });
    try {
      expect(await attach(body)).toBe(true);
      await vi.waitFor(() => expect(pixi.inFlight).toBe(3));
      expect(pixi.loaded.length).toBeLessThan(deliveredNames('changwuyu').length);
      expect(pixi.sprites.at(-1).texture).toBe(pixi.idleTexture);
      expect(pixi.sprites.at(-1).width).toBeGreaterThan(0);
      expect(pixi.sprites.at(-1).height).toBeGreaterThan(0);
      expect(pixi.rendered).toBeGreaterThan(0);
      expect(play('atk')).toBe(true);
    } finally { finishBackground(); pixi.blocked = null; }
    await finishFrames('changwuyu');
    const clock = vi.spyOn(performance, 'now').mockReturnValue(10000);
    pixi.tick();
    expect(play('atk')).toBe(true);
    // 补齐后使用原始动作时间步，第二帧已经是非 idle 的攻击帧。
    const timeline = timelineFor('changwuyu', 'atk');
    clock.mockReturnValue(10000 + timeline.dur[0] + 1); pixi.tick();
    expect(pixi.sprites.at(-1).texture.id).toContain(timeline.list[1]);
  });

  it('uses the next delivered idle when the first is missing instead of rejecting the whole role', async () => {
    await hide();
    pixi.missing.add(changwuyuIdlePath);
    expect(await attach(document.getElementById('ovBody'))).toBe(true);
    expect(pixi.loaded[0]).toContain(changwuyuIdlePath);
    expect(document.getElementById('unitFrames').dataset.frame).toBe(CHANGWUYU_FRAME_SEQUENCES.idle[1]);
    await finishFrames('changwuyu');
    expect(play('atk')).toBe(true);
  });

  it('keeps partial idle and action sequences usable after a missing noncritical frame', async () => {
    await hide();
    pixi.missing.add(`/changwuyu/${CHANGWUYU_FRAME_SEQUENCES.idle[1]}.webp`);
    pixi.missing.add(changwuyuActionPath);
    expect(await attach(document.getElementById('ovBody'))).toBe(true);
    await finishFrames('changwuyu');
    expect(play('atk')).toBe(true);
    expect(document.querySelector('#btSelf img').style.visibility).toBe('hidden');
  });

  it('cancels old background batches and unloads them before a different role takes over', async () => {
    await hide();
    let finishBackground;
    const background = new Promise(resolve => { finishBackground = resolve; });
    pixi.blocked = url => url.includes('/changwuyu/') && !url.includes(changwuyuIdlePath) ? background : Promise.resolve();
    const body = document.getElementById('ovBody');
    try {
      await attach(body);
      await vi.waitFor(() => expect(pixi.inFlight).toBe(3));
      const oldLoads = pixi.loaded.filter(url => url.includes('/changwuyu/'));
      body.querySelector('img').setAttribute('data-asset-key', 'battle-xingyue');
      const replacement = attach(body);
      await Promise.resolve();
      expect(pixi.loaded.some(url => url.includes('/xingyue/'))).toBe(false);
      finishBackground(); pixi.blocked = null;
      expect(await replacement).toBe(true);
      expect(pixi.loaded.filter(url => url.includes('/changwuyu/'))).toEqual(oldLoads);
      expect(pixi.unloaded).toEqual(expect.arrayContaining(oldLoads));
      expect(document.getElementById('unitFrames').dataset.role).toBe('xingyue');
      expect(cacheStats().roleNames).toEqual(['xingyue']);
      await finishFrames('xingyue');
    } finally { finishBackground(); pixi.blocked = null; }
  });

  it('does not reuse a pending attachment when the same image slot changes role', async () => {
    await hide();
    pixi.loadGate = new Promise(resolve => { pixi.finishLoad = resolve; });
    const body = document.getElementById('ovBody');
    const first = attach(body);
    await vi.waitFor(() => expect(pixi.inFlight).toBe(1));
    body.querySelector('img').setAttribute('data-asset-key', 'battle-baita');
    const replacement = attach(body);
    expect(replacement).not.toBe(first);
    pixi.finishLoad(); pixi.loadGate = null;
    expect(await first).toBe(false);
    expect(await replacement).toBe(true);
    expect(document.getElementById('unitFrames').dataset.role).toBe('baita');
    expect(document.querySelector('#btSelf img').style.visibility).toBe('hidden');
    expect(pixi.unloaded).toContainEqual(expect.stringContaining(changwuyuIdlePath));
    await finishFrames('baita');
  });

  it('reports actual single-app/session and completed frame count without starting more loads', async () => {
    await attach(document.getElementById('ovBody')); await finishFrames('changwuyu');
    const count = pixi.loaded.length;
    expect(cacheStats()).toMatchObject({ phase: 'all-ready', rendererBackend: 'webgl', liveApps: 1,
      activeFrameSessions: 1, pendingAttach: 0, staticDiagnostic: false, textureCount: deliveredNames('changwuyu').length });
    cacheStats(); cacheStats();
    expect(pixi.loaded).toHaveLength(count);
    await hide();
    expect(cacheStats()).toMatchObject({ phase: 'released', liveApps: 1, activeFrameSessions: 0, textureCount: 0 });
  });

  it('skips all texture work with reduced motion while leaving the static figure visible', async () => {
    await hide();
    const facade = (await import('../game/src/core/sdt-facade.js')).default;
    const previous = facade.Motion;
    facade.Motion = { reduceMotion: () => true };
    try {
      await attach(document.getElementById('ovBody'));
      expect(pixi.loaded).toEqual([]);
      expect(document.querySelector('#btSelf img').style.visibility).toBe('');
    } finally { facade.Motion = previous; }
  });

  it('restores static art when reduced motion changes while the first texture is pending', async () => {
    const facade = (await import('../game/src/core/sdt-facade.js')).default;
    const previous = facade.Motion;
    let reduced = false;
    facade.Motion = { reduceMotion: () => reduced };
    pixi.loadGate = new Promise(resolve => { pixi.finishLoad = resolve; });
    try {
      const pending = attach(document.getElementById('ovBody'));
      await vi.waitFor(() => expect(pixi.inFlight).toBe(1));
      reduced = true; pixi.finishLoad(); pixi.loadGate = null;
      await pending;
      expect(cacheStats().activeFrameSessions).toBe(0);
      expect(document.querySelector('#btSelf img').style.visibility).toBe('');
      expect(document.getElementById('unitFrames').hidden).toBe(true);
    } finally { facade.Motion = previous; }
  });

  it.each(['tick', 'action', 'poll'])('retires live character frames on reduced motion before the next %s', async action => {
    const facade = (await import('../game/src/core/sdt-facade.js')).default;
    const previous = facade.Motion;
    let reduced = false;
    facade.Motion = { reduceMotion: () => reduced };
    const intervals = vi.spyOn(globalThis, 'setInterval');
    try {
      await attach(document.getElementById('ovBody')); await finishFrames('changwuyu');
      const rendered = pixi.rendered;
      reduced = true;
      if (action === 'tick') pixi.tick();
      else if (action === 'poll') intervals.mock.calls.find(call => call[1] === 200)[0]();
      else expect(play('atk')).toBe(false);
      expect(pixi.rendered).toBe(rendered);
      expect(cacheStats().activeFrameSessions).toBe(0);
      expect(document.querySelector('#btSelf img').style.visibility).toBe('');
      expect(document.getElementById('unitFrames').hidden).toBe(true);
      reduced = false;
      expect(await attach(document.getElementById('ovBody'))).toBe(true);
      expect(cacheStats().activeFrameSessions).toBe(1);
    } finally { facade.Motion = previous; }
  });

  it('waits for pending frame batches to unload before a new attach', async () => {
    hide();
    const body = document.getElementById('ovBody');
    pixi.loadGate = new Promise(resolve => { pixi.finishLoad = resolve; });
    const firstAttach = attach(body);
    await vi.waitFor(() => expect(pixi.inFlight).toBe(1));
    hide();
    const secondAttach = attach(body);
    const loadsWhileBlocked = pixi.loaded.length;
    await Promise.resolve();
    expect(pixi.loaded).toHaveLength(loadsWhileBlocked);
    pixi.finishLoad();
    pixi.loadGate = null;
    await firstAttach;
    await secondAttach;
    expect(pixi.unloaded).toContainEqual(expect.stringContaining(changwuyuIdlePath));
    expect(pixi.sprites.at(-1).texture).toBe(pixi.idleTexture);
    hide();
  });

  // Loading keeps the aligned static portrait present; successful GPU paint replaces it atomically.
  it('keeps the static portrait until first paint completes on initial attach', async () => {
    hide();
    await new Promise(resolve => setTimeout(resolve, 0));
    const body = document.getElementById('ovBody');
    const img = document.querySelector('#btSelf img');
    const attachPromise = attach(body);
    // Pending attachment must keep the static fallback; successful paint owns the handoff.
    expect(img.style.visibility).toBe('');
    await attachPromise;
    // 接管终态：img 保持隐藏（不与 sprite 双层叠影）、sprite 已挂待机帧——
    // 藏了静态图就必须有序列帧顶上，两头都断防止「闪」与「人物消失」两个方向的回归。
    // （不断 #unitFrames.hidden：beforeEach 重建 body 后模块持有的 host 是旧节点，断言会失真）
    expect(img.style.visibility).toBe('hidden');
    expect(pixi.sprites.at(-1).texture).toBe(pixi.idleTexture);
    expect(pixi.rendered).toBeGreaterThan(0);
    hide();
  });

  it('shares one pending attachment across repeated renders of the same live figure', async () => {
    hide();
    const body = document.getElementById('ovBody');
    pixi.loadGate = new Promise(resolve => { pixi.finishLoad = resolve; });
    const first = attach(body), repeat = attach(body);
    expect(repeat).toBe(first);
    await vi.waitFor(() => expect(pixi.inFlight).toBe(1));
    pixi.finishLoad(); pixi.loadGate = null;
    await first;
    expect(pixi.rendered).toBeGreaterThan(0);
    expect(pixi.sprites.at(-1).texture).toBe(pixi.idleTexture);
    hide();
  });

  it('restores the static portrait when no playable frame set exists (fallback, no permanent blank)', async () => {
    hide();
    await new Promise(resolve => setTimeout(resolve, 0));
    pixi.idleEnabled = false;   // 探测不到 idle 帧 → loadSet 返回 null
    const body = document.getElementById('ovBody');
    const img = document.querySelector('#btSelf img');
    await attach(body);
    // 失败路径原路恢复：同步段藏过 img，装载失败必须恢复静态立绘（不闪也不消失）；
    // sprite 不得残留上一场的纹理（loadSet 失败会清空候选帧，hide 兜底置 EMPTY）
    expect(img.style.visibility).toBe('');
    expect(pixi.sprites.at(-1).texture).toBe(pixi.emptyTexture);
    pixi.idleEnabled = true;
    hide();
  });
});
