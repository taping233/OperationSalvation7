import { installImmediateWebLocks } from './helpers/web-locks.js';
installImmediateWebLocks();
// Real two-key transaction, recovery, recorder and export modules; isolated jsdom storage only.
import { beforeEach, describe, expect, it, vi } from 'vitest';
window.SDT = {
  Icons: { img: () => '', TYPE_ART: {} }, Sound: { music: vi.fn(), sfx: vi.fn(), setDucked: vi.fn() },
  FX: { feedback: vi.fn() }, UI: { log: vi.fn(), refresh: vi.fn(), showOverlay: vi.fn(), hideOverlay: vi.fn(), act: vi.fn() },
  MAP: { rules: { playerMaxHp: 50, playerAtk: 4, fireHeal: 5, battleEnergy: 2, battleHandMax: 10,
    bossDeckSize: 10, starterSha: 3, battleStartDraw: 5, battleTurnDraw: 1, diceSides: 6,
    stashStart: 25, stashMax: 100, stashUpgradeSlots: 5 } },
};
await import('../game/src/cards/cards.js');
await import('../game/src/hub/base.js');
const { RunStorage } = await import('../game/src/hub/game.storage.js');
const { createRecoveryCommands } = await import('../game/src/hub/recovery.commands.js');
const { createExtractionCommands } = await import('../game/src/hub/extraction.commands.js');
const recorder = await import('../game/src/agent/agent.recorder.js');
const Base = window.SDT.Base;
const card = (id, name, value = 2, rarity = '古朴') => ({ id, name, value, rarity, type: '法术' });
const initial = card('starter-attack', '初始攻击', 1, '初始');
const count = stacks => stacks.reduce((n, s) => n + s.count, 0);
const totalValue = stacks => stacks.reduce((n, s) => n + s.count * window.SDT.Cards.sellPrice(s.card), 0);

async function harness({ owned, stash = [], clear = true } = {}) {
  localStorage.clear();
  RunStorage.remove(2);
  recorder.resetRunCounters();
  Base.use(2); (await Base.reset(2));
  Base.data.stash = structuredClone(stash);
  expect((await Base.save())).toBe(true);
  const game = { pendingExtraction: null, runActive: true, extractionPending: false, mode: 'standard',
    bossKilled: clear, layerIdx: clear ? 3 : 1, turn: 55, coins: 15, elapsed: 8337, hp: 10,
    usedPocket: [], inventory: [], ownedCards: owned.map((c, i) => ({ uid: `saved-audit-${i}`, card: structuredClone(c) })),
    myClass: '法师', characterId: 'baita' };
  window.SDT.game = game;
  expect(RunStorage.write(2, { ...game, seed: 'saved-card-fixture', rngState: { seed: 1, streams: {} } })).toBe(true);
  let pendingFailure = null;
  const recovery = createRecoveryCommands({ storage: localStorage,
    lockManager: { request: (_name, _options, callback) => callback() }, baseApi: Base, runStore: RunStorage,
    failpoint: phase => { if (pendingFailure === phase) { pendingFailure = null; throw new Error('fixture interruption'); } } });
  const deps = { getActiveSlot: () => 2, runStore: RunStorage, baseApi: Base, recovery, game, random: () => 0,
    addXpToProgress: (p, a) => ({ after: { lv: p.lv || 1, xp: (p.xp || 0) + a } }) };
  const commands = createExtractionCommands(deps);
  const started = await commands.begin(); expect(started.ok).toBe(true);
  return { game, commands, runId: started.value.runId, newCommands: () => createExtractionCommands(deps),
    failNextAt: phase => { pendingFailure = phase; } };
}

const finish = async (h, commands = h.commands) => {
  const result = await commands.finish(h.runId, 2);
  expect(result.ok).toBe(true);
  const receipt = result.value.output.receipt;
  expect(h.game.pendingExtraction).toBeNull(); expect(RunStorage.read(2)).toBeNull();
  const base = JSON.parse(localStorage.getItem(Base.SLOT_KEY(2)));
  const storedKey = Object.keys(base._m01.requests).find(key => key.startsWith('extractFinish:'));
  expect(base._m01.requests[storedKey].result.value.output.receipt.savedCards).toEqual(receipt.savedCards);
  expect(count(receipt.savedCards)).toBe(receipt.netTake.cardsStashed);
  return receipt;
};
const record = receipt => recorder.recordRun(receipt.outcome, { receipt, savedCards: receipt.savedCards });
beforeEach(() => { recorder.resetRunCounters(); });

describe('final saved-card receipt feeds records without candidate/warehouse contamination', () => {
  it.each([true, false])('clear=%s: groups same-name run variants using actual command semantics, independent of prior same-name warehouse cards', async clear => {
    const first = card('new-a-first', '同名卡', 4, '史诗');
    const variant = card('new-a-variant', '同名卡', 7, '传说');
    const other = card('new-b', '本局乙', 2);
    const h = await harness({ clear, owned: [initial, first, variant, first, other, card('lost', '未选卡', 1)],
      stash: [{ card: card('old-a', '同名卡', 99), count: 2 }] });
    const result = await h.commands.updateCards([{ name: '同名卡', count: 2 }, { name: '本局乙', count: 1 }], h.runId, 2);
    expect(result.count).toBe(3);
    const receipt = await finish(h);
    expect(receipt.outcome).toBe(clear ? 'clear' : 'extract');
    expect(receipt.savedCards).toEqual([{ card: first, count: 2 }, { card: other, count: 1 }]);
    // Existing warehouse stack keeps its original card object; this is not the run's valuation source.
    expect(Base.data.stash.find(s => s.card.name === '同名卡')).toMatchObject({ card: { id: 'old-a' }, count: 4 });
    const entry = record(receipt);
    expect(count(entry.carried)).toBe(3); expect(entry.carriedValue).toBe(10);
    expect(entry.carried.map(c => c.name)).toEqual(['同名卡', '本局乙']);
  });

  it.each([true, false])('clear=%s: explicit zero saved cards never falls back to owned candidates', async clear => {
    const h = await harness({ clear, owned: [initial, card('unselected', '没有入库', 9)] });
    const receipt = await finish(h);
    expect(receipt.savedCards).toEqual([]); expect(receipt.losses.lostCount).toBe(1);
    const entry = record(receipt);
    expect(entry.carried).toEqual([]); expect(entry.carriedValue).toBe(0);
  });

  it('starter-only run has no eligible saved cards', async () => {
    const h = await harness({ owned: [initial, initial, initial] });
    const receipt = await finish(h);
    expect(receipt.savedCards).toEqual([]); expect(receipt.netTake.cardsStashed).toBe(0);
    expect(receipt.losses.lostCount).toBe(0);
  });

  it('organizing reload rebuilds the exact saved snapshot from stored remaining counts', async () => {
    const a = card('reload-a', '刷新甲', 3), b = card('reload-b', '刷新乙', 4);
    const h = await harness({ owned: [initial, a, a, b] });
    expect((await h.commands.updateCards([{ name: a.name, count: 1 }], h.runId, 2)).count).toBe(1);
    const reloadedRun = RunStorage.read(2);
    Object.assign(h.game, structuredClone(reloadedRun));
    const receipt = await finish(h, h.newCommands());
    expect(receipt.savedCards).toEqual([{ card: a, count: 1 }]);
    expect(record(receipt).carriedValue).toBe(3);
  });

  it.each(['after-base', 'after-run'])('finish interruption at %s validates and replays persisted snapshot without duplicate storage', async phase => {
    const a = card('retry-a', '重试甲', 3);
    const h = await harness({ owned: [initial, a, a] });
    await h.commands.updateCards([{ name: a.name, count: 1 }], h.runId, 2);
    h.failNextAt(phase);
    expect((await h.commands.finish(h.runId, 2)).ok).toBe(false);
    const completed = await h.commands.finish(h.runId, 2);
    expect(completed.ok).toBe(true); expect(completed.replayed).toBe(true);
    expect(completed.value.output.receipt.savedCards).toEqual([{ card: a, count: 1 }]);
    expect(Base.data.stash.find(s => s.card.id === a.id).count).toBe(1);
    expect(record(completed.value.output.receipt).carriedValue).toBe(3);
  });

  it('snapshots nested candidate card data before pending cleanup, independent of later mutation', async () => {
    const a = { ...card('nested-a', '盒中卡', 3), stored: [{ card: card('nested-key', '钥匙', 2), count: 1 }] };
    const h = await harness({ owned: [a] });
    await h.commands.updateCards([{ name: a.name, count: 1 }], h.runId, 2);
    const receipt = await finish(h);
    h.game.ownedCards[0].card.stored[0].count = 99;
    expect(receipt.savedCards[0].card.stored[0].count).toBe(1);
  });

  it('reproduces the public 29-candidate/26-eligible/23-stashed example as 77 and preserves existing record content on export', async () => {
    const facts = [['命运钟表',4],['奥术残卷',3],['寻宝图',2],['急速跑鞋',1],['精神药水',3],['精神药水',3],
      ['初始攻击',1],['初始攻击',1],['珍珠盒',3],['沉船宝盒',4],['三把钥匙',6],['骷髅王剑',5],['致命穿刺',2],
      ['挖宝',2],['沉船宝盒',4],['冰刺',1],['法力奔涌',5],['嗜血刃',4],['初始攻击',1],['一把钥匙',2],
      ['神秘召唤',4],['致命穿刺',2],['穿刺',3],['毒箭',2],['迷之匣',2],['挖宝',2],['铜币',3],['员工通行证B',4],['斩杀',5]];
    const owned = facts.map(([name, price]) => name === '初始攻击' ? initial : card(`public-${name}`, name, price));
    const h = await harness({ owned, stash: [{ card: card('prior', '往局卡', 42), count: 2 }] });
    expect(count(h.game.pendingExtraction.remainingCards)).toBe(26);
    let room = Base.stashRoom(); const selections = [];
    for (const s of h.game.pendingExtraction.remainingCards.slice().sort((a,b) => window.SDT.Cards.sellPrice(b.card) - window.SDT.Cards.sellPrice(a.card))) {
      const take = Math.min(s.count, room); if (!take) break;
      selections.push({ name: s.card.name, count: take }); room -= take;
    }
    expect((await h.commands.updateCards(selections, h.runId, 2)).count).toBe(23);
    expect(h.game.pendingExtraction.remainingCards.map(s => s.card.name)).toEqual(['急速跑鞋','冰刺','迷之匣']);
    const receipt = await finish(h);
    expect(count(receipt.savedCards)).toBe(23); expect(totalValue(receipt.savedCards)).toBe(77);
    const old = { id: 'preexisting-unmodified', ts: 1, outcome: 'clear', carried: [{ name: '历史原样', count: 29, value: 84 }], carriedValue: 84 };
    localStorage.setItem('sdt-run-records', JSON.stringify([old]));
    const entry = record(receipt);
    expect(count(entry.carried)).toBe(23); expect(entry.carriedValue).toBe(77);
    const exported = JSON.parse(recorder.exportJSON());
    expect(exported.runs[0]).toEqual(old); expect(exported.runs[1].carriedValue).toBe(77);
    const csv = recorder.exportCSV().split('\n').map(row => row.split(','));
    expect(csv[2][csv[0].indexOf('carriedValue')]).toBe('77');
    expect(csv[2][csv[0].indexOf('stashedCards')]).toBe('23');
  });
});
