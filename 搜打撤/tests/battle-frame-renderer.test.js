import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadFrameRenderer } from '../game/src/battle/view/battle.frame-renderer.js';

let pixi, legacy, loadLegacy;
beforeEach(() => {
  vi.resetModules();
  pixi = { Application: class WebGLApplication {}, utils: { isWebGLSupported: vi.fn(() => true) } };
  legacy = { ...pixi, CanvasRenderer: class CanvasRenderer {} };
  loadLegacy = vi.fn(() => legacy);
  vi.doMock('pixi.js', () => pixi);
  vi.doMock('pixi.js-legacy', loadLegacy);
});
afterEach(() => {
  vi.doUnmock('pixi.js');
  vi.doUnmock('pixi.js-legacy');
  vi.resetModules();
});

describe('battle frame renderer selection', () => {
  it('keeps the WebGL module without loading Canvas when the installed support check succeeds', async () => {
    const selected = await loadFrameRenderer();
    expect(selected.Application).toBe(pixi.Application);
    expect('CanvasRenderer' in selected).toBe(false);
    expect(pixi.utils.isWebGLSupported).toHaveBeenCalledOnce();
    expect(loadLegacy).not.toHaveBeenCalled();
  });

  it('loads the official Canvas module when the installed WebGL support check rejects', async () => {
    pixi.utils.isWebGLSupported.mockReturnValue(false);
    const selected = await loadFrameRenderer();
    expect(selected.CanvasRenderer).toBe(legacy.CanvasRenderer);
    expect(selected.Application).toBe(pixi.Application);
    expect(loadLegacy).toHaveBeenCalledOnce();
  });

  it('waits for the Canvas module before resolving the selected API', async () => {
    pixi.utils.isWebGLSupported.mockReturnValue(false);
    let release;
    vi.doMock('pixi.js-legacy', () => new Promise(resolve => { release = () => resolve(legacy); }));
    const settled = vi.fn();
    const selected = loadFrameRenderer().then(settled);
    await vi.waitFor(() => expect(release).toBeTypeOf('function'));
    expect(settled).not.toHaveBeenCalled();
    release();
    await selected;
    expect(settled.mock.calls[0][0].CanvasRenderer).toBe(legacy.CanvasRenderer);
  });

  it('propagates failed Canvas imports and does not memoize a rejected selection Promise', async () => {
    pixi.utils.isWebGLSupported.mockReturnValue(false);
    const error = new Error('Canvas module fetch failed (controlled)');
    vi.doMock('pixi.js-legacy', () => { throw error; });
    await expect(loadFrameRenderer()).rejects.toThrow();
    vi.doMock('pixi.js-legacy', loadLegacy);
    expect((await loadFrameRenderer()).CanvasRenderer).toBe(legacy.CanvasRenderer);
  });

  it('does not hide unexpected capability-check errors by importing a different renderer', async () => {
    const error = new Error('Unexpected adapter failure (controlled)');
    pixi.utils.isWebGLSupported.mockImplementation(() => { throw error; });
    await expect(loadFrameRenderer()).rejects.toBe(error);
    expect(loadLegacy).not.toHaveBeenCalled();
  });
});

it('creates and renders with the real official Canvas backend when WebGL contexts are unavailable', async () => {
  // 实际包注册/共享 core 集成；2D context 是受控桩，不替代浏览器像素验收。
  vi.doUnmock('pixi.js');
  vi.doUnmock('pixi.js-legacy');
  const contexts = [];
  const drawing = {
    imageSmoothingEnabled: true,
    getImageData: () => ({ data: new Uint8ClampedArray(4) }),
    fillRect: vi.fn(), clearRect: vi.fn(), setTransform: vi.fn(), drawImage: vi.fn(),
    save: vi.fn(), restore: vi.fn(), beginPath: vi.fn(), rect: vi.fn(), clip: vi.fn(),
  };
  const getContext = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function (type) {
    contexts.push(type);
    return type === '2d' ? drawing : null;
  });
  vi.stubGlobal('WebGLRenderingContext', class {});
  let app, texture;
  try {
    const selected = await loadFrameRenderer();
    const ordinary = await import('pixi.js');
    expect(selected.Application).toBe(ordinary.Application);
    expect(selected.Sprite).toBe(ordinary.Sprite);
    expect(selected.Texture).toBe(ordinary.Texture);
    app = new selected.Application({ width: 120, height: 80, resolution: 2, autoDensity: true,
      backgroundAlpha: 0, antialias: false, autoStart: false, powerPreference: 'low-power' });
    expect(app.renderer.type).toBe(selected.RENDERER_TYPE.CANVAS);
    expect(app.view.width).toBe(240);
    expect(app.view.height).toBe(160);
    expect(app.view.style.width).toBe('120px');
    const source = document.createElement('canvas');
    source.width = source.height = 16;
    texture = selected.Texture.from(source);
    const sprite = new selected.Sprite(texture);
    sprite.anchor.set(0.5, 1);
    sprite.width = 32; sprite.height = 48; sprite.x = 60; sprite.y = 70;
    app.stage.addChild(sprite);
    app.renderer.render(app.stage);
    expect(drawing.drawImage).toHaveBeenCalled();
    app.renderer.resize(160, 100);
    expect(app.view.width).toBe(320);
    expect(app.view.height).toBe(200);
    expect(contexts).toContain('webgl');
    expect(contexts).toContain('experimental-webgl');
    expect(contexts).toContain('2d');
  } finally {
    app?.destroy(true, { children: true });
    texture?.destroy(true);
    getContext.mockRestore();
    vi.unstubAllGlobals();
  }
});
