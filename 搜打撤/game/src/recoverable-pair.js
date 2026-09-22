const PHASES = new Set(['prepared', 'base-written', 'run-written']);
const fail = (code, message, retryable = false, details) => ({ ok: false, code, message, retryable, ...(details ? { details } : {}) });

function validJournal(journal, slotId) {
  if (!journal || journal.version !== 1 || journal.slotId !== slotId ||
      typeof journal.txId !== 'string' || typeof journal.requestId !== 'string' ||
      typeof journal.command !== 'string' || typeof journal.fingerprint !== 'string' ||
      typeof journal.runId !== 'string' || !Number.isInteger(journal.expectedBaseRevision) ||
      !Number.isInteger(journal.expectedRunRevision) || journal.expectedBaseRevision < 0 || journal.expectedRunRevision < 0 ||
      !PHASES.has(journal.phase) || !journal.before || typeof journal.before !== 'object' ||
      !journal.after || typeof journal.after !== 'object' || !journal.receipt ||
      typeof journal.receipt !== 'object' || Array.isArray(journal.receipt)) return false;
  return ['baseRaw', 'runRaw'].every(key =>
    (journal.before[key] === null || typeof journal.before[key] === 'string') &&
    (journal.after[key] === null || typeof journal.after[key] === 'string'));
}

function writeRaw(storage, key, raw) {
  if (raw === null) storage.removeItem(key);
  else storage.setItem(key, raw);
}

export function createRecoverablePair({ storage, keyFor, onChanged = () => {}, failpoint = () => {}, validateJournal = () => ({ ok: true }) }) {
  const validate = (journal, slotId) => {
    if (!validJournal(journal, slotId)) return fail('RECOVERY_BLOCKED', '恢复日志结构或版本无效', false, { slotId });
    try {
      const domain = validateJournal(journal, slotId);
      return domain?.ok === true ? domain : (domain?.ok === false ? domain : fail('RECOVERY_BLOCKED', '恢复日志领域内容无效', false, { slotId }));
    } catch { return fail('RECOVERY_BLOCKED', '恢复日志领域校验异常', false, { slotId }); }
  };
  const readJournal = slotId => {
    let raw;
    try { raw = storage.getItem(keyFor(slotId).journal); }
    catch { return fail('STORAGE_READ_FAILED', '无法读取恢复日志', true, { slotId }); }
    if (raw === null) return { ok: true, value: null };
    try {
      const value = JSON.parse(raw);
      const checked = validate(value, slotId);
      return checked.ok ? { ok: true, value } : checked;
    } catch { return fail('RECOVERY_BLOCKED', '恢复日志无法解析', false, { slotId }); }
  };

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

  const recover = slotId => {
    const read = readJournal(slotId);
    if (!read.ok || !read.value) return read;
    const journal = read.value;
    const checked = stateOf(slotId, journal);
    if (!checked.ok) return checked;
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

  const commit = (slotId, journal) => {
    const valid = validate(journal, slotId);
    if (!valid.ok) return { ...valid, code: 'INVALID_ARGUMENT', message: '事务日志参数无效' };
    const existing = readJournal(slotId);
    if (!existing.ok) return existing;
    if (existing.value) return fail('RECOVERY_REQUIRED', '该档位存在待恢复提交', true, { slotId });
    const keys = keyFor(slotId);
    let journalWritten = false;
    try {
      storage.setItem(keys.journal, JSON.stringify(journal));
      journalWritten = true;
      failpoint('after-journal');
      const checked = stateOf(slotId, journal);
      if (!checked.ok) return checked;
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
