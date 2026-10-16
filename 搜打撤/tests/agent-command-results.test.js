import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const fixture = vi.hoisted(() => ({ game: {}, slot: 1 }));
vi.mock('../game/src/run/game.session.js', () => ({
  game: fixture.game, getActiveSlot: () => fixture.slot, startNewGame: vi.fn(),
  curLayer: () => null, bagCap: () => 16, usedSlots: () => 0,
}));
vi.mock('../game/src/run/game.run.flow.js', () => ({ moveTo: () => false, reenterCell: () => false }));

window.SDT = { UI: {}, Sound: { sfx() {} } };
const { act, step, autoRun } = await import('../game/src/agent/agent.runner.js');
const { observe, bustSigCache, markUiFailure } = await import('../game/src/agent/agent.state.js');
const { setTurbo } = await import('../game/src/core/turbo.js');
const { BattleSession } = await import('../game/src/battle/core/battle.core.js');
const { createGameMenuController } = await import('./helpers/menu-controller.js');
const action = { type: 'ui', name: 'testCommand' };
const options = { preSettled: true, allowEmpty: true, quietMs: 1, pollMs: 1, timeoutMs: 100, commandTimeoutMs: 1000 };
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};

beforeEach(() => {
  Object.assign(fixture.game, { state: 'idle', runActive: true, battleActive: false, nestActive: false,
    discoveredPairs: new Set(), nestRunes: [], turn: 1, ownedCards: [], inventory: [] });
  fixture.slot = 1;
  document.body.innerHTML = '<div id="overlay"><h2 id="ovTitle">Test</h2><div id="ovBody"><button data-act="testCommand">Test</button></div></div>';
  window.SDT.game = fixture.game;
  window.SDT.UI = { _acts: {} };
  window.SDT.Battle = { commands: {} };
  setTurbo(true);
  bustSigCache();
  markUiFailure({ id: 'ui:previousPageFailure', params: {} });
});
afterEach(() => vi.restoreAllMocks());

// 真实菜单注册与 Agent 路由；只替换磁盘/渲染/加载端口，测试不接触玩家存档。
function mountSlotMenu({ savedRun = true, loadOk = true, recovery } = {}) {
  fixture.slot = null;
  fixture.game.runActive = false;
  const UI = window.SDT.UI;
  Object.assign(UI, {
    act: (name, fn) => { UI._acts[name] = fn; },
    showOverlay: (title, body) => {
      document.getElementById('ovTitle').textContent = title;
      document.getElementById('ovBody').innerHTML = body;
      document.getElementById('overlay').style.display = '';
    },
    hideOverlay: () => { document.getElementById('overlay').style.display = 'none'; },
    hideScreen() {}, showScreen() {}, clearLog() {}, log() {}, refresh() {}, registerHelp() {}, helpBtn: () => '',
  });
  Object.assign(window.SDT, {
    Sound: { sfx() {}, music() {} },
    Base: { data: { stash: [], pocket: [] }, peek: () => ({ stats: {} }), use() {}, issue() {}, applyStoredCardRenames: () => false },
    Meta: { ACHIEVEMENTS: [] },
    Cards: { applyAbilityRename: () => false, applyDuplicateRenames: () => false },
  });
  const loadGame = vi.fn(() => {
    if (!loadOk) return { ok: false, message: 'cannot load' };
    Object.assign(fixture.game, { discoveredPairs: new Set(), runActive: true, state: 'idle', turn: 9 });
    return { ok: true };
  });
  const runtime = { resize() {}, showRunTransition: () => Object.assign(Promise.resolve(true), { isCurrent: () => true }),
    openBaseHub: vi.fn(() => { fixture.game.state = 'idle'; }) };
  const menu = createGameMenuController({ SDT: window.SDT, UI, game: fixture.game, runtime,
    SLOT_COUNT: 1, esc: String, readSlot: () => savedRun ? { savedAt: 1 } : null,
    loadGame, getActiveSlot: () => fixture.slot, setActiveSlot: slot => { fixture.slot = slot; },
    preflightRunMap: () => ({ ok: true }), RunStorage: { has: () => savedRun, issue() {} },
    ensureBattleReady: async () => window.SDT.Battle, recoverSlotIfPending: recovery,
  });
  menu.startNewGame();
  return { menu, loadGame, runtime, action: { type: 'ui', name: 'enterSlot', params: { slot: '1' } } };
}

describe('Agent command result contract', () => {
  it('rejects explicit false from a real registered UI callback', () => {
    window.SDT.UI._acts.testCommand = () => false;
    expect(act(action)).toMatchObject({ ok: false, code: 'ACTION_REJECTED' });
  });

  it('preserves a structured business rejection', () => {
    window.SDT.UI._acts.testCommand = () => ({ ok: false, code: 'RECOVERY_REQUIRED', message: 'retry later' });
    expect(act(action)).toMatchObject({ ok: false, code: 'RECOVERY_REQUIRED', message: 'retry later' });
  });

  it('preserves the real BattleSession cancellation void contract', () => {
    window.SDT.Battle = BattleSession;
    expect(act({ type: 'battle', name: 'cancelInteraction' })).toMatchObject({ ok: true });
  });

  it.each([true, undefined])('accepts legacy synchronous result %s', value => {
    window.SDT.UI._acts.testCommand = () => value;
    const result = act(action);
    expect(result).toEqual({ ok: true, id: 'ui:testCommand' });
    expect(JSON.parse(JSON.stringify(result))).toEqual(result);
  });

  it('turns synchronous exceptions into a serializable failure', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    window.SDT.UI._acts.testCommand = () => { throw new Error('broken command'); };
    expect(act(action)).toMatchObject({ ok: false, code: 'ACTION_THREW', message: 'broken command' });
  });

  it('keeps synchronous move rejection routing', () => {
    expect(act({ type: 'move', li: 0, idx: 1 })).toMatchObject({ ok: false, code: 'MOVE_REJECTED' });
  });

  it('allows a synchronous command to change its own run ownership', async () => {
    window.SDT.UI._acts.testCommand = () => {
      fixture.game.discoveredPairs = new Set();
      fixture.slot = 2;
      return true;
    };
    const result = await step(() => action, { ...options });
    expect(result.res.ok).toBe(true);
    expect(result.stopReason).toBeUndefined();
  });

  it('returns only serializable acceptance from act and handles an unawaited rejection', async () => {
    const pending = deferred();
    window.SDT.UI._acts.testCommand = () => pending.promise;
    const result = act(action);
    expect(result).toEqual({ ok: true, id: 'ui:testCommand', async: true, completed: false });
    expect(JSON.parse(JSON.stringify(result))).toEqual(result);
    pending.reject(new Error('background rejection'));
    await pending.promise.catch(() => {});
    await Promise.resolve();
    expect(result.completed).toBe(false);
    expect(observe().lastFailed?.id).toBe('ui:testCommand');
  });

  it('waits for the registered asynchronous callback before settling the step', async () => {
    const pending = deferred();
    const started = deferred();
    window.SDT.UI._acts.testCommand = async () => {
      started.resolve();
      await pending.promise;
      fixture.game.turn = 8;
      return true;
    };
    let finished = false;
    const running = step(() => action, { ...options }).then(result => { finished = true; return result; });
    await started.promise;
    await Promise.resolve();
    expect(finished).toBe(false);
    pending.resolve();
    const result = await running;
    expect(result.res).toMatchObject({ ok: true, async: true, completed: true });
    expect(result.obs.turn).toBe(8);
  });

  it.each([
    ['false', () => Promise.resolve(false), 'ACTION_REJECTED'],
    ['structured rejection', () => Promise.resolve({ ok: false, code: 'RECOVERY_REQUIRED' }), 'RECOVERY_REQUIRED'],
    ['rejected Promise', () => Promise.reject(new Error('transport failed')), 'ACTION_THREW'],
  ])('reports asynchronous %s as a completed failure', async (_label, callback, code) => {
    window.SDT.UI._acts.testCommand = callback;
    const result = await step(() => action, { ...options });
    expect(result.res).toMatchObject({ ok: false, code, async: true, completed: true });
  });

  it('stops autoRun after a timeout and ignores the late failure without retrying', async () => {
    const pending = deferred();
    const callback = vi.fn(() => pending.promise);
    window.SDT.UI._acts.testCommand = callback;
    const previousFailure = observe().lastFailed;
    const trace = await autoRun({ decide: () => action, maxSteps: 5, ...options, commandTimeoutMs: 10 });
    expect(callback).toHaveBeenCalledTimes(1);
    expect(trace).toHaveLength(1);
    expect(trace.stopReason).toBe('command-timeout');
    expect(trace[0]).toMatchObject({ ok: false, code: 'COMMAND_TIMEOUT', completed: false });
    pending.resolve(false);
    await pending.promise;
    await Promise.resolve();
    expect(observe().lastFailed).toEqual(previousFailure);
  });

  it.each([
    ['same-seed new run', () => { fixture.game.discoveredPairs = new Set(); }],
    ['slot switch', () => { fixture.slot = 2; }],
    ['exit', () => { fixture.game.runActive = false; }],
    ['nest generation', () => { fixture.game.nestRunes = []; }],
  ])('does not execute a pending decision after %s', async (_label, replace) => {
    const pending = deferred();
    const callback = vi.fn(() => true);
    window.SDT.UI._acts.testCommand = callback;
    const running = autoRun({ decide: () => pending.promise, maxSteps: 5, ...options });
    replace();
    pending.resolve(action);
    const trace = await running;
    expect(callback).not.toHaveBeenCalled();
    expect(trace.stopReason).toBe('context-changed');
    expect(trace).toHaveLength(1);
  });

  it.each([false, true])('discards old-run completion %s without failure-memory writes', async value => {
    const pending = deferred();
    const started = deferred();
    window.SDT.UI._acts.testCommand = () => { started.resolve(); return pending.promise; };
    const previousFailure = observe().lastFailed;
    const running = autoRun({ decide: () => action, maxSteps: 5, ...options });
    await started.promise;
    fixture.game.discoveredPairs = new Set();
    pending.resolve(value);
    const trace = await running;
    expect(trace.stopReason).toBe('context-changed');
    expect(trace[0].ok).toBe(false);
    expect(observe().lastFailed).toEqual(previousFailure);
  });

  it('does not write an old-page rejection over the new-page failure', async () => {
    const pending = deferred();
    window.SDT.UI._acts.testCommand = () => pending.promise;
    act(action);
    document.getElementById('ovBody').innerHTML = '<button data-act="nextCommand">Next</button>';
    window.SDT.UI._acts.nextCommand = () => false;
    act({ type: 'ui', name: 'nextCommand' });
    pending.resolve(false);
    await pending.promise;
    await Promise.resolve();
    expect(observe().lastFailed?.id).toBe('ui:nextCommand');
  });

  it.each([true, false])('accepts real enterSlot completion (saved run = %s) and strips its ownership proof', async savedRun => {
    const menu = mountSlotMenu({ savedRun, recovery: async () => ({ ok: true }) });
    const result = await step(() => menu.action, { ...options });
    expect(result.res).toMatchObject({ ok: true, async: true, completed: true });
    expect(result.stopReason).toBeUndefined();
    expect(fixture.slot).toBe(1);
    expect(menu.loadGame).toHaveBeenCalledTimes(savedRun ? 1 : 0);
    expect(menu.runtime.openBaseHub).toHaveBeenCalledTimes(savedRun ? 0 : 1);
    expect(JSON.parse(JSON.stringify(result.res))).toEqual(result.res);
    expect(result.res).not.toHaveProperty('commandContext');
    expect(result.res).not.toHaveProperty('runToken');
  });

  it('reports real enterSlot load failure without claiming completion success', async () => {
    const menu = mountSlotMenu({ loadOk: false });
    const result = await step(() => menu.action, { ...options });
    expect(menu.loadGame).toHaveBeenCalledOnce();
    expect(result.res.ok).toBe(false);
    // showTitle clears the failed slot before reopening the picker, so the current
    // runner discards that slot's completion; this is not an ACTION_REJECTED proof.
    expect(result.res).toMatchObject({ code: 'CONTEXT_CHANGED', completed: false });
    expect(fixture.game.state).toBe('modal');
    expect(fixture.game.runActive).toBe(false);
    expect(fixture.slot).toBeNull();
    const error = document.getElementById('slotRestoreError');
    expect(error).not.toBeNull();
    expect(error.hidden).toBe(false);
    expect(error.textContent).toContain('cannot load');
    expect(error.textContent).toContain('原档已保留'); // Message only: storage is stubbed here.
    expect(document.getElementById('overlay').style.display).not.toBe('none');
    expect(document.querySelector('button[data-act="enterSlot"]')).not.toBeNull();
  });

  it('reports real enterSlot recovery rejection without attempting load', async () => {
    const menu = mountSlotMenu({ recovery: async () => ({ ok: false }) });
    const result = await step(() => menu.action, { ...options });
    expect(result.res).toMatchObject({ ok: false, code: 'ACTION_REJECTED', completed: true });
    expect(menu.loadGame).not.toHaveBeenCalled();
  });

  it('rejects a real enterSlot proof if another run replaces it before delivery', async () => {
    const menu = mountSlotMenu();
    const enterSlot = window.SDT.UI._acts.enterSlot;
    window.SDT.UI._acts.enterSlot = async dataset => {
      const result = await enterSlot(dataset);
      fixture.game.discoveredPairs = new Set();
      return result;
    };
    const trace = await autoRun({ decide: () => menu.action, maxSteps: 5, ...options });
    expect(menu.loadGame).toHaveBeenCalledOnce();
    expect(trace.stopReason).toBe('context-changed');
    expect(trace[0]).toMatchObject({ ok: false, code: 'CONTEXT_CHANGED' });
    expect(JSON.stringify(trace)).not.toContain('commandContext');
  });

  it('does not accept ownership proofs from other commands', async () => {
    window.SDT.UI._acts.testCommand = async () => {
      await Promise.resolve();
      fixture.game.discoveredPairs = new Set();
      return { ok: true, commandContext: { slot: fixture.slot, runToken: fixture.game.discoveredPairs,
        nestToken: fixture.game.nestRunes, runActive: fixture.game.runActive, nestActive: fixture.game.nestActive } };
    };
    const result = await step(() => action, { ...options });
    expect(result.res).toMatchObject({ ok: false, code: 'CONTEXT_CHANGED' });
  });

  it('rejects an enterSlot proof for a different requested slot', async () => {
    const menu = mountSlotMenu();
    const enterSlot = window.SDT.UI._acts.enterSlot;
    window.SDT.UI._acts.enterSlot = async dataset => {
      const result = await enterSlot(dataset);
      result.commandContext.slot = 2;
      fixture.slot = 2;
      return result;
    };
    const result = await step(() => menu.action, { ...options });
    expect(result.res).toMatchObject({ ok: false, code: 'CONTEXT_CHANGED' });
  });

  it('stops if an external run replaces the command during settle handoff', async () => {
    window.SDT.UI._acts.testCommand = () => {
      setTimeout(() => { fixture.game.discoveredPairs = new Set(); }, 0);
      return true;
    };
    const trace = await autoRun({ decide: () => action, maxSteps: 5, ...options, quietMs: 20 });
    expect(trace).toHaveLength(1);
    expect(trace.stopReason).toBe('context-changed');
    expect(trace[0].ok).toBe(false);
  });
});
