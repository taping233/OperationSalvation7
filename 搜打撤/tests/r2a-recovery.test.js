import { describe, expect, it } from 'vitest';
import { createRecoverablePair } from '../game/src/recoverable-pair.js';

class MemoryStorage {
  constructor(seed = {}) { this.map = new Map(Object.entries(seed)); }
  getItem(k) { return this.map.has(k) ? this.map.get(k) : null; }
  setItem(k, v) { this.map.set(k, String(v)); }
  removeItem(k) { this.map.delete(k); }
}
const keyFor = n => ({ base: `qa:base:${n}`, run: `qa:run:${n}`, journal: `qa:tx:${n}` });
const journal = (slotId = 1) => ({
  version: 1, txId: `tx-${slotId}`, slotId, requestId: 'req-1', command: 'settle.test', fingerprint: 'fp',
  runId: `run-${slotId}`, expectedBaseRevision: 0, expectedRunRevision: 0,
  before: { baseRaw: '{"base":"old"}', runRaw: '{"run":"old"}' },
  after: { baseRaw: '{"base":"new"}', runRaw: null },
  receipt: { ok: true, value: { requestId: 'req-1' }, revision: 1 }, phase: 'prepared',
});
const seeded = slot => { const j = journal(slot); return new MemoryStorage({ [keyFor(slot).base]: j.before.baseRaw, [keyFor(slot).run]: j.before.runRaw }); };

describe('R2-a redo failure matrix', () => {
  it('日志首写失败返回 SAVE_FAILED 且不产生 pending，也不改旧键', () => {
    const storage = seeded(1), originalSet = storage.setItem.bind(storage);
    storage.setItem = (key, value) => { if (key === keyFor(1).journal) throw new Error('quota'); originalSet(key, value); };
    const result = createRecoverablePair({ storage, keyFor }).commit(1, journal(1));
    expect(result.code).toBe('SAVE_FAILED');
    expect(storage.getItem(keyFor(1).journal)).toBeNull();
    expect(storage.getItem(keyFor(1).base)).toBe(journal(1).before.baseRaw);
  });

  it('phase 日志写失败保留 pending，重启可恢复', () => {
    const storage = seeded(1), originalSet = storage.setItem.bind(storage); let journalWrites = 0;
    storage.setItem = (key, value) => { if (key === keyFor(1).journal && ++journalWrites === 2) throw new Error('phase'); originalSet(key, value); };
    expect(createRecoverablePair({ storage, keyFor }).commit(1, journal(1)).code).toBe('SAVE_FAILED_PENDING_RECOVERY');
    storage.setItem = originalSet;
    expect(createRecoverablePair({ storage, keyFor }).recover(1).ok).toBe(true);
  });

  it('清理日志失败保留 pending，重启恢复后清理', () => {
    const storage = seeded(1), originalRemove = storage.removeItem.bind(storage); let failOnce = true;
    storage.removeItem = key => { if (key === keyFor(1).journal && failOnce) { failOnce = false; throw new Error('remove'); } originalRemove(key); };
    expect(createRecoverablePair({ storage, keyFor }).commit(1, journal(1)).code).toBe('SAVE_FAILED_PENDING_RECOVERY');
    expect(createRecoverablePair({ storage, keyFor }).recover(1).ok).toBe(true);
  });

  for (const target of ['base', 'run']) it(`${target} 玩家键真实写失败保留 pending，修复存储后可恢复`, () => {
    const storage = seeded(1), originalSet = storage.setItem.bind(storage), originalRemove = storage.removeItem.bind(storage); let failOnce = true;
    storage.setItem = (key, value) => { if (target === 'base' && key === keyFor(1).base && failOnce) { failOnce = false; throw new Error(target); } originalSet(key, value); };
    storage.removeItem = key => { if (target === 'run' && key === keyFor(1).run && failOnce) { failOnce = false; throw new Error(target); } originalRemove(key); };
    expect(createRecoverablePair({ storage, keyFor }).commit(1, journal(1)).code).toBe('SAVE_FAILED_PENDING_RECOVERY');
    storage.setItem = originalSet; storage.removeItem = originalRemove;
    expect(createRecoverablePair({ storage, keyFor }).recover(1).ok).toBe(true);
  });

  it('读取异常封装为 Result', () => {
    const storage = seeded(1); storage.getItem = () => { throw new Error('read'); };
    expect(createRecoverablePair({ storage, keyFor }).recover(1).code).toBe('STORAGE_READ_FAILED');
  });
  for (const point of ['after-journal', 'after-base', 'after-run', 'before-cleanup']) {
    it(`${point} 故障后重建模块可恢复成完整新状态`, () => {
      const storage = seeded(1);
      let armed = true;
      const first = createRecoverablePair({ storage, keyFor, failpoint: p => { if (armed && p === point) { armed = false; throw new Error(point); } } });
      expect(first.commit(1, journal(1)).ok).toBe(false);
      const rebooted = createRecoverablePair({ storage, keyFor });
      expect(rebooted.recover(1).ok).toBe(true);
      expect(storage.getItem(keyFor(1).base)).toBe(journal(1).after.baseRaw);
      expect(storage.getItem(keyFor(1).run)).toBeNull();
      expect(storage.getItem(keyFor(1).journal)).toBeNull();
    });
  }

  it('prepared 后竞争写入第三值，重启恢复必须阻塞且不覆盖现场', () => {
    const storage = seeded(1);
    const first = createRecoverablePair({ storage, keyFor, failpoint: p => { if (p === 'after-journal') storage.setItem(keyFor(1).base, '{"base":"other-tab"}'); } });
    expect(first.commit(1, journal(1)).code).toBe('RECOVERY_BLOCKED');
    const rebooted = createRecoverablePair({ storage, keyFor });
    expect(rebooted.recover(1).code).toBe('RECOVERY_BLOCKED');
    expect(storage.getItem(keyFor(1).base)).toBe('{"base":"other-tab"}');
    expect(storage.getItem(keyFor(1).run)).toBe(journal(1).before.runRaw);
    expect(storage.getItem(keyFor(1).journal)).not.toBeNull();
  });

  it('坏日志、未来版本与字段缺失均保留数据并阻塞', () => {
    for (const raw of ['{bad', JSON.stringify({ ...journal(1), version: 2 }), JSON.stringify({ ...journal(1), after: null })]) {
      const storage = seeded(1); storage.setItem(keyFor(1).journal, raw);
      expect(createRecoverablePair({ storage, keyFor }).recover(1).code).toBe('RECOVERY_BLOCKED');
      expect(storage.getItem(keyFor(1).base)).toBe(journal(1).before.baseRaw);
    }
  });

  it('五档日志严格隔离', () => {
    const storage = new MemoryStorage();
    for (let slot = 1; slot <= 5; slot++) {
      const j = journal(slot); storage.setItem(keyFor(slot).base, j.before.baseRaw); storage.setItem(keyFor(slot).run, j.before.runRaw);
      expect(createRecoverablePair({ storage, keyFor }).commit(slot, j).ok).toBe(true);
    }
    for (let slot = 1; slot <= 5; slot++) expect(storage.getItem(keyFor(slot).base)).toBe(journal(slot).after.baseRaw);
  });
});
