import { installImmediateWebLocks } from './helpers/web-locks.js';
installImmediateWebLocks();
import { beforeEach, describe, expect, it, vi } from 'vitest';

window.SDT = {
  Icons: { img: () => '', TYPE_ART: {} }, Sound: { music: vi.fn(), sfx: vi.fn(), setDucked: vi.fn() },
  FX: { feedback: vi.fn() }, UI: { log: vi.fn(), refresh: vi.fn(), showOverlay: vi.fn(), hideOverlay: vi.fn(), act: vi.fn() },
  MAP: { rules: { playerMaxHp: 50, playerAtk: 4, fireHeal: 5, battleEnergy: 2, battleHandMax: 10,
    bossDeckSize: 10, starterSha: 0, battleStartDraw: 5, battleTurnDraw: 1, diceSides: 6,
    stashStart: 20, stashMax: 100, stashUpgradeSlots: 5 } },
};
await import('../game/src/cards/cards.js');
await import('../game/src/hub/base.js');
await import('../game/src/hub/meta.js');
const { RunStorage } = await import('../game/src/hub/game.storage.js');
const { createRecoveryCommands } = await import('../game/src/hub/recovery.commands.js');
const { createExtractionCommands, validatePendingExtraction } = await import('../game/src/hub/extraction.commands.js');
const Base = window.SDT.Base;

const lockManager = { request: (_name, _options, callback) => callback() };
const card = { id: 'extract-recovery-card', name: '撤离测试卡', type: '法术', rarity: '古朴' };

async function harness(slot = 2, failpoint = null) {
  localStorage.clear();
  RunStorage.remove(slot); // clear the module's optimistic write baseline between repeated-slot fixtures
  Base.use(slot);
  (await Base.reset(slot));
  expect(RunStorage.write(slot, { seed: 'extract-test', rngState: { seed: 'extract-test', streams: { pocket: 0 } },
    hp: 20, maxHp: 30, inventory: [], ownedCards: [], myClass: 'wu' })).toBe(true);
  const game = {
    pendingExtraction: null, runActive: true, extractionPending: false, mode: 'normal',
    usedPocket: [{ card: { id: 'pocket-test', name: '口袋测试卡', rarity: '稀有' }, count: 2 }],
    inventory: [{ name: '木材', count: 3 }, { name: '口粮', count: 2 }],
    ownedCards: [{ card }, { card }], myClass: 'wu', turn: 4, coins: 12, bossKilled: false,
  };
  let activeSlot = slot;
  let pendingFailure = failpoint;
  let revisionRace = null;
  const recovery = createRecoveryCommands({ storage: localStorage, lockManager, baseApi: Base, runStore: RunStorage,
    failpoint: phase => { if (pendingFailure === phase) { pendingFailure = null; throw new Error('simulated interruption'); } } });
  const runRace = async boundary => {
    if (revisionRace?.boundary !== boundary || --revisionRace.remaining > 0) return;
    const callback = revisionRace.callback;
    revisionRace = null;
    await callback();
  };
  const recoveryPort = { ...recovery,
    recoverSlot: async slotId => { const result = await recovery.recoverSlot(slotId); await runRace('recovery'); return result; },
    commitBaseAndRun: async (...args) => { await runRace('commit'); return recovery.commitBaseAndRun(...args); },
  };
  const deps = {
    getActiveSlot: () => activeSlot, runStore: RunStorage, baseApi: Base, recovery: recoveryPort, game,
    random: () => 0.1, makePocketStream: state => {
      let offset = Number(state?.streams?.pocket) || 0;
      return { random: () => (offset++ % 2) ? 0.9 : 0.1,
        snapshot: () => ({ seed: state?.seed || 'extract-test', streams: { pocket: offset } }) };
    }, restoreRandom: vi.fn(), characterFor: () => ({ id: 'wu' }),
    addXpToProgress: (progress, amount) => ({ after: { lv: progress.lv, xp: progress.xp + amount } }), xpMultiplier: () => 1,
  };
  return { slot, game, recovery, commands: createExtractionCommands(deps), newCommands: () => createExtractionCommands(deps),
    setActiveSlot: value => { activeSlot = value; }, failNextAt: phase => { pendingFailure = phase; },
    beforeNextCommit: (callback, boundary = 'recovery') => { revisionRace = { callback, boundary, remaining: boundary === 'recovery' ? 2 : 1 }; } };
}

beforeEach(() => localStorage.clear());

describe('撤离整理 paired recovery', () => {
  it.each(['begin', 'stash', 'finish'].flatMap(command =>
    ['after-journal', 'after-base', 'after-run', 'before-cleanup'].map(phase => [command, phase])))(
    '%s 在 %s 中断后保留日志恢复令牌，同一实例重试只结算一次', async (command, phase) => {
      const h = await harness(2);
      if (command !== 'begin') expect((await h.commands.begin()).ok).toBe(true);
      const runId = h.game.pendingExtraction?.runId;
      const invoke = () => command === 'begin' ? h.commands.begin()
        : command === 'stash' ? h.commands.updateCards([{ name: card.name, count: 1 }], runId, 2)
          : h.commands.finish(runId, 2);
      h.failNextAt(phase);
      expect(await invoke()).toMatchObject({ ok: false, code: 'SAVE_FAILED_PENDING_RECOVERY' });
      expect(localStorage.getItem('sdt-tx-v1-slot2')).not.toBeNull();
      expect((await invoke()).ok).toBe(true);
      expect(localStorage.getItem('sdt-tx-v1-slot2')).toBeNull();
      expect(Base.data.wood).toBe(3);
      expect(Base.data.rations).toBe(2);
      expect(Base.data.characters.wu.xp).toBe(26);
      expect(Base.data.stats.extracts).toBe(1);
      expect(Base.data.pocket.find(stack => stack.card.id === 'pocket-test').count).toBe(1);
      if (command === 'stash') expect(Base.data.stash.find(stack => stack.card.id === card.id).count).toBe(1);
      if (command === 'finish') expect(RunStorage.read(2)).toBeNull();
    });

  it.each(['after-base', 'after-run'])('完成整理在 %s 中断后，入库不能续放完成令牌，原完成按钮仍可恢复', async phase => {
    const h = await harness(2);
    const started = await h.commands.begin();
    const runId = started.value.runId;
    h.failNextAt(phase);
    expect(await h.commands.finish(runId, 2)).toMatchObject({ ok: false, code: 'SAVE_FAILED_PENDING_RECOVERY' });
    const baseRaw = localStorage.getItem(Base.SLOT_KEY(2));
    const runRaw = localStorage.getItem(RunStorage.key(2));
    const journalRaw = localStorage.getItem('sdt-tx-v1-slot2');

    expect(await h.commands.updateCards([{ name: card.name, count: 1 }], runId, 2))
      .toMatchObject({ ok: false, code: 'REQUEST_PENDING', retryable: true });
    expect(localStorage.getItem(Base.SLOT_KEY(2))).toBe(baseRaw);
    expect(localStorage.getItem(RunStorage.key(2))).toBe(runRaw);
    expect(localStorage.getItem('sdt-tx-v1-slot2')).toBe(journalRaw);
    expect(h.game.pendingExtraction.runId).toBe(runId);

    const finished = await h.commands.finish(runId, 2);
    expect(finished).toMatchObject({ ok: true, replayed: true });
    expect(finished.value.output.receipt.losses.lostCount).toBe(2);
    expect(h.game.pendingExtraction).toBeNull();
    expect(RunStorage.read(2)).toBeNull();
  });

  it('入库中断后完成整理仍被阻止，重试入库只提交原选择一次', async () => {
    const h = await harness(2);
    const started = await h.commands.begin();
    const runId = started.value.runId;
    h.failNextAt('after-base');
    expect(await h.commands.updateCards([{ name: card.name, count: 1 }], runId, 2))
      .toMatchObject({ ok: false, code: 'SAVE_FAILED_PENDING_RECOVERY' });
    expect(await h.commands.finish(runId, 2)).toMatchObject({ ok: false, code: 'REQUEST_PENDING' });
    expect(await h.commands.updateCards([{ name: card.name, count: 1 }], runId, 2))
      .toMatchObject({ ok: true, count: 1, replayed: true });
    expect(Base.data.stash.find(stack => stack.card.id === card.id).count).toBe(1);
    expect((await h.commands.finish(runId, 2)).ok).toBe(true);
  });

  it.each(['begin', 'stash', 'finish'].flatMap(command => ['recovery', 'commit'].map(boundary => [command, boundary])))(
    '%s 的日志前修订冲突（%s 边界）可用同一实例重新准备，不覆盖并发存档', async (command, boundary) => {
    const h = await harness(2);
    if (command !== 'begin') expect((await h.commands.begin()).ok).toBe(true);
    const runId = h.game.pendingExtraction?.runId;
    const invoke = () => command === 'begin' ? h.commands.begin()
      : command === 'stash' ? h.commands.updateCards([{ name: card.name, count: 1 }], runId, 2)
        : h.commands.finish(runId, 2);
    const beforeRun = localStorage.getItem(RunStorage.key(2));
    let advancedBase;
    h.beforeNextCommit(async () => {
      Base.data.coins += 7;
      expect((await Base.save())).toBe(true);
      advancedBase = localStorage.getItem(Base.SLOT_KEY(2));
    }, boundary);

    expect(await invoke()).toMatchObject({ ok: false, code: 'STALE_REVISION', retryable: true });
    expect(localStorage.getItem('sdt-tx-v1-slot2')).toBeNull();
    expect(localStorage.getItem(Base.SLOT_KEY(2))).toBe(advancedBase);
    expect(localStorage.getItem(RunStorage.key(2))).toBe(beforeRun);
    expect((await invoke()).ok).toBe(true);
    expect(Base.data.coins).toBe(7);
    expect(Base.data.wood).toBe(3);
    expect(Base.data.stats.extracts).toBe(1);
    if (command === 'stash') {
      expect(Base.data.stash.find(stack => stack.card.id === card.id).count).toBe(1);
      expect((await h.commands.finish(runId, 2)).ok).toBe(true);
    }
    if (command === 'finish') expect(RunStorage.read(2)).toBeNull();
  });

  const invalidSelections = [
    ['小数 0.5', [{ name: card.name, count: 0.5 }]], ['小数 1.5', [{ name: card.name, count: 1.5 }]],
    ['NaN', [{ name: card.name, count: NaN }]], ['Infinity', [{ name: card.name, count: Infinity }]],
    ['负数', [{ name: card.name, count: -1 }]], ['零', [{ name: card.name, count: 0 }]],
    ['数字字符串', [{ name: card.name, count: '1' }]], ['布尔计数', [{ name: card.name, count: true }]],
    ['超出安全整数', [{ name: card.name, count: Number.MAX_SAFE_INTEGER + 1 }]],
    ['缺少计数', [{ name: card.name }]], ['缺少名称', [{ count: 1 }]], ['空名称', [{ name: '', count: 1 }]],
    ['null 项', [null]], ['数组项', [[card.name, 1]]], ['非数组', { name: card.name, count: 1 }],
    ['null 容器', null], ['缺少容器', undefined],
    ['字符串容器', card.name], ['稀疏数组', Array(1)],
    ['空白名称', [{ name: '  ', count: 1 }]], ['对象计数', [{ name: card.name, count: {} }]],
    ['混合有效无效项', [{ name: card.name, count: 1 }, { name: card.name, count: 0.5 }]],
  ];
  it.each(invalidSelections.flatMap(([label, selection]) => [false, true].map(ephemeral => [label, ephemeral, selection])))(
    '拒绝 %s（内存局=%s），基地/对局/修订/日志与整理快照均不变', async (_label, ephemeral, selection) => {
    const h = await harness(2);
    if (ephemeral) h.setActiveSlot(null);
    const started = await h.commands.begin();
    h.game.pendingExtraction = started.value;
    const beforeStorage = Object.fromEntries(Object.keys(localStorage).map(key => [key, localStorage.getItem(key)]));
    const beforeBase = structuredClone(Base.data);
    const beforePending = structuredClone(h.game.pendingExtraction);
    expect(await h.commands.updateCards(selection, started.value.runId, ephemeral ? null : 2))
      .toMatchObject({ ok: false, code: 'INVALID_ARGUMENT' });
    expect(Object.fromEntries(Object.keys(localStorage).map(key => [key, localStorage.getItem(key)]))).toEqual(beforeStorage);
    expect(Base.data).toEqual(beforeBase);
    expect(h.game.pendingExtraction).toEqual(beforePending);
  });

  it('重复整数选择按剩余张数和仓容收敛，接受的整理快照保持有效', async () => {
    const h = await harness(2);
    Base.data.stash = [{ card: { name: '已有卡' }, count: 19 }];
    expect((await Base.save())).toBe(true);
    const started = await h.commands.begin();
    const saved = await h.commands.updateCards([{ name: card.name, count: 1 }, { name: card.name, count: 2 }], started.value.runId, 2);
    expect(saved).toMatchObject({ ok: true, count: 1 });
    expect(saved.value.remainingCards[0].count).toBe(1);
    expect(validatePendingExtraction(saved.value)).toEqual({ ok: true });
    const baseRaw = localStorage.getItem(Base.SLOT_KEY(2));
    const runRaw = localStorage.getItem(RunStorage.key(2));
    expect(await h.commands.updateCards([], started.value.runId, 2)).toMatchObject({ ok: true, unchanged: true });
    expect(localStorage.getItem(Base.SLOT_KEY(2))).toBe(baseRaw);
    expect(localStorage.getItem(RunStorage.key(2))).toBe(runRaw);
  });

  it.each([18, 19].flatMap(stashed => [false, true].map(ephemeral => [stashed, ephemeral])))(
    '符文与卡牌共占仓容（已有卡=%s，内存局=%s），命令自身限制入库量', async (stashed, ephemeral) => {
      const h = await harness(2);
      Base.data.stash = [{ card: { name: '已有卡' }, count: stashed }];
      Base.data.runes = [{ name: '占位符文' }];
      expect((await Base.save())).toBe(true);
      if (ephemeral) h.setActiveSlot(null);
      const started = await h.commands.begin();
      h.game.pendingExtraction = started.value;
      const beforeBase = localStorage.getItem(Base.SLOT_KEY(2));
      const beforeRun = localStorage.getItem(RunStorage.key(2));
      const saved = await h.commands.updateCards([{ name: card.name, count: 2 }], started.value.runId, ephemeral ? null : 2);
      expect(saved.ok).toBe(true);
      expect(saved.count || 0).toBe(19 - stashed);
      expect(saved.value.remainingCards[0].count).toBe(stashed - 17);
      expect(validatePendingExtraction(saved.value)).toEqual({ ok: true });
      expect(Base.stashUsed()).toBe(20);
      if (stashed === 19 || ephemeral) {
        expect(localStorage.getItem(Base.SLOT_KEY(2))).toBe(beforeBase);
        expect(localStorage.getItem(RunStorage.key(2))).toBe(beforeRun);
      }
    });

  it('基地内存仓容过期时，以当前提交快照的符文数量限制直接入库请求', async () => {
    const h = await harness(2);
    Base.data.stash = [{ card: { name: '已有卡' }, count: 18 }];
    expect((await Base.save())).toBe(true);
    const started = await h.commands.begin();
    const externalBase = JSON.parse(localStorage.getItem(Base.SLOT_KEY(2)));
    externalBase.runes = [{ name: '另一标签页新符文' }];
    externalBase._m01.revision++;
    localStorage.setItem(Base.SLOT_KEY(2), JSON.stringify(externalBase));
    expect(Base.stashRoom()).toBe(2); // 整理页仍看见旧内存；持久态实际只有一格
    const saved = await h.commands.updateCards([{ name: card.name, count: 2 }], started.value.runId, 2);
    expect(saved).toMatchObject({ ok: true, count: 1 });
    expect(Base.stashUsed()).toBe(20);
    expect(saved.value.remainingCards[0].count).toBe(1);
    expect(Base.data.runes).toEqual(externalBase.runes);
  });

  it('begin中断后重试沿用冻结口袋结果和资源，不重复奖励', async () => {
    const h = await harness(2, 'after-base');
    h.game.elapsed = 30;
    h.game.elapsedSynced = 10;
    const first = await h.commands.begin();
    expect(first.ok).toBe(false);
    const retry = await h.commands.begin();
    expect(retry.ok).toBe(true);
    expect(retry.value.keptPocket.reduce((n, s) => n + s.count, 0)).toBe(1);
    const base = JSON.parse(localStorage.getItem(Base.SLOT_KEY(2)));
    expect(base.wood).toBe(3);
    expect(base.rations).toBe(2);
    expect(base.stats.playSeconds).toBe(20);
    expect(RunStorage.read(2).elapsed).toBe(30);
    expect(base.characters.wu.xp).toBe(26);
    expect(base.pocket.find(stack => stack.card.id === 'pocket-test').count).toBe(1);
  });

  it('入库和完成在事务写入后中断，receipt重放不重复卡牌或资源', async () => {
    const h = await harness(3);
    const started = await h.commands.begin();
    expect(started.ok).toBe(true);
    const selected = [{ name: card.name, count: 1 }];
    const beforeCount = JSON.parse(localStorage.getItem(Base.SLOT_KEY(3))).stash
      .find(stack => stack.card.id === card.id)?.count || 0;
    h.failNextAt('after-base');
    const interrupted = await h.commands.updateCards(selected, started.value.runId, 3);
    expect(interrupted.ok).toBe(false);
    const sameSelection = await h.commands.updateCards(selected, started.value.runId, 3);
    expect(sameSelection.ok).toBe(true);
    expect(JSON.parse(localStorage.getItem(Base.SLOT_KEY(3))).stash.find(stack => stack.card.id === card.id).count).toBe(beforeCount + 1);
    h.failNextAt('after-run');
    const finishInterrupted = await h.commands.finish(started.value.runId, 3);
    expect(finishInterrupted.ok).toBe(false);
    const completed = await h.commands.finish(started.value.runId, 3);
    expect(completed.ok).toBe(true);
    expect(RunStorage.read(3)).toBeNull();
  });

  it('整理中刷新后可分两次入库、完成并重新建立下一局，资源和卡牌只结算一次', async () => {
    const h = await harness(1);
    const started = await h.commands.begin();
    expect(started.ok).toBe(true);
    const runId = started.value.runId;
    const selected = [{ name: card.name, count: 1 }];
    expect((await h.commands.updateCards(selected, runId, 1)).count).toBe(1);

    // 模拟页面刷新后仅从持久运行档恢复整理页，不沿用内存中的 pending 对象。
    h.game.pendingExtraction = structuredClone(RunStorage.read(1).pendingExtraction);
    expect(h.game.pendingExtraction.remainingCards[0].count).toBe(1);
    expect((await h.newCommands().updateCards(selected, runId, 1)).count).toBe(1);
    expect(h.game.pendingExtraction.remainingCards).toEqual([]);
    expect((await h.newCommands().finish(runId, 1)).ok).toBe(true);

    const base = JSON.parse(localStorage.getItem(Base.SLOT_KEY(1)));
    expect(base.stash.find(stack => stack.card.id === card.id).count).toBe(2);
    expect(base.wood).toBe(3);
    expect(base.rations).toBe(2);
    expect(base.stats.extracts).toBe(1);
    expect(RunStorage.read(1)).toBeNull();

    expect(RunStorage.write(1, { seed: 'next-run', hp: 30, maxHp: 30 })).toBe(true);
    expect(RunStorage.readIdentity(1).value.runId).not.toBe(runId);
  });

  it('slot=null只修改内存，即使Base当前指向旧档也不写localStorage', async () => {
    const h = await harness(4);
    const before = localStorage.getItem(Base.SLOT_KEY(4));
    Base.use(4);
    h.setActiveSlot(null);
    const commands = createExtractionCommands({
      getActiveSlot: () => null, runStore: RunStorage, baseApi: Base, recovery: h.recovery, game: h.game,
      random: () => 0.1, characterFor: () => ({ id: 'wu' }), addXpToProgress: (p, n) => ({ after: { lv: p.lv, xp: p.xp + n } }),
    });
    const started = await commands.begin();
    expect(started.ok).toBe(true);
    await commands.updateCards([{ name: card.name, count: 1 }], 'ephemeral', null);
    await commands.finish('ephemeral', null);
    expect(localStorage.getItem(Base.SLOT_KEY(4))).toBe(before);
    expect(localStorage.getItem(RunStorage.key(4))).not.toBeNull();
  });

  it('等待恢复期间同槽替换runId，拒绝把旧局奖励应用到新局', async () => {
    const h = await harness(5);
    const oldRunId = RunStorage.readIdentity(5).value.runId;
    let release;
    const delayedRecovery = { ...h.recovery, recoverSlot: () => new Promise(resolve => { release = resolve; }) };
    const commands = createExtractionCommands({
      getActiveSlot: () => 5, runStore: RunStorage, baseApi: Base, recovery: delayedRecovery, game: h.game,
      random: () => 0.1, characterFor: () => ({ id: 'wu' }),
      addXpToProgress: (progress, amount) => ({ after: { lv: progress.lv, xp: progress.xp + amount } }), xpMultiplier: () => 1,
    });
    const pending = commands.begin();
    RunStorage.remove(5);
    RunStorage.write(5, { seed: 'replacement-run', hp: 30, maxHp: 30, inventory: [], ownedCards: [], myClass: 'wu' });
    release({ ok: true, value: null });
    const result = await pending;
    expect(result.ok).toBe(false);
    expect(result.code).toBe('STALE_RUN');
    expect(RunStorage.readIdentity(5).value.runId).not.toBe(oldRunId);
    expect(JSON.parse(localStorage.getItem(Base.SLOT_KEY(5))).wood).toBe(0);
  });
});
