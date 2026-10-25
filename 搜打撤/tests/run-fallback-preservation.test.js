import { installImmediateWebLocks } from './helpers/web-locks.js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RunStorage } from '../game/src/hub/game.storage.js';
import { createVersionedSlotReader } from '../game/src/hub/versioned-slot-reader.js';
const prevKey = slot => `sdt-run-${slot}-prev`;
const checkedFixture = () => ({ok:true});
async function confirmPrevious(slot) {
  const preview = RunStorage.previousCandidate(slot, checkedFixture);
  expect(preview.ok).toBe(true);
  expect(await RunStorage.restorePrevious(slot, preview.value, checkedFixture)).toBe(true);
}
beforeEach(async () => { installImmediateWebLocks(); await RunStorage.flushWrites(); localStorage.clear(); for (let i=1; i<=5; i++) await RunStorage.remove(i); });
afterEach(() => vi.restoreAllMocks());

describe('回退原始坏档保存证据', () => {
  it('损坏备份写失败时不能自愈覆盖唯一原串或声称备份成功', async () => {
    const broken = '{primary broken fixture';
    const backup = JSON.stringify({ version: 2, hp: 14, _r2:{ runId:'fallback-fixture', revision: 3 } });
    localStorage.setItem(RunStorage.key(1), broken);
    localStorage.setItem(prevKey(1), backup);
    const original = Storage.prototype.setItem;
    vi.spyOn(Storage.prototype,'setItem').mockImplementation(function(key, value) {
      if(key===RunStorage.corruptKey(1)) throw new Error('fixture backup write failure');
      return original.call(this,key,value);
    });
    const warning = vi.spyOn(console,'warn').mockImplementation(() => {});
    expect(RunStorage.read(1)).toBeNull();
    expect(localStorage.getItem(RunStorage.key(1))).toBe(broken);
    expect(localStorage.getItem(prevKey(1))).toBe(backup);
    expect(warning.mock.calls.flat().join(' ')).not.toContain('坏档原串保留于 corrupt 键');
  });
  it('坏prev不能把主档坏原串的corrupt备份换成prev坏串', async () => {
    const primary = '{primary malformed fixture';
    localStorage.setItem(RunStorage.key(1), primary);
    localStorage.setItem(prevKey(1), '{previous malformed fixture');
    vi.spyOn(console,'warn').mockImplementation(() => {});
    expect(RunStorage.read(1)).toBeNull();
    expect(localStorage.getItem(RunStorage.key(1))).toBe(primary);
    await RunStorage.flushWrites();
    expect(localStorage.getItem(RunStorage.corruptKey(1))).toBe(primary);
  });
  it('备份失败后恢复可写，确认重试能逐字节恢复并采纳原探索身份', async () => {
    const broken = '{quota retry malformed';
    const previous = JSON.stringify({ version: 2, hp: 18, _r2: { runId: 'quota-retry-run', revision: 6 } });
    localStorage.setItem(RunStorage.key(2), broken);
    localStorage.setItem(prevKey(2), previous);
    const set = Storage.prototype.setItem;
    const block = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (key, value) {
      if (key === RunStorage.corruptKey(2)) throw new DOMException('fixture quota', 'QuotaExceededError');
      return set.call(this, key, value);
    });
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(RunStorage.readForPreflight(2)).toBeNull();
    expect(RunStorage.issue(2)).toBe('corrupt');
    expect(localStorage.getItem(RunStorage.key(2))).toBe(broken);
    await RunStorage.flushWrites();
    block.mockRestore();
    await confirmPrevious(2);
    const candidate = RunStorage.readForPreflight(2);
    expect(candidate.hp).toBe(18);
    expect(localStorage.getItem(RunStorage.key(2))).toBe(previous);
    expect(localStorage.getItem(RunStorage.corruptKey(2))).toBe(broken);
    expect(RunStorage.readIdentity(2)).toEqual({ ok: true, value: { runId: 'quota-retry-run', revision: 6 } });
    expect(RunStorage.acceptLoad(2, candidate)).toEqual({ ok: true });
    expect(await RunStorage.write(2, { hp: 19 })).toBe(true);
    expect(RunStorage.readIdentity(2)).toEqual({ ok: true, value: { runId: 'quota-retry-run', revision: 7 } });
  });

  it('全部写入受限时原主/prev都保留，零自愈写入且不谎报回退', async () => {
    const broken = '{all writes denied';
    const previous = JSON.stringify({ version: 2, hp: 14 });
    localStorage.setItem(RunStorage.key(1), broken);
    localStorage.setItem(prevKey(1), previous);
    const set = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('fixture full storage', 'QuotaExceededError');
    });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(RunStorage.readForPreflight(1)).toBeNull();
    expect(localStorage.getItem(RunStorage.key(1))).toBe(broken);
    expect(localStorage.getItem(prevKey(1))).toBe(previous);
    expect(set.mock.calls.filter(([key]) => key === RunStorage.key(1))).toHaveLength(0);
    expect(warn.mock.calls.flat().join(' ')).not.toContain('已回退到上一版存档');
  });

  it('corrupt备份成功但主档自愈写失败时保留所有原串及主档异常，确认重试可恢复', async () => {
    const broken = '{self heal write denied';
    const previous = JSON.stringify({ version: 2, hp: 16 });
    localStorage.setItem(RunStorage.key(1), broken);
    localStorage.setItem(prevKey(1), previous);
    const set = Storage.prototype.setItem;
    const block = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (key, value) {
      if (key === RunStorage.key(1)) throw new Error('fixture heal failed');
      return set.call(this, key, value);
    });
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(RunStorage.readForPreflight(1)).toBeNull();
    expect(RunStorage.issue(1)).toBe('corrupt');
    expect(localStorage.getItem(RunStorage.key(1))).toBe(broken);
    expect(localStorage.getItem(prevKey(1))).toBe(previous);
    await RunStorage.flushWrites();
    expect(localStorage.getItem(RunStorage.corruptKey(1))).toBe(broken);
    block.mockRestore();
    await confirmPrevious(1);
    expect(RunStorage.readForPreflight(1).hp).toBe(16);
  });

  it.each(['primary', 'previous'])('%s读取失败不自愈，也不触碰其他档位', async target => {
    const broken = '{read failed fixture';
    const previous = JSON.stringify({ version: 2, hp: 11 });
    localStorage.setItem(RunStorage.key(1), broken);
    localStorage.setItem(prevKey(1), previous);
    localStorage.setItem(RunStorage.key(2), 'other-slot-fixture');
    const get = Storage.prototype.getItem;
    const name = target === 'primary' ? RunStorage.key(1) : prevKey(1);
    const block = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(function (key) {
      if (key === name) throw new Error('fixture read unavailable');
      return get.call(this, key);
    });
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const set = vi.spyOn(Storage.prototype, 'setItem');
    expect(RunStorage.readForPreflight(1)).toBeNull();
    expect(RunStorage.issue(1)).toBe(target === 'primary' ? 'readFailed' : 'corrupt');
    expect(set.mock.calls.filter(([key]) => key === RunStorage.key(1))).toHaveLength(0);
    block.mockRestore();
    expect(localStorage.getItem(RunStorage.key(1))).toBe(broken);
    expect(localStorage.getItem(prevKey(1))).toBe(previous);
    expect(localStorage.getItem(RunStorage.key(2))).toBe('other-slot-fixture');
  });

});


describe('reader备档验证的向后兼容窄API', () => {
  function reader() {
    return createVersionedSlotReader({ logTag: '[fixture]', maxVersion: 2,
      migrations: { 1: value => value }, corruptKeyFor: slot => `fixture-corrupt-${slot}`,
      versionOf: value => value.version ?? 0, rejectArrays: true });
  }

  it('旧两参parse仍备份，结果只与本次slot和原串对应；无记录查询返回false', async () => {
    const current = reader();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(current.didBackUpCorrupt(1, undefined)).toBe(false);
    expect(current.parse(1, '{original')).toBeNull();
    expect(localStorage.getItem('fixture-corrupt-1')).toBe('{original');
    expect(current.didBackUpCorrupt(1, '{original')).toBe(true);
    expect(current.didBackUpCorrupt(2, '{original')).toBe(false);
    expect(current.didBackUpCorrupt(1, '{other')).toBe(false);
  });

  it.each(['{bad previous', '[]', '{"version":1.5}'])('不备份验证候选%s不改原corrupt备份和成功凭据', async raw => {
    const current = reader();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    current.parse(1, '{original');
    const set = vi.spyOn(Storage.prototype, 'setItem');
    expect(current.parse(1, raw, { backupCorrupt: false })).toBeNull();
    expect(set).not.toHaveBeenCalled();
    expect(localStorage.getItem('fixture-corrupt-1')).toBe('{original');
    expect(current.didBackUpCorrupt(1, '{original')).toBe(true);
  });
});
