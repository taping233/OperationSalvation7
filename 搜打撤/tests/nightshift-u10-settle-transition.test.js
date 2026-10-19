import { beforeEach, describe, expect, it, vi } from 'vitest';

// U10 M1（2026-09-29 夜班，find-E-0120）：settle 过场 resolve(false)（非当前/被跳过）后
// 消费端必须静默终止续流，不再 UI.log/续结算——原实现在 teardown 后于此处摸 document
// 抛 `document is not defined`（hud.js:90，vitest-final-4u-clean.log:321 实锤）。
// mock 骨架镜像 battle-settlement-retry.test.js；showRunTransition 按契约桩成 resolve(false)/(true)。

const state = vi.hoisted(() => ({
  game: null, saveGame: null, payloadFactory: null, transition: null, activeSlot: 1,
  commands: null, readReceipt: null,
}));

vi.mock('../game/src/run/game.session.js', () => ({
  game: state.game,
  saveGame: (...args) => state.saveGame(...args),
  createRunSavePayload: (...args) => state.payloadFactory(...args),
  getActiveSlot: () => state.activeSlot,
  setBattleSettlementPending: vi.fn(),
  clearBattleSettlementPending: vi.fn(),
  doDeath: vi.fn(), cardStacks: vi.fn(), newUid: vi.fn(), safeUsed: vi.fn(), usedSlots: vi.fn(),
}));
vi.mock('../game/src/hub/game.storage.js', () => ({ RunStorage: {
  readIdentity: () => ({ ok: true, value: { runId: 'test-run', revision: 2 } }),
} }));
vi.mock('../game/src/hub/battle-settlement.commands.js', () => ({
  createBattleSettlementCommands: () => state.commands,
}));
vi.mock('../game/src/hub/recovery.commands.js', () => ({
  commitBaseAndRun: vi.fn(), readSettlementReceipt: vi.fn(), recoverSlot: vi.fn(),
}));
vi.mock('../game/src/run/game.run.js', () => ({ showRunTransition: (...args) => state.transition(...args) }));
vi.mock('../game/src/hub/game.bag.bridge.js', () => ({ bagSlots: { closeBackpack: vi.fn(), pocketAdd: vi.fn() } }));
vi.mock('../game/src/core/event-bus.js', () => ({ on: vi.fn() }));
vi.mock('../game/src/core/random.js', () => ({ Random: { random: vi.fn(() => 0.5) } }));
vi.mock('../game/src/core/shared.js', () => ({
  clone: value => (value == null ? value : JSON.parse(JSON.stringify(value))), esc: String,
}));

beforeEach(() => {
  vi.resetModules();
  state.activeSlot = 1;
  state.game ||= {};
  Object.keys(state.game).forEach(key => { delete state.game[key]; });
  Object.assign(state.game, {
    state: 'idle', seed: 'seed-1', ownedCards: [], usedPocket: [], visited: {}, discoveredPairs: new Set(),
    layerIdx: 0, trackPos: 1, elapsed: 30, elapsedSynced: 20, myClass: 'wu', hp: 20, maxHp: 20,
    grantCard: vi.fn(),
  });
  state.saveGame = vi.fn(() => true);
  state.payloadFactory = vi.fn(() => ({ layerIdx: 0, trackPos: 1, visited: {}, elapsed: 30 }));
  state.readReceipt = vi.fn(async () => ({ ok: true, replay: false, value: null }));
  state.commands = {
    readReceipt: (...args) => state.readReceipt(...args),
    createAttempt: vi.fn(async input => ({ ok: true, replay: false, attempt: Object.freeze({ id: 'attempt-1', ...input }) })),
    commitAttempt: vi.fn(async () => ({ ok: true, replay: false, receipt: { runRevision: 3 } })),
  };
  window.SDT = {
    UI: {
      hideOverlay: vi.fn(), showOverlay: vi.fn(), refresh: vi.fn(), log: vi.fn(),
      act: vi.fn(), el: {},
    },
    Base: { slot: 1, data: { eggBattles: 0, ammoTaught: true }, save: vi.fn(() => true), isSha: () => false },
    Cards: { all: () => [] },
    Sound: { sfx: vi.fn() },
    Icons: { rich: v => v },
  };
});

async function bind() {
  const { bindBagMixins } = await import('../game/src/hub/game.bag.settle.js');
  bindBagMixins();
  return state.game.onBattleEnd;
}

describe('U10 M1 settle 过场非当前后续流静默终止', () => {
  it('撤退过场 resolve(false) 后：不打「你撤出了战斗」日志、不续结算', async () => {
    state.transition = vi.fn(async () => false);
    const onBattleEnd = await bind();
    await onBattleEnd({ isBoss: false, foeNames: [] }, [], null, []);
    expect(state.transition).toHaveBeenCalledTimes(1);
    expect(window.SDT.UI.log).not.toHaveBeenCalled();
    expect(state.saveGame).not.toHaveBeenCalled();
  });

  it('回归锚：撤退过场 resolve(true)（正常路径）行为零变化——照常打日志、照常续结算', async () => {
    state.transition = vi.fn(async () => true);
    const onBattleEnd = await bind();
    await onBattleEnd({ isBoss: false, foeNames: [] }, [], null, []);
    expect(state.transition).toHaveBeenCalledTimes(1);
    expect(window.SDT.UI.log).toHaveBeenCalledWith(expect.stringContaining('你撤出了战斗'), 'sys');
    expect(state.saveGame).toHaveBeenCalled();
  });

  it('原战场胜利反馈 resolve(false) 后：不打胜利日志、不续结算', async () => {
    state.transition = vi.fn(async () => false);
    window.SDT.Battle = { presentVictory: vi.fn(async () => false) };
    const onBattleEnd = await bind();
    await onBattleEnd({ isBoss: false, foeNames: [] }, [], true, []);
    expect(state.transition).not.toHaveBeenCalled();
    expect(window.SDT.Battle.presentVictory).toHaveBeenCalledTimes(1);
    expect(window.SDT.UI.log).not.toHaveBeenCalled();
    expect(state.saveGame).not.toHaveBeenCalled();
  });
});

it('retreat passes map preparation to the unchanged 1050ms transition without moving settlement earlier', async () => {
  let finish;
  window.SDT.Renderer={warm:vi.fn(async () => true)};
  state.transition=vi.fn(options => { expect(options.duration).toBe(1050); options.prepare(); return new Promise(resolve => {finish=resolve;}); });
  const onBattleEnd=await bind(); const pending=onBattleEnd({isBoss:false,foeNames:[]},[],null,[]);
  await vi.waitFor(() => expect(state.transition).toHaveBeenCalledOnce());
  expect(window.SDT.Renderer.warm).toHaveBeenCalledOnce(); expect(state.saveGame).not.toHaveBeenCalled();
  finish(true); await pending; expect(state.saveGame).toHaveBeenCalled();
});
