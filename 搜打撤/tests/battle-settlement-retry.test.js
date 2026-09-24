import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ game: null, saveGame: null, transition: null, actions: null, chestDone: null, chestOpts: null, recovery: null, runId: 'test-run', runRevision: 2, baseStored: null, pending: null, receipts: {}, failCommit: false, failCommitCommand: null, levelsGained: 0, identityReads: [] }));

vi.mock('../game/src/run/game.session.js', () => ({
  game: state.game, saveGame: (...args) => state.game.pendingBattleSettlement ? false : state.saveGame(...args), prepareRunSnapshot: () => ({ ok: true, value: { rewardCards: state.game.ownedCards.map(x => x.card), visited: state.game.visited } }), getActiveSlot: () => 1,
  doDeath: vi.fn(), cardStacks: vi.fn(), newUid: vi.fn(), safeUsed: vi.fn(), usedSlots: vi.fn(),
}));
vi.mock('../game/src/hub/game.storage.js', () => ({ RunStorage: { readIdentity: () => state.identityReads.length ? state.identityReads.shift() : ({ ok: true, value: { runId: state.runId, revision: state.runRevision } }) } }));
vi.mock('../game/src/hub/recovery.commands.js', () => ({
  recoverSlotIfPending: (...args) => state.recovery.recoverSlotIfPending(...args),
  readSettlementReceipt: (...args) => state.recovery.readSettlementReceipt(...args),
  commitBaseAndRun: (...args) => state.recovery.commitBaseAndRun(...args),
}));
vi.mock('../game/src/run/game.run.js', () => ({ showRunTransition: (...args) => state.transition(...args) }));
vi.mock('../game/src/hub/game.bag.bridge.js', () => ({ bagSlots: { closeBackpack: vi.fn(), pocketAdd: vi.fn() } }));
vi.mock('../game/src/core/event-bus.js', () => ({ on: vi.fn() }));
vi.mock('../game/src/core/random.js', () => ({ Random: { random: () => 0.5 } }));
vi.mock('../game/src/core/shared.js', () => ({ esc: String }));

beforeEach(() => {
  vi.resetModules();
  state.actions = {};
  state.chestDone = null;
  state.chestOpts = null;
  state.runId = 'test-run';
  state.runRevision = 2;
  state.baseStored = { eggBattles: 0, eggPity: 3, stats: { kills: 0, bossKills: [], playSeconds: 10 }, _m01: { revision: 4, requests: {} } };
  state.pending = null; state.receipts = {}; state.failCommit = false; state.failCommitCommand = null; state.levelsGained = 0; state.identityReads = [];
  state.recovery = {
    recoverSlotIfPending: vi.fn(async () => {
      if (state.pending) {
        state.baseStored = { ...state.pending.afterBase, _m01: { ...state.pending.afterBase._m01, revision: state.pending.afterBase._m01.revision + 1 } };
        state.runRevision++;
        state.receipts[state.pending.requestId] = { ok: true, value: { requestId: state.pending.requestId, command: state.pending.command, runId: state.pending.runId, output: state.pending.output } };
        state.pending = null;
      }
      return { ok: true, value: null };
    }),
    readSettlementReceipt: vi.fn(async context => state.receipts[context.requestId] || ({ ok: true, value: null, revision: state.baseStored._m01.revision })),
    commitBaseAndRun: vi.fn(async (context, prepared) => {
      if (state.failCommit || state.failCommitCommand === prepared.command) {
        state.failCommit = false;
        state.failCommitCommand = null;
        state.pending = { ...prepared, requestId: context.requestId };
        return { ok: false, code: 'SAVE_FAILED_PENDING_RECOVERY', message: 'pending' };
      }
      state.baseStored = { ...prepared.afterBase, _m01: { ...prepared.afterBase._m01, revision: prepared.afterBase._m01.revision + 1 } };
      state.runRevision++;
      state.receipts[context.requestId] = { ok: true, value: { requestId: context.requestId, command: prepared.command, runId: prepared.runId, output: prepared.output } };
      return state.receipts[context.requestId];
    }),
  };
  state.game ||= {};
  Object.keys(state.game).forEach(key => { delete state.game[key]; });
  Object.assign(state.game, {
    state: 'idle', ownedCards: [], usedPocket: [], visited: {}, layerIdx: 0, trackPos: 1,
    grantCard: vi.fn(card => { state.game.ownedCards.push({ uid: `loot-${state.game.ownedCards.length}`, card }); return true; }), addItem: vi.fn(), myClass: 'wu', elapsed: 10, elapsedSynced: 10, runActive: true,
  });
  state.saveGame = vi.fn(() => true);
  state.transition = vi.fn(async () => {});
  window.SDT = {
    UI: {
      hideOverlay: vi.fn(), showOverlay: vi.fn(), refresh: vi.fn(), log: vi.fn(),
      act: (name, fn) => { state.actions[name] = fn; },
    },
    Base: { data: { eggBattles: 0, eggPity: 3, ammoTaught: true }, _readForCommit: () => state.baseStored, save: vi.fn(() => true), isSha: () => false },
    Cards: { all: () => [{ id: 'legend', rarity: '传说' }], isRandomObtainable: () => true },
    Meta: { track: vi.fn(), applyBattleKillsToBase: (base, foes, boss) => { base.stats.kills += foes.length; if (boss) base.stats.bossKills.push(foes[0]); return state.levelsGained ?? 0; }, xpMultiplier: () => 1, checkUnlocks: vi.fn(), notifyBattleProgressLevels: vi.fn() },
    Chests: {
      rollDrops: vi.fn(() => [{ kind: 'small' }]), dropText: () => '小宝箱',
      prepareBattle: vi.fn(drops => { window.SDT.Base.data.eggPity = 4; return { version: 1, index: 0, queue: drops.map(drop => ({ kind: drop.kind, contents: { cards: [], coins: 0 }, taken: [] })) }; }),
      openPrepared: vi.fn((_game, _pending, done, opts) => { state.chestDone = done; state.chestOpts = opts; return true; }),
    },
  };
});

async function bind() {
  const { bindBagMixins } = await import('../game/src/hub/game.bag.settle.js');
  bindBagMixins();
  return state.game.onBattleEnd;
}

describe('战后结算入口的配对保存契约', () => {
  it('过场失败后重试，不再次消耗已转入口袋的牌', async () => {
    const onBattleEnd = await bind();
    const card = { id: 'played', name: '已打出的牌', rarity: '古朴' };
    state.game.ownedCards.push({ uid: 'played-1', card });
    state.transition.mockRejectedValueOnce(new Error('transition failed'));
    const opts = { isBoss: false, foeNames: ['敌人'] };

    expect(await onBattleEnd(opts, ['played-1'], true, [])).toBe(false);
    expect(state.game.ownedCards).toHaveLength(0);
    const { bagSlots } = await import('../game/src/hub/game.bag.bridge.js');
    expect(bagSlots.pocketAdd).toHaveBeenCalledTimes(1);
    await state.actions.battleSettleRetry();
    await onBattleEnd(opts, ['played-1'], true, []);
    expect(bagSlots.pocketAdd).toHaveBeenCalledTimes(1);
    expect(window.SDT.Chests.prepareBattle).toHaveBeenCalledTimes(1);
    expect(window.SDT.Chests.openPrepared).toHaveBeenCalledTimes(1);
    expect(state.recovery.commitBaseAndRun.mock.calls.map(([, prepared]) => prepared.command)).toEqual(['battle.stage']);
    await state.chestDone();
    expect(state.recovery.commitBaseAndRun.mock.calls.map(([, prepared]) => prepared.command)).toEqual(['battle.stage', 'battle.settle']);
  });

  it('模拟 pending 配对恢复后，奖励、计数和击杀经验只提交一次', async () => {
    const onBattleEnd = await bind();
    state.levelsGained = 2;
    state.game.elapsed = 37;
    let releaseTransition;
    state.transition.mockImplementationOnce(() => new Promise(resolve => { releaseTransition = resolve; }));
    state.failCommit = true;
    const opts = { isBoss: true, foeNames: ['首脑'] };

    const first = onBattleEnd(opts, [], true, []);
    const duplicate = onBattleEnd(opts, [], true, []);
    expect(state.transition).toHaveBeenCalledTimes(1);
    releaseTransition();
    await Promise.all([first, duplicate]);
    expect(window.SDT.Chests.openPrepared).not.toHaveBeenCalled();
    expect(state.game.grantCard).not.toHaveBeenCalled();
    expect(state.pending).not.toBeNull();
    expect(state.baseStored.eggBattles).toBe(0);
    await state.recovery.recoverSlotIfPending(1); // 模拟重建后选档恢复 pending pair
    expect(state.baseStored.eggBattles).toBe(1);
    expect(state.baseStored.stats.kills).toBe(1);
    expect(Object.keys(state.receipts)).toHaveLength(1);
    await onBattleEnd(opts, [], true, []);
    expect(state.recovery.commitBaseAndRun).toHaveBeenCalledTimes(1); // stage receipt prevents a second stage commit
    expect(state.recovery.commitBaseAndRun.mock.calls[0][1].command).toBe('battle.stage');
    expect(window.SDT.Chests.openPrepared).toHaveBeenCalledTimes(1);
    expect(state.game.grantCard).not.toHaveBeenCalled();
    await state.chestDone();
    expect(state.recovery.commitBaseAndRun).toHaveBeenCalledTimes(2);
    expect(state.game.grantCard).toHaveBeenCalledTimes(1);
    expect(state.game.elapsedSynced).toBe(37);
    expect(window.SDT.Meta.notifyBattleProgressLevels).toHaveBeenCalledTimes(1);
    expect(window.SDT.Meta.notifyBattleProgressLevels).toHaveBeenCalledWith('wu', 2);
    expect(state.baseStored.eggBattles).toBe(1);
    expect(state.baseStored.stats.kills).toBe(1);
    expect(window.SDT.Chests.rollDrops).toHaveBeenCalledTimes(1);
    expect(state.recovery.commitBaseAndRun.mock.calls[1][1].command).toBe('battle.settle');
    expect(Object.keys(state.receipts)).toHaveLength(2);
  });

  it('配对提交保留宝箱保底，重试不重复计战斗数据', async () => {
    const onBattleEnd = await bind();
    const opts = { isBoss: false, foeNames: ['敌人'] };

    await onBattleEnd(opts, [], true, []);
    expect(state.game.pendingBattleSettlement).toBe(false); // stage 已 durable，开箱交互可单独保存
    const { saveGame } = await import('../game/src/run/game.session.js');
    expect(saveGame()).toBe(true);
    expect(state.saveGame).toHaveBeenCalledTimes(1);
    expect(state.chestOpts.persist()).toBe(true);
    await state.chestDone();
    expect(state.baseStored.eggBattles).toBe(1);
    expect(state.baseStored.eggPity).toBe(4);
    expect(state.baseStored.stats.kills).toBe(1);
    expect(state.game.pendingBattleSettlement).toBe(false);
    await onBattleEnd(opts, [], true, []);
    expect(state.baseStored.eggBattles).toBe(1);
    expect(state.baseStored.stats.kills).toBe(1);
    expect(window.SDT.Chests.openPrepared).toHaveBeenCalledTimes(1);
  });

  it('同一对局重建结算模块后，下一场战斗使用新收据并再次入账', async () => {
    vi.stubGlobal('crypto', { randomUUID: undefined });
    const clock = vi.spyOn(Date, 'now').mockReturnValue(12345);
    const firstSettle = await bind();
    const firstOpts = { isBoss: false, foeNames: ['第一场'] };
    await firstSettle(firstOpts, [], true, []);
    await state.chestDone();
    const firstRequestId = state.recovery.commitBaseAndRun.mock.calls[0][0].requestId;

    vi.resetModules();
    const secondSettle = await bind();
    const secondOpts = { isBoss: false, foeNames: ['第二场'] };
    await secondSettle(secondOpts, [], true, []);
    await state.chestDone();
    const secondRequestId = state.recovery.commitBaseAndRun.mock.calls[2][0].requestId;
    expect(secondRequestId).not.toBe(firstRequestId);
    expect(state.recovery.commitBaseAndRun.mock.calls.map(([, prepared]) => prepared.command)).toEqual([
      'battle.stage', 'battle.settle', 'battle.stage', 'battle.settle',
    ]);
    expect(state.baseStored.eggBattles).toBe(2);
    expect(state.baseStored.stats.kills).toBe(2);
    clock.mockRestore();
    vi.unstubAllGlobals();
  });

  it('final 提交失败后恢复 final 收据，不重复发放暂存传说卡或战斗统计', async () => {
    const onBattleEnd = await bind();
    const opts = { isBoss: true, foeNames: ['首脑'] };

    await onBattleEnd(opts, [], true, []);
    expect(state.recovery.commitBaseAndRun.mock.calls[0][1].command).toBe('battle.stage');
    state.failCommitCommand = 'battle.settle';
    await state.chestDone();

    expect(state.pending?.command).toBe('battle.settle');
    expect(state.game.grantCard).toHaveBeenCalledTimes(1);
    expect(state.baseStored.eggBattles).toBe(1);
    expect(state.baseStored.stats.kills).toBe(1);
    expect(state.recovery.commitBaseAndRun.mock.calls[1][0].requestId).toBe(`${state.recovery.commitBaseAndRun.mock.calls[0][0].requestId}:final`);
    expect(state.recovery.commitBaseAndRun.mock.calls[1][1].payload.stageRequestId).toBe(state.recovery.commitBaseAndRun.mock.calls[0][0].requestId);

    await state.recovery.recoverSlotIfPending(1);
    await onBattleEnd(opts, [], true, []);

    expect(state.recovery.commitBaseAndRun).toHaveBeenCalledTimes(2); // final receipt replay must not recommit
    expect(state.game.grantCard).toHaveBeenCalledTimes(1);
    expect(state.baseStored.eggBattles).toBe(1);
    expect(state.baseStored.stats.kills).toBe(1);
    expect(Object.keys(state.receipts)).toHaveLength(2);
    expect(state.receipts[state.recovery.commitBaseAndRun.mock.calls[0][0].requestId].value.command).toBe('battle.stage');
    expect(state.receipts[state.recovery.commitBaseAndRun.mock.calls[1][0].requestId].value.command).toBe('battle.settle');
    expect(state.game.pendingBattleLoot).toBeNull();
    expect(state.game.pendingBattleSettlement).toBe(false);
  });

  it('首次身份读取失败显示重试并保留 pending，恢复读取后继续结算', async () => {
    state.identityReads.push({ ok: false, code: 'RUN_UNREADABLE', message: '对局存档无法读取' });
    const onBattleEnd = await bind();
    const opts = { isBoss: false, foeNames: ['敌人'] };

    expect(await onBattleEnd(opts, [], true, [])).toBe(false);
    expect(state.game.pendingBattleSettlement).toBeTruthy();
    expect(window.SDT.UI.showOverlay).toHaveBeenCalledWith('战后结算未完成', expect.any(String), 'discover');
    expect(window.SDT.Chests.openPrepared).not.toHaveBeenCalled();

    await onBattleEnd(opts, [], true, []);
    expect(window.SDT.Chests.openPrepared).toHaveBeenCalledTimes(1);
    await state.chestDone();
    expect(state.recovery.commitBaseAndRun).toHaveBeenCalledTimes(2);
    expect(state.recovery.commitBaseAndRun.mock.calls.map(([, prepared]) => prepared.command)).toEqual(['battle.stage', 'battle.settle']);
    expect(state.game.pendingBattleSettlement).toBe(false);
  });

  it('过场中同槽开启新局时，旧回调不能把奖励写进新局', async () => {
    const onBattleEnd = await bind();
    let releaseTransition;
    state.transition.mockImplementationOnce(() => new Promise(resolve => { releaseTransition = resolve; }));
    const pending = onBattleEnd({ isBoss: true, foeNames: ['首脑'] }, [], true, []);
    state.runId = 'next-run';
    releaseTransition();
    expect(await pending).toBe(false);
    expect(state.game.grantCard).not.toHaveBeenCalled();
    expect(state.saveGame).not.toHaveBeenCalled();
    expect(window.SDT.Base.save).not.toHaveBeenCalled();
    expect(window.SDT.Chests.openPrepared).not.toHaveBeenCalled();
    expect(state.recovery.commitBaseAndRun).not.toHaveBeenCalled();
    expect(state.game.pendingBattleSettlement).toBe(false);
  });
});
