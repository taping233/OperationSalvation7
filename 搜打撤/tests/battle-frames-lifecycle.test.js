import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';

const pixi = vi.hoisted(() => {
  const unloaded = [];
  const loaded = [];
  const sprites = [];
  const idleTexture = { id: 'idle-texture' };
  const extraTexture = { id: 'extra-texture' };
  const emptyTexture = { id: 'empty' };
  class Application {
    constructor() {
      this.view = document.createElement('canvas');
      this.stage = { addChild() {} };
      this.ticker = { maxFPS: 0, stop() {}, start() {}, add(fn) { pixi.tick = fn; } };
      this.renderer = { type: 1, render() { pixi.rendered += 1; } };
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
    idleEnabled: true, idlePaths: new Set(), rendered: 0, loadDelayMs: 0, inFlight: 0, maxInFlight: 0, tick: null,
    blocked: null, missing: new Set() };
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

import { attach, cacheStats, isLiveBattleFigure, hide, play, presentDeath } from '../game/src/battle/view/battle.frames.js';
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
    pixi.blocked = null;
    pixi.missing.clear();
    document.body.innerHTML = '<div id="overlay"><div id="ovBody"><div class="battle-stage sts"><div id="btSelf"><div class="sts-figure"><img /></div></div></div></div><div id="unitFrames"></div></div>';
    document.querySelector('#btSelf img').setAttribute('src', '/assets/portraits/battle/changwuyu.webp');
  });
  afterEach(async () => { pixi.finishLoad?.(); pixi.finishUnload?.(); await hide(); vi.restoreAllMocks(); });

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
    expect(cacheStats()).toEqual({ roles: 0, roleNames: [] });
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
    expect(cacheStats()).toEqual({ roles: 0, roleNames: [] });
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
    expect(cacheStats()).toEqual({ roles: 0, roleNames: [] });
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

  // —— 首进场不闪（a59e2ff 回归钉，老板 09-20 实机「首次进场闪一下」）——
  // 机理：attach 同步段（首个 await 之前）确认角色在 HAS_FRAMES 白名单后立即
  // visibility='hidden' 藏静态立绘，序列帧纹理异步装载就绪后由 Pixi sprite 接管。
  // 若藏 img 的时机被挪到任何 await 之后，装载窗口内静态 img 会露一帧再跳切序列帧=闪。
  it('hides the static portrait synchronously on first attach, before async texture loading', async () => {
    hide();
    await new Promise(resolve => setTimeout(resolve, 0));
    const body = document.getElementById('ovBody');
    const img = document.querySelector('#btSelf img');
    const attachPromise = attach(body);
    // 同步断言：attach() 返回 promise 的时刻（未 await）img 必须已藏——
    // 这是「装载期间不露静态立绘」的观测点，任何把隐藏挪后到异步段的回归在此变红。
    expect(img.style.visibility).toBe('hidden');
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
