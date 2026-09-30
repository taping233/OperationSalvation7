import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../game/src/run/lab.ending.js', () => ({ playLabEnding: callback => callback() }));

const canvasContext = new Proxy({}, { get: (_target, key) => key === 'canvas' ? { width: 300, height: 150 } : () => canvasContext, set: () => true });
window.HTMLCanvasElement.prototype.getContext = () => canvasContext;
document.body.innerHTML = '<canvas id="game"></canvas><div id="title"></div><div id="exitScr"></div>';
window.SDT = { Icons: { img: () => '', TYPE_ART: {} }, Sound: { music() {}, sfx() {}, setDucked() {} }, MAP: { rules: { playerMaxHp: 50, playerAtk: 4, battleEnergy: 2, battleStartDraw: 5, battleTurnDraw: 1, diceSides: 6 }, items: { rations: { name: '口粮' }, wood: { name: '木材' } } } };
Object.defineProperty(navigator, 'locks', {
  configurable: true,
  value: { request: (_name, _options, callback) => Promise.resolve(callback()) },
});

await import('../game/src/cards/cards.js');
await import('../game/src/ui/ui.js');
await import('../game/src/hub/base.js');
const session = await import('../game/src/run/game.session.js');
await import('../game/src/run/game.nest.js');
const Base = window.SDT.Base;
const RunStorage = (await import('../game/src/hub/game.storage.js')).RunStorage;
const Nest = window.SDT.Nest;
const actions = new Map();
let activeSlot = 3;
let committedFinishes = 0;

beforeAll(() => {
  const UI = window.SDT.UI;
  UI.init = () => {};
  UI.log = vi.fn();
  UI.showOverlay = () => { actions.clear(); };
  UI.hideOverlay = vi.fn();
  UI.refresh = vi.fn();
  UI.act = (id, callback) => { if (callback) actions.set(id, callback); };
  UI.registerHelp = vi.fn();
  session.configureGameRuntime({ log: UI.log });
  window.SDT.Meta = { checkUnlocks: () => { committedFinishes++; }, setXpMul() {}, track() {} };
  window.SDT.Cards.ensureSha();
  window.SDT.Cards.ensureStarters();
});

beforeEach(() => {
  localStorage.clear();
  actions.clear();
  committedFinishes = 0;
  activeSlot = 3;
  session._set_active_slot(activeSlot);
  Base.use(activeSlot);
  Base.data.nestUnlocked = true;
  Base.data.runes = [{ name: '已有符文', rarity: '古朴', attrs: ['火'] }];
  Base.data.stats.labTotalScore = 100;
  Base.data.stats.labBestScore = 80;
  Base.data.stats.labRuns = 2;
  Base.data.stats.playSeconds = 40;
  expect(Base.save()).toBe(true);

  RunStorage.readForLoad(activeSlot);
  expect(RunStorage.write(activeSlot, {
    nestActive: true, nestPos: 11, nestRunes: [{ name: '带回符文', rarity: '稀有', attrs: ['水'] }],
    nestEquipped: [], nestBossName: '测试所主', seed: 'nest-transaction-run', elapsed: 50,
  })).toBe(true);
  const game = session.game;
  Object.assign(game, {
    state: 'modal', runActive: true, nestActive: true, seed: 'nest-transaction-run',
    nestPos: 11, nestRunes: [{ name: '带回符文', rarity: '稀有', attrs: ['水'] }],
    nestEquipped: [], nestBossName: '测试所主', nestBossDown: false, nestKills: 0,
    nestTargetedBox: 0, cardBox: [], coins: 5, hp: 50, maxHp: 50,
    elapsed: 50, elapsedSynced: 40, turn: 1,
  });
});

afterEach(() => vi.restoreAllMocks());

describe('research-lab extraction transaction', () => {
  it('keeps the real Run when a pair phase is interrupted, then recovers and retries exactly once', async () => {
    const runKey = RunStorage.key(activeSlot);
    const baseKey = Base.SLOT_KEY(activeSlot);
    const journalKey = `sdt-tx-v1-slot${activeSlot}`;
    const originalSetItem = Storage.prototype.setItem;
    let journalWrites = 0;
    const interruption = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (key, value) {
      if (key === journalKey && ++journalWrites === 2) throw new Error('simulated interruption after Base write');
      return originalSetItem.call(this, key, value);
    });

    const first = Nest.doNestExtract();
    const duplicate = Nest.doNestExtract();
    await Promise.all([first, duplicate]);

    expect(interruption).toHaveBeenCalled();
    expect(localStorage.getItem(journalKey)).not.toBeNull();
    expect(localStorage.getItem(runKey)).not.toBeNull();
    expect(Base._readForCommit(activeSlot).runes).toHaveLength(2);
    expect(actions.has('nestExtractRetry')).toBe(true);
    expect(session.game.nestActive).toBe(true);

    interruption.mockRestore();
    await actions.get('nestExtractRetry')();

    const committedBase = JSON.parse(localStorage.getItem(baseKey));
    expect(committedBase.runes.map(rune => rune.name)).toEqual(['已有符文', '带回符文']);
    expect(committedBase.stats).toMatchObject({ labTotalScore: 210, labBestScore: 110, labRuns: 3, playSeconds: 50 });
    expect(localStorage.getItem(runKey)).toBeNull();
    expect(localStorage.getItem(journalKey)).toBeNull();
    expect(session.game.nestActive).toBe(false);
    expect(committedFinishes).toBe(1);

    // A late duplicate callback must reuse the committed receipt and never apply rewards again.
    await Nest.doNestExtract();
    expect(JSON.parse(localStorage.getItem(baseKey)).runes).toHaveLength(2);
    expect(JSON.parse(localStorage.getItem(baseKey)).stats.labTotalScore).toBe(210);
    expect(committedFinishes).toBe(1);
  });

  it('a fresh command instance recovers afterRun:null and replays the persisted receipt', async () => {
    const { createRecoveryCommands } = await import('../game/src/hub/recovery.commands.js');
    const { createNestSettlementCommands } = await import('../game/src/hub/nest-settlement.commands.js');
    const recovery = createRecoveryCommands({
      storage: localStorage, baseApi: Base, runStore: RunStorage,
      lockManager: { request: (_name, _options, callback) => Promise.resolve(callback()) },
      failpoint: phase => { if (phase === 'after-base') throw new Error('simulated process interruption'); },
    });
    const ports = {
      getActiveSlot: () => activeSlot,
      getBase: () => Base,
      getRunStorage: () => RunStorage,
      getRecovery: () => recovery,
    };
    const input = { slotId: activeSlot, runId: RunStorage.readIdentity(activeSlot).value.runId,
      runes: [{ name: '恢复符文', rarity: '稀有', attrs: ['草'] }], score: 55, elapsedDelta: 10 };
    const firstCommand = createNestSettlementCommands(ports);
    expect((await firstCommand.settle(input)).code).toBe('SAVE_FAILED_PENDING_RECOVERY');
    expect(RunStorage.has(activeSlot)).toBe(true);

    const freshRecovery = createRecoveryCommands({
      storage: localStorage, baseApi: Base, runStore: RunStorage,
      lockManager: { request: (_name, _options, callback) => Promise.resolve(callback()) },
    });
    const freshCommand = createNestSettlementCommands({ ...ports, getRecovery: () => freshRecovery });
    const result = await freshCommand.settle(input);

    expect(result).toMatchObject({ ok: true, value: { replay: true } });
    expect(RunStorage.has(activeSlot)).toBe(false);
    expect(Base._readForCommit(activeSlot).runes.map(rune => rune.name)).toEqual(['已有符文', '恢复符文']);
    expect(Base._readForCommit(activeSlot).stats).toMatchObject({ labTotalScore: 155, labRuns: 3, playSeconds: 50 });
  });
});
