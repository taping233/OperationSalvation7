// @vitest-environment node
import { configureGameRuntime, game, canvas, ctx } from '../game/src/run/game.session.kernel.js';
import { createGameCanvas } from '../game/src/run/game.session.browser.js';
import { it, expect, vi } from 'vitest';
import { execFileSync } from 'node:child_process';

it('kernel 可在 Node 无 window/document 下加载并接收 browser/log 端口', () => {
  expect(typeof globalThis.window).toBe('undefined');
  expect(typeof globalThis.document).toBe('undefined');
  expect(game.hp).toBe(30);
  expect(canvas).toBeNull();
  expect(ctx).toBeNull();

  const nextContext = { id: 'injected-game-context' };
  const nextCanvas = { id: 'injected-game-canvas', getContext: vi.fn(() => nextContext) };
  const getElementById = vi.fn(() => nextCanvas);
  const ports = createGameCanvas({ getElementById });
  expect(getElementById).toHaveBeenCalledWith('game');
  expect(nextCanvas.getContext).toHaveBeenCalledWith('2d', { alpha: false });
  expect(ports).toEqual({ canvas: nextCanvas, ctx: nextContext });

  const logs = [];
  configureGameRuntime({ ...ports, log: (...args) => logs.push(args) });
  game.log('session message', 'warn');

  expect(canvas).toBe(nextCanvas);
  expect(ctx).toBe(nextContext);
  expect(logs).toEqual([['session message', 'warn']]);
});

it('原生 Node 先加载内核再加载 FX 入口时保持业务依赖与单例引用', () => {
  const kernelUrl = new URL('../game/src/run/game.session.kernel.js', import.meta.url).href;
  const mapUrl = new URL('../game/src/core/mapData.js', import.meta.url).href;
  const fxUrl = new URL('../game/src/core/renderer.fx.js', import.meta.url).href;
  const facadeUrl = new URL('../game/src/core/sdt-facade.js', import.meta.url).href;
  const source = `
    import assert from 'node:assert/strict';
    assert.equal(typeof window, 'undefined');
    assert.equal(typeof document, 'undefined');
    const kernel = await import(${JSON.stringify(kernelUrl)});
    const state = kernel.game;
    const map = kernel.MAP;
    const fx = kernel.FX;
    assert.ok(fx);
    const { MAP } = await import(${JSON.stringify(mapUrl)});
    const { FX } = await import(${JSON.stringify(fxUrl)});
    const { default: SDT } = await import(${JSON.stringify(facadeUrl)});
    assert.equal(map, MAP);
    assert.equal(fx, FX);
    assert.equal(SDT.MAP, MAP);
    assert.equal(SDT.FX, FX);
    assert.equal(state.map, MAP);
    assert.equal(SDT.game, state);
    FX.timeScale = 0.12;
    assert.equal(kernel.FX.timeScale, 0.12);
    const logs = [];
    kernel.configureGameRuntime({ log: (...args) => logs.push(args) });
    state.log('wired', 'info');
    assert.deepEqual(logs, [['wired', 'info']]);
    assert.equal(kernel.game, state);
    assert.equal(kernel.game.map, map);
    assert.equal(kernel.game.getSnapshot().map, map);
    assert.equal(kernel.game.hp, MAP.rules.playerMaxHp);
    console.log('native kernel dependency identity passed');
  `;
  const output = execFileSync(process.execPath, ['--input-type=module', '--eval', source], { encoding: 'utf8' });
  expect(output).toContain('native kernel dependency identity passed');
});
