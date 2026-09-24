import './base.js';
import { RUN_KEY, RunStorage, SAVE_VERSION } from './game.storage.js';
import { createRecoverablePair } from './recoverable-pair.js';
import { clone, fail, stable, validSlot } from './commands.shared.js';

const Base = () => window.SDT.Base;

function parseVersioned(raw, maxVersion, label) {
  if (raw === null) return { ok: true, value: null };
  try {
    const value = JSON.parse(raw);
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error();
    const version = Number(value.version) || 0;
    if (version > maxVersion) return fail('RECOVERY_BLOCKED', `${label}来自未来版本`, false, { version });
    return { ok: true, value };
  } catch { return fail('RECOVERY_BLOCKED', `${label}损坏，拒绝事务覆盖`); }
}

export function createRecoveryCommands({ storage = globalThis.localStorage, lockManager = globalThis.navigator?.locks, failpoint,
  baseApi = Base(), runStore = RunStorage, keyFactory = null, baseVersion = baseApi.BASE_VERSION, runVersion = SAVE_VERSION } = {}) {
  const keys = keyFactory || (slotId => ({ base: baseApi.SLOT_KEY(slotId), run: RUN_KEY(slotId), journal: `sdt-tx-v1-slot${slotId}` }));
  const validateJournal = journal => {
    const parse = (raw, maxVersion, label, nullable = true) => {
      if (raw === null) return nullable ? { ok: true, value: null } : fail('RECOVERY_BLOCKED', `${label}不可为空`);
      return parseVersioned(raw, maxVersion, label);
    };
    const beforeBase = parse(journal.before.baseRaw, baseVersion, '日志中的旧基地存档');
    const afterBase = parse(journal.after.baseRaw, baseVersion, '日志中的新基地存档', false);
    const beforeRun = parse(journal.before.runRaw, runVersion, '日志中的旧对局存档');
    const afterRun = parse(journal.after.runRaw, runVersion, '日志中的新对局存档');
    for (const checked of [beforeBase, afterBase, beforeRun, afterRun]) if (!checked.ok) return checked;
    const receipt = journal.receipt;
    const receiptValue = receipt?.ok === true && receipt.value && typeof receipt.value === 'object' ? receipt.value : null;
    const requestKey = `${journal.command}:${journal.requestId}`;
    const stored = afterBase.value?._m01?.requests?.[requestKey];
    if (Number(afterBase.value?.version) !== baseVersion || (afterRun.value !== null && Number(afterRun.value?.version) !== runVersion)) {
      return fail('RECOVERY_BLOCKED', '日志新快照版本不匹配');
    }
    if (!receiptValue || receiptValue.requestId !== journal.requestId || receiptValue.command !== journal.command ||
        receiptValue.runId !== journal.runId || receiptValue.baseRevision !== journal.expectedBaseRevision + 1 ||
        receiptValue.runRevision !== journal.expectedRunRevision + 1 || receipt.revision !== receiptValue.baseRevision ||
        afterBase.value?._m01?.revision !== receiptValue.baseRevision || stored?.fingerprint !== journal.fingerprint ||
        stable(stored?.result) !== stable(receipt)) return fail('RECOVERY_BLOCKED', '日志收据与基地事务身份不匹配');
    const nextRunIdentity = afterRun.value?._r2;
    if (afterRun.value !== null && (nextRunIdentity?.runId !== journal.runId || nextRunIdentity?.revision !== receiptValue.runRevision)) {
      return fail('RECOVERY_BLOCKED', '日志对局身份或修订不匹配');
    }
    const oldRunIdentity = beforeRun.value?._r2;
    if (beforeRun.value !== null && (oldRunIdentity?.runId !== journal.runId || oldRunIdentity?.revision !== journal.expectedRunRevision)) {
      return fail('RECOVERY_BLOCKED', '日志旧对局身份或修订不匹配');
    }
    const beforeBaseRevision = beforeBase.value === null || !Object.hasOwn(beforeBase.value, '_m01')
      ? 0 : beforeBase.value._m01?.revision;
    if (beforeBaseRevision !== journal.expectedBaseRevision) return fail('RECOVERY_BLOCKED', '日志旧基地修订不匹配');
    return { ok: true };
  };
  const pair = createRecoverablePair({
    storage, keyFor: keys, failpoint,
    validateJournal,
    onChanged: slotId => { baseApi._refreshExternal(slotId); runStore._invalidate(slotId); },
  });
  const locked = async (slotId, fn) => {
    if (!lockManager || typeof lockManager.request !== 'function') return fail('CAPABILITY_UNAVAILABLE', '浏览器不支持 Web Locks，拒绝生产两键事务');
    try { return await lockManager.request(`sdt-slot-${slotId}`, { mode: 'exclusive' }, fn); }
    catch { return fail('LOCK_FAILED', '无法取得事务锁，未确认提交结果', true, { slotId }); }
  };
  const validateContext = context => {
    if (!context || !validSlot(context.slotId) || typeof context.requestId !== 'string' || !context.requestId ||
        !Number.isInteger(context.expectedBaseRevision) || !Number.isInteger(context.expectedRunRevision)) return fail('INVALID_ARGUMENT', '事务上下文无效');
    return null;
  };
  const recoverInside = slotId => pair.recover(slotId);

  const recoverSlot = async slotId => {
    if (!validSlot(slotId)) return fail('INVALID_ARGUMENT', 'slotId 必须为 1～5');
    return locked(slotId, () => {
      const recovered = recoverInside(slotId);
      if (!recovered.ok) return recovered;
      return recovered.value === null ? { ok: true, value: null } : clone(recovered.value);
    });
  };

  const recoverSlotIfPending = async slotId => {
    if (!validSlot(slotId)) return fail('INVALID_ARGUMENT', 'slotId 必须为 1～5');
    let raw;
    try { raw = storage.getItem(keys(slotId).journal); }
    catch { return fail('STORAGE_READ_FAILED', '无法读取恢复日志', true, { slotId }); }
    if (raw === null) return { ok: true, value: null };
    return recoverSlot(slotId);
  };

  const readSettlementReceipt = async (context, identity) => {
    const invalid = validateContext(context);
    if (invalid || !identity || typeof identity.command !== 'string') return invalid || fail('INVALID_ARGUMENT', 'command 无效');
    return locked(context.slotId, () => {
      const recovered = recoverInside(context.slotId);
      if (!recovered.ok) return recovered;
      let raw;
      try { raw = storage.getItem(keys(context.slotId).base); }
      catch { return fail('STORAGE_READ_FAILED', '无法读取基地存档', true); }
      const parsed = parseVersioned(raw, baseVersion, '基地存档');
      if (!parsed.ok) return parsed;
      let current, fingerprint;
      try { current = baseApi._readForCommit(context.slotId) || parsed.value; fingerprint = stable({ command: identity.command, payload: identity.payload ?? null, runId: identity.runId ?? null }); }
      catch { return fail('STORAGE_READ_FAILED', '无法读取或序列化基地事务', true); }
      const prior = current?._m01?.requests?.[`${identity.command}:${context.requestId}`];
      if (!prior) return { ok: true, value: null, revision: current?._m01?.revision || 0 };
      if (prior.fingerprint !== fingerprint) return fail('REQUEST_ID_CONFLICT', '同一 requestId 的参数不同');
      return clone(prior.result);
    });
  };

  const commitBaseAndRun = async (context, prepared) => {
    const invalid = validateContext(context);
    if (invalid || !prepared || typeof prepared.command !== 'string' || typeof prepared.runId !== 'string' ||
        !prepared.afterBase || typeof prepared.afterBase !== 'object' || Array.isArray(prepared.afterBase) ||
        !Object.hasOwn(prepared, 'afterRun') || (prepared.afterRun !== null && (typeof prepared.afterRun !== 'object' || Array.isArray(prepared.afterRun)))) return invalid || fail('INVALID_ARGUMENT', 'prepared 事务无效');
    return locked(context.slotId, () => {
      const recovered = recoverInside(context.slotId);
      if (!recovered.ok) return recovered;
      const k = keys(context.slotId);
      let baseRaw, runRaw;
      try { baseRaw = storage.getItem(k.base); runRaw = storage.getItem(k.run); }
      catch { return fail('STORAGE_READ_FAILED', '无法读取事务存档', true); }
      const baseParsed = parseVersioned(baseRaw, baseVersion, '基地存档');
      const runParsed = parseVersioned(runRaw, runVersion, '对局存档');
      if (!baseParsed.ok || !runParsed.ok) return !baseParsed.ok ? baseParsed : runParsed;
      let currentBase;
      try { currentBase = baseApi._readForCommit(context.slotId) || baseParsed.value; }
      catch { return fail('STORAGE_READ_FAILED', '无法读取基地事务快照', true); }
      if (!currentBase?._m01 || !Number.isInteger(currentBase._m01.revision) || !currentBase._m01.requests) return fail('RECOVERY_BLOCKED', '基地事务元数据无效');
      let fingerprint;
      try { fingerprint = stable({ command: prepared.command, payload: prepared.payload ?? null, runId: prepared.runId }); }
      catch { return fail('INVALID_ARGUMENT', '事务参数必须是可序列化纯数据'); }
      const requestKey = `${prepared.command}:${context.requestId}`;
      const prior = currentBase._m01.requests[requestKey];
      if (prior) return prior.fingerprint === fingerprint ? clone(prior.result) : fail('REQUEST_ID_CONFLICT', '同一 requestId 的参数不同');
      let currentRun = runParsed.value;
      if (!currentRun) return fail('INVALID_STATE', '没有可提交的进行中对局');
      if (!currentRun._r2) {
        if (!runStore.write(context.slotId, currentRun)) return fail('SAVE_FAILED', '旧对局身份升级失败', true);
        try { runRaw = storage.getItem(k.run); currentRun = JSON.parse(runRaw); }
        catch { return fail('STORAGE_READ_FAILED', '无法读取升级后的对局存档', true); }
      }
      const baseRevision = currentBase._m01.revision;
      const runRevision = currentRun._r2.revision;
      if (context.expectedBaseRevision !== baseRevision || context.expectedRunRevision !== runRevision || prepared.runId !== currentRun._r2.runId) {
        return fail('STALE_REVISION', '基地或对局状态已变化', false, { baseRevision, runRevision, runId: currentRun._r2.runId });
      }
      let nextBase, nextRun, output;
      try { nextBase = clone(prepared.afterBase); nextRun = prepared.afterRun === null ? null : clone(prepared.afterRun); output = clone(prepared.output ?? null); }
      catch { return fail('INVALID_ARGUMENT', '事务快照必须是可序列化纯数据'); }
      const result = { ok: true, value: { requestId: context.requestId, command: prepared.command, baseRevision: baseRevision + 1, runRevision: runRevision + 1, runId: prepared.runId, output }, revision: baseRevision + 1 };
      nextBase.version = baseVersion;
      nextBase._m01 = { revision: baseRevision + 1, requests: { ...currentBase._m01.requests, [requestKey]: { fingerprint, result } } };
      if (nextRun) { nextRun.version = runVersion; nextRun._r2 = { runId: prepared.runId, revision: runRevision + 1 }; }
      let afterBaseRaw, afterRunRaw;
      try { afterBaseRaw = JSON.stringify(nextBase); afterRunRaw = nextRun === null ? null : JSON.stringify(nextRun); }
      catch { return fail('INVALID_ARGUMENT', '事务快照无法序列化'); }
      const journal = {
        version: 1, txId: `${context.slotId}:${prepared.runId}:${context.requestId}`, slotId: context.slotId,
        requestId: context.requestId, command: prepared.command, fingerprint, runId: prepared.runId,
        expectedBaseRevision: context.expectedBaseRevision, expectedRunRevision: context.expectedRunRevision,
        before: { baseRaw, runRaw }, after: { baseRaw: afterBaseRaw, runRaw: afterRunRaw }, receipt: result,
        phase: 'prepared',
      };
      const committed = pair.commit(context.slotId, journal);
      return committed.ok ? committed.value : committed;
    });
  };
  return Object.freeze({ recoverSlot, recoverSlotIfPending, readSettlementReceipt, commitBaseAndRun });
}

const production = createRecoveryCommands();
export const recoverSlot = production.recoverSlot;
export const recoverSlotIfPending = production.recoverSlotIfPending;
export const readSettlementReceipt = production.readSettlementReceipt;
export const commitBaseAndRun = production.commitBaseAndRun;
