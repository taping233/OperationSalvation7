import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const fixture = vi.hoisted(() => ({ now: 0, game: { state: 'idle' } }));
vi.mock('../game/src/run/game.session.js', () => ({
  game: fixture.game, getActiveSlot: () => 1, startNewGame: vi.fn(),
}));
vi.mock('../game/src/run/game.run.flow.js', () => ({ moveTo: vi.fn(), reenterCell: vi.fn() }));
vi.mock('../game/src/agent/agent.state.js', () => ({
  observe: () => ({ phase: 'idle', actions: [] }), settleSignature: () => 'stable', bustSigCache: vi.fn(), markUiFailure: vi.fn(),
}));
vi.mock('../game/src/agent/agent.surface.js', () => ({
  findUiElement: vi.fn(), collectActionKeys: () => [], overlayVisible: () => false,
}));
vi.mock('../game/src/agent/agent.recorder.js', () => ({
  setDriver: vi.fn(), getDriver: () => 'human', battleTick: vi.fn(), battleActionTick: vi.fn(), battleEnd: vi.fn(), noteStopReason: vi.fn(),
}));
vi.mock('../game/src/core/turbo.js', () => ({ isTurbo: () => true }));

const options = { quietMs: 1, timeoutMs: 100, allowEmpty: true };
let channels;
let starts;
let posts;
function installMessageChannel() {
  vi.stubGlobal('MessageChannel', class {
    constructor() {
      channels += 1;
      this.port1 = { onmessage: null, start: () => { starts += 1; } };
      this.port2 = { postMessage: () => {
        posts += 1;
        queueMicrotask(() => this.port1.onmessage?.({ data: null }));
      } };
    }
  });
}

beforeEach(() => {
  vi.resetModules();
  channels = starts = posts = 0;
  fixture.now = 0;
  vi.spyOn(performance, 'now').mockImplementation(() => fixture.now++);
  vi.stubGlobal('setImmediate', undefined);
  installMessageChannel();
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('Agent turbo scheduling lazy MessageChannel', () => {
  it('creates no ports at import and one channel on the first browser wait', async () => {
    const { waitSettle } = await import('../game/src/agent/agent.runner.js');
    expect(channels).toBe(0);
    expect(starts).toBe(0);
    expect((await waitSettle(options)).ok).toBe(true);
    expect(channels).toBe(1);
    expect(starts).toBe(1);
    expect(posts).toBe(1);
  });

  it('reuses the same FIFO pump for concurrent and later waits', async () => {
    const { waitSettle } = await import('../game/src/agent/agent.runner.js');
    const order = [];
    await Promise.all([
      waitSettle(options).then(() => order.push('first')),
      waitSettle(options).then(() => order.push('second')),
    ]);
    await waitSettle(options).then(() => order.push('third'));
    expect(order).toEqual(['first', 'second', 'third']);
    expect(channels).toBe(1);
    expect(starts).toBe(1);
    expect(posts).toBe(3);
  });

  it('keeps Node setImmediate ahead of MessageChannel without allocating unused ports', async () => {
    const immediate = vi.fn(resolve => queueMicrotask(resolve));
    vi.stubGlobal('setImmediate', immediate);
    const { waitSettle } = await import('../game/src/agent/agent.runner.js');
    await waitSettle(options);
    expect(immediate).toHaveBeenCalledTimes(1);
    expect(channels).toBe(0);
    expect(posts).toBe(0);
  });

  it('retains the zero-delay timer fallback when MessageChannel is unavailable', async () => {
    vi.stubGlobal('MessageChannel', undefined);
    const timer = vi.spyOn(globalThis, 'setTimeout');
    const { waitSettle } = await import('../game/src/agent/agent.runner.js');
    expect((await waitSettle(options)).ok).toBe(true);
    expect(timer.mock.calls.some(([, delay]) => delay === 0)).toBe(true);
    expect(channels).toBe(0);
  });
});
