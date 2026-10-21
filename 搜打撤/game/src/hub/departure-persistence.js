import { createRecoverablePair } from './recoverable-pair.js';
import { clone, fail, stable, successReceipt, validSlot } from './commands.shared.js';
import { planBaseDeparture } from './base-departure.commands.js';
import { guardSlotStorage, withSlotWriteLock } from './slot-write-lock.js';

export const DEPARTURE_COMMAND = 'departureStart';
let departureNonce = 0;

// A departure creates an exploration; settlement journals require an existing one.
export function validateDepartureJournal(journal, baseVersion, runVersion) {
  try {
    const beforeBase = journal.before.baseRaw === null ? null : JSON.parse(journal.before.baseRaw);
    const afterBase = JSON.parse(journal.after.baseRaw);
    const afterRun = JSON.parse(journal.after.runRaw);
    const result = journal.receipt;
    const receipt = result?.ok === true ? result.value : null;
    const stored = afterBase?._m01?.requests?.[`${DEPARTURE_COMMAND}:${journal.requestId}`];
    if (journal.command !== DEPARTURE_COMMAND || journal.before.runRaw !== null ||
        journal.expectedRunRevision !== 0 || !journal.runId || journal.requestId !== journal.runId ||
        (beforeBase !== null && (!beforeBase || Array.isArray(beforeBase) || Number(beforeBase.version) > baseVersion)) ||
        (beforeBase?._m01?.revision || 0) !== journal.expectedBaseRevision ||
        afterBase?.version !== baseVersion || afterRun?.version !== runVersion ||
        afterRun._r2?.runId !== journal.runId || afterRun._r2?.revision !== 0 ||
        afterBase._m01?.revision !== journal.expectedBaseRevision + 1 ||
        receipt?.command !== DEPARTURE_COMMAND || receipt.requestId !== journal.requestId ||
        receipt.runId !== journal.runId || receipt.runRevision !== 0 ||
        receipt.baseRevision !== afterBase._m01.revision || result.revision !== receipt.baseRevision ||
        stored?.fingerprint !== journal.fingerprint || stable(stored?.result) !== stable(result)) {
      return fail('RECOVERY_BLOCKED', '出征日志身份、修订或快照不匹配');
    }
    return { ok: true };
  } catch { return fail('RECOVERY_BLOCKED', '出征日志损坏，已保留原存档'); }
}

export function createDeparturePersistence({ storage, baseApi, runStore, txKey, failpoint, lockManager = globalThis.navigator?.locks }) {
  const keys = slotId => ({ base: baseApi.SLOT_KEY(slotId), run: runStore.key(slotId), journal: txKey(slotId) });
  let writeOwner = null;
  const guardedStorage = guardSlotStorage(storage, key => writeOwner && Object.values(keys(writeOwner.slotId)).includes(key) ? writeOwner : null);
  const pair = createRecoverablePair({
    storage: guardedStorage, keyFor: keys, failpoint,
    validateJournal: journal => validateDepartureJournal(journal, baseApi.BASE_VERSION, runStore.SAVE_VERSION),
    onChanged: slotId => { baseApi._refreshExternal(slotId); runStore._invalidate(slotId); },
  });
  function pending(slotId) {
    let raw;
    try { raw = storage.getItem(keys(slotId).journal); }
    catch { return fail('STORAGE_READ_FAILED', '无法读取出征恢复日志', true); }
    if (raw === null) return { ok: true, value: null };
    const journal = pair.readJournal(slotId);
    return journal.ok ? journal : fail('RECOVERY_REQUIRED', '该档位存在待恢复事务，请重新进入档位', true);
  }
  function prepare(slotId, picks) {
    const before = baseApi._readDepartureBaseline(slotId);
    if (!before.ok) return fail('STALE_REVISION', '基地已变化或无法读取，请重新进入档位');
    try {
      if (storage.getItem(keys(slotId).run) !== null) return fail('RUN_EXISTS', '该档位已有对局，请继续原对局');
      const planned = planBaseDeparture(baseApi.data, picks);
      if (!planned.departure.ok) return fail('INVALID_STATE', '出征整备无法完成');
      return { ok: true, value: { beforeBaseRaw: before.raw, ...planned } };
    } catch { return fail('STORAGE_READ_FAILED', '无法准备出征存档', true); }
  }
  function commit(slotId, prepared, run) {
    try {
      const current = keys(slotId);
      if (storage.getItem(current.base) !== prepared.beforeBaseRaw || storage.getItem(current.run) !== null) {
        return { result: fail('STALE_REVISION', '出征准备期间存档已变化，请重新进入档位'), runId: null };
      }
    } catch { return { result: fail('STORAGE_READ_FAILED', '无法复核出征存档', true), runId: null }; }
    const runId = `run-${slotId}-${globalThis.crypto?.randomUUID?.() || `${Date.now().toString(36)}-${(++departureNonce).toString(36)}`}`;
    const afterBase = clone(prepared.afterState);
    const revision = (afterBase._m01?.revision || 0) + 1;
    const payload = { cards: prepared.departure.cards, pocketCleared: prepared.departure.pocketCleared };
    const fingerprint = stable({ command: DEPARTURE_COMMAND, payload, runId });
    const receipt = successReceipt({ requestId: runId, command: DEPARTURE_COMMAND, baseRevision: revision, runRevision: 0, runId, output: null }, revision);
    afterBase.version = baseApi.BASE_VERSION;
    afterBase._m01 = { revision, requests: { ...(afterBase._m01?.requests || {}), [`${DEPARTURE_COMMAND}:${runId}`]: { fingerprint, result: receipt } } };
    const afterRun = { ...run, version: runStore.SAVE_VERSION, _r2: { runId, revision: 0 } };
    const journal = {
      version: 1, txId: `${slotId}:${runId}:departure`, slotId, requestId: runId,
      command: DEPARTURE_COMMAND, fingerprint, runId,
      expectedBaseRevision: revision - 1, expectedRunRevision: 0,
      before: { baseRaw: prepared.beforeBaseRaw, runRaw: null },
      after: { baseRaw: JSON.stringify(afterBase), runRaw: JSON.stringify(afterRun) }, receipt, phase: 'prepared',
    };
    return { result: pair.commit(slotId, journal), runId };
  }
  async function withLock(slotId, current, work) {
    if (!validSlot(slotId)) return fail('INVALID_ARGUMENT', '出征档位必须是 1～5');
    const result = await withSlotWriteLock(slotId, lease => {
      writeOwner = { slotId, lease };
      try { return work(); } finally { writeOwner = null; }
    }, { lockManager, isCurrent: current });
    return result.ok ? result.value : result;
  }
  return { pending, prepare, commit, recover: slotId => pair.recover(slotId), withLock };
}
