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
});
