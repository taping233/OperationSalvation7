import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  game: null, saveGame: null, payloadFactory: null, transition: null, actions: null, chestDone: null,
  activeSlot: 1, runId: 'test-run', commands: null, commandOptions: null, readReceipt: null,
  commitResponses: [], commitApplied: false, pending: null, setPending: null, clearPending: null, random: null,
}));

vi.mock('../game/src/run/game.session.js', () => ({
  game: state.game,
  saveGame: (...args) => state.saveGame(...args),
  createRunSavePayload: (...args) => state.payloadFactory(...args),
  getActiveSlot: () => state.activeSlot,
  setBattleSettlementPending: (...args) => state.setPending(...args),
  clearBattleSettlementPending: (...args) => state.clearPending(...args),
  doDeath: vi.fn(), cardStacks: vi.fn(), newUid: vi.fn(), safeUsed: vi.fn(), usedSlots: vi.fn(),
}));
vi.mock('../game/src/hub/game.storage.js', () => ({ RunStorage: {
  readIdentity: () => ({ ok: true, value: { runId: state.runId, revision: 2 } }),
} }));
vi.mock('../game/src/hub/battle-settlement.commands.js', () => ({
  createBattleSettlementCommands: options => {
    state.commandOptions = options;
    return state.commands;
  },
}));
vi.mock('../game/src/hub/recovery.commands.js', () => ({
  commitBaseAndRun: vi.fn(), readSettlementReceipt: vi.fn(), recoverSlot: vi.fn(),
}));
vi.mock('../game/src/run/game.run.js', () => ({ showRunTransition: (...args) => state.transition(...args) }));
vi.mock('../game/src/hub/game.bag.bridge.js', () => ({ bagSlots: { closeBackpack: vi.fn(), pocketAdd: vi.fn() } }));
vi.mock('../game/src/core/event-bus.js', () => ({ on: vi.fn() }));
vi.mock('../game/src/core/random.js', () => ({ Random: { random: (...args) => state.random(...args) } }));
vi.mock('../game/src/core/shared.js', () => ({ esc: String }));

beforeEach(() => {
  vi.resetModules();
  state.actions = {};
  state.chestDone = null;
  state.activeSlot = 1;
  state.runId = 'test-run';
  state.game ||= {};
  Object.keys(state.game).forEach(key => { delete state.game[key]; });
  Object.assign(state.game, {
    state: 'idle', seed: 'seed-1', ownedCards: [], usedPocket: [], visited: {}, discoveredPairs: new Set(),
    layerIdx: 0, trackPos: 1, elapsed: 30, elapsedSynced: 20,
    grantCard: vi.fn(), addItem: vi.fn(), myClass: 'wu', hp: 20, maxHp: 20,
  });
  state.saveGame = vi.fn(() => true);
  state.payloadFactory = vi.fn(() => ({
    layerIdx: state.game.layerIdx, trackPos: state.game.trackPos, visited: { ...state.game.visited }, elapsed: state.game.elapsed,
  }));
  state.transition = vi.fn(async () => {});
  state.pending = null;
  state.setPending = vi.fn((slotId, runId) => { state.pending = { slotId, runId }; });
  state.clearPending = vi.fn(() => { state.pending = null; });
  state.commitResponses = [];
  state.commitApplied = false;
  state.random = vi.fn(() => 0.5);
  state.readReceipt = vi.fn(async () => ({ ok: true, replay: false, value: null }));
  state.commands = {
    readReceipt: (...args) => state.readReceipt(...args),
    createAttempt: vi.fn(async input => ({ ok: true, replay: false, attempt: Object.freeze({ id: 'attempt-1', ...input }) })),
    commitAttempt: vi.fn(async attempt => {
      const result = state.commitResponses.shift() || { ok: true, replay: false, receipt: { runRevision: 3 } };
      if (result.ok && !state.commitApplied) {
        window.SDT.Base.data.eggBattles += 1;
        state.commitApplied = true;
      }
      return result;
    }),
  };
  window.SDT = {
    UI: {
      hideOverlay: vi.fn(), showOverlay: vi.fn(), refresh: vi.fn(), log: vi.fn(),
      act: (name, fn) => { state.actions[name] = fn; },
    },
    Base: { slot: 1, data: { eggBattles: 0, ammoTaught: true }, save: vi.fn(() => true), isSha: () => false },
    Cards: { SHA: { id: 'starter-attack' }, all: () => [{ id: 'legend', rarity: '传说' }], isRandomObtainable: () => true, cardHTML: () => '' },
    Meta: { track: vi.fn() },
    Chests: {
      rollDrops: vi.fn(() => [{ kind: 'small' }]), dropText: () => '小宝箱',
      open: vi.fn((_game, _drops, done) => { state.chestDone = done; }),
    },
  };
});

async function bind() {
  const { bindBagMixins } = await import('../game/src/hub/game.bag.settle.js');
  bindBagMixins();
  return state.game.onBattleEnd;
}

async function openAndFinishChest(onBattleEnd, opts) {
  await onBattleEnd(opts, [], true, []);
  expect(state.chestDone).toBeTypeOf('function');
  return state.chestDone();
}

describe('战后结算事务接线与失败重试', () => {
  it('过场失败后重试，不再次消耗已转入口袋的牌', async () => {
    const onBattleEnd = await bind();
    state.game.ownedCards.push({ uid: 'played-1', card: { id: 'played', name: '已打出的牌', rarity: '古朴' } });
    state.transition.mockRejectedValueOnce(new Error('transition failed'));
    const opts = { isBoss: false, foeNames: ['敌人'], encounterId: 'entry:enemy' };

    expect(await onBattleEnd(opts, ['played-1'], true, [])).toBe(false);
    expect(state.game.ownedCards).toHaveLength(0);
    const { bagSlots } = await import('../game/src/hub/game.bag.bridge.js');
    expect(bagSlots.pocketAdd).toHaveBeenCalledTimes(1);
    await state.actions.battleSettleRetry();
    expect(bagSlots.pocketAdd).toHaveBeenCalledTimes(1);
    expect(window.SDT.Chests.open).toHaveBeenCalledTimes(1);
    await state.chestDone();
    expect(state.commands.commitAttempt).toHaveBeenCalledTimes(1);
  });

  it('重复通知与事务失败重试复用固定attempt，不重复发奖励、重开宝箱或增计数', async () => {
    const onBattleEnd = await bind();
    let releaseTransition;
    state.transition.mockImplementationOnce(() => new Promise(resolve => { releaseTransition = resolve; }));
    state.commitResponses = [
      { ok: false, code: 'STORAGE_WRITE_FAILED', message: 'write failed' },
      { ok: true, replay: false, receipt: { runRevision: 3 } },
    ];
    const opts = { isBoss: true, foeNames: ['首脑'], encounterId: 'boss:final' };

    const first = onBattleEnd(opts, [], true, []);
    const duplicate = onBattleEnd(opts, [], true, []);
    await vi.waitFor(() => expect(state.transition).toHaveBeenCalledTimes(1));
    releaseTransition();
    await Promise.all([first, duplicate]);
    expect(window.SDT.Chests.open).toHaveBeenCalledTimes(1);

    await state.chestDone();
    expect(state.game.grantCard).toHaveBeenCalledTimes(1);
    expect(state.game.visited['0,1']).toBe(1);
    expect(state.commands.createAttempt).toHaveBeenCalledTimes(1);
    expect(state.commands.commitAttempt).toHaveBeenCalledTimes(1);
    expect(state.commands.commitAttempt.mock.calls[0][0].id).toBe('attempt-1');
    expect(state.commands.createAttempt.mock.calls[0][0]).toMatchObject({
      slotId: 1, node: { layerIdx: 0, trackPos: 1, isBoss: true, encounterId: 'boss:final' },
      afterRun: { visited: { '0,1': 1 }, layerIdx: 0, trackPos: 1 }, elapsedDelta: 10,
    });
    expect(window.SDT.Base.data.eggBattles).toBe(0);
    expect(state.saveGame).not.toHaveBeenCalled();
    expect(window.SDT.Base.save).not.toHaveBeenCalled();
    expect(state.game.state).toBe('battleSettlement');
    expect(state.pending).toEqual({ slotId: 1, runId: 'test-run' });

    await state.actions.battleSettleRetry();
    expect(state.commands.createAttempt).toHaveBeenCalledTimes(1);
    expect(state.commands.commitAttempt).toHaveBeenCalledTimes(2);
    expect(state.commands.commitAttempt.mock.calls[1][0]).toBe(state.commands.commitAttempt.mock.calls[0][0]);
    expect(state.game.grantCard).toHaveBeenCalledTimes(1);
    expect(state.random).toHaveBeenCalledTimes(1);
    expect(window.SDT.Chests.rollDrops).toHaveBeenCalledTimes(1);
    expect(window.SDT.Base.data.eggBattles).toBe(1);
    expect(state.clearPending).toHaveBeenCalledWith(1, 'test-run');
    expect(state.game.state).toBe('idle');
    await onBattleEnd(opts, [], true, []);
    expect(state.commands.commitAttempt).toHaveBeenCalledTimes(2);
  });

  it('允许同一局背包整理替换ownedCards数组后继续提交', async () => {
    const onBattleEnd = await bind();
    const opts = { isBoss: false, foeNames: ['敌人'] };
    await onBattleEnd(opts, [], true, []);
    state.game.ownedCards = state.game.ownedCards.filter(() => true);
    await state.chestDone();
    expect(state.commands.commitAttempt).toHaveBeenCalledTimes(1);
    expect(state.commands.createAttempt).toHaveBeenCalledTimes(1);
  });

  it('新节点已存在收据时在奖励与过场前停止，不投影旧结果', async () => {
    state.readReceipt.mockResolvedValueOnce({ ok: true, replay: true, value: { runRevision: 3 } });
    const onBattleEnd = await bind();
    const result = await onBattleEnd({ isBoss: true, foeNames: ['首脑'] }, [], true, []);
    expect(result).toBe(false);
    expect(state.game.state).toBe('battleSettlement');
    expect(state.transition).not.toHaveBeenCalled();
    expect(state.game.visited).toEqual({});
    expect(state.game.grantCard).not.toHaveBeenCalled();
    expect(state.commands.createAttempt).not.toHaveBeenCalled();
    expect(state.commands.commitAttempt).not.toHaveBeenCalled();
    expect(window.SDT.Chests.open).not.toHaveBeenCalled();
  });

  it('读取收据等待期间锁住战斗操作，切档后旧失败不弹新局重试面板', async () => {
    let releaseReceipt;
    state.readReceipt.mockImplementationOnce(() => new Promise(resolve => { releaseReceipt = resolve; }));
    const onBattleEnd = await bind();
    const pending = onBattleEnd({ isBoss: false, foeNames: ['敌人'] }, [], true, []);
    expect(state.game.state).toBe('battleSettlement');
    state.activeSlot = 2;
    releaseReceipt({ ok: false, code: 'STORAGE_READ_FAILED', message: 'failed' });
    expect(await pending).toBe(false);
    expect(window.SDT.UI.showOverlay).not.toHaveBeenCalled();
    expect(state.commands.createAttempt).not.toHaveBeenCalled();
  });

  it('提交等待期间同槽开启新局后，旧失败不改变新局状态或显示重试面板', async () => {
    let releaseCommit;
    state.commands.commitAttempt.mockImplementationOnce(() => new Promise(resolve => { releaseCommit = resolve; }));
    const onBattleEnd = await bind();
    await onBattleEnd({ isBoss: false, foeNames: ['敌人'] }, [], true, []);
    const pending = state.chestDone();
    await vi.waitFor(() => expect(releaseCommit).toBeTypeOf('function'));
    expect(state.game.state).toBe('battleSettlement');
    state.game.seed = 'seed-next';
    state.game.discoveredPairs = new Set();
    state.game.ownedCards = [];
    state.runId = 'next-run';
    state.game.state = 'idle';
    releaseCommit({ ok: false, code: 'STALE_RUN', message: 'stale' });
    expect(await pending).toBe(false);
    expect(state.game.state).toBe('idle');
    expect(window.SDT.UI.showOverlay).not.toHaveBeenCalled();
  });

  it('无档位胜利保留内存行为，撤退仍走普通保存且不创建胜利事务', async () => {
    const onBattleEnd = await bind();
    state.activeSlot = null;
    await onBattleEnd({ isBoss: false, foeNames: ['敌人'] }, [], true, []);
    await state.chestDone();
    expect(window.SDT.Base.data.eggBattles).toBe(1);
    expect(state.commands.createAttempt).not.toHaveBeenCalled();
    expect(state.saveGame).toHaveBeenCalledTimes(1);

    state.saveGame.mockClear();
    const retreat = onBattleEnd({ isBoss: false, foeNames: ['敌人'] }, [], null, []);
    await retreat;
    expect(state.saveGame).toHaveBeenCalledTimes(1);
    expect(state.commands.createAttempt).not.toHaveBeenCalled();
  });

  it('教学保存仅在事务成功后执行，失败重试不重复奖励', async () => {
    const onBattleEnd = await bind();
    window.SDT.Base.data.ammoTaught = false;
    window.SDT.Base.save.mockReturnValue(false);
    state.commitResponses = [
      { ok: false, code: 'STORAGE_WRITE_FAILED', message: 'write failed' },
      { ok: true, replay: false, receipt: { runRevision: 3 } },
    ];
    const opts = { isBoss: false, foeNames: ['敌人'] };

    await onBattleEnd(opts, [], true, []);
    await state.chestDone();
    expect(state.game.state).toBe('battleSettlement');
    expect(window.SDT.Base.data.ammoTaught).toBe(false);
    expect(window.SDT.Base.save).not.toHaveBeenCalled();
    expect(state.game.grantCard).toHaveBeenCalledTimes(0);

    await state.actions.battleSettleRetry();
    expect(window.SDT.Base.data.ammoTaught).toBe(true);
    expect(window.SDT.Base.save).toHaveBeenCalledTimes(1);
    expect(state.game.grantCard).toHaveBeenCalledTimes(0);
    expect(state.commands.createAttempt).toHaveBeenCalledTimes(1);
    expect(state.commands.commitAttempt).toHaveBeenCalledTimes(2);
    expect(state.game.state).toBe('modal');
    await onBattleEnd(opts, [], true, []);
    await state.chestDone();
    expect(state.commands.commitAttempt).toHaveBeenCalledTimes(2);
    expect(state.commands.createAttempt).toHaveBeenCalledTimes(1);
    expect(state.game.grantCard).toHaveBeenCalledTimes(0);
  });

  it('死亡与龙巢战斗仍绕过普通战后事务', async () => {
    const onBattleEnd = await bind();
    const { doDeath } = await import('../game/src/run/game.session.js');
    await onBattleEnd({ isBoss: false, foeNames: ['敌人'] }, [], false, []);
    expect(doDeath).toHaveBeenCalledTimes(1);
    expect(state.readReceipt).not.toHaveBeenCalled();
    expect(state.commands.createAttempt).not.toHaveBeenCalled();
    expect(state.commands.commitAttempt).not.toHaveBeenCalled();

    state.game.nestActive = true;
    await onBattleEnd({ isBoss: true, foeNames: ['龙巢首脑'] }, [], true, []);
    expect(state.readReceipt).not.toHaveBeenCalled();
    expect(state.commands.createAttempt).not.toHaveBeenCalled();
    expect(state.commands.commitAttempt).not.toHaveBeenCalled();
  });
});

describe('真实 session 的战后保存入口', () => {
  it('payload构造不写盘，pending事务阻断普通saveGame直到清除', async () => {
    vi.doUnmock('../game/src/run/game.session.js');
    vi.doUnmock('../game/src/hub/game.storage.js');
    vi.doUnmock('../game/src/hub/recovery.commands.js');
    vi.doUnmock('../game/src/hub/extraction.commands.js');
    vi.doUnmock('../game/src/hub/terminal.commands.js');
    vi.doUnmock('../game/src/ui/game.menu.js');
    vi.doUnmock('../game/src/agent/agent.data.js');
    vi.doUnmock('../game/src/battle/battle-loader.js');
    vi.doUnmock('../game/src/core/random.js');
    vi.doUnmock('../game/src/core/shared.js');
    vi.doUnmock('../game/src/run/game.session.kernel.js');
    vi.doUnmock('../game/src/run/game.session.modes.js');
    vi.doUnmock('../game/src/run/game.session.bag.js');
    vi.doUnmock('../game/src/run/game.session.map.js');
    vi.doUnmock('../game/src/run/game.session.board.js');
    vi.doUnmock('../game/src/run/game.session.death.js');
    vi.resetModules();
    localStorage.clear();
    const ctx = new Proxy({}, { get: () => () => ctx, set: () => true });
    window.HTMLCanvasElement.prototype.getContext = () => ctx;
    document.body.innerHTML = '<canvas id="game"></canvas><div id="title"></div><div id="exitScr"></div>';
    window.SDT = {
      Icons: { img: () => '', TYPE_ART: {} }, Sound: { music() {}, sfx() {}, setDucked() {} }, FX: { feedback() {} },
      MAP: { rules: { playerMaxHp: 50, playerAtk: 4, fireHeal: 5, battleEnergy: 2, battleHandMax: 10, bossDeckSize: 10, starterSha: 0, battleStartDraw: 5, battleTurnDraw: 1, diceSides: 6 }, items: { rations: { name: '口粮' }, wood: { name: '木材' } } },
    };
    await import('../game/src/cards/cards.js');
    await import('../game/src/ui/ui.js');
    await import('../game/src/hub/base.js');
    Object.assign(window.SDT.UI, { log() {}, refresh() {}, clearLog() {}, hideOverlay() {}, hideScreen() {}, showScreen() {}, showOverlay() {}, act() {}, registerHelp() {}, helpBtn() { return ''; } });
    window.SDT.Meta = { setXpMul() {}, track() {} };
    window.SDT.Nest = { renderNestMap() {} };
    const session = await import('../game/src/run/game.session.js');
    const { RunStorage } = await import('../game/src/hub/game.storage.js');
    const Base = window.SDT.Base;
    const slot = 2;
    Base.use(slot);
    session._set_active_slot(slot);
    session.buildDerived('settlement-session-save');
    session.game.runActive = true;
    session.game.nestActive = false;
    session.game.state = 'idle';
    session.game.elapsed = 30;
    session.game.elapsedSynced = 20;
    expect(session.saveGame()).toBe(true);
    const initialStats = Base.data.stats.playSeconds;
    const rawBeforePayload = [localStorage.getItem(RunStorage.key(slot)), localStorage.getItem(`sdt-base-v2-slot${slot}`)];
    const syncedBeforePayload = session.game.elapsedSynced;
    const payload = session.createRunSavePayload();
    expect(payload).toMatchObject({ slot, elapsed: 30, layerIdx: session.game.layerIdx, trackPos: session.game.trackPos });
    expect([localStorage.getItem(RunStorage.key(slot)), localStorage.getItem(`sdt-base-v2-slot${slot}`)]).toEqual(rawBeforePayload);
    expect(Base.data.stats.playSeconds).toBe(initialStats);
    expect(session.game.elapsedSynced).toBe(syncedBeforePayload);

    const identity = RunStorage.readIdentity(slot);
    session.setBattleSettlementPending(slot, identity.value.runId);
    session.game.elapsed = 40;
    session.game.ownedCards = session.game.ownedCards.filter(() => true);
    const rawBeforeBlockedSave = [localStorage.getItem(RunStorage.key(slot)), localStorage.getItem(`sdt-base-v2-slot${slot}`)];
    expect(session.saveGame()).toBe(false);
    expect([localStorage.getItem(RunStorage.key(slot)), localStorage.getItem(`sdt-base-v2-slot${slot}`)]).toEqual(rawBeforeBlockedSave);
    expect(session.game.elapsedSynced).toBe(30);
    expect(Base.data.stats.playSeconds).toBe(initialStats);

    session.clearBattleSettlementPending(slot, identity.value.runId);
    expect(session.saveGame()).toBe(true);
    expect(session.game.elapsedSynced).toBe(40);
    expect(Base.data.stats.playSeconds).toBe(initialStats + 10);
  });
});
