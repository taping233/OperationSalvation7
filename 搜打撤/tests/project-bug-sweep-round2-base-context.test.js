import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { installImmediateWebLocks } from './helpers/web-locks.js';
import { RULES } from '../game/src/core/rules.js';

window.SDT ||= {};
window.SDT.MAP = { rules: RULES };
const { Base } = await import('../game/src/hub/base.js');
const { readBase, commitBase } = await import('../game/src/hub/base.commands.js');
const { createSaveArchive } = await import('../game/src/hub/save-archive.js');
const { RunStorage } = await import('../game/src/hub/game.storage.js');
const { createRecoveryCommands } = await import('../game/src/hub/recovery.commands.js');

beforeEach(async () => {
  installImmediateWebLocks(); localStorage.clear();
  window.SDT.MAP = { rules: RULES }; window.SDT.UI = { log: vi.fn() };
  Base.use(1); Base.data.coins = 10; Base.data.marker = 'old'; await Base.save();
});
afterEach(async () => { vi.restoreAllMocks(); await Base.flushWrites(); await RunStorage.flushWrites(); localStorage.clear(); });

function queueLocks() {
  let paused = false; const queue = [];
  const manager = { request: (_name, _options, work) => paused
    ? new Promise(resolve => queue.push(() => resolve(work()))) : Promise.resolve().then(work) };
  Object.defineProperty(navigator, 'locks', { configurable: true, value: manager });
  return { manager, queue, pause: () => { paused = true; } };
}
function prepared(requestId = 'old-request') {
  const read = readBase(1), draft = structuredClone(read.value); draft.wood++;
  return { context: { slotId: 1, expectedRevision: read.revision, requestId },
    change: { beforeRevision: read.revision, command: 'test.mutation', payload: { requestId }, afterState: draft } };
}

describe('Base领域提交绑定排队时的会话', () => {
  it('导入同revision新基地后，旧草稿不能覆盖新导入的资产', async () => {
    const locks = queueLocks();
    const source = { ...structuredClone(Base.data), marker: 'imported', coins: 999 };
    localStorage.setItem(Base.SLOT_KEY(2), JSON.stringify(source));
    const archive = createSaveArchive({ lockManager: locks.manager, digest: async value => createHash('sha256').update(value).digest('hex') });
    const exported = await archive.exportSlot(2), preview = await archive.previewImport(exported.value.text, 1);
    expect(preview.ok).toBe(true);
    const pending = prepared();
    locks.pause();
    const importing = archive.importSlot(preview.value, { confirm: true });
    const committing = commitBase(pending.context, pending.change);
    expect(locks.queue).toHaveLength(2);
    locks.queue.shift()(); expect(await importing).toEqual({ ok: true });
    const imported = localStorage.getItem(Base.SLOT_KEY(1));
    locks.queue.shift()();
    const result = await committing;
    while (locks.queue.length) locks.queue.shift()();
    expect(result).toMatchObject({ ok: false, code: 'STALE_SLOT' });
    expect(localStorage.getItem(Base.SLOT_KEY(1))).toBe(imported);
    expect(Base.data).toMatchObject({ coins: 999, marker: 'imported', wood: 0 });
  });
  it.each(['same-slot', 'switch-back'])('重新进入会话 %s 后废弃旧排队草稿', async kind => {
    const pending = prepared(), locks = queueLocks(); locks.pause();
    const writing = commitBase(pending.context, pending.change);
    if (kind === 'switch-back') Base.use(2);
    Base.use(1);
    const raw = localStorage.getItem(Base.SLOT_KEY(1));
    locks.queue.shift()();
    expect(await writing).toMatchObject({ ok: false, code: 'STALE_SLOT' });
    expect(localStorage.getItem(Base.SLOT_KEY(1))).toBe(raw);
  });
  it('未替换的同档提交成功；之后按新revision发起的连续命令仍成功', async () => {
    const first = prepared('first'), locks = queueLocks(); locks.pause();
    const writing = commitBase(first.context, first.change);
    locks.queue.shift()(); expect((await writing).ok).toBe(true);
    const second = prepared('second');
    const next = commitBase(second.context, second.change);
    locks.queue.shift()(); expect((await next).ok).toBe(true);
    expect(Base.data.wood).toBe(2);
  });
  it('同一请求并发排队可重放首次成功回执，普通前一笔交易不会废弃会话', async () => {
    const first = prepared('same'), locks = queueLocks(); locks.pause();
    const writing = commitBase(first.context, first.change), duplicate = commitBase(first.context, first.change);
    locks.queue.shift()(); const result = await writing;
    locks.queue.shift()(); expect(await duplicate).toEqual(result);
    expect(result.ok).toBe(true); expect(Base.data.wood).toBe(1);
  });
  it('双键结算排队后导入相同runId/revision的新档，不允许旧结算覆盖基地并删除对局', async () => {
    await RunStorage.remove(1);
    expect(await RunStorage.write(1, { seed: 'pair-context', nestActive: true, ownedCards: [], inventory: [] })).toBe(true);
    const run = JSON.parse(localStorage.getItem(RunStorage.key(1))), beforeBase = structuredClone(Base.data);
    localStorage.setItem(Base.SLOT_KEY(2), JSON.stringify({ ...beforeBase, marker: 'pair-imported', coins: 777 }));
    localStorage.setItem(RunStorage.key(2), JSON.stringify(run));
    const locks = queueLocks();
    const archive = createSaveArchive({ lockManager: locks.manager, digest: async value => createHash('sha256').update(value).digest('hex') });
    const recovery = createRecoveryCommands({ storage: localStorage, lockManager: locks.manager, baseApi: Base, runStore: RunStorage });
    const exported = await archive.exportSlot(2), preview = await archive.previewImport(exported.value.text, 1);
    expect(preview.ok).toBe(true);
    locks.pause();
    const importing = archive.importSlot(preview.value, { confirm: true });
    const committing = recovery.commitBaseAndRun({ slotId: 1, requestId: 'old-terminal', expectedBaseRevision: beforeBase._m01.revision,
      expectedRunRevision: run._r2.revision }, { command: 'run.abandon', runId: run._r2.runId, payload: {}, afterBase: beforeBase, afterRun: null });
    locks.queue.shift()(); expect(await importing).toEqual({ ok: true });
    const imported = localStorage.getItem(Base.SLOT_KEY(1));
    locks.queue.shift()();
    const result = await committing;
    while (locks.queue.length) locks.queue.shift()();
    expect(result).toMatchObject({ ok: false, code: 'STALE_SLOT' });
    expect(localStorage.getItem(Base.SLOT_KEY(1))).toBe(imported);
    expect(localStorage.getItem(RunStorage.key(1))).toBe(JSON.stringify(run));
    expect(localStorage.getItem('sdt-tx-v1-slot1')).toBeNull();
  });
});

describe('Run检查点排队时的档位身份', () => {
  it('导入空档后，原对局排队的自动保存不能复活旧Run', async () => {
    await RunStorage.remove(1);
    const old = { seed: 'obsolete-before-empty-import', nestActive: true, ownedCards: [], inventory: [] };
    expect(await RunStorage.write(1, old)).toBe(true);
    const locks = queueLocks();
    const archive = createSaveArchive({ lockManager: locks.manager, digest: async value => createHash('sha256').update(value).digest('hex') });
    const exported = await archive.exportSlot(2), preview = await archive.previewImport(exported.value.text, 1);
    expect(preview.ok).toBe(true);
    locks.pause();
    const importing = archive.importSlot(preview.value, { confirm: true });
    const writing = RunStorage.write(1, old);
    locks.queue.shift()(); expect(await importing).toEqual({ ok: true });
    locks.queue.shift()();
    expect(await writing).toBe(false);
    expect(localStorage.getItem(RunStorage.key(1))).toBeNull();
    expect(RunStorage.lastWriteIssue(1)).toBe('STALE_SLOT');
    const fresh = RunStorage.write(1, { seed: 'new-after-empty-import', ownedCards: [], inventory: [] });
    locks.queue.shift()(); expect(await fresh).toBe(true);
    expect(RunStorage.read(1).seed).toBe('new-after-empty-import');
  });
  it('删除档位后，已排队的旧Run保存不能重新创建刚删掉的局', async () => {
    await RunStorage.remove(1);
    const old = { seed: 'obsolete-before-remove', nestActive: true, ownedCards: [], inventory: [] };
    expect(await RunStorage.write(1, old)).toBe(true);
    const locks = queueLocks(); locks.pause();
    const removing = RunStorage.remove(1), writing = RunStorage.write(1, old);
    locks.queue.shift()(); expect(await removing).toBe(true);
    locks.queue.shift()(); expect(await writing).toBe(false);
    expect(localStorage.getItem(RunStorage.key(1))).toBeNull();
  });
  it('同一局连续排队检查点仍按顺序保存最新状态', async () => {
    await RunStorage.remove(1);
    expect(await RunStorage.write(1, { seed: 'same-run', hp: 10 })).toBe(true);
    const identity = RunStorage.readIdentity(1).value.runId, locks = queueLocks(); locks.pause();
    const first = RunStorage.write(1, { seed: 'same-run', hp: 9 }), second = RunStorage.write(1, { seed: 'same-run', hp: 8 });
    locks.queue.shift()(); expect(await first).toBe(true);
    locks.queue.shift()(); expect(await second).toBe(true);
    expect(RunStorage.read(1).hp).toBe(8); expect(RunStorage.readIdentity(1).value.runId).toBe(identity);
  });
  it('完整读档采纳后废弃此前排队的旧内存检查点', async () => {
    await RunStorage.remove(1);
    expect(await RunStorage.write(1, { seed: 'same-run', hp: 10 })).toBe(true);
    const locks = queueLocks(); locks.pause();
    const old = RunStorage.write(1, { seed: 'same-run', hp: 1 });
    expect(RunStorage.acceptLoad(1, RunStorage.readForPreflight(1))).toEqual({ ok: true });
    locks.queue.shift()(); expect(await old).toBe(false);
    expect(RunStorage.read(1).hp).toBe(10);
  });
});
