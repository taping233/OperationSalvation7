import { installImmediateWebLocks } from './helpers/web-locks.js';
installImmediateWebLocks();
/* SYS-02 结算回执·幂等（2026-10-03）：真实两键事务台架（extraction-recovery.test.js 同款）。
 * 钉死：
 *   ① extractFinish 提交在事务写入后中断，重试经收据重放拿回同一份回执——字段不重复累计，
 *      基地卡牌/口袋/经验只结算一次；
 *   ② 回执随事务收据持久化（base._m01.requests 的 output 位），可在存档里对账；
 *   ③ 整理中刷新、从持久运行档恢复后重建命令实例，finish 重算出的回执与同一输入的预期完全一致。 */
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
const { createExtractionCommands } = await import('../game/src/hub/extraction.commands.js');
const Base = window.SDT.Base;

const lockManager = { request: (_name, _options, callback) => callback() };
const card = { id: 'receipt-card', name: '回执测试卡', type: '法术', rarity: '史诗' };

async function harness(slot = 2, failpoint = null) {
  localStorage.clear();
  Base.use(slot);
  (await Base.reset(slot));
  RunStorage.write(slot, { seed: 'receipt-test', rngState: { seed: 'receipt-test', streams: { pocket: 0 } },
    hp: 20, maxHp: 30, inventory: [], ownedCards: [], myClass: 'wu' });
  const game = {
    pendingExtraction: null, runActive: true, extractionPending: false, mode: 'normal',
    bossKilled: true, layerIdx: 3, turn: 9, coins: 12, elapsed: 123,
    usedPocket: [{ card: { id: 'pocket-card', name: '口袋卡', rarity: '稀有' }, count: 2 }],
    inventory: [{ name: '木材', count: 3 }, { name: '口粮', count: 2 }],
    ownedCards: [{ card }, { card }], myClass: 'wu',
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
        snapshot: () => ({ seed: state?.seed || 'receipt-test', streams: { pocket: offset } }) };
    }, restoreRandom: vi.fn(), characterFor: () => ({ id: 'wu' }),
    addXpToProgress: (progress, amount) => ({ after: { lv: progress.lv, xp: progress.xp + amount } }), xpMultiplier: () => 1,
  };
  return { slot, game, recovery, commands: createExtractionCommands(deps), newCommands: () => createExtractionCommands(deps),
    setActiveSlot: value => { activeSlot = value; }, failNextAt: phase => { pendingFailure = phase; } };
}

// 与终局态输入一一对应的预期回执（两例共用同一输入口径）
const expectedReceipt = {
  version: 1, outcome: 'clear', bossKilled: true, layersReached: 4,
  actions: 8, firstExplore: { moves: 8, xp: 36 },   // 旧档无 explored：回退 turn-1；20+8*2
  growth: {
    version: 1, source: 'extraction', characterId: 'wu', characterName: 'wu', awardedXp: 36, actualXp: 36, overflowXp: 0,
    before: { lv: 1, xp: 0 }, after: { lv: 1, xp: 36 }, levelsGained: 0, maxed: false,
    nextLevelXp: 50, xpToNext: 14, effects: [{ label: '出征生命加成', before: 0, after: 0 }],
  },
  savedCards: [{ card, count: 1 }],
  netTake: { cardsStashed: 1, pocketKept: 1, wood: 3, rations: 2 },
  losses: { lostCount: 1, lostNotable: [{ name: '回执测试卡', rarity: '史诗', count: 1 }], pocketLost: 1 },
  runCoins: 12, durationSec: 123,
};

beforeEach(() => localStorage.clear());

describe('结算回执幂等与持久化', () => {
  it('extractFinish 提交后中断，重试收据重放：回执原样返回、基地不重复累计，回执随收据持久化', async () => {
    const h = await harness(2);
    const started = await h.commands.begin();
    expect(started.ok).toBe(true);
    const runId = started.value.runId;
    const selection = [{ name: card.name, count: 1 }];
    expect((await h.commands.updateCards(selection, runId, 2)).count).toBe(1);

    h.failNextAt('after-run');   // 日志已提交、响应未达——真实的「失败重试」窗口
    const interrupted = await h.commands.finish(runId, 2);
    expect(interrupted.ok).toBe(false);
    const completed = await h.commands.finish(runId, 2);
    expect(completed.ok).toBe(true);
    expect(completed.replayed).toBe(true);
    expect(completed.value.output.receipt).toEqual(expectedReceipt);
    expect(RunStorage.read(2)).toBeNull();   // 对局已收尾

    const base = JSON.parse(localStorage.getItem(Base.SLOT_KEY(2)));
    const requestKey = Object.keys(base._m01.requests).find(k => k.startsWith('extractFinish:'));
    expect(requestKey).toBeTruthy();
    expect(base._m01.requests[requestKey].result.value.output.receipt).toEqual(expectedReceipt);   // 随收据持久化，可对账
    expect(base.stash.find(stack => stack.card.id === card.id).count).toBe(1);   // 入库一次
    expect(base.pocket.find(stack => stack.card.id === 'pocket-card').count).toBe(1);   // 口袋 1/3 掷骰只掷一次
    expect(base.wood).toBe(3);
    expect(base.rations).toBe(2);
    expect(base.characters.wu.xp).toBe(36);   // 首探经验只发一次
  });

  it('整理中刷新：从持久运行档恢复后重建命令，finish 重算回执与同一输入的预期一致', async () => {
    const h = await harness(1);
    const started = await h.commands.begin();
    expect(started.ok).toBe(true);
    const runId = started.value.runId;
    expect((await h.commands.updateCards([{ name: card.name, count: 1 }], runId, 1)).count).toBe(1);

    // 模拟页面刷新：pending 与终局态只从持久化现场恢复，命令实例全量重建
    h.game.pendingExtraction = structuredClone(RunStorage.read(1).pendingExtraction);
    const finished = await h.newCommands().finish(runId, 1);
    expect(finished.ok).toBe(true);
    expect(finished.replayed).toBe(false);
    expect(finished.value.output.receipt).toEqual(expectedReceipt);
    expect(RunStorage.read(1)).toBeNull();
    const base = JSON.parse(localStorage.getItem(Base.SLOT_KEY(1)));
    expect(base.stats.extracts).toBe(1);
    expect(base.stash.find(stack => stack.card.id === card.id).count).toBe(1);
  });
});

it('mixed pocket receipt persists only actual base recovery cards and replays rule-loss details without rerolling', async () => {
  const h = await harness(1);
  h.game.usedPocket = [
    {card:{id:'normal-pocket',name:'普通消耗卡',rarity:'稀有'},count:3},
    {card:{id:'starter-attack',name:'初始攻击',rarity:'初始'},count:2},
    {card:{id:'old-career',name:'旧职业卡',rarity:'职业'},count:4},
  ];
  const started=await h.commands.begin();
  expect(started.ok).toBe(true);
  expect(RunStorage.read(1).rngState.streams.pocket).toBe(9);
  expect(started.value.keptPocket.reduce((n,s)=>n+s.count,0)).toBe(5);
  const baseBefore=JSON.parse(localStorage.getItem(Base.SLOT_KEY(1)));
  expect(baseBefore.pocket).toEqual([{card:{id:'normal-pocket',name:'普通消耗卡',rarity:'稀有'},count:2}]);
  h.failNextAt('after-base');
  expect((await h.commands.finish(started.value.runId,1)).ok).toBe(false);
  const finished=await h.commands.finish(started.value.runId,1);
  expect(finished.ok).toBe(true);
  expect(finished.replayed).toBe(true);
  const receipt=finished.value.output.receipt;
  expect(receipt.netTake.pocketKept).toBe(2);
  expect(receipt.losses).toMatchObject({pocketLost:7,pocketRuleLost:3});
  const after=JSON.parse(localStorage.getItem(Base.SLOT_KEY(1)));
  expect(after.pocket).toEqual(baseBefore.pocket);
  expect(after.stats.extracts).toBe(1);
  const stored=Object.values(after._m01.requests).map(item=>item.result?.value?.output?.receipt).find(Boolean);
  expect(stored).toEqual(receipt);
});
