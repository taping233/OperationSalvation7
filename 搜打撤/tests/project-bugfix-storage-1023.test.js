import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { RULES } from '../game/src/core/rules.js';
import { RunStorage } from '../game/src/hub/game.storage.js';
import { createSessionRestoration } from '../game/src/run/game-session-restoration.js';
import { createTerminalCommands } from '../game/src/hub/terminal.commands.js';
import { installImmediateWebLocks } from './helpers/web-locks.js';

window.SDT ||= {};
window.SDT.MAP = { rules: RULES };
const { Base } = await import('../game/src/hub/base.js');
const { createSaveArchive } = await import('../game/src/hub/save-archive.js');
const { createRecoveryCommands } = await import('../game/src/hub/recovery.commands.js');
const { createBattleSettlementCommands } = await import('../game/src/hub/battle-settlement.commands.js');

afterEach(async () => { vi.restoreAllMocks(); await Base.flushWrites(); await RunStorage.flushWrites(); localStorage.clear(); });

const failedIdentity = { ok: false, code: 'STORAGE_READ_FAILED', message: '身份读取失败' };
function restoration(storage = RunStorage) {
  const game = { seed: 'unchanged', hp: 8 };
  const log = vi.fn(), restoreRunBattles = vi.fn();
  const controller = createSessionRestoration({ RunStorage: storage, development: false,
    readState: () => ({ game }), readUI: () => ({ log }), restoreRunBattles,
    validateRunSave: () => ({ ok: true }), validatePendingExtraction: () => ({ ok: true }),
    planMapRestore: () => ({ ok: true, value: { source: 'nest' } }),
    trackRestoration: restore => restore() });
  return { controller, game, log, restoreRunBattles };
}

describe('存档身份读取失败保留结构化结果', () => {
  it('事务键均可读而主档键抛错时返回失败，不逸出同步异常', () => {
    const native = Storage.prototype.getItem;
    const raw = '{"version":2,"_r2":{"runId":"retained","revision":2}}';
    localStorage.setItem(RunStorage.key(1), raw);
    const fault = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(function (key) {
      if (key === RunStorage.key(1)) throw new DOMException('unavailable', 'SecurityError');
      return native.call(this, key);
    });
    expect(RunStorage.readIdentity(1)).toMatchObject({ ok: false, code: 'STORAGE_READ_FAILED' });
    const h = restoration();
    expect(h.controller.loadGame(1)).toMatchObject({ ok: false, code: 'STORAGE_READ_FAILED', preserveRun: true });
    expect(h.game).toEqual({ seed: 'unchanged', hp: 8 });
    fault.mockRestore();
    expect(localStorage.getItem(RunStorage.key(1))).toBe(raw);
  });

  it('预检时不重试主档并把一次读取故障误认成成功装载', () => {
    const readForPreflight = vi.fn();
    const h = restoration({ readIdentity: () => failedIdentity, readForPreflight });
    expect(h.controller.preflightRunMap(1)).toMatchObject({ ...failedIdentity, preserveRun: true });
    expect(readForPreflight).not.toHaveBeenCalled();
  });

  it('完整预检后身份重读失败仍在采纳写基线和重放运行状态前退出', () => {
    const storage = {
      readIdentity: vi.fn().mockReturnValueOnce({ ok: true, value: { runId: 'run', revision: 1 } }).mockReturnValue(failedIdentity),
      readForPreflight: () => ({ version: 2, seed: 'saved', nestActive: true }), acceptLoad: vi.fn(() => ({ ok: true })),
    };
    const h = restoration(storage);
    expect(h.controller.loadGame(1)).toMatchObject({ ...failedIdentity, preserveRun: true });
    expect(h.restoreRunBattles).not.toHaveBeenCalled();
    expect(storage.acceptLoad).not.toHaveBeenCalled();
    expect(h.game).toEqual({ seed: 'unchanged', hp: 8 });
  });

  it('撤离整理的身份复核读取失败不改报为身份不匹配', () => {
    const storage = {
      readIdentity: vi.fn().mockReturnValueOnce({ ok: true, value: { runId: 'run', revision: 1 } }).mockReturnValue(failedIdentity),
      readForPreflight: () => ({ version: 2, pendingExtraction: { runId: 'run' } }),
    };
    const h = restoration(storage);
    expect(h.controller.preflightRunMap(1)).toMatchObject({ ...failedIdentity, preserveRun: true });
  });

  it('终局创建返回真实读取错误，不声称已恢复档位或要求重新确认', async () => {
    const recoverSlot = vi.fn(async () => ({ ok: true }));
    const commands = createTerminalCommands({ getActiveSlot: () => 1,
      getRunStorage: () => ({ readIdentity: () => failedIdentity }),
      getRecovery: () => ({ recoverSlot }) });
    expect(await commands.createAttempt({ slotId: 1, command: 'run.death' })).toEqual(failedIdentity);
    expect(recoverSlot).not.toHaveBeenCalled();
  });
});

describe('整档替换与战后时长持久化', () => {
  beforeEach(async () => {
    installImmediateWebLocks(); localStorage.clear();
    for (let slot = 1; slot <= 5; slot++) await RunStorage.remove(slot);
    Base.use(1); expect(await Base.save()).toBe(true);
  });

  it('空档包替换活动槽后不保留或重新写回旧币与旧卡', async () => {
    Base.data.coins = 999; Base.data.stash = [{ card: { id: 'old', name: '旧资产' }, count: 7 }];
    expect(await Base.save()).toBe(true);
    const archive = createSaveArchive({ digest: async text => createHash('sha256').update(text).digest('hex') });
    const exported = await archive.exportSlot(2);
    const preview = await archive.previewImport(exported.value.text, 1);
    expect(await archive.importSlot(preview.value, { confirm: true })).toEqual({ ok: true });
    expect(Base.data.coins).toBe(0); expect(Base.data.stash).toEqual([]);
    expect(await Base.save()).toBe(true);
    const stored = JSON.parse(localStorage.getItem(Base.SLOT_KEY(1)));
    expect(stored.coins).toBe(0); expect(stored.stash).toEqual([]);
  });

  it.each([false, true])('战后检查点避免后续保存/重读重复累计时长（reload=%s）', async reload => {
    expect(await RunStorage.write(1, { layerIdx: 0, trackPos: 1, visited: {}, elapsed: 10,
      elapsedTimeBaseline: 0, ownedCards: [], seed: 'elapsed-fix' })).toBe(true);
    const runId = RunStorage.readIdentity(1).value.runId;
    Base.data.stats.playSeconds = 100; Base.data.stats.playTimeCheckpoint = { runId, elapsed: 10 };
    expect(await Base.save()).toBe(true);
    const recovery = createRecoveryCommands({ storage: localStorage, lockManager: navigator.locks, baseApi: Base, runStore: RunStorage });
    const commands = createBattleSettlementCommands({ getBase: () => Base, getRunStorage: () => RunStorage,
      getRecovery: () => recovery, getActiveSlot: () => 1 });
    const node = { layerIdx: 0, trackPos: 1, isBoss: false, encounterId: 'entry:raider' };
    const prepared = await commands.createAttempt({ slotId: 1, node,
      afterRun: { ...RunStorage.read(1), elapsed: 30, visited: { '0,1': 1 } }, elapsedDelta: 20 });
    expect(prepared.ok).toBe(true);
    expect((await commands.commitAttempt(prepared.attempt)).ok).toBe(true);
    expect(Base.data.stats.playTimeCheckpoint).toEqual({ runId, elapsed: 30 });
    if (reload) Base.use(1);
    const next = await Base.syncPlayTime(reload ? 30 : 31, reload ? 0 : 30, runId);
    expect(next.delta).toBe(reload ? 0 : 1);
    expect(Base.data.stats.playSeconds).toBe(reload ? 120 : 121);
  });
});
