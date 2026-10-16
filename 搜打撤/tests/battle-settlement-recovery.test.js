import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const slotId = 1;
const runKey = `sdt-save-v2-slot${slotId}`;
const baseKey = `sdt-base-v2-slot${slotId}`;
const journalKey = `sdt-tx-v1-slot${slotId}`;
const node = { layerIdx: 0, trackPos: 1, isBoss: false, encounterId: 'entry:raider' };
const locks = { request: (_name, _options, action) => Promise.resolve(action()) };
const settleHarness = vi.hoisted(() => ({ game: null, payload: null, actions: null, chestDone: null, randomCalls: 0 }));
let activeSlot;
let priorLocks;

async function loadCommands({ initialize = false, lockManager = locks, failpoint } = {}) {
  window.SDT ||= { Icons: { img: () => '' } };
  await import('../game/src/cards/cards.js');
  await import('../game/src/hub/base.js');
  const Base = window.SDT.Base;
  const { RunStorage } = await import('../game/src/hub/game.storage.js');
  const { createRecoveryCommands } = await import('../game/src/hub/recovery.commands.js');
  const recovery = createRecoveryCommands({
    storage: localStorage, lockManager, failpoint, baseApi: Base, runStore: RunStorage,
  });
  const { createBattleSettlementCommands } = await import('../game/src/hub/battle-settlement.commands.js');
  const commands = createBattleSettlementCommands({
    getBase: () => Base,
    getRunStorage: () => RunStorage,
    getRecovery: () => recovery,
    getActiveSlot: () => activeSlot,
  });
  if (initialize) {
    RunStorage.readForLoad(slotId);
    expect(RunStorage.write(slotId, {
      turn: 7, layerIdx: node.layerIdx, trackPos: node.trackPos, visited: {}, battleComplete: false,
      ownedCards: [{ uid: 'starter', card: { id: 'starter', name: '起始牌' } }],
      rngState: { loot: 12, map: 41 }, mapSnapshot: { seed: 'stable-map', layoutVersion: 1 }, elapsed: 17,
    })).toBe(true);
    Base.use(slotId);
    Base.data.eggBattles = 0;
    Base.data.stats.playSeconds = 40;
    Base.data.ammoTaught = true;
    expect(Base.save()).toBe(true);
  } else {
    Base.use(slotId);
  }
  return { Base, RunStorage, recovery, commands };
}

async function resetAndReload(options = {}) {
  vi.resetModules();
  delete window.SDT.Base;
  return loadCommands(options);
}

function makeAfterRun(RunStorage) {
  const current = RunStorage.read(slotId);
  return {
    ...current,
    turn: 8,
    visited: { ...current.visited, [`${node.layerIdx},${node.trackPos}`]: 1 },
    battleComplete: true,
    ownedCards: [...current.ownedCards, { uid: 'battle-reward', card: { id: 'reward', name: '战斗奖励' } }],
    rngState: { loot: 13, map: 41 },
    mapSnapshot: { seed: 'stable-map', layoutVersion: 1 },
    elapsed: 20,
    savedAt: 1_790_000_000_000,
  };
}

async function prepare(env, options = {}) {
  const afterRun = options.afterRun || makeAfterRun(env.RunStorage);
  const result = await env.commands.createAttempt({
    slotId, node: options.node || { ...node }, afterRun, elapsedDelta: options.elapsedDelta ?? 3,
    ...(options.victoryProgress ? { victoryProgress: options.victoryProgress } : {}),
  });
  expect(result.ok).toBe(true);
  if (!result.ok || result.replay) throw new Error(`attempt preparation failed: ${result.code || 'receipt replay'}`);
  return { attempt: result.attempt, afterRun };
}

function rawSnapshot() {
  return Object.fromEntries(Object.keys(localStorage).sort().map(key => [key, localStorage.getItem(key)]));
}

function failStorageMethod(method, failingKey) {
  const native = Storage.prototype[method];
  return vi.spyOn(Storage.prototype, method).mockImplementation(function (key, value) {
    if (key === failingKey) throw new DOMException('injected quota failure', 'QuotaExceededError');
    return method === 'setItem' ? native.call(this, key, value) : native.call(this, key);
  });
}

beforeEach(async () => {
  vi.resetModules();
  localStorage.clear();
  activeSlot = slotId;
  priorLocks = null;
  window.SDT = { Icons: { img: () => '' } };
  await loadCommands({ initialize: true });
});

afterEach(() => {
  vi.restoreAllMocks();
  for (const moduleId of [
    '../game/src/run/game.session.js', '../game/src/run/game.run.js', '../game/src/core/event-bus.js',
    '../game/src/core/random.js', '../game/src/core/shared.js', '../game/src/hub/game.bag.bridge.js',
  ]) vi.doUnmock(moduleId);
  if (priorLocks) Object.defineProperty(navigator, 'locks', priorLocks);
  else if (Object.hasOwn(navigator, 'locks')) delete navigator.locks;
  vi.resetModules();
  localStorage.clear();
  delete window.SDT;
});

describe('真实 Base/RunStorage 胜利结算恢复事务', () => {
  it('恢复日志写入前失败保持原始双存档不变', async () => {
    let env = await loadCommands();
    const { attempt } = await prepare(env);
    const before = rawSnapshot();
    failStorageMethod('setItem', journalKey);

    const committed = await env.commands.commitAttempt(attempt);
    expect(committed).toMatchObject({ ok: false, code: 'SAVE_FAILED' });
    expect(rawSnapshot()).toEqual(before);
    vi.restoreAllMocks();

    env = await resetAndReload();
    expect(env.RunStorage.read(slotId).visited).toEqual({});
    expect(env.Base.data.eggBattles).toBe(0);
    expect(localStorage.getItem(journalKey)).toBeNull();
  });

  it.each(['after-journal', 'after-base', 'after-run', 'before-cleanup'])(
    'pair在 %s 中断后，同原始storage重建会恢复一致后态并重放收据', async phase => {
      const env = await loadCommands({ failpoint: point => { if (point === phase) throw new Error(`cut:${phase}`); } });
      const { attempt, afterRun } = await prepare(env);
      const failed = await env.commands.commitAttempt(attempt);
      expect(failed).toMatchObject({ ok: false, code: 'SAVE_FAILED_PENDING_RECOVERY' });
      expect(localStorage.getItem(journalKey)).not.toBeNull();
      expect(env.RunStorage.readIdentity(slotId)).toMatchObject({ ok: false, code: 'RECOVERY_REQUIRED' });

      const storage = localStorage;
      const restored = await resetAndReload();
      expect(localStorage).toBe(storage);
      const recovered = await restored.recovery.recoverSlot(slotId);
      expect(recovered.ok).toBe(true);
      const persistedRun = restored.RunStorage.read(slotId);
      expect(persistedRun).toMatchObject({
        layerIdx: afterRun.layerIdx, trackPos: afterRun.trackPos, turn: 8, visited: { '0,1': 1 },
        battleComplete: true, ownedCards: afterRun.ownedCards, rngState: { loot: 13, map: 41 },
        mapSnapshot: { seed: 'stable-map', layoutVersion: 1 }, elapsed: 20,
      });
      expect(restored.Base.data.eggBattles).toBe(1);
      expect(restored.Base.data.stats.playSeconds).toBe(43);
      expect(localStorage.getItem(journalKey)).toBeNull();

      const receiptBeforeReplay = rawSnapshot();
      const replay = await restored.commands.readReceipt({ slotId, node: { ...node } });
      expect(replay).toMatchObject({ ok: true, replay: true, value: { runId: attempt.runId, runRevision: attempt.context.expectedRunRevision + 1 } });
      expect(await restored.commands.commitAttempt(attempt)).toMatchObject({ ok: true, replay: true });
      expect(rawSnapshot()).toEqual(receiptBeforeReplay);
      expect(restored.Base.data.eggBattles).toBe(1);
    },
  );

  it.each(['after-journal', 'after-base', 'after-run', 'before-cleanup'])(
    '胜利统计与多级XP在 %s 恢复后只提交一次', async phase => {
      const env = await loadCommands({ failpoint: point => { if (point === phase) throw new Error(`cut:${phase}`); } });
      env.Base.data.stats.kills = 0;
      env.Base.data.stats.bossKills = [];
      env.Base.data.characters.wu = { lv: 1, xp: 0 };
      expect(env.Base.save()).toBe(true);
      const progressInput = {
        foeNames: ['首脑', '随行敌人', '随行敌人'], isBoss: true, classId: 'wu', xpMultiplier: 5,
      };
      const { attempt } = await prepare(env, { victoryProgress: progressInput });
      expect(attempt.afterBase.stats).toMatchObject({ kills: 3, bossKills: ['首脑'] });
      expect(attempt.afterBase.characters.wu).toEqual({ lv: 3, xp: 120 });
      expect(env.Base.data.stats.kills).toBe(0);
      expect(env.Base.data.characters.wu).toEqual({ lv: 1, xp: 0 });

      expect(await env.commands.commitAttempt(attempt)).toMatchObject({ ok: false, code: 'SAVE_FAILED_PENDING_RECOVERY' });
      expect(env.Base.data.stats.kills).toBe(0);
      expect(env.Base.data.characters.wu).toEqual({ lv: 1, xp: 0 });
      const restored = await resetAndReload();
      expect((await restored.recovery.recoverSlot(slotId)).ok).toBe(true);
      expect(restored.Base.data.stats).toMatchObject({ kills: 3, bossKills: ['首脑'] });
      expect(restored.Base.data.characters.wu).toEqual({ lv: 3, xp: 120 });

      const persisted = rawSnapshot();
      expect(await restored.commands.commitAttempt(attempt)).toMatchObject({ ok: true, replay: true });
      expect(rawSnapshot()).toEqual(persisted);
      expect(restored.Base.data.stats.kills).toBe(3);
      expect(restored.Base.data.characters.wu).toEqual({ lv: 3, xp: 120 });
    },
  );

  it('真实journal cleanup删除失败后重建恢复且不重复增加永久计数', async () => {
    const env = await loadCommands();
    const { attempt } = await prepare(env);
    failStorageMethod('removeItem', journalKey);
    expect(await env.commands.commitAttempt(attempt)).toMatchObject({ ok: false, code: 'SAVE_FAILED_PENDING_RECOVERY' });
    expect(JSON.parse(localStorage.getItem(baseKey)).eggBattles).toBe(1);
    expect(JSON.parse(localStorage.getItem(runKey)).visited['0,1']).toBe(1);
    vi.restoreAllMocks();

    const restored = await resetAndReload();
    expect((await restored.recovery.recoverSlot(slotId)).ok).toBe(true);
    expect(restored.Base.data.eggBattles).toBe(1);
    const beforeReplay = rawSnapshot();
    expect(await restored.commands.commitAttempt(attempt)).toMatchObject({ ok: true, replay: true });
    expect(rawSnapshot()).toEqual(beforeReplay);
    expect(restored.Base.data.eggBattles).toBe(1);
  });

  it('成功后同步Base内存与两种写入baseline，重复receipt不产生新写入', async () => {
    const env = await loadCommands();
    const { attempt, afterRun } = await prepare(env);
    expect(await env.commands.commitAttempt(attempt)).toMatchObject({ ok: true, replay: false });
    expect(env.Base.data.eggBattles).toBe(1);
    expect(env.Base.data.stats.playSeconds).toBe(43);
    expect(env.RunStorage.read(slotId)).toMatchObject({ visited: { '0,1': 1 }, ownedCards: afterRun.ownedCards, rngState: afterRun.rngState });

    const beforeReplay = rawSnapshot();
    expect(await env.commands.commitAttempt(attempt)).toMatchObject({ ok: true, replay: true });
    expect(rawSnapshot()).toEqual(beforeReplay);
    env.Base.data.coins += 1;
    expect(env.Base.save()).toBe(true);
    const currentRun = env.RunStorage.read(slotId);
    expect(env.RunStorage.write(slotId, { ...currentRun, turn: 9 })).toBe(true);
  });

  it('同requestId但节点业务payload不同会冲突；坏日志保留双存档现场', async () => {
    let env = await loadCommands();
    const { attempt } = await prepare(env);
    expect((await env.commands.commitAttempt(attempt)).ok).toBe(true);
    const conflict = await env.commands.readReceipt({ slotId, node: { ...node, isBoss: true } });
    expect(conflict).toMatchObject({ ok: false, code: 'REQUEST_ID_CONFLICT' });

    const savedBase = localStorage.getItem(baseKey);
    const savedRun = localStorage.getItem(runKey);
    localStorage.setItem(journalKey, '{invalid journal');
    env = await resetAndReload();
    const malformed = await env.recovery.recoverSlot(slotId);
    expect(malformed).toMatchObject({ ok: false, code: 'RECOVERY_BLOCKED' });
    expect(localStorage.getItem(baseKey)).toBe(savedBase);
    expect(localStorage.getItem(runKey)).toBe(savedRun);
    expect(localStorage.getItem(journalKey)).toBe('{invalid journal');
  });

  it('遇到日志之外的第三值时阻断恢复并保留基地、对局与日志', async () => {
    const env = await loadCommands({ failpoint: point => { if (point === 'after-base') throw new Error('cut after base'); } });
    const next = await prepare(env);
    expect(await env.commands.commitAttempt(next.attempt)).toMatchObject({ ok: false, code: 'SAVE_FAILED_PENDING_RECOVERY' });
    const foreignRun = JSON.parse(localStorage.getItem(runKey));
    foreignRun.turn = 999;
    localStorage.setItem(runKey, JSON.stringify(foreignRun));
    const baseAtThirdValue = localStorage.getItem(baseKey);
    const thirdValue = localStorage.getItem(runKey);
    const restored = await resetAndReload();
    expect(await restored.recovery.recoverSlot(slotId)).toMatchObject({ ok: false, code: 'RECOVERY_BLOCKED' });
    expect(localStorage.getItem(baseKey)).toBe(baseAtThirdValue);
    expect(localStorage.getItem(runKey)).toBe(thirdValue);
    expect(localStorage.getItem(journalKey)).not.toBeNull();
  });

  it('陈旧run/base revision、切档和同槽新run都会拒绝attempt', async () => {
    let env = await loadCommands();
    const runAttempt = await prepare(env);
    const run = env.RunStorage.read(slotId);
    expect(env.RunStorage.write(slotId, { ...run, turn: 99 })).toBe(true);
    expect(await env.commands.commitAttempt(runAttempt.attempt)).toMatchObject({ ok: false, code: 'STALE_RUN' });
    expect(env.Base.data.eggBattles).toBe(0);

    env = await resetAndReload({ initialize: true });
    const baseAttempt = await prepare(env);
    env.Base.data.coins += 1;
    expect(env.Base.save()).toBe(true);
    expect(await env.commands.commitAttempt(baseAttempt.attempt)).toMatchObject({ ok: false, code: 'STALE_REVISION' });
    expect(env.Base.data.eggBattles).toBe(0);

    env = await resetAndReload({ initialize: true });
    const oldRunAttempt = await prepare(env);
    activeSlot = 2;
    expect(await env.commands.commitAttempt(oldRunAttempt.attempt)).toMatchObject({ ok: false, code: 'STALE_SLOT' });
    activeSlot = slotId;
    expect(env.RunStorage.remove(slotId)).toBe(true);
    env.RunStorage.readForLoad(slotId);
    expect(env.RunStorage.write(slotId, { turn: 0, layerIdx: 0, trackPos: 1, visited: {} })).toBe(true);
    expect(await env.commands.commitAttempt(oldRunAttempt.attempt)).toMatchObject({ ok: false, code: 'STALE_RUN' });
    expect(env.Base.data.eggBattles).toBe(0);
  });

  it('Web Locks不可用时拒绝且不更改存档', async () => {
    const before = rawSnapshot();
    const env = await loadCommands({ lockManager: null });
    const result = await env.commands.readReceipt({ slotId, node: { ...node } });
    expect(result).toMatchObject({ ok: false, code: 'CAPABILITY_UNAVAILABLE' });
    expect(rawSnapshot()).toEqual(before);
  });

  it('等待recover期间修改原node/afterRun不改变首次捕获的attempt', async () => {
    const env = await loadCommands();
    let releaseRecovery;
    const delayedRecovery = {
      ...env.recovery,
      recoverSlot: slot => new Promise(resolve => {
        releaseRecovery = async () => resolve(await env.recovery.recoverSlot(slot));
      }),
    };
    const { createBattleSettlementCommands } = await import('../game/src/hub/battle-settlement.commands.js');
    const commands = createBattleSettlementCommands({
      getBase: () => env.Base, getRunStorage: () => env.RunStorage,
      getRecovery: () => delayedRecovery, getActiveSlot: () => activeSlot,
    });
    const mutableNode = { ...node };
    const mutableRun = makeAfterRun(env.RunStorage);
    const mutableInput = { slotId, node: mutableNode, afterRun: mutableRun, elapsedDelta: 3 };
    const pending = commands.createAttempt(mutableInput);
    mutableNode.trackPos = 7;
    mutableRun.visited['0,1'] = 0;
    mutableRun.ownedCards.push({ uid: 'late', card: { id: 'late', name: '迟到写入' } });
    mutableRun.rngState.loot = 900;
    mutableInput.elapsedDelta = 80;
    await releaseRecovery();
    const created = await pending;
    expect(created.ok).toBe(true);
    if (!created.ok || created.replay) throw new Error('expected a new attempt');
    expect(created.attempt.payload.trackPos).toBe(1);
    expect(created.attempt.afterRun.visited['0,1']).toBe(1);
    expect(created.attempt.afterRun.ownedCards.some(card => card.uid === 'late')).toBe(false);
    expect(created.attempt.afterRun.rngState.loot).toBe(13);
    expect(created.attempt.afterBase.stats.playSeconds).toBe(43);
    expect(Object.isFrozen(created.attempt)).toBe(true);
    expect(Object.isFrozen(created.attempt.afterRun.ownedCards)).toBe(true);
  });

  it('真实battle settle在journal待恢复时允许同attempt重试，不重复投奖励', async () => {
    vi.resetModules();
    delete window.SDT.Base;
    priorLocks = Object.getOwnPropertyDescriptor(navigator, 'locks');
    Object.defineProperty(navigator, 'locks', { configurable: true, value: locks });
    const env = await loadCommands({ initialize: true });
    env.Base.data.characters.wu = { lv: 1, xp: 0 };
    expect(env.Base.save()).toBe(true);
    const killsBefore = env.Base.data.stats.kills;
    const bossKillsBefore = [...env.Base.data.stats.bossKills];
    settleHarness.game = {
      state: 'idle', runActive: true, nestActive: false, seed: 'battle-run-seed',
      layerIdx: 0, trackPos: 1, ownedCards: [], visited: {}, discoveredPairs: new Set(),
      elapsed: 20, elapsedSynced: 17, hp: 20, maxHp: 30, myClass: 'wu',
      grantCard: vi.fn(card => settleHarness.game.ownedCards.push({ uid: 'boss-reward', card })),
      addItem: vi.fn(),
    };
    settleHarness.actions = {};
    settleHarness.chestDone = null;
    settleHarness.randomCalls = 0;
    settleHarness.payload = vi.fn(() => {
      const persisted = env.RunStorage.read(slotId);
      return {
        ...persisted,
        seed: settleHarness.game.seed,
        layerIdx: settleHarness.game.layerIdx,
        trackPos: settleHarness.game.trackPos,
        visited: { ...settleHarness.game.visited },
        ownedCards: [...settleHarness.game.ownedCards],
        rngState: { loot: 12 + settleHarness.randomCalls, map: 41 },
        elapsed: settleHarness.game.elapsed,
        savedAt: 1_790_000_000_000,
      };
    });
    vi.doMock('../game/src/run/game.session.js', () => ({
      game: settleHarness.game,
      createRunSavePayload: () => settleHarness.payload(),
      getActiveSlot: () => slotId,
      saveGame: vi.fn(() => true),
      setBattleSettlementPending: vi.fn(), clearBattleSettlementPending: vi.fn(),
      doDeath: vi.fn(), cardStacks: vi.fn(), newUid: vi.fn(), safeUsed: vi.fn(), usedSlots: vi.fn(),
    }));
    vi.doMock('../game/src/run/game.run.js', () => ({ showRunTransition: vi.fn(async () => {}) }));
    vi.doMock('../game/src/core/event-bus.js', () => ({ on: vi.fn() }));
    vi.doMock('../game/src/core/random.js', () => ({ Random: { random: vi.fn(() => { settleHarness.randomCalls++; return 0; }) } }));
    vi.doMock('../game/src/core/shared.js', () => ({ esc: String }));
    vi.doMock('../game/src/hub/game.bag.bridge.js', () => ({ bagSlots: { closeBackpack: vi.fn(), pocketAdd: vi.fn() } }));
    window.SDT.UI = {
      _bagCloseHook: null, hideOverlay: vi.fn(), showOverlay: vi.fn(), refresh: vi.fn(), log: vi.fn(),
      act: (name, action) => { settleHarness.actions[name] = action; },
    };
    window.SDT.Base.data.ammoTaught = true;
    window.SDT.Cards = {
      all: () => [{ id: 'legendary', name: '传说奖励', rarity: '传说' }],
      isRandomObtainable: () => true,
    };
    window.SDT.Meta = { track: vi.fn(), xpMultiplier: () => 1, publishBattleProgress: vi.fn() };
    let extraReward = null;
    window.SDT.Chests = {
      restore:vi.fn((_game, saved, done) => { extraReward = { saved, done }; return true; }),
      rollDrops: vi.fn(() => [{ kind: 'boss' }]), dropText: () => '首脑宝箱',
      open: vi.fn((_game, _drops, done) => { settleHarness.chestDone = done; }),
    };

    const { bindBagMixins } = await import('../game/src/hub/game.bag.settle.js');
    bindBagMixins();
    const opts = { isBoss: true, foeNames: ['首脑', '随行敌人'] };
    await settleHarness.game.onBattleEnd(opts, [], true, []);
    expect(settleHarness.chestDone).toBeTypeOf('function');

    expect(await settleHarness.chestDone()).toBe(false);
    expect(extraReward).not.toBeNull();
    expect(settleHarness.game.grantCard).not.toHaveBeenCalled();
    extraReward.saved.current.cards.forEach(card => settleHarness.game.grantCard(card));
    const failRunWrite = failStorageMethod('setItem', runKey);
    expect(await extraReward.done()).toBe(false);
    failRunWrite.mockRestore();
    expect(env.RunStorage.readIdentity(slotId)).toMatchObject({ ok: false, code: 'RECOVERY_REQUIRED' });
    expect(JSON.parse(localStorage.getItem(baseKey)).eggBattles).toBe(1);
    expect(env.Base.data.stats.kills).toBe(killsBefore);
    expect(env.Base.data.stats.bossKills).toEqual(bossKillsBefore);
    expect(env.Base.data.characters.wu).toEqual({ lv: 1, xp: 0 });
    expect(window.SDT.Meta.track).not.toHaveBeenCalled();
    expect(window.SDT.Meta.publishBattleProgress).not.toHaveBeenCalled();
    expect(JSON.parse(localStorage.getItem(runKey)).visited['0,1']).toBeUndefined();

    expect(await settleHarness.actions.battleSettleRetry()).toBe(true);
    expect(env.RunStorage.readIdentity(slotId).ok).toBe(true);
    expect(env.RunStorage.read(slotId)).toMatchObject({ visited: { '0,1': 1 }, ownedCards: [{ uid: 'boss-reward', card: { id: 'legendary' } }], rngState: { loot: 13, map: 41 } });
    expect(env.Base.data.eggBattles).toBe(1);
    expect(env.Base.data.stats.kills).toBe(killsBefore + 2);
    expect(env.Base.data.stats.bossKills).toEqual([...bossKillsBefore, '首脑']);
    expect(env.Base.data.characters.wu).toEqual({ lv: 1, xp: 46 });
    expect(window.SDT.Meta.track).not.toHaveBeenCalled();
    expect(window.SDT.Meta.publishBattleProgress).toHaveBeenCalledTimes(1);
    expect(window.SDT.Meta.publishBattleProgress).toHaveBeenCalledWith([]);
    expect(settleHarness.game.grantCard).toHaveBeenCalledTimes(1);
    expect(settleHarness.randomCalls).toBe(1);
    expect(settleHarness.payload).toHaveBeenCalledTimes(1);
    expect(window.SDT.Chests.rollDrops).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem(journalKey)).toBeNull();
  });
});
