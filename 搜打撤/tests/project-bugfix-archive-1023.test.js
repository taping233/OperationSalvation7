import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { RULES } from '../game/src/core/rules.js';
import { installImmediateWebLocks } from './helpers/web-locks.js';
window.SDT ||= {};
window.SDT.MAP = { rules: RULES };
const { Base } = await import('../game/src/hub/base.js');
const { RunStorage } = await import('../game/src/hub/game.storage.js');
const { createSaveArchive } = await import('../game/src/hub/save-archive.js');
const digest = async text => createHash('sha256').update(text).digest('hex');
beforeEach(async () => {
  installImmediateWebLocks(); localStorage.clear();
  for (let slot = 1; slot <= 5; slot++) await RunStorage.remove(slot);
  Base.use(1); expect(await Base.save()).toBe(true);
});
afterEach(async () => { vi.restoreAllMocks(); await Base.flushWrites(); await RunStorage.flushWrites(); localStorage.clear(); });

async function previewSource(api, source = Base.data) {
  localStorage.setItem(Base.SLOT_KEY(2), JSON.stringify(source));
  const exported = await api.exportSlot(2); expect(exported.ok).toBe(true);
  return api.previewImport(exported.value.text, 1);
}

describe('整档服务的排队所有权与子结构预检', () => {
  it('导入非空新档后拒绝在旧档发起、尚在排队的复原命令', async () => {
    const original = { id: 'old-pocket', name: '旧消耗牌' }, imported = { id: 'new-pocket', name: '新消耗牌' };
    Base.data.keys = 10; Base.data.pocket = [{ card: original, count: 1 }];
    expect(await Base.save()).toBe(true);
    let paused = false; const queue = [];
    const manager = { request: (_name, _options, work) => paused
      ? new Promise(resolve => queue.push(() => resolve(work()))) : Promise.resolve().then(work) };
    Object.defineProperty(navigator, 'locks', { configurable: true, value: manager });
    const api = createSaveArchive({ digest, lockManager: manager });
    const preview = await previewSource(api, { ...structuredClone(Base.data), pocket: [{ card: imported, count: 1 }] });
    expect(preview.ok).toBe(true); paused = true;
    const importing = api.importSlot(preview.value, { confirm: true });
    const restoring = Base.restore(0);
    expect(queue).toHaveLength(2);
    queue.shift()(); expect(await importing).toEqual({ ok: true });
    queue.shift()();
    expect(await restoring).toBe(false);
    expect(Base.data.keys).toBe(10); expect(Base.data.pocket).toEqual([{ card: imported, count: 1 }]);
    expect(Base.data.stash).toEqual([]);
  });

  it.each([
    { appearance: { characterSkins: { wu: 3 }, selectedSkins: {} } },
    { appearance: { characterSkins: { wu: ['default', 3] }, selectedSkins: {} } },
    { appearance: { characterSkins: {}, selectedSkins: { wu: { id: 'default' } } } },
  ])('导入前拒绝人物皮肤消费者无法使用的子结构 %j', async changes => {
    const before = localStorage.getItem(Base.SLOT_KEY(1));
    const result = await previewSource(createSaveArchive({ digest }), { ...structuredClone(Base.data), ...changes });
    expect(result).toMatchObject({ ok: false, code: 'INVALID_BASE_ARCHIVE' });
    expect(localStorage.getItem(Base.SLOT_KEY(1))).toBe(before);
  });

  it('保留旧档中暂不在当前资源表的皮肤字符串ID', async () => {
    const source = { ...structuredClone(Base.data), appearance: {
      characterSkins: { wu: ['retired-skin'] }, selectedSkins: { wu: 'retired-skin' } } };
    const api = createSaveArchive({ digest });
    const preview = await previewSource(api, source);
    expect(preview.ok).toBe(true);
    expect(await api.importSlot(preview.value, { confirm: true })).toEqual({ ok: true });
    expect(Base.data.appearance).toEqual(source.appearance);
  });
});
