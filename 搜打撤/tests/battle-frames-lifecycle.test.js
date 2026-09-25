import { describe, expect, it, beforeEach, vi } from 'vitest';

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
      this.ticker = { maxFPS: 0, stop() {}, start() {}, add() {} };
      this.renderer = { render() {} };
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
  return { unloaded, loaded, sprites, idleTexture, extraTexture, emptyTexture, Application, Sprite, unloadGate: null, finishUnload: null, idleEnabled: true };
});

vi.mock('pixi.js', () => ({
  Application: pixi.Application,
  Sprite: pixi.Sprite,
  Texture: { EMPTY: pixi.emptyTexture },
  Assets: {
    load: async url => {
      pixi.loaded.push(url);
      if (url.includes('/idle.webp') && pixi.idleEnabled) return pixi.idleTexture;
      if (url.includes('/atk-wind.webp')) return pixi.extraTexture;
      throw new Error('missing test frame');
    },
    unload: async url => {
      pixi.unloaded.push(url);
      if (pixi.unloadGate) await pixi.unloadGate;
    },
  },
}));

import { attach, cacheStats, isLiveBattleFigure, hide } from '../game/src/battle/battle.frames.js';

describe('battle frame lifecycle', () => {
  beforeEach(() => {
    pixi.unloaded.length = 0;
    pixi.loaded.length = 0;
    pixi.unloadGate = null;
    pixi.finishUnload = null;
    pixi.idleEnabled = true;
    document.body.innerHTML = '<div id="overlay"><div id="ovBody"><div class="battle-stage sts"><div id="btSelf"><div class="sts-figure"><img /></div></div></div></div><div id="unitFrames"></div></div>';
    document.querySelector('#btSelf img').setAttribute('src', '/assets/portraits/battle/changwuyu.webp');
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
    await vi.waitFor(() => expect(pixi.unloaded).toContainEqual(expect.stringContaining('/changwuyu/idle.webp')));
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

  it('unloads partial loads when idle is missing and clears a sprite even after the cache is empty', async () => {
    const body = document.getElementById('ovBody');
    const sprite = pixi.sprites.at(-1);
    expect(cacheStats()).toEqual({ roles: 0, roleNames: [] });
    sprite.texture = pixi.extraTexture;
    hide();
    expect(sprite.texture).toBe(pixi.emptyTexture);

    pixi.idleEnabled = false;
    await attach(body);
    expect(cacheStats().roleNames).toContain('changwuyu');
    expect(pixi.unloaded).toContainEqual(expect.stringContaining('/changwuyu/atk-wind.webp'));

    // Ensure hide clears the sprite reference in addition to releasing the failed set.
    sprite.texture = pixi.extraTexture;
    hide();
    expect(sprite.texture).toBe(pixi.emptyTexture);
    expect(cacheStats()).toEqual({ roles: 0, roleNames: [] });
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
