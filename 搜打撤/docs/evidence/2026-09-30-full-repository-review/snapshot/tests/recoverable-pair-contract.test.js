// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { createRecoverablePair } from '../game/src/hub/recoverable-pair.js';

function createStorage(seed = {}) {
  const values = new Map(Object.entries(seed));
  return {
    values,
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); },
    removeItem(key) { values.delete(key); },
  };
}

describe('recoverable pair journal boundary', () => {
  it('rejects an array journal with assigned fields without changing the three storage keys', () => {
    const keys = { base: 'pair:base:1', run: 'pair:run:1', journal: 'pair:journal:1' };
    const before = { baseRaw: '{"base":"old"}', runRaw: '{"run":"old"}' };
    const storage = createStorage({ [keys.base]: before.baseRaw, [keys.run]: before.runRaw });
    const arrayJournal = Object.assign([], {
      version: 1, txId: 'tx-1', slotId: 1, requestId: 'req-1', command: 'test', fingerprint: 'fp', runId: 'run-1',
      expectedBaseRevision: 0, expectedRunRevision: 0,
      before, after: { baseRaw: '{"base":"new"}', runRaw: null },
      receipt: { ok: true, revision: 1 }, phase: 'prepared',
    });
    const pair = createRecoverablePair({ storage, keyFor: () => keys });

    expect(pair.commit(1, arrayJournal).code).toBe('INVALID_ARGUMENT');
    expect(storage.getItem(keys.base)).toBe(before.baseRaw);
    expect(storage.getItem(keys.run)).toBe(before.runRaw);
    expect(storage.getItem(keys.journal)).toBeNull();
  });
});
