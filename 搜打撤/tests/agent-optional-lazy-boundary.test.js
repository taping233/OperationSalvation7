import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const llmPath = '../game/src/agent/agent.llm.runtime.js';
const replayPath = '../game/src/agent/agent.replay.runtime.js';
const obs = { phase: 'idle', actions: [], ui: { actions: [] } };
const deferred = () => {
  let resolve;
  const promise = new Promise(accept => { resolve = accept; });
  return { promise, resolve };
};
beforeEach(() => {
  vi.resetModules();
  vi.doUnmock(llmPath);
  vi.doUnmock(replayPath);
  localStorage.clear();
});
afterEach(() => { vi.doUnmock(llmPath); vi.doUnmock(replayPath); vi.restoreAllMocks(); });

describe('Agent optional LLM execution', () => {
  it('keeps config, parsing and factory calls synchronous without fetching the execution chunk', async () => {
    const load = vi.fn(() => ({ decideConfigured: vi.fn() }));
    vi.doMock(llmPath, load);
    const llm = await import('../game/src/agent/agent.llm.js');
    expect(llm.loadConfig()).not.toBeInstanceOf(Promise);
    expect(llm.isEnabled()).toBe(false);
    expect(llm.parseActionReply('{"type":"sys","name":"noop"}').ok).toBe(true);
    const decide = llm.decide();
    expect(decide).toBeTypeOf('function');
    expect(await decide(obs)).toMatchObject({ type: 'sys', name: 'noop' });
    expect(load).not.toHaveBeenCalled();
  });

  it('does not start a configured request when stopped during cold loading', async () => {
    const loading = deferred();
    const execute = vi.fn();
    vi.doMock(llmPath, async () => { await loading.promise; return { decideConfigured: execute }; });
    const llm = await import('../game/src/agent/agent.llm.js');
    llm.saveConfig({ apiKey: 'fixture', model: 'fixture' });
    const controller = new AbortController();
    const pending = llm.decide()(obs, { signal: controller.signal });
    controller.abort();
    loading.resolve();
    expect(await pending).toMatchObject({ type: 'sys', name: 'noop' });
    expect(execute).not.toHaveBeenCalled();
  });

  it('an aborted caller settles even if the optional import is still unresolved', async () => {
    const loading = deferred();
    const execute = vi.fn();
    vi.doMock(llmPath, async () => { await loading.promise; return { decideConfigured: execute }; });
    const llm = await import('../game/src/agent/agent.llm.js');
    llm.saveConfig({ apiKey: 'fixture', model: 'fixture' });
    const controller = new AbortController();
    const onFallback = vi.fn();
    const pending = llm.decide({ onFallback })(obs, { signal: controller.signal });
    controller.abort();
    expect(await pending).toMatchObject({ type: 'sys', name: 'noop' });
    expect(onFallback).toHaveBeenCalledWith(expect.stringContaining('取消'));
    loading.resolve();
    await vi.dynamicImportSettled();
    expect(execute).not.toHaveBeenCalled();
  });

  it('a cold-load timeout settles without fetch and a later decision can use the completed import', async () => {
    const loading = deferred();
    const action = { type: 'sys', name: 'startGame' };
    const execute = vi.fn(async () => action);
    vi.doMock(llmPath, async () => { await loading.promise; return { decideConfigured: execute }; });
    const llm = await import('../game/src/agent/agent.llm.js');
    llm.saveConfig({ apiKey: 'fixture', model: 'fixture' });
    const onFallback = vi.fn();
    const decide = llm.decide({ onFallback, timeoutMs: 10 });
    expect(await decide(obs)).toMatchObject({ type: 'sys', name: 'noop' });
    expect(onFallback).toHaveBeenCalledWith(expect.stringContaining('超时'));
    expect(execute).not.toHaveBeenCalled();
    loading.resolve();
    await vi.dynamicImportSettled();
    expect(await decide(obs)).toBe(action);
    expect(execute).toHaveBeenCalledOnce();
  });

  it('falls back visibly on chunk failure, then retries on the next configured decision', async () => {
    vi.doMock(llmPath, () => { throw new Error('missing optional chunk'); });
    const llm = await import('../game/src/agent/agent.llm.js');
    llm.saveConfig({ apiKey: 'fixture', model: 'fixture' });
    const onFallback = vi.fn();
    const decide = llm.decide({ onFallback });
    expect(await decide(obs)).toMatchObject({ type: 'sys', name: 'noop' });
    expect(onFallback).toHaveBeenCalledWith(expect.stringContaining('加载失败'));
    const action = { type: 'sys', name: 'startGame' };
    const execute = vi.fn(async () => action);
    vi.doMock(llmPath, () => ({ decideConfigured: execute }));
    expect(await decide(obs)).toBe(action);
    expect(execute).toHaveBeenCalledOnce();
  });
});

describe('Agent optional trusted-fixture replay', () => {
  it('loads once only on first capture/play and forwards the original arguments and receipts', async () => {
    const capture = vi.fn(async input => ({ ok: true, packet: input }));
    const play = vi.fn(async () => ({ ok: true, executed: 3 }));
    const load = vi.fn(() => ({ capture, play }));
    vi.doMock(replayPath, load);
    const replay = await import('../game/src/agent/agent.replay.js');
    expect(load).not.toHaveBeenCalled();
    const packet = { fixture: 'local' };
    const pending = replay.capture(packet);
    expect(pending).toBeInstanceOf(Promise);
    expect(await pending).toEqual({ ok: true, packet });
    const options = { prepare: () => {} };
    expect(await replay.play(packet, options)).toEqual({ ok: true, executed: 3 });
    expect(play).toHaveBeenCalledWith(packet, options);
    expect(load).toHaveBeenCalledOnce();
  });

  it('returns a serializable load failure and retries without executing commands', async () => {
    vi.doMock(replayPath, () => { throw new Error('missing replay chunk'); });
    const replay = await import('../game/src/agent/agent.replay.js');
    const failure = await replay.play({});
    expect(failure).toMatchObject({ ok: false, code: 'REPLAY_LOAD_FAILED', executed: 0 });
    expect(JSON.parse(JSON.stringify(failure))).toEqual(failure);
    const play = vi.fn(async () => ({ ok: true, executed: 0 }));
    vi.doMock(replayPath, () => ({ play }));
    expect(await replay.play({})).toEqual({ ok: true, executed: 0 });
  });
});
