import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const fixture = vi.hoisted(() => ({ game: {}, slot: 1 }));
vi.mock('../game/src/run/game.session.js', () => ({ game: fixture.game,
  getActiveSlot: () => fixture.slot, startNewGame: vi.fn(), curLayer: () => null,
  bagCap: () => 16, usedSlots: () => 0 }));
vi.mock('../game/src/run/game.run.flow.js', () => ({ moveTo: () => false, reenterCell: () => false }));
const { autoRun, stopRun } = await import('../game/src/agent/agent.runner.js');
const { setTurbo } = await import('../game/src/core/turbo.js');
const { bustSigCache } = await import('../game/src/agent/agent.state.js');
const options = { preSettled: true, allowEmpty: true, quietMs: 1, pollMs: 1,
  timeoutMs: 100, commandTimeoutMs: 2000, maxSteps: 1 };
beforeEach(() => {
  Object.assign(fixture.game, { state: 'idle', runActive: true, battleActive: false,
    discoveredPairs: new Set(), nestRunes: [], turn: 1, ownedCards: [], inventory: [] });
  document.body.innerHTML = '<div id="overlay"><div id="ovBody"><button data-act="testCommand">Test</button></div></div>';
  window.SDT = { game: fixture.game, UI: { _acts: { testCommand: vi.fn() } }, Battle: { commands: {} } };
  setTurbo(true); bustSigCache();
});
afterEach(() => { stopRun(); vi.restoreAllMocks(); });

describe('自动驱动在途任务的生命周期', () => {
  it('不响应取消的决策也能立即停止，并允许新任务正常运行', async () => {
    let release;
    const running = autoRun({ ...options, decide: () => new Promise(resolve => { release = resolve; }) });
    await vi.waitFor(() => expect(release).toBeTypeOf('function'));
    stopRun(); expect((await running).stopReason).toBe('cancelled');
    const next = await autoRun({ ...options, decide: () => null });
    expect(next.stopReason).toBe('decide-null');
    release({ type: 'ui', name: 'testCommand' }); await Promise.resolve();
    expect(window.SDT.UI._acts.testCommand).not.toHaveBeenCalled();
  });
  it('长决策超过局级期限时收口，迟到结果不得执行', async () => {
    let release, signal;
    const running = autoRun({ ...options, runTimeoutMs: 30,
      decide: (_obs, extras) => { signal = extras.signal; return new Promise(resolve => { release = resolve; }); } });
    expect((await running).stopReason).toBe('run-timeout');
    expect(signal.aborted).toBe(true);
    release({ type: 'ui', name: 'testCommand' }); await Promise.resolve();
    expect(window.SDT.UI._acts.testCommand).not.toHaveBeenCalled();
  });
  it('在途命令不返回时仍遵守局级期限，后续拒绝没有未处理异常', async () => {
    let reject;
    window.SDT.UI._acts.testCommand = vi.fn(() => new Promise((_resolve, failure) => { reject = failure; }));
    const running = autoRun({ ...options, runTimeoutMs: 60, decide: () => ({ type: 'ui', name: 'testCommand' }) });
    expect((await running).stopReason).toBe('run-timeout');
    reject(new Error('late command')); await Promise.resolve();
    expect(window.SDT.UI._acts.testCommand).toHaveBeenCalledOnce();
  });
  it('主动停止不等待命令自身的长超时', async () => {
    let release;
    window.SDT.UI._acts.testCommand = vi.fn(() => new Promise(resolve => { release = resolve; }));
    const running = autoRun({ ...options, decide: () => ({ type: 'ui', name: 'testCommand' }) });
    await vi.waitFor(() => expect(release).toBeTypeOf('function'));
    stopRun(); expect((await running).stopReason).toBe('cancelled');
    release(true); await Promise.resolve();
  });
  it('同一局换页时不将旧决策施加到同名的新按钮上', async () => {
    let release;
    const command = window.SDT.UI._acts.testCommand;
    const running = autoRun({ ...options, decide: () => new Promise(resolve => { release = resolve; }) });
    await vi.waitFor(() => expect(release).toBeTypeOf('function'));
    document.getElementById('ovBody').innerHTML = '<button data-act="testCommand">Different reward</button>';
    release({ type: 'ui', name: 'testCommand' });
    expect((await running).stopReason).toBe('context-changed'); expect(command).not.toHaveBeenCalled();
  });
  it('决策期间打开卡牌特写，旧关闭弹层动作不能关闭新的操作面', async () => {
    let release;
    const close = vi.fn(() => true); window.SDT.UI.closeTopOverlayByEsc = close;
    const running = autoRun({ ...options, decide: () => new Promise(resolve => { release = resolve; }) });
    await vi.waitFor(() => expect(release).toBeTypeOf('function'));
    document.body.insertAdjacentHTML('beforeend', '<div id="cardZoom"><div class="cz-backdrop"></div></div>');
    release({ type: 'ui', name: 'closeOverlay' });
    expect((await running).stopReason).toBe('context-changed'); expect(close).not.toHaveBeenCalled();
  });
  it('调用方的取消信号能够停止已加载的驱动', async () => {
    const controller = new AbortController(); let started = false;
    const running = autoRun({ ...options, signal: controller.signal, decide: () => { started = true; return new Promise(() => {}); } });
    await vi.waitFor(() => expect(started).toBe(true)); controller.abort();
    expect((await running).stopReason).toBe('cancelled');
  });
  it('调用方已取消时不启动决策', async () => {
    const controller = new AbortController(); controller.abort(); const decide = vi.fn();
    expect((await autoRun({ ...options, signal: controller.signal, decide })).stopReason).toBe('cancelled');
    expect(decide).not.toHaveBeenCalled();
  });
});
