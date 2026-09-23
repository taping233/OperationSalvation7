import { beforeEach, describe, expect, it, vi } from 'vitest';

window.SDT = {
  Icons: { img: () => '', TYPE_ART: {} }, Sound: { music: vi.fn(), sfx: vi.fn(), setDucked: vi.fn() },
  FX: { feedback: vi.fn() }, UI: { log: vi.fn(), refresh: vi.fn(), showOverlay: vi.fn(), hideOverlay: vi.fn(), act: vi.fn() },
  MAP: { rules: { playerMaxHp: 50, playerAtk: 4, fireHeal: 5, battleEnergy: 2, battleHandMax: 10,
    bossDeckSize: 10, starterSha: 0, battleStartDraw: 5, battleTurnDraw: 1, diceSides: 6,
    stashStart: 20, stashMax: 100, stashUpgradeSlots: 5 } },
};
await import('../game/src/cards.js');
await import('../game/src/base.js');
await import('../game/src/meta.js');
const { RunStorage } = await import('../game/src/game.storage.js');
const { createRecoveryCommands } = await import('../game/src/recovery.commands.js');
const { createExtractionCommands } = await import('../game/src/extraction.commands.js');
const Base = window.SDT.Base;

const lockManager = { request: (_name, _options, callback) => callback() };
const card = { id: 'extract-recovery-card', name: '撤离测试卡', type: '法术', rarity: '古朴' };

async function harness(slot = 2, failpoint = null) {
  localStorage.clear();
  Base.use(slot);
  Base.reset(slot);
  RunStorage.write(slot, { seed: 'extract-test', rngState: { seed: 'extract-test', streams: { pocket: 0 } },
    hp: 20, maxHp: 30, inventory: [], ownedCards: [], myClass: 'wu' });
  const game = {
    pendingExtraction: null, runActive: true, extractionPending: false, mode: 'normal',
    usedPocket: [{ card: { id: 'pocket-test', name: '口袋测试卡', rarity: '稀有' }, count: 2 }],
    inventory: [{ name: '木材', count: 3 }, { name: '口粮', count: 2 }],
    ownedCards: [{ card }, { card }], myClass: 'wu', turn: 4, coins: 12, bossKilled: false,
  };
  let activeSlot = slot;
  let pendingFailure = failpoint;
  const recovery = createRecoveryCommands({ storage: localStorage, lockManager, baseApi: Base, runStore: RunStorage,
    failpoint: phase => { if (pendingFailure === phase) { pendingFailure = null; throw new Error('simulated interruption'); } } });
  const deps = {
    getActiveSlot: () => activeSlot, runStore: RunStorage, baseApi: Base, recovery, game,
    random: () => 0.1, makePocketStream: state => {
      let offset = Number(state?.streams?.pocket) || 0;
      return { random: () => (offset++ % 2) ? 0.9 : 0.1,
        snapshot: () => ({ seed: state?.seed || 'extract-test', streams: { pocket: offset } }) };
    }, restoreRandom: vi.fn(), characterFor: () => ({ id: 'wu' }),
    addXpToProgress: (progress, amount) => ({ after: { lv: progress.lv, xp: progress.xp + amount } }), xpMultiplier: () => 1,
  };
  return { slot, game, recovery, commands: createExtractionCommands(deps), newCommands: () => createExtractionCommands(deps),
    setActiveSlot: value => { activeSlot = value; }, failNextAt: phase => { pendingFailure = phase; } };
}

beforeEach(() => localStorage.clear());

describe('撤离整理 paired recovery', () => {
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
