import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';

const ctx = new Proxy({}, { get: () => () => ctx, set: () => true });
window.HTMLCanvasElement.prototype.getContext = () => ctx;
document.body.innerHTML = '<canvas id="game"></canvas><div id="title"></div><div id="exitScr"></div><div id="ovBody"></div>';
window.SDT = {
  Icons: { img: () => '', TYPE_ART: {} }, Sound: { music() {}, sfx() {}, setDucked() {} }, FX: { feedback() {} },
  MAP: { rules: { playerMaxHp: 50, playerAtk: 4, fireHeal: 5, battleEnergy: 2, battleHandMax: 10, bossDeckSize: 10, starterSha: 0, battleStartDraw: 5, battleTurnDraw: 1, diceSides: 6 }, items: { rations: { name: '口粮' }, wood: { name: '木材' } } },
};
await import('../game/src/cards/cards.js');
await import('../game/src/ui/ui.js');
await import('../game/src/hub/base.js');
const session = await import('../game/src/run/game.session.js');
const { RunStorage } = await import('../game/src/hub/game.storage.js');
const { Random } = await import('../game/src/core/random.js');
const { createGameMenuController } = await import('../game/src/ui/game.menu.js');
const { Base, UI } = window.SDT;
const handlers = {};
Object.assign(UI, {
  log: vi.fn(), refresh() {}, clearLog() {}, hideOverlay() {}, hideScreen() {}, showScreen() {},
  showOverlay(_title, html) { document.getElementById('ovBody').innerHTML = html; },
  act(name, fn) { handlers[name] = fn; }, registerHelp() {}, helpBtn() { return ''; },
});
window.SDT.Meta = { setXpMul() {}, track() {}, ACHIEVEMENTS: [], isUnlocked: () => false };
window.SDT.Nest = { renderNestMap() { session.game.state = 'idle'; } };
window.SDT.Battle = { restore: vi.fn(() => true) };

function writeRun(changes = {}) {
  const value = { version: 2, seed: 'e5-session', nestActive: true, ...changes };
  const raw = JSON.stringify(value);
  localStorage.setItem(RunStorage.key(1), raw);
  return raw;
}

function ordinary(changes = {}) {
  return writeRun({ nestActive: false, mapSeed: 'e5-session', generatorVersion: 3, layoutVersion: 9,
    layerIdx: 0, trackPos: 0, myClass: 'warrior', ...changes });
}

function blockKey(key) {
  const set = Storage.prototype.setItem;
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (k, value) {
    if (k === key) throw new DOMException('test quota', 'QuotaExceededError');
    return set.call(this, k, value);
  });
}

function trackRunWrites(failFirst = false) {
  const set = Storage.prototype.setItem, writes = vi.fn();
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (key, value) {
    if (key === RunStorage.key(1)) {
      writes(key, value);
      if (failFirst && writes.mock.calls.length === 1) throw new DOMException('test quota', 'QuotaExceededError');
    }
    return set.call(this, key, value);
  });
  return writes;
}

function trackBaseWrites(slot = 1) {
  const set = Storage.prototype.setItem, writes = vi.fn();
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (key, value) {
    if (key === Base.SLOT_KEY(slot)) writes(key, value);
    return set.call(this, key, value);
  });
  return writes;
}

beforeEach(() => {
  localStorage.clear();
  for (let slot = 1; slot <= 5; slot++) RunStorage.remove(slot);
  session._set_active_slot(1);
  Base.use(1);
  Object.assign(session.game, { pendingExtraction: null, extractionPending: null, terminalPending: null,
    battleActive: false, runActive: false, nestActive: false, state: 'title', elapsed: 0, elapsedSynced: 0 });
  session.configureGameRuntime({ openClassChoice: vi.fn() });
  UI.log.mockClear();
  window.SDT.Battle.restore.mockReset().mockReturnValue(true);
});
afterEach(() => vi.restoreAllMocks());

describe('E5 real session recovery and persistence results', () => {
  it('accepts a minimal historical nest with defaults and unknown extension without saving', () => {
    const raw = writeRun({ version: undefined, extraFutureMetadata: { untouched: true } });
    const baseSave = vi.spyOn(Base, 'save'), runWrite = trackRunWrites();
    const result = session.loadGame(1);
    expect(result).toEqual({ ok: true, value: true, persistence: { status: 'not_attempted', attempts: [] } });
    expect(session.game.ownedCards).toEqual([]);
    expect(session.game.discoveredPairs).toEqual(new Set());
    expect(baseSave).not.toHaveBeenCalled(); expect(runWrite).not.toHaveBeenCalled();
    expect(localStorage.getItem(RunStorage.key(1))).toBe(raw);
  });

  it('includes the existing enterLayer save for a real recoverable old 3/9 map', () => {
    ordinary();
    const runWrite = trackRunWrites();
    expect(session.loadGame(1).persistence).toEqual({ status: 'succeeded', attempts: [
      { target: 'run', reason: 'save_game', ok: true },
    ] });
    expect(runWrite).toHaveBeenCalledTimes(1);
    expect(JSON.parse(localStorage.getItem(RunStorage.key(1))).mapSnapshot).toBeTruthy();
  });

  it('records the two existing Base saves without adding writes', () => {
    writeRun({ elapsed: 7 });
    vi.spyOn(window.SDT.Cards, 'applyAbilityRename').mockReturnValue(true);
    const baseWrite = trackBaseWrites();
    expect(session.loadGame(1).persistence).toEqual({ status: 'succeeded', attempts: [
      { target: 'base', reason: 'card_rename', ok: true },
      { target: 'base', reason: 'elapsed_migration', ok: true },
    ] });
    expect(baseWrite).toHaveBeenCalledTimes(2);
  });

  it('reports real Base write failure while preserving usable restored gameplay', () => {
    ordinary({ elapsed: 9 });
    blockKey('sdt-base-v2-slot1');
    const result = session.loadGame(1);
    expect(result.ok).toBe(true);
    expect(result.persistence).toEqual({ status: 'failed', attempts: [
      { target: 'base', reason: 'elapsed_migration', ok: false, code: 'BASE_SAVE_FAILED' },
      { target: 'run', reason: 'save_game', ok: true },
    ] });
    expect(UI.log.mock.calls.flat().join(' ')).toContain('对局已恢复，但恢复后的部分进度未保存');
  });

  it('reports real run write failure without hiding the already loaded run', () => {
    const raw = ordinary();
    blockKey(RunStorage.key(1));
    const result = session.loadGame(1);
    expect(result.ok).toBe(true);
    expect(result.persistence.status).toBe('failed');
    expect(result.persistence.attempts).toEqual([expect.objectContaining({ target: 'run', ok: false })]);
    expect(localStorage.getItem(RunStorage.key(1))).toBe(raw);
  });

  it('a later battle recovery write cannot erase an earlier failed write', () => {
    ordinary({ battle: { legacy: true } });
    const runWrite = trackRunWrites(true);
    const result = session.loadGame(1);
    expect(result.ok).toBe(true);
    expect(result.persistence.status).toBe('failed');
    expect(result.persistence.attempts.map(a => a.ok)).toEqual([false, true]);
    expect(runWrite).toHaveBeenCalledTimes(2);
    expect(window.SDT.Battle.restore).toHaveBeenCalledTimes(1);
  });

  it('includes battle-triggered syncPlayTime and run save without duplicate calls', () => {
    writeRun({ battle: { legacy: true } });
    window.SDT.Battle.restore.mockImplementation(() => { session.game.elapsed = 4; return true; });
    const baseWrite = trackBaseWrites(), runWrite = trackRunWrites();
    expect(session.loadGame(1).persistence).toEqual({ status: 'succeeded', attempts: [
      { target: 'base', reason: 'play_time_sync', ok: true },
      { target: 'run', reason: 'save_game', ok: true },
    ] });
    expect(baseWrite).toHaveBeenCalledTimes(1); expect(runWrite).toHaveBeenCalledTimes(1);
  });

  it('does not claim a run write when the existing saveGame guard rejects it', () => {
    writeRun({ battle: { legacy: true } });
    window.SDT.Battle.restore.mockImplementation(() => { session.game.extractionPending = true; return true; });
    const runWrite = trackRunWrites();
    expect(session.loadGame(1).persistence).toEqual({ status: 'not_attempted', attempts: [] });
    expect(runWrite).not.toHaveBeenCalled();
  });

  it.each([{ ownedCards: [null] }, { discovered: {} }, { usedPocket: [{ card: null }] }])(
    'rejects dangerous structure %j before Random, map, Base and game mutation', fields => {
      const raw = ordinary(fields);
      const random = Random.snapshot(), layers = session.game.layerData, cards = session.game.ownedCards;
      const baseUse = vi.spyOn(Base, 'use'), baseSave = vi.spyOn(Base, 'save'), runWrite = trackRunWrites();
      expect(session.loadGame(1)).toMatchObject({ ok: false, code: 'INVALID_RUN_STRUCTURE', preserveRun: true,
        persistence: { status: 'not_attempted', attempts: [] } });
      expect(Random.snapshot()).toEqual(random); expect(session.game.layerData).toBe(layers);
      expect(session.game.ownedCards).toBe(cards); expect(session.game.state).toBe('title');
      expect(baseUse).not.toHaveBeenCalled(); expect(baseSave).not.toHaveBeenCalled(); expect(runWrite).not.toHaveBeenCalled();
      expect(localStorage.getItem(RunStorage.key(1))).toBe(raw);
    });

  it('does not promise a backup when unreadable data cannot be backed up', () => {
    localStorage.setItem(RunStorage.key(1), '{bad json');
    blockKey(RunStorage.corruptKey(1));
    expect(session.loadGame(1)).toMatchObject({ ok: false, persistence: { status: 'not_attempted' } });
    expect(UI.log.mock.calls.flat().join(' ')).toContain('原档已保留');
    expect(UI.log.mock.calls.flat().join(' ')).not.toContain('已备份');
    expect(localStorage.getItem(RunStorage.key(1))).toBe('{bad json');
  });

  it('does not mutate completed or rejected results on later ordinary saves', () => {
    writeRun();
    const completed = session.loadGame(1);
    expect(session.saveGame()).toBe(true);
    expect(completed.persistence).toEqual({ status: 'not_attempted', attempts: [] });
    writeRun({ discovered: {} });
    const rejected = session.loadGame(1);
    expect(session.saveGame()).toBe(false);
    expect(RunStorage.lastWriteIssue(1)).toBe('STALE_SLOT');
    expect(rejected.persistence).toEqual({ status: 'not_attempted', attempts: [] });
  });

  it.each([
    [{ ownedCards: [null] }, 'INVALID_RUN_STRUCTURE'],
    [{ mapSnapshot: { snapshotVersion: 999 } }, 'UNSUPPORTED_MAP_SNAPSHOT'],
    [{ pendingExtraction: { phase: 'invalid' } }, 'INVALID_EXTRACTION'],
  ])('refused external replacement %j cannot authorize the old game to overwrite it', (changes, code) => {
    ordinary();
    expect(session.loadGame(1).ok).toBe(true);
    const replacement = { ...JSON.parse(localStorage.getItem(RunStorage.key(1))), ...changes };
    replacement._r2.revision++;
    const raw = JSON.stringify(replacement);
    localStorage.setItem(RunStorage.key(1), raw);
    expect(session.loadGame(1)).toMatchObject({ ok: false, code,
      persistence: { status: 'not_attempted', attempts: [] } });
    expect(session.saveGame()).toBe(false);
    expect(RunStorage.lastWriteIssue(1)).toBe('STALE_SLOT');
    expect(localStorage.getItem(RunStorage.key(1))).toBe(raw);
  });

  it('menu preflight of a valid replacement stays read-only until actual load adopts it', () => {
    ordinary();
    expect(session.loadGame(1).ok).toBe(true);
    const replacement = JSON.parse(localStorage.getItem(RunStorage.key(1)));
    replacement.hp = 17; replacement._r2.revision++;
    const raw = JSON.stringify(replacement);
    localStorage.setItem(RunStorage.key(1), raw);
    expect(session.preflightRunMap(1).ok).toBe(true);
    expect(session.saveGame()).toBe(false);
    expect(RunStorage.lastWriteIssue(1)).toBe('STALE_SLOT');
    expect(localStorage.getItem(RunStorage.key(1))).toBe(raw);
    expect(session.loadGame(1).ok).toBe(true);
    expect(session.game.hp).toBe(17);
    expect(session.saveGame()).toBe(true);
  });

  it.each([
    [2, 'read-error', 'STORAGE_READ_FAILED'],
    [3, 'read-error', 'STORAGE_READ_FAILED'],
    [3, 'replace', 'STALE_SLOT'],
  ])('rejects storage change at read %i (%s) before restore side effects', (readNumber, fault, code) => {
    ordinary();
    expect(session.loadGame(1).ok).toBe(true);
    const replacement = JSON.parse(localStorage.getItem(RunStorage.key(1)));
    replacement.hp = 19; replacement._r2.revision++;
    let raw = JSON.stringify(replacement);
    localStorage.setItem(RunStorage.key(1), raw);
    const random = Random.snapshot(), layers = session.game.layerData, hp = session.game.hp;
    const baseUse = vi.spyOn(Base, 'use'), baseSave = vi.spyOn(Base, 'save');
    const get = Storage.prototype.getItem;
    let reads = 0;
    const faultRead = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(function (key) {
      if (key === RunStorage.key(1) && ++reads === readNumber) {
        if (fault === 'read-error') throw new Error('test read failure');
        replacement.hp = 21; replacement._r2.revision++;
        raw = JSON.stringify(replacement);
        localStorage.setItem(key, raw);
      }
      return get.call(this, key);
    });
    expect(session.loadGame(1)).toMatchObject({ ok: false, code,
      persistence: { status: 'not_attempted', attempts: [] } });
    faultRead.mockRestore();
    expect(baseUse).not.toHaveBeenCalled(); expect(baseSave).not.toHaveBeenCalled();
    expect(Random.snapshot()).toEqual(random); expect(session.game.layerData).toBe(layers);
    expect(session.game.hp).toBe(hp);
    expect(session.saveGame()).toBe(false);
    expect(RunStorage.lastWriteIssue(1)).toBe('STALE_SLOT');
    expect(localStorage.getItem(RunStorage.key(1))).toBe(raw);
  });

  it('restores the enclosing collection after a nested load throws', () => {
    ordinary({ battle: { legacy: true } });
    localStorage.setItem(RunStorage.key(2), JSON.stringify({ version: 2, seed: 'throwing-nest', nestActive: true }));
    vi.spyOn(window.SDT.Nest, 'renderNestMap').mockImplementationOnce(() => { throw new Error('test render failure'); });
    window.SDT.Battle.restore.mockImplementation(() => {
      expect(() => session.loadGame(2)).toThrow('test render failure');
      // The outer load still owns collection after the nested exception.
      expect(session.saveGame()).toBe(true);
      return true;
    });
    const result = session.loadGame(1);
    expect(result.persistence.status).toBe('succeeded');
    expect(result.persistence.attempts).toHaveLength(3);
    expect(session.saveGame()).toBe(true);
    expect(result.persistence.attempts).toHaveLength(3);
    writeRun();
    expect(session.loadGame(1).persistence).toEqual({ status: 'not_attempted', attempts: [] });
  });
});

describe('E5 real menu with real session entry', () => {
  function menu() {
    return createGameMenuController({ SDT: window.SDT, UI, game: session.game,
      runtime: { resize() {}, showRunTransition: () => Object.assign(Promise.resolve(true), { isCurrent: () => true }) },
      SLOT_COUNT: 1, esc: String, readSlot: RunStorage.read, loadGame: session.loadGame,
      clearSlot() {}, saveGame: session.saveGame, clearAllSlots() {}, getActiveSlot: session.getActiveSlot,
      setActiveSlot: session._set_active_slot, preflightRunMap: session.preflightRunMap,
      RunStorage, ensureBattleReady: async () => {} });
  }

  it('retains successful enterSlot credentials and warns on real load persistence failure', async () => {
    ordinary({ elapsed: 11 });
    blockKey('sdt-base-v2-slot1');
    menu().startNewGame();
    const result = await handlers.enterSlot({ slot: 1 });
    expect(result).toMatchObject({ ok: true, commandContext: { slot: 1, runActive: true, nestActive: false } });
    expect(result.commandContext.runToken).toBe(session.game.discoveredPairs);
    expect(UI.log.mock.calls.flat().join(' ')).toContain('对局已恢复，但恢复后的部分进度未保存');
  });

  it('preflights the real unsafe run before launch or Base.use', async () => {
    const raw = ordinary({ ownedCards: [null], discovered: {} });
    menu().startNewGame();
    const baseUse = vi.spyOn(Base, 'use'), baseSave = vi.spyOn(Base, 'save');
    expect(await handlers.enterSlot({ slot: 1 })).toBe(false);
    expect(baseUse).not.toHaveBeenCalled(); expect(baseSave).not.toHaveBeenCalled();
    expect(document.getElementById('slotRestoreError').textContent).toContain('原档已保留');
    expect(localStorage.getItem(RunStorage.key(1))).toBe(raw);
  });
});
