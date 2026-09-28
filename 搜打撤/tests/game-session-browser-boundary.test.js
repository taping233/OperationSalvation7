// @vitest-environment node
import { configureGameRuntime, game, canvas, ctx } from '../game/src/run/game.session.kernel.js';
import { createGameCanvas } from '../game/src/run/game.session.browser.js';
import { it, expect, vi } from 'vitest';

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
