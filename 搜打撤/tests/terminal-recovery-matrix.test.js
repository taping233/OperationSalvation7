import { beforeEach, describe, expect, it, vi } from 'vitest';

window.SDT = window.SDT || { Icons: { img: () => '' } };
await import('../game/src/base.js');
const { createRecoveryCommands } = await import('../game/src/recovery.commands.js');
const { RunStorage } = await import('../game/src/game.storage.js');
const Base = window.SDT.Base;

const keys = slotId => ({
  base: Base.SLOT_KEY(slotId),
  run: RunStorage.key(slotId),
  journal: `sdt-tx-v1-slot${slotId}`,
});
const locks = { request: async (_name, _options, callback) => callback() };
const copy = value => JSON.parse(JSON.stringify(value));
const makeApi = (slotId, options = {}) => createRecoveryCommands({
  storage: localStorage,
  baseApi: Base,
  runStore: RunStorage,
  lockManager: locks,
  keyFactory: keys,
  ...options,
});

function seed(slotId) {
  const k = keys(slotId);
  localStorage.removeItem(k.base);
  localStorage.removeItem(k.run);
  localStorage.removeItem(k.journal);
  localStorage.setItem(k.base, JSON.stringify({ version: Base.BASE_VERSION, coins: 10, _m01: { revision: 0, requests: {} } }));
  Base.use(slotId);
  expect(RunStorage.write(slotId, { hp: 30 })).toBe(true);

  const base = Base._readForCommit(slotId);
  const run = JSON.parse(localStorage.getItem(k.run));
  const context = {
    slotId,
    requestId: `terminal-${slotId}`,
    expectedBaseRevision: base._m01.revision,
    expectedRunRevision: run._r2.revision,
  };
  const prepared = {
    command: 'settlement.terminal-test',
    runId: run._r2.runId,
    payload: { outcome: 'extract' },
    afterBase: { ...copy(base), coins: base.coins + 7 },
    afterRun: null,
    output: { settled: true },
  };
  return { k, context, prepared, beforeBase: localStorage.getItem(k.base), beforeRun: localStorage.getItem(k.run) };
}

describe('生产双键结算恢复边界', () => {
  beforeEach(() => {
    localStorage.clear();
    for (let slotId = 1; slotId <= 5; slotId++) RunStorage._invalidate(slotId);
  });

  it('无日志选档不需要 Web Locks；有空/坏日志或读错误时不能忽略', async () => {
    const f = seed(1);
    const lockRequest = vi.fn(locks.request);
    const api = makeApi(1, { lockManager: { request: lockRequest } });
    expect(await api.recoverSlotIfPending(1)).toEqual({ ok: true, value: null });
    expect(lockRequest).not.toHaveBeenCalled();

    localStorage.setItem(f.k.journal, '');
    const unavailable = await makeApi(1, { lockManager: null }).recoverSlotIfPending(1);
    expect(unavailable.code).toBe('CAPABILITY_UNAVAILABLE');
    expect(localStorage.getItem(f.k.journal)).toBe('');
    const blocked = await api.recoverSlotIfPending(1);
    expect(blocked.code).toBe('RECOVERY_BLOCKED');
    expect(localStorage.getItem(f.k.journal)).toBe('');

    const readFailure = await createRecoveryCommands({
      storage: { getItem: () => { throw new Error('read denied'); } },
      baseApi: Base, runStore: RunStorage, lockManager: locks, keyFactory: keys,
    }).recoverSlotIfPending(1);
    expect(readFailure).toMatchObject({ ok: false, code: 'STORAGE_READ_FAILED' });
  });

  it('真实 Base/RunStorage 下首写失败不改玩家键，随后阶段失败可重启恢复且奖励只入账一次', async () => {
    const nativeSet = Storage.prototype.setItem;
    const first = seed(2);
    const firstWriteFailure = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (key, value) {
      if (key === first.k.journal) throw new Error('journal quota');
      return nativeSet.call(this, key, value);
    });
    try {
      const failed = await makeApi(2).commitBaseAndRun(first.context, first.prepared);
      expect(failed.code).toBe('SAVE_FAILED');
      expect(localStorage.getItem(first.k.base)).toBe(first.beforeBase);
      expect(localStorage.getItem(first.k.run)).toBe(first.beforeRun);
      expect(localStorage.getItem(first.k.journal)).toBeNull();
    } finally { firstWriteFailure.mockRestore(); }

    const runDelete = seed(3);
    const nativeRemove = Storage.prototype.removeItem;
    let failRunDelete = true;
    const removeRunFailure = vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(function (key) {
      if (key === runDelete.k.run && failRunDelete) { failRunDelete = false; throw new Error('run removal denied'); }
      return nativeRemove.call(this, key);
    });
    let interrupted;
    try { interrupted = await makeApi(3).commitBaseAndRun(runDelete.context, runDelete.prepared); }
    finally { removeRunFailure.mockRestore(); }
    expect(interrupted.code).toBe('SAVE_FAILED_PENDING_RECOVERY');
    expect(JSON.parse(localStorage.getItem(runDelete.k.base)).coins).toBe(17);
    expect(localStorage.getItem(runDelete.k.run)).toBe(runDelete.beforeRun);

    const rebooted = makeApi(3);
    const recovered = await rebooted.recoverSlotIfPending(3);
    expect(recovered).toMatchObject({ ok: true, value: { runId: runDelete.prepared.runId } });
    expect(localStorage.getItem(runDelete.k.run)).toBeNull();
    expect(localStorage.getItem(runDelete.k.journal)).toBeNull();
    expect(JSON.parse(localStorage.getItem(runDelete.k.base)).coins).toBe(17);
    expect(await rebooted.commitBaseAndRun(runDelete.context, runDelete.prepared)).toEqual(recovered);
    expect(JSON.parse(localStorage.getItem(runDelete.k.base)).coins).toBe(17);
  });

  it('真实阶段日志/清理失败可恢复；不覆盖第三值的新探索身份', async () => {
    const phase = seed(4);
    const nativeSet = Storage.prototype.setItem;
    let journalWrites = 0;
    const phaseFailure = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (key, value) {
      if (key === phase.k.journal && ++journalWrites === 2) throw new Error('phase write denied');
      return nativeSet.call(this, key, value);
    });
    let phaseResult;
    try { phaseResult = await makeApi(4).commitBaseAndRun(phase.context, phase.prepared); }
    finally { phaseFailure.mockRestore(); }
    expect(phaseResult.code).toBe('SAVE_FAILED_PENDING_RECOVERY');
    expect((await makeApi(4).recoverSlotIfPending(4)).ok).toBe(true);
    expect(JSON.parse(localStorage.getItem(phase.k.base)).coins).toBe(17);
    expect(localStorage.getItem(phase.k.run)).toBeNull();

    const cleanup = seed(3);
    const nativeRemove = Storage.prototype.removeItem;
    let failJournalCleanup = true;
    const cleanupFailure = vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(function (key) {
      if (key === cleanup.k.journal && failJournalCleanup) { failJournalCleanup = false; throw new Error('journal cleanup denied'); }
      return nativeRemove.call(this, key);
    });
    let cleanupResult;
    try { cleanupResult = await makeApi(3).commitBaseAndRun(cleanup.context, cleanup.prepared); }
    finally { cleanupFailure.mockRestore(); }
    expect(cleanupResult.code).toBe('SAVE_FAILED_PENDING_RECOVERY');
    expect((await makeApi(3).recoverSlotIfPending(3)).ok).toBe(true);
    expect(JSON.parse(localStorage.getItem(cleanup.k.base)).coins).toBe(17);
    expect(localStorage.getItem(cleanup.k.run)).toBeNull();
    expect(localStorage.getItem(cleanup.k.journal)).toBeNull();

    const changedRun = seed(5);
    let leavePending = true;
    const pending = await makeApi(5, { failpoint: point => {
      if (leavePending && point === 'after-journal') { leavePending = false; throw new Error('simulated restart'); }
    } }).commitBaseAndRun(changedRun.context, changedRun.prepared);
    expect(pending.code).toBe('SAVE_FAILED_PENDING_RECOVERY');
    const newerRunRaw = JSON.stringify({ version: RunStorage.SAVE_VERSION, hp: 21, _r2: { runId: 'newer-run', revision: 0 } });
    localStorage.setItem(changedRun.k.run, newerRunRaw);
    const blocked = await makeApi(5).recoverSlotIfPending(5);
    expect(blocked.code).toBe('RECOVERY_BLOCKED');
    expect(localStorage.getItem(changedRun.k.run)).toBe(newerRunRaw);
    expect(localStorage.getItem(changedRun.k.journal)).not.toBeNull();
    expect(await makeApi(5).recoverSlotIfPending(4)).toEqual({ ok: true, value: null });
    expect(localStorage.getItem(changedRun.k.run)).toBe(newerRunRaw);
    expect(localStorage.getItem(changedRun.k.journal)).not.toBeNull();
  });
});
