import { createHash } from 'node:crypto';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { RULES } from '../game/src/core/rules.js';
import { retainRunReceipts } from '../game/src/hub/receipt-retention.js';
import { createBaseEconomy } from '../game/src/hub/base-economy.js';

window.SDT ||= { Icons: { img: () => '' } };
window.SDT.MAP = { rules: RULES };
const { Base } = await import('../game/src/hub/base.js');
const { RunStorage } = await import('../game/src/hub/game.storage.js');
const { createSaveArchive, validateArchivedRun } = await import('../game/src/hub/save-archive.js');
const digest = async value => createHash('sha256').update(value).digest('hex');
let locks;
function serialLocks() {
  const tails = new Map(), active = new Set();
  return { active, request(name, _options, work) {
    const task = (tails.get(name) || Promise.resolve()).then(() => {
      active.add(name);
      try { return work(); } finally { active.delete(name); }
    });
    tails.set(name, task.catch(() => {}));
    return task;
  } };
}
const run = (hp = 10) => ({ version: 2, nestActive: true, nestPos: 0, hp, seed: 'archive-fixture',
  elapsed: 50, savedAt: 12345, _r2: { runId: 'archive-run', revision: 1 } });
beforeEach(async () => {
  vi.restoreAllMocks();
  locks = serialLocks();
  Object.defineProperty(navigator, 'locks', { configurable: true, value: locks });
  await RunStorage.flushWrites(); await Base.flushWrites();
  localStorage.clear();
  for (let slot = 1; slot <= 5; slot++) await RunStorage.remove(slot);
  Base.use(1);
  expect(await Base.save()).toBe(true);
});
afterEach(async () => { await RunStorage.flushWrites(); await Base.flushWrites(); vi.restoreAllMocks(); });

describe('审阅整改：存档互斥与明确恢复', () => {
  it('普通写入与删除均等待同槽锁，物理写只发生在锁内', async () => {
    const originalSet = Storage.prototype.setItem, originalRemove = Storage.prototype.removeItem;
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (key, value) {
      if (key.startsWith('sdt-run-') || key.startsWith('sdt-save-v2-slot')) expect(locks.active.has('sdt-slot-1')).toBe(true);
      return originalSet.call(this, key, value);
    });
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(function (key) {
      if (key.startsWith('sdt-run-') || key.startsWith('sdt-save-v2-slot')) expect(locks.active.has('sdt-slot-1')).toBe(true);
      return originalRemove.call(this, key);
    });
    const saving = RunStorage.write(1, run());
    expect(saving).toBeInstanceOf(Promise);
    expect(localStorage.getItem(RunStorage.key(1))).toBeNull();
    expect(await saving).toBe(true);
    expect(await RunStorage.remove(1)).toBe(true);
  });
  it('外部标签已推进主串时旧运行态被拒绝', async () => {
    expect(await RunStorage.write(1, run())).toBe(true);
    const external = JSON.stringify({ ...run(99), _r2: { runId: 'archive-run', revision: 8 } });
    localStorage.setItem(RunStorage.key(1), external);
    expect(await RunStorage.write(1, run(1))).toBe(false);
    expect(localStorage.getItem(RunStorage.key(1))).toBe(external);
  });
  it('浅层/深层损坏主串均不在读取时覆盖，确认恢复才采用完整有效备档', async () => {
    const previousRaw = JSON.stringify(run());
    localStorage.setItem('sdt-run-1-prev', previousRaw);
    const broken = JSON.stringify({ ...run(4), ownedCards: 'broken' });
    localStorage.setItem(RunStorage.key(1), broken);
    expect(RunStorage.read(1).hp).toBe(4);
    const candidate = RunStorage.previousCandidate(1, validateArchivedRun);
    expect(candidate.ok).toBe(true);
    expect(localStorage.getItem(RunStorage.key(1))).toBe(broken);
    expect(await RunStorage.restorePrevious(1, candidate.value, validateArchivedRun)).toBe(true);
    expect(localStorage.getItem(RunStorage.key(1))).toBe(previousRaw);
    expect(localStorage.getItem(RunStorage.corruptKey(1))).toBe(broken);
    expect(RunStorage.acceptLoad(1, RunStorage.readForPreflight(1))).toEqual({ ok: true });
    expect(await RunStorage.write(1, run(20))).toBe(true);
  });
  it('过新主档及预览后变化不被备档覆盖', async () => {
    localStorage.setItem('sdt-run-1-prev', JSON.stringify(run()));
    const future = JSON.stringify({ version: 100 });
    localStorage.setItem(RunStorage.key(1), future);
    expect(RunStorage.previousCandidate(1, validateArchivedRun).code).toBe('RUN_TOO_NEW');
    localStorage.setItem(RunStorage.key(1), '{broken');
    const candidate = RunStorage.previousCandidate(1, validateArchivedRun);
    expect(candidate.ok).toBe(true);
    localStorage.setItem(RunStorage.key(1), future);
    expect(await RunStorage.restorePrevious(1, candidate.value, validateArchivedRun)).toBe(false);
    expect(localStorage.getItem(RunStorage.key(1))).toBe(future);
  });
  it('异常基地不能误作空槽重置，显式覆盖仍保全原串', async () => {
    const future = JSON.stringify({ version: 100, coins: 999 });
    localStorage.setItem(Base.SLOT_KEY(1), future);
    expect(Base.peek(1)).toBeNull();
    expect(await Base.reset(1)).toBe(false);
    expect(localStorage.getItem(Base.SLOT_KEY(1))).toBe(future);
    expect(await Base.reset(1, { overwrite: true })).toBe(true);
    expect(localStorage.getItem(Base.PRESERVED_KEY(1))).toBe(future);
    expect(await Base.save()).toBe(true);
    expect(localStorage.getItem(Base.PRESERVED_KEY(1))).toBe(future);
  });
  it('对局已保存但基地被打断后，按同局检查点补回40秒且不重复累计', async () => {
    Base.data.stats.playSeconds = 1000;
    expect(await Base.syncPlayTime(10, 10, 'time-run')).toMatchObject({ persisted: true });
    const durable = localStorage.getItem(Base.SLOT_KEY(1));
    const original = Storage.prototype.setItem;
    const fail = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (key, value) {
      if (key === Base.SLOT_KEY(1)) throw new Error('interrupted');
      return original.call(this, key, value);
    });
    expect(await Base.syncPlayTime(50, 10, 'time-run')).toMatchObject({ delta: 40, persisted: false });
    fail.mockRestore();
    expect(localStorage.getItem(Base.SLOT_KEY(1))).toBe(durable);
    Base.use(1);
    expect(await Base.syncPlayTime(50, 0, 'time-run')).toMatchObject({ delta: 40, persisted: true });
    expect(Base.data.stats.playSeconds).toBe(1040);
    expect(await Base.syncPlayTime(50, 0, 'time-run')).toMatchObject({ changed: false });
    expect(Base.data.stats.playSeconds).toBe(1040);
  });
});

describe('整档导入导出与回滚', () => {
  const archive = () => createSaveArchive({ digest });
  async function exported(api) {
    localStorage.setItem(RunStorage.key(1), JSON.stringify(run()));
    localStorage.setItem(RunStorage.corruptKey(1), '{original broken');
    const result = await api.exportSlot(1);
    expect(result.ok).toBe(true); return result.value.text;
  }
  it('完整导出含原始坏档和校验，导入经预览与明确确认才替换目标槽', async () => {
    const api = archive(), text = await exported(api);
    const parsed = JSON.parse(text);
    expect(parsed.values.corruptRun).toBe('{original broken');
    expect(parsed.checksum).toMatch(/^[a-f0-9]{64}$/);
    const preview = await api.previewImport(text, 2);
    expect(preview.ok).toBe(true);
    expect((await api.importSlot(preview.value)).code).toBe('CONFIRM_REQUIRED');
    expect(localStorage.getItem(RunStorage.key(2))).toBeNull();
    expect(await api.importSlot(preview.value, { confirm: true })).toEqual({ ok: true });
    expect(JSON.parse(localStorage.getItem(RunStorage.key(2))).hp).toBe(10);
    expect(localStorage.getItem('sdt-import-v1-slot2')).toBeNull();
  });
  it('篡改文件、未来版本、未恢复事务均在写入前拒绝', async () => {
    const api = archive(), text = await exported(api), changed = JSON.parse(text);
    changed.values.run = JSON.stringify(run(99));
    expect((await api.previewImport(JSON.stringify(changed), 2)).code).toBe('CHECKSUM_MISMATCH');
    localStorage.setItem('sdt-tx-v1-slot1', '{pending');
    const pending = await api.exportSlot(1);
    expect(pending.ok).toBe(true);
    expect((await api.previewImport(pending.value.text, 2)).code).toBe('RECOVERY_REQUIRED');
    localStorage.removeItem('sdt-tx-v1-slot1');
    localStorage.setItem(RunStorage.key(1), JSON.stringify({ ...run(), version: 99 }));
    const future = await api.exportSlot(1);
    expect((await api.previewImport(future.value.text, 2)).ok).toBe(false);
    expect(localStorage.getItem(RunStorage.key(2))).toBeNull();
  });
  it('预检后目标变化拒绝覆盖；写入失败恢复导入前原串', async () => {
    const api = archive(), text = await exported(api);
    const preview = await api.previewImport(text, 2);
    localStorage.setItem(Base.SLOT_KEY(2), '{changed');
    expect((await api.importSlot(preview.value, { confirm: true })).code).toBe('STALE_SLOT');
    const second = await api.previewImport(text, 2), original = Storage.prototype.setItem;
    let failOnce = true;
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (key, value) {
      if (key === RunStorage.key(2) && failOnce) { failOnce = false; throw new Error('quota'); }
      return original.call(this, key, value);
    });
    expect((await api.importSlot(second.value, { confirm: true })).code).toBe('IMPORT_WRITE_FAILED');
    expect(localStorage.getItem(Base.SLOT_KEY(2))).toBe('{changed');
    expect(localStorage.getItem(RunStorage.key(2))).toBeNull();
    expect(localStorage.getItem('sdt-import-v1-slot2')).toBeNull();
  });
  it('导入不把新档写权交给旧运行态；完整装载采纳后才能保存', async () => {
    const api = archive(), text = await exported(api);
    RunStorage.readForLoad(1);
    const preview = await api.previewImport(text, 1);
    expect(await api.importSlot(preview.value, {confirm:true})).toEqual({ok:true});
    expect(await RunStorage.write(1, run(99))).toBe(false);
    expect(JSON.parse(localStorage.getItem(RunStorage.key(1))).hp).toBe(10);
    expect(RunStorage.acceptLoad(1, RunStorage.readForPreflight(1))).toEqual({ok:true});
    expect(await RunStorage.write(1, run(99))).toBe(true);
  });
  it('导入失败且回滚受阻时保留记录，明确恢复原档后解除写入阻断', async () => {
    const api = archive(), text = await exported(api), original = Storage.prototype.setItem;
    localStorage.setItem(Base.SLOT_KEY(2), '{original corrupt base');
    const preview = await api.previewImport(text, 2);
    let blocked = false;
    const fault = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (key, value) {
      if (key === RunStorage.key(2)) { blocked = true; throw new Error('interrupted run'); }
      if (key === Base.SLOT_KEY(2) && blocked) throw new Error('rollback blocked');
      return original.call(this, key, value);
    });
    expect((await api.importSlot(preview.value, {confirm:true})).code).toBe('IMPORT_RECOVERY_REQUIRED');
    expect(localStorage.getItem('sdt-import-v1-slot2')).not.toBeNull();
    expect(await RunStorage.write(2, run(99))).toBe(false);
    fault.mockRestore();
    expect(await api.recoverImport(2, {confirm:true})).toEqual({ok:true});
    expect(localStorage.getItem(Base.SLOT_KEY(2))).toBe('{original corrupt base');
    expect(localStorage.getItem(RunStorage.key(2))).toBeNull();
    expect(localStorage.getItem('sdt-import-v1-slot2')).toBeNull();
  });
});

it('收据保留活动局全部、永久请求及最近8局各一条', () => {
  const requests = { permanent: { result: { revision: 1, value: {} } } };
  for (let i = 0; i < 100; i++) requests[`closed:${i}`] = { result: { revision: i + 2, value: { runId: `run-${i}` } } };
  requests.active1 = { result: { revision: 200, value: { runId: 'active' } } };
  requests.active2 = { result: { revision: 201, value: { runId: 'active' } } };
  const retained = retainRunReceipts(requests, 'active');
  expect(Object.keys(retained)).toHaveLength(11);
  expect(retained).toHaveProperty('active1'); expect(retained).toHaveProperty('active2'); expect(retained).toHaveProperty('permanent');
});

it('拆包以消费一格后的净占用验收，四空位合法、三空位拒绝', () => {
  const card = { id: 'pack' }, rewards = [{ card: { id: 'a' }, count: 5 }];
  let room = 4, state = { stash: [{ card, count: 2 }] };
  const economy = createBaseEconomy({ read: () => state, room: () => room,
    mutate: work => work(state), appendCards: (draft, cards) => draft.stash.push(...cards) });
  expect(economy.openCardPack('pack', rewards)).toEqual({ ok: true });
  expect(state.stash[0].count).toBe(1);
  room = 3; expect(economy.openCardPack('pack', rewards)).toMatchObject({ ok: false, why: 'full' });
});
