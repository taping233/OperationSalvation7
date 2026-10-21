/** @typedef {'prepared' | 'base-written' | 'run-written'} JournalPhase */
/** @typedef {{ baseRaw: string | null, runRaw: string | null }} RawPair */
/** @typedef {{ base: string, run: string, journal: string }} JournalKeys */
/** @typedef {{ version: 1, txId: string, slotId: number, requestId: string, command: string, fingerprint: string, runId: string, expectedBaseRevision: number, expectedRunRevision: number, before: RawPair, after: RawPair, receipt: Record<string, unknown>, phase: JournalPhase }} Journal */
/** @typedef {{ getItem(key: string): string | null, setItem(key: string, value: string): void, removeItem(key: string): void }} StoragePort */
/** @typedef {{ ok: false, code: string, message: string, retryable: boolean, details?: unknown }} Failure */
/** @template T @typedef {{ ok: true, value: T } | Failure} Result */
/** @typedef {{ ok: true } | Failure} JournalValidationResult */
/** @typedef {'after-journal' | 'after-base' | 'after-run' | 'before-cleanup' | 'recover-after-base' | 'recover-after-run'} Failpoint */
/** @typedef {{ storage: StoragePort, keyFor(slotId: number): JournalKeys, onChanged?: (slotId: number) => void, failpoint?: (point: Failpoint) => void, validateJournal?: (journal: Journal, slotId: number) => JournalValidationResult }} CreateRecoverablePairOptions */

/** @type {Set<JournalPhase>} */
import { fail } from './commands.shared.js';

const PHASES = new Set(['prepared', 'base-written', 'run-written']);
/** @param {unknown} value @returns {value is JournalPhase} */
function isJournalPhase(value) {
  return typeof value === 'string' && PHASES.has(/** @type {JournalPhase} */ (value));
}

/** @param {unknown} value @returns {value is RawPair} */
function isRawPair(value) {
  if (!value || typeof value !== 'object') return false;
  const pair = /** @type {Record<string, unknown>} */ (value);
  return (pair.baseRaw === null || typeof pair.baseRaw === 'string') &&
    (pair.runRaw === null || typeof pair.runRaw === 'string');
}

/** @param {unknown} journal @param {number} slotId @returns {journal is Journal} */
function validJournal(journal, slotId) {
  if (!journal || typeof journal !== 'object' || Array.isArray(journal)) return false;
  const record = /** @type {Record<string, unknown>} */ (journal);
  if (record.version !== 1 || record.slotId !== slotId ||
      typeof record.txId !== 'string' || typeof record.requestId !== 'string' ||
      typeof record.command !== 'string' || typeof record.fingerprint !== 'string' ||
      typeof record.runId !== 'string' || typeof record.expectedBaseRevision !== 'number' ||
      !Number.isInteger(record.expectedBaseRevision) || record.expectedBaseRevision < 0 ||
      typeof record.expectedRunRevision !== 'number' || !Number.isInteger(record.expectedRunRevision) || record.expectedRunRevision < 0 ||
      !isJournalPhase(record.phase) || !isRawPair(record.before) || !isRawPair(record.after) || !record.receipt ||
      typeof record.receipt !== 'object' || Array.isArray(record.receipt)) return false;
  return true;
}

/** @param {StoragePort} storage @param {string} key @param {string | null} raw */
function writeRaw(storage, key, raw) {
  if (raw === null) storage.removeItem(key);
  else storage.setItem(key, raw);
}

/** @param {CreateRecoverablePairOptions} options */
export function createRecoverablePair(options) {
  const { storage, keyFor, onChanged = () => {}, failpoint = () => {}, validateJournal = () => ({ ok: true }) } = options;
  /** @param {unknown} journal @param {number} slotId @returns {JournalValidationResult} */
  const validate = (journal, slotId) => {
    if (!validJournal(journal, slotId)) return fail('RECOVERY_BLOCKED', '恢复日志结构或版本无效', false, { slotId });
    try {
      const domain = validateJournal(journal, slotId);
      return domain?.ok === true ? domain : (domain?.ok === false ? domain : fail('RECOVERY_BLOCKED', '恢复日志领域内容无效', false, { slotId }));
    } catch { return fail('RECOVERY_BLOCKED', '恢复日志领域校验异常', false, { slotId }); }
  };
  /** @param {number} slotId @returns {Result<Journal | null>} */
  const readJournal = slotId => {
    let raw;
    try { raw = storage.getItem(keyFor(slotId).journal); }
    catch { return fail('STORAGE_READ_FAILED', '无法读取恢复日志', true, { slotId }); }
    if (raw === null) return { ok: true, value: null };
    try {
      /** @type {unknown} */
      const value = JSON.parse(raw);
      const checked = validate(value, slotId);
      if (!checked.ok) return /** @type {Extract<typeof checked, {ok:false}>} */ (checked);
      return { ok: true, value: /** @type {Journal} */ (value) };
    } catch { return fail('RECOVERY_BLOCKED', '恢复日志无法解析', false, { slotId }); }
  };

  /** @param {number} slotId @param {Journal} journal @returns {Result<{ keys: JournalKeys, current: RawPair }>} */
  const stateOf = (slotId, journal) => {
    const keys = keyFor(slotId);
    let current;
    try { current = { baseRaw: storage.getItem(keys.base), runRaw: storage.getItem(keys.run) }; }
    catch { return fail('STORAGE_READ_FAILED', '无法读取事务存档', true, { slotId }); }
    for (const name of ['baseRaw', 'runRaw']) {
      if (current[name] !== journal.before[name] && current[name] !== journal.after[name]) {
        return fail('RECOVERY_BLOCKED', '存档出现日志之外的第三值，已保留现场', false, { slotId, key: name });
      }
    }
    return { ok: true, value: { keys, current } };
  };

  /** @param {number} slotId @returns {Result<Record<string, unknown> | null>} */
  const recover = slotId => {
    const read = readJournal(slotId);
    if (!read.ok || !read.value) return read;
    const journal = read.value;
    const checked = stateOf(slotId, journal);
    if (checked.ok === false) return checked;
    const { keys, current } = checked.value;
    try {
      if (current.baseRaw === journal.before.baseRaw) writeRaw(storage, keys.base, journal.after.baseRaw);
      failpoint('recover-after-base');
      if (current.runRaw === journal.before.runRaw) writeRaw(storage, keys.run, journal.after.runRaw);
      failpoint('recover-after-run');
      if (storage.getItem(keys.base) !== journal.after.baseRaw || storage.getItem(keys.run) !== journal.after.runRaw) {
        return fail('RECOVERY_BLOCKED', '恢复写入验证失败', true, { slotId });
      }
      storage.removeItem(keys.journal);
      try { onChanged(slotId); } catch { /* 持久提交已完成；缓存会在后续读取时重建 */ }
      return { ok: true, value: journal.receipt };
    } catch { return fail('SAVE_FAILED_PENDING_RECOVERY', '提交已开始，刷新后继续恢复', true, { slotId }); }
  };

  /** @param {number} slotId @param {Journal} journal @returns {{ ok: true, value: Record<string, unknown>, revision: unknown } | Failure} */
  const commit = (slotId, journal) => {
    const valid = validate(journal, slotId);
    if (valid.ok === false) return { ...valid, code: 'INVALID_ARGUMENT', message: '事务日志参数无效' };
    const existing = readJournal(slotId);
    if (existing.ok === false) return existing;
    if (existing.value) return fail('RECOVERY_REQUIRED', '该档位存在待恢复提交', true, { slotId });
    const keys = keyFor(slotId);
    let journalWritten = false;
    try {
      storage.setItem(keys.journal, JSON.stringify(journal));
      journalWritten = true;
      failpoint('after-journal');
      const checked = stateOf(slotId, journal);
      if (checked.ok === false) return checked;
      writeRaw(storage, keys.base, journal.after.baseRaw);
      journal.phase = 'base-written'; storage.setItem(keys.journal, JSON.stringify(journal));
      failpoint('after-base');
      writeRaw(storage, keys.run, journal.after.runRaw);
      journal.phase = 'run-written'; storage.setItem(keys.journal, JSON.stringify(journal));
      failpoint('after-run');
      if (storage.getItem(keys.base) !== journal.after.baseRaw || storage.getItem(keys.run) !== journal.after.runRaw) throw new Error('verify');
      failpoint('before-cleanup');
      storage.removeItem(keys.journal);
      try { onChanged(slotId); } catch { /* 持久提交已完成；缓存会在后续读取时重建 */ }
      return { ok: true, value: journal.receipt, revision: journal.receipt.revision };
    } catch {
      return journalWritten
        ? fail('SAVE_FAILED_PENDING_RECOVERY', '提交已开始，刷新后继续恢复', true, { slotId })
        : fail('SAVE_FAILED', '恢复日志未写入，原存档未改变', true, { slotId });
    }
  };

  return Object.freeze({ readJournal, recover, commit });
}
