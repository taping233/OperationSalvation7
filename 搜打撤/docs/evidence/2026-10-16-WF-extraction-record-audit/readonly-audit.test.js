// Read-only audit of current production modules. All writes below are isolated jsdom localStorage.
// No historic browser save is read, imported, or rewritten. The official UI export supplies card names/prices only.
import { afterAll, describe, it, expect, vi } from 'vitest';
import { readFileSync, writeFileSync } from 'node:fs';

window.SDT = {
  Icons: { img: () => '', TYPE_ART: {} }, Sound: { music: vi.fn(), sfx: vi.fn(), setDucked: vi.fn() },
  FX: { feedback: vi.fn() }, UI: { log: vi.fn(), refresh: vi.fn(), showOverlay: vi.fn(), hideOverlay: vi.fn(), act: vi.fn() },
  MAP: { rules: { playerMaxHp: 50, playerAtk: 4, fireHeal: 5, battleEnergy: 2, battleHandMax: 10,
    bossDeckSize: 10, starterSha: 3, battleStartDraw: 5, battleTurnDraw: 1, diceSides: 6,
    stashStart: 25, stashMax: 100, stashUpgradeSlots: 5 } },
};
await import('../../../game/src/cards/cards.js');
await import('../../../game/src/hub/base.js');
const { RunStorage } = await import('../../../game/src/hub/game.storage.js');
const { createRecoveryCommands } = await import('../../../game/src/hub/recovery.commands.js');
const { createExtractionCommands } = await import('../../../game/src/hub/extraction.commands.js');
const recorder = await import('../../../game/src/agent/agent.recorder.js');
const Base = window.SDT.Base;
const dir = 'docs/evidence/2026-10-16-WF-extraction-record-audit';
const official = JSON.parse(readFileSync('docs/evidence/2026-10-16-WF-cloud-play-eight-hours/run-data-ui-export-20261016-0028.json', 'utf8'));
const observed = official.runs.find(r => r.runId === 'run-2-b8abe3ed-028c-44e6-be83-bbeb0fad055d');
const count = stacks => stacks.reduce((sum, s) => sum + s.count, 0);
const value = stacks => stacks.reduce((sum, s) => sum + s.count * window.SDT.Cards.sellPrice(s.card), 0);
const reports = [];
afterAll(() => writeFileSync(`${dir}/readonly-audit-result.json`, JSON.stringify({ generatedAt: new Date().toISOString(),
  provenance: 'Synthetic isolated jsdom storage; actual production command, transaction, recorder and export modules',
  historicRecordUntouched: true, productionSourceChanged: false, reports }, null, 2) + '\n'));

async function harness() {
  localStorage.clear();
  recorder.resetRunCounters();
  Base.use(2); Base.reset(2);
  // Synthetic preexisting warehouse ownership. It must never appear in this run's selected cards.
  Base.data.stash = [{ card: { id: 'audit-prior', name: '审计往局持有', rarity: '古朴' }, count: 2 }];
  expect(Base.save()).toBe(true);
  const ownedCards = observed.carried.flatMap((row, i) => Array.from({ length: row.count }, (_, j) => ({
    uid: `audit-${i}-${j}`,
    card: { id: row.name === '初始攻击' ? 'starter-attack' : `audit-${row.name}`,
      name: row.name, rarity: row.rarity, type: row.type, value: row.value },
  })));
  // Only terminal public facts are reconstructed, not a real saved game.
  const game = { pendingExtraction: null, runActive: true, extractionPending: false, mode: 'standard',
    bossKilled: true, layerIdx: 3, turn: 55, coins: 15, elapsed: 8337, hp: 10, maxHp: 40,
    explored: Object.fromEntries(Array.from({ length: 40 }, (_, i) => [`audit-${i}`, 1])),
    usedPocket: [], inventory: [], ownedCards, myClass: '法师', characterId: 'baita' };
  window.SDT.game = game;
  RunStorage.write(2, { ...game, seed: 'audit-only', rngState: { seed: 1, streams: {} } });
  let pendingFailure = null;
  const recovery = createRecoveryCommands({ storage: localStorage,
    lockManager: { request: (_name, _options, callback) => callback() }, baseApi: Base, runStore: RunStorage,
    failpoint: phase => { if (phase === pendingFailure) { pendingFailure = null; throw new Error('audit-only interruption'); } } });
  const deps = { getActiveSlot: () => 2, runStore: RunStorage, baseApi: Base, recovery, game, random: () => 0,
    addXpToProgress: (progress, amount) => ({ after: { lv: progress.lv || 1, xp: (progress.xp || 0) + amount } }) };
  const commands = createExtractionCommands(deps);
  const started = await commands.begin();
  expect(started.ok).toBe(true);
  expect(count(started.value.remainingCards)).toBe(26);
  expect(started.value.remainingCards.some(s => s.card.name === '初始攻击')).toBe(false);
  return { game, commands, recovery, deps, runId: started.value.runId, failNextAt: phase => { pendingFailure = phase; } };
}

async function smart(h) {
  let room = Base.stashRoom();
  const ordered = h.game.pendingExtraction.remainingCards.slice()
    .sort((a, b) => window.SDT.Cards.sellPrice(b.card) - window.SDT.Cards.sellPrice(a.card));
  const selections = [];
  for (const s of ordered) {
    if (room <= 0) break;
    const take = Math.min(s.count, room);
    selections.push({ name: s.card.name, count: take }); room -= take;
  }
  const result = await h.commands.updateCards(selections, h.runId, 2);
  expect(result.ok).toBe(true); expect(result.count).toBe(23);
  const selected = Base.data.stash.filter(s => s.card.id !== 'audit-prior');
  expect(count(selected)).toBe(23); expect(value(selected)).toBe(77);
  const remaining = h.game.pendingExtraction.remainingCards;
  expect(remaining.map(s => [s.card.name, s.count])).toEqual([['急速跑鞋', 1], ['冰刺', 1], ['迷之匣', 1]]);
  return { selected: structuredClone(selected), remaining: structuredClone(remaining) };
}

describe('read-only extraction-record audit of real modules', () => {
  it('reproduces correct persistent 23/77 settlement but incorrect current recorder 29/84', async () => {
    const h = await harness();
    const { selected, remaining } = await smart(h);
    const pendingBefore = structuredClone(h.game.pendingExtraction);
    const result = await h.commands.finish(h.runId, 2);
    expect(result.ok).toBe(true);
    const receipt = result.value.output.receipt;
    expect(receipt.netTake.cardsStashed).toBe(23); expect(receipt.losses.lostCount).toBe(3);
    expect(h.game.pendingExtraction).toBeNull(); expect(h.game.runActive).toBe(false);
    expect(RunStorage.read(2)).toBeNull(); expect(h.game.ownedCards).toHaveLength(29);
    const base = JSON.parse(localStorage.getItem(Base.SLOT_KEY(2)));
    const storedKey = Object.keys(base._m01.requests).find(k => k.startsWith('extractFinish:'));
    expect(base._m01.requests[storedKey].result.value.output.receipt).toEqual(receipt);
    // Exact current showExtractDone call contract, without invoking any browser UI or altering its source.
    const entry = recorder.recordRun(receipt.outcome, {
      receipt, carriedCards: h.game.ownedCards.map(o => ({ card: o.card, count: 1 })),
    });
    expect(count(entry.carried)).toBe(29); expect(entry.carriedValue).toBe(84);
    const exported = JSON.parse(recorder.exportJSON());
    expect(exported.runs[0]).toEqual(JSON.parse(JSON.stringify(entry)));
    expect(exported.runs[0].carriedValue).toBe(84);
    const csv = recorder.exportCSV().split('\n').map(line => line.split(','));
    expect(csv[1][csv[0].indexOf('carriedValue')]).toBe('84');
    expect(csv[1][csv[0].indexOf('stashedCards')]).toBe('23');
    reports.push({ case: 'persistent-clear-current', netCardsStashed: receipt.netTake.cardsStashed,
      expectedCards: count(selected), expectedValue: value(selected), recordedCards: count(entry.carried),
      recordedValue: entry.carriedValue, lostCards: remaining.map(s => ({ name: s.card.name, count: s.count })),
      pendingClearedBeforeRecord: h.game.pendingExtraction === null, runSaveRemovedBeforeRecord: RunStorage.read(2) === null,
      receiptHasSelectedCardSnapshot: Object.hasOwn(receipt, 'savedCards'),
      selectedCards: selected.map(s => ({ name: s.card.name, count: s.count, price: window.SDT.Cards.sellPrice(s.card) })),
      organizingSnapshotFields: Object.keys(pendingBefore) });
  });
  it('reconstructs same final 23/77 after organizing reload with fresh command instance', async () => {
    const h = await harness(); await smart(h);
    const savedRun = RunStorage.read(2);
    h.game.pendingExtraction = structuredClone(savedRun.pendingExtraction);
    const reloaded = createExtractionCommands(h.deps);
    const result = await reloaded.finish(h.runId, 2);
    expect(result.ok).toBe(true); expect(result.value.output.receipt.netTake.cardsStashed).toBe(23);
    expect(h.game.pendingExtraction).toBeNull();
    reports.push({ case: 'organizing-reload', netCardsStashed: result.value.output.receipt.netTake.cardsStashed,
      actualSavedCards: count(Base.data.stash.filter(s => s.card.id !== 'audit-prior')),
      actualSavedValue: value(Base.data.stash.filter(s => s.card.id !== 'audit-prior')) });
  });
  it('keeps 12 total wins independent from existing final-ten detail cap and round values', () => {
    localStorage.clear(); recorder.resetRunCounters();
    for (let i = 1; i <= 12; i++) recorder.noteBattle(true, { foe: `audit-${i}`, round: i === 12 ? 7 : 1, mode: 'win' });
    const entry = recorder.recordRun('clear');
    expect(entry.battles).toEqual({ fought: 12, won: 12 });
    expect(entry.lastBattles).toHaveLength(10); expect(entry.lastBattles[0].foe).toBe('audit-3');
    expect(entry.lastBattles.at(-1).round).toBe(7);
    reports.push({ case: 'existing-battle-cap', totals: entry.battles, details: entry.lastBattles.length,
      finalRound: entry.lastBattles.at(-1).round });
  });
  it('replays the exact receipt after finish transaction interruption without double deposit', async () => {
    const h = await harness(); await smart(h);
    h.failNextAt('after-run');
    expect((await h.commands.finish(h.runId, 2)).ok).toBe(false);
    const completed = await h.commands.finish(h.runId, 2);
    expect(completed.ok).toBe(true); expect(completed.replayed).toBe(true);
    expect(completed.value.output.receipt.netTake.cardsStashed).toBe(23);
    expect(Base.stashUsed()).toBe(25);
    expect(value(Base.data.stash.filter(s => s.card.id !== 'audit-prior'))).toBe(77);
    reports.push({ case: 'finish-interruption-replay', replayed: completed.replayed,
      netCardsStashed: completed.value.output.receipt.netTake.cardsStashed, warehouseUsed: Base.stashUsed(),
      actualSavedValue: value(Base.data.stash.filter(s => s.card.id !== 'audit-prior')) });
  });
});
