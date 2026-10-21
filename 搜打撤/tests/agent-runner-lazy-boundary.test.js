import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { parse } from 'acorn';

const fixture = vi.hoisted(() => ({ game: {}, slot: 1, driver: 'human', stops: [], turbo: false }));
vi.mock('../game/src/run/game.session.js', () => ({
  game: fixture.game, getActiveSlot: () => fixture.slot, startNewGame: vi.fn(),
}));
vi.mock('../game/src/run/game.run.flow.js', () => ({ moveTo: () => false, reenterCell: () => false }));
vi.mock('../game/src/agent/agent.state.js', () => ({
  observe: () => ({ phase: 'idle', actions: [] }), markUiFailure: vi.fn(),
}));
vi.mock('../game/src/agent/agent.recorder.js', () => ({
  getDriver: () => fixture.driver, setDriver: value => { fixture.driver = value; },
  noteStopReason: value => fixture.stops.push(value),
}));
vi.mock('../game/src/core/turbo.js', () => ({ isTurbo: () => fixture.turbo }));

const runtimePath = '../game/src/agent/agent.runner.runtime.js';
const facade = () => import('../game/src/agent/agent.runner.js');
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((accept, fail) => { resolve = accept; reject = fail; });
  return { promise, resolve, reject };
};
const trace = code => Object.assign([], { stopReason: code });
beforeEach(() => {
  vi.resetModules();
  vi.doUnmock(runtimePath);
  fixture.slot = 1;
  fixture.driver = 'human';
  fixture.turbo = false;
  fixture.stops = [];
  Object.assign(fixture.game, { discoveredPairs: new Set(), nestRunes: [], runActive: true, nestActive: false });
  document.body.innerHTML = '<div id="ovBody"></div>';
});
afterEach(() => { vi.doUnmock(runtimePath); vi.restoreAllMocks(); });

describe('Agent asynchronous execution boundary', () => {
  it('keeps synchronous contracts in the entry graph and optional execution outside it', () => {
    const seen = new Set();
    const pending = [path.resolve('game/src/main.js')];
    while (pending.length) {
      const file = pending.pop();
      if (seen.has(file) || !file.endsWith('.js')) continue;
      seen.add(file);
      const ast = parse(readFileSync(file, 'utf8'), { sourceType: 'module', ecmaVersion: 'latest' });
      for (const node of ast.body) {
        if (!['ImportDeclaration', 'ExportNamedDeclaration', 'ExportAllDeclaration'].includes(node.type)) continue;
        if (node.source?.value?.startsWith('.')) pending.push(path.resolve(path.dirname(file), node.source.value));
      }
    }
    for (const name of ['agent', 'agent.action-router', 'agent.state', 'agent.policy', 'agent.recorder', 'agent.data']) {
      expect(seen.has(path.resolve(`game/src/agent/${name}.js`)), name).toBe(true);
    }
    for (const name of ['agent.runner.runtime', 'agent.replay.runtime', 'agent.replay-state', 'agent.llm.runtime']) {
      expect(seen.has(path.resolve(`game/src/agent/${name}.js`)), name).toBe(false);
    }
  });

  it('imports no execution chunk for synchronous act and stopRun', async () => {
    const load = vi.fn(() => ({ autoRun: vi.fn() }));
    vi.doMock(runtimePath, load);
    const runner = await facade();
    const result = runner.act({ type: 'sys', name: 'noop' });
    expect(result).toEqual({ ok: true, id: 'sys:noop' });
    expect(JSON.parse(JSON.stringify(result))).toEqual(result);
    expect(runner.stopRun()).toBeUndefined();
    expect(load).not.toHaveBeenCalled();
  });

  it('reserves a single run before loading and honours Stop without executing a late first step', async () => {
    const loading = deferred();
    const execute = vi.fn(async () => trace('max-steps'));
    const load = vi.fn(async () => { await loading.promise; return { autoRun: execute }; });
    vi.doMock(runtimePath, load);
    const runner = await facade();
    const pending = runner.autoRun({ decide: () => null, driver: 'greedy' });
    expect(pending).toBeInstanceOf(Promise);
    expect(fixture.driver).toBe('greedy');
    expect((await runner.autoRun({ decide: () => null })).stopReason).toBe('already-running');
    runner.stopRun();
    loading.resolve();
    expect((await pending).stopReason).toBe('cancelled');
    expect(execute).not.toHaveBeenCalled();
    expect(fixture.driver).toBe('human');
    expect(fixture.stops.at(-1)).toMatchObject({ code: 'cancelled', steps: 0 });
    await runner.autoRun({ decide: () => null, driver: 'random' });
    expect(execute).toHaveBeenCalledOnce();
    expect(execute.mock.calls[0][1].signal.aborted).toBe(false);
    expect(load).toHaveBeenCalledOnce();
    expect(fixture.driver).toBe('human');
  });

  it('Stop promptly releases an unresolved import wait and a later load cannot execute the abandoned run', async () => {
    const loading = deferred();
    const execute = vi.fn(async () => trace('decide-null'));
    vi.doMock(runtimePath, async () => { await loading.promise; return { autoRun: execute }; });
    const runner = await facade();
    const pending = runner.autoRun({ decide: () => null, driver: 'greedy' });
    runner.stopRun();
    expect((await pending).stopReason).toBe('cancelled');
    expect(fixture.driver).toBe('human');
    const next = runner.autoRun({ decide: () => null, driver: 'random' });
    expect(fixture.driver).toBe('random');
    loading.resolve();
    expect((await next).stopReason).toBe('decide-null');
    expect(execute).toHaveBeenCalledOnce();
    expect(execute.mock.calls[0][0].driver).toBe('random');
    expect(fixture.driver).toBe('human');
  });

  it('the run deadline releases an unresolved import wait and clears its timer and abort listener', async () => {
    const loading = deferred();
    const execute = vi.fn(async () => trace('decide-null'));
    vi.doMock(runtimePath, async () => { await loading.promise; return { autoRun: execute }; });
    const runner = await facade();
    const remove = vi.spyOn(AbortSignal.prototype, 'removeEventListener');
    const clear = vi.spyOn(globalThis, 'clearTimeout');
    const pending = runner.autoRun({ decide: () => null, driver: 'greedy', runTimeoutMs: 10 });
    expect((await pending).stopReason).toBe('run-timeout');
    expect(fixture.driver).toBe('human');
    expect(execute).not.toHaveBeenCalled();
    expect(remove).toHaveBeenCalledWith('abort', expect.any(Function));
    expect(clear).toHaveBeenCalled();
    const next = runner.autoRun({ decide: () => null });
    loading.resolve();
    expect((await next).stopReason).toBe('decide-null');
    expect(execute).toHaveBeenCalledOnce();
  });

  it('does not execute a cold run after slot or run identity changes', async () => {
    const loading = deferred();
    const execute = vi.fn();
    vi.doMock(runtimePath, async () => { await loading.promise; return { autoRun: execute }; });
    const runner = await facade();
    const pending = runner.autoRun({ decide: () => null });
    fixture.slot = 2;
    loading.resolve();
    expect((await pending).stopReason).toBe('context-changed');
    expect(execute).not.toHaveBeenCalled();
    expect(fixture.driver).toBe('human');
  });

  it('reports a retryable load failure and always restores run ownership and driver', async () => {
    vi.doMock(runtimePath, () => { throw new Error('missing chunk'); });
    const runner = await facade();
    await expect(runner.autoRun({ decide: () => null, driver: 'greedy' }))
      .rejects.toMatchObject({ code: 'AGENT_RUNNER_LOAD_FAILED' });
    expect(fixture.driver).toBe('human');
    expect(fixture.stops.at(-1)).toMatchObject({ code: 'runner-load-failed', steps: 0 });
    const execute = vi.fn(async () => trace('decide-null'));
    vi.doMock(runtimePath, () => ({ autoRun: execute }));
    expect((await runner.autoRun({ decide: () => null })).stopReason).toBe('decide-null');
    expect(execute).toHaveBeenCalledOnce();
  });

  it('deduplicates cold waits without changing their Promise contract', async () => {
    const execute = vi.fn(async options => ({ ok: true, options }));
    const load = vi.fn(() => ({ waitSettle: execute }));
    vi.doMock(runtimePath, load);
    const runner = await facade();
    const first = runner.waitSettle({ quietMs: 1 });
    const second = runner.waitSettle({ quietMs: 2 });
    expect(first).toBeInstanceOf(Promise);
    expect(await first).toMatchObject({ ok: true, options: { quietMs: 1, timeoutMs: expect.any(Number) } });
    expect(await second).toMatchObject({ ok: true, options: { quietMs: 2, timeoutMs: expect.any(Number) } });
    expect(load).toHaveBeenCalledOnce();
  });

  it('settle times out an unresolved import with the original receipt and never starts a late settle', async () => {
    const loading = deferred();
    const execute = vi.fn(async () => ({ ok: true, stalled: false }));
    vi.doMock(runtimePath, async () => { await loading.promise; return { waitSettle: execute }; });
    const runner = await facade();
    const pending = runner.waitSettle({ timeoutMs: 10 });
    expect(await pending).toEqual({ ok: false, stalled: true, obs: { phase: 'idle', actions: [] } });
    expect(execute).not.toHaveBeenCalled();
    loading.resolve();
    await vi.dynamicImportSettled();
    expect(execute).not.toHaveBeenCalled();
    // The abandoned caller cannot consume the next caller's options or settle budget.
    const options = { timeoutMs: 50, quietMs: 3 };
    expect(await runner.waitSettle(options)).toEqual({ ok: true, stalled: false });
    expect(execute).toHaveBeenCalledExactlyOnceWith(options);
    expect(execute.mock.calls[0][0]).toBe(options);
  });

  it.each([[false, 20000], [true, 8000]])('retains the finite default settle budget (turbo=%s)', async (turbo, timeout) => {
    fixture.turbo = turbo;
    let now = 100;
    vi.spyOn(performance, 'now').mockImplementation(() => now);
    const loading = deferred();
    const execute = vi.fn();
    vi.doMock(runtimePath, async () => { await loading.promise; return { waitSettle: execute }; });
    const runner = await facade();
    const pending = runner.waitSettle();
    now += timeout + 1;
    loading.resolve();
    expect(await pending).toMatchObject({ ok: false, stalled: true });
    expect(execute).not.toHaveBeenCalled();
  });

  it('deducts cold loading time from settle timeout without mutating caller options', async () => {
    let now = 100;
    vi.spyOn(performance, 'now').mockImplementation(() => now);
    const loading = deferred();
    const execute = vi.fn(async () => ({ ok: true, stalled: false }));
    vi.doMock(runtimePath, async () => { await loading.promise; return { waitSettle: execute }; });
    const runner = await facade();
    const options = { timeoutMs: 100, quietMs: 3, pollMs: 2, allowEmpty: true };
    const pending = runner.waitSettle(options);
    now = 160;
    loading.resolve();
    expect(await pending).toEqual({ ok: true, stalled: false });
    expect(execute).toHaveBeenCalledExactlyOnceWith({ ...options, timeoutMs: 40 });
    expect(options.timeoutMs).toBe(100);
  });

  it('does not start settle when the deadline has passed as the import resolves', async () => {
    let now = 100;
    vi.spyOn(performance, 'now').mockImplementation(() => now);
    const loading = deferred();
    const execute = vi.fn();
    vi.doMock(runtimePath, async () => { await loading.promise; return { waitSettle: execute }; });
    const runner = await facade();
    const pending = runner.waitSettle({ timeoutMs: 100 });
    now = 201;
    loading.resolve();
    expect(await pending).toMatchObject({ ok: false, stalled: true });
    expect(execute).not.toHaveBeenCalled();
  });

  it('bounds the standalone step cold wait and never runs a late decision after timeout', async () => {
    const loading = deferred();
    const execute = vi.fn(async () => ({ done: true, res: null }));
    vi.doMock(runtimePath, async () => { await loading.promise; return { step: execute }; });
    const runner = await facade();
    const decide = vi.fn(() => ({ type: 'sys', name: 'startGame' }));
    const pending = runner.step(decide, { timeoutMs: 10, preSettled: true });
    expect(await pending).toMatchObject({ action: null, done: true, settleStalled: true,
      res: { ok: false, code: 'AGENT_RUNNER_LOAD_TIMEOUT' }, stopReason: 'runner-load-timeout' });
    expect(decide).not.toHaveBeenCalled();
    expect(execute).not.toHaveBeenCalled();
    loading.resolve();
    await vi.dynamicImportSettled();
    expect(execute).not.toHaveBeenCalled();
    const options = { timeoutMs: 50, preSettled: true };
    await runner.step(decide, options);
    expect(execute).toHaveBeenCalledExactlyOnceWith(decide, options);
    expect(execute.mock.calls[0][1]).toBe(options);
  });

  it('guards the cold standalone step against context changes', async () => {
    const loading = deferred();
    const execute = vi.fn();
    vi.doMock(runtimePath, async () => { await loading.promise; return { step: execute }; });
    const runner = await facade();
    const pending = runner.step(() => ({ type: 'sys', name: 'startGame' }));
    fixture.game.discoveredPairs = new Set();
    loading.resolve();
    expect(await pending).toMatchObject({ res: { ok: false, code: 'CONTEXT_CHANGED' }, stopReason: 'context-changed' });
    expect(execute).not.toHaveBeenCalled();
  });
});
