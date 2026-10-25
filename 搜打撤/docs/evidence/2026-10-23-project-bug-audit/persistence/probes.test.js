import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { RULES } from '../../../../game/src/core/rules.js';
window.SDT ||= {};
Object.assign(window.SDT, { Icons: { img: () => '' }, MAP: { rules: RULES }, UI: { log() {} } });
Object.defineProperty(navigator, 'locks', { configurable: true,
  value: { request: (_name, _options, callback) => Promise.resolve().then(callback) } });
const { Base } = await import('../../../../game/src/hub/base.js');
const { RunStorage } = await import('../../../../game/src/hub/game.storage.js');
const { createSaveArchive } = await import('../../../../game/src/hub/save-archive.js');
const { createRecoveryCommands } = await import('../../../../game/src/hub/recovery.commands.js');
const { createBattleSettlementCommands } = await import('../../../../game/src/hub/battle-settlement.commands.js');
const digest = async text => createHash('sha256').update(text).digest('hex');
const observation = (id, values) => console.log(`AUDIT ${id} ${JSON.stringify(values)}`);
beforeEach(async () => {
  vi.restoreAllMocks(); await Base.flushWrites(); await RunStorage.flushWrites(); localStorage.clear();
  for (let slot = 1; slot <= 5; slot++) await RunStorage.remove(slot);
  Base.use(1); expect(await Base.save()).toBe(true);
});
afterEach(async () => { vi.restoreAllMocks(); await Base.flushWrites(); await RunStorage.flushWrites(); });

it('S1 known: identity primary-key read failures must return a structured error', () => {
  const native = Storage.prototype.getItem;
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(function (key) {
    if (key === RunStorage.key(1)) throw new DOMException('primary unavailable', 'SecurityError');
    return native.call(this, key);
  });
  let result, thrown;
  try { result = RunStorage.readIdentity(1); } catch (error) { thrown = error.name; }
  observation('S1', { result, thrown });
  expect(thrown).toBeUndefined();
  expect(result).toMatchObject({ ok: false, code: 'STORAGE_READ_FAILED' });
});

it('PERSIST-1: importing an empty slot must not resurrect the previous active base', async () => {
  Base.data.coins = 999; Base.data.stash = [{ card: { id: 'old', name: 'old assets' }, count: 7 }];
  expect(await Base.save()).toBe(true);
  const archive = createSaveArchive({ digest });
  const exported = await archive.exportSlot(2); expect(exported.ok).toBe(true);
  const preview = await archive.previewImport(exported.value.text, 1); expect(preview.ok).toBe(true);
  expect(await archive.importSlot(preview.value, { confirm: true })).toEqual({ ok: true });
  expect(localStorage.getItem(Base.SLOT_KEY(1))).toBeNull();
  const memoryAfterImport = { coins: Base.data.coins, stash: structuredClone(Base.data.stash) };
  const saved = await Base.save();
  const durable = JSON.parse(localStorage.getItem(Base.SLOT_KEY(1)) || 'null');
  observation('PERSIST-1', { memoryAfterImport, saved, durableCoins: durable?.coins, durableStash: durable?.stash });
  expect(Base.data.coins).toBe(0); expect(Base.data.stash).toEqual([]);
  expect(durable?.coins || 0).toBe(0); expect(durable?.stash || []).toEqual([]);
});

it('PERSIST-2: a battle settlement must advance the elapsed checkpoint with its charged seconds', async () => {
  expect(await RunStorage.write(1, { layerIdx: 0, trackPos: 1, visited: {}, elapsed: 10,
    elapsedTimeBaseline: 0, ownedCards: [], seed: 'elapsed-audit' })).toBe(true);
  const runId = RunStorage.readIdentity(1).value.runId;
  Base.data.stats.playSeconds = 100;
  Base.data.stats.playTimeCheckpoint = { runId, elapsed: 10 };
  expect(await Base.save()).toBe(true);
  const recovery = createRecoveryCommands({ storage: localStorage, lockManager: navigator.locks, baseApi: Base, runStore: RunStorage });
  const commands = createBattleSettlementCommands({ getBase: () => Base, getRunStorage: () => RunStorage,
    getRecovery: () => recovery, getActiveSlot: () => 1 });
  const node = { layerIdx: 0, trackPos: 1, isBoss: false, encounterId: 'entry:raider' };
  const afterRun = { ...RunStorage.read(1), elapsed: 30, visited: { '0,1': 1 } };
  const prepared = await commands.createAttempt({ slotId: 1, node, afterRun, elapsedDelta: 20 });
  expect(prepared.ok).toBe(true);
  const committed = await commands.commitAttempt(prepared.attempt); expect(committed.ok).toBe(true);
  const settled = structuredClone(Base.data.stats);
  const next = await Base.syncPlayTime(31, 30, runId);
  observation('PERSIST-2', { settled, next, finalSeconds: Base.data.stats.playSeconds });
  expect(next.delta).toBe(1); expect(Base.data.stats.playSeconds).toBe(121);
});
