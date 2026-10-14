import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// stopRun → decide signal 贯通（jsdom 环境：需要 DOM 动作面，不涉 fetch）

const fixture = vi.hoisted(() => ({ game: {}, slot: 1 }));
vi.mock('../game/src/run/game.session.js', () => ({
  game: fixture.game, getActiveSlot: () => fixture.slot, startNewGame: vi.fn(),
  curLayer: () => null, bagCap: () => 16, usedSlots: () => 0,
}));
vi.mock('../game/src/run/game.run.flow.js', () => ({ moveTo: () => false, reenterCell: () => false }));

window.SDT = { UI: {}, Sound: { sfx() {} } };
const { autoRun, stopRun } = await import('../game/src/agent/agent.runner.js');
const { setTurbo } = await import('../game/src/core/turbo.js');
const { bustSigCache } = await import('../game/src/agent/agent.state.js');

const options = { preSettled: true, allowEmpty: true, quietMs: 1, pollMs: 1, timeoutMs: 100, commandTimeoutMs: 100 };

beforeEach(() => {
  Object.assign(fixture.game, { state: 'idle', runActive: true, battleActive: false, nestActive: false,
    discoveredPairs: new Set(), nestRunes: [], turn: 1, ownedCards: [], inventory: [] });
  fixture.slot = 1;
  document.body.innerHTML = '<div id="overlay"><div id="ovBody"><button data-act="testCommand">Test</button></div></div>';
  window.SDT.game = fixture.game;
  window.SDT.UI = { _acts: {} };
  window.SDT.Battle = { commands: {} };
  setTurbo(true);
  bustSigCache();
});
afterEach(() => vi.restoreAllMocks());

describe('agent.runner stopRun → decide signal 贯通', () => {
  it('stopRun 中止本局 signal，autoRun 以 cancelled 收口', async () => {
    let captured = null;
    const command = vi.fn();
    window.SDT.UI._acts.testCommand = command;
    const hangingDecide = (innerObs, extras) => new Promise((resolve) => {
      captured = extras?.signal || null;
      captured?.addEventListener('abort', () => resolve({ type: 'ui', name: 'testCommand' }), { once: true });
    });
    const running = autoRun({ decide: hangingDecide, maxSteps: 5, ...options });
    await vi.waitFor(() => expect(captured).toBeTruthy());
    expect(captured.aborted).toBe(false);
    stopRun();
    const trace = await running;
    expect(captured.aborted).toBe(true);
    expect(trace.stopReason).toBe('cancelled');
    expect(command).not.toHaveBeenCalled();
  });

  it('停止后迟到决策不执行；收口前拒绝新局，收口后新局独立执行', async () => {
    let release;
    const oldCommand = vi.fn();
    const newCommand = vi.fn();
    document.getElementById('ovBody').innerHTML += '<button data-act="nextCommand">Next</button>';
    window.SDT.UI._acts = { testCommand: oldCommand, nextCommand: newCommand };
    const first = autoRun({ decide: () => new Promise(resolve => { release = resolve; }),
      maxSteps: 1, ...options });
    await vi.waitFor(() => expect(release).toBeTypeOf('function'));
    stopRun();
    const blocked = await autoRun({ decide: () => ({ type: 'ui', name: 'nextCommand' }),
      maxSteps: 1, ...options });
    expect(blocked.stopReason).toBe('already-running');
    release({ type: 'ui', name: 'testCommand' });
    expect((await first).stopReason).toBe('cancelled');
    expect(oldCommand).not.toHaveBeenCalled();
    const next = await autoRun({ decide: () => ({ type: 'ui', name: 'nextCommand' }),
      maxSteps: 1, ...options });
    expect(next.stopReason).toBe('max-steps');
    expect(newCommand).toHaveBeenCalledTimes(1);
    expect(oldCommand).not.toHaveBeenCalled();
  });

  it('上一局的 stopRun 不影响新一局的 signal（控制器随局重建）', async () => {
    const seen = [];
    const firstDecide = (_obs, extras) => { seen.push(extras?.signal || null); return Promise.resolve(null); };
    await autoRun({ decide: firstDecide, maxSteps: 1, ...options });
    stopRun();   // 局间调用：此刻不应有任何活跃控制器被中止
    const secondDecide = (_obs, extras) => { seen.push(extras?.signal || null); return Promise.resolve(null); };
    await autoRun({ decide: secondDecide, maxSteps: 1, ...options });
    expect(seen.length).toBe(2);
    expect(seen[1]?.aborted).toBe(false);
  });

  it('runTimeoutMs 局级墙钟：超时以 run-timeout 收口', async () => {
    // decide 带 15ms 延迟：40ms 墙钟必先于 spin(6 连同键)熔断到达，钉住墙钟本身
    const decide = () => new Promise(r => setTimeout(() => r({ type: 'ui', name: 'testCommand' }), 15));
    const trace = await autoRun({ decide, maxSteps: 5000, ...options, runTimeoutMs: 40 });
    expect(trace.stopReason).toBe('run-timeout');
    expect(trace.length).toBeLessThan(5000);
  });

  it('重入守卫：上一局未收口时第二局以 already-running 拒绝', async () => {
    let captured = null;
    const hangingDecide = (_obs, extras) => new Promise((resolve) => {
      captured = extras?.signal || null;
      captured?.addEventListener('abort', () => resolve({ type: 'ui', name: 'testCommand' }), { once: true });
    });
    const first = autoRun({ decide: hangingDecide, maxSteps: 5, ...options });
    await vi.waitFor(() => expect(captured).toBeTruthy());
    const second = await autoRun({ decide: hangingDecide, maxSteps: 1, ...options });
    expect(second.stopReason).toBe('already-running');
    stopRun();   // 中止首局在途 decide → 收口，避免悬挂
    const trace = await first;
    expect(trace.stopReason).toBe('cancelled');
  });
});
