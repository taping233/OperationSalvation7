import { beforeEach, describe, expect, it, vi } from 'vitest';

window.SDT = window.SDT || { Icons: { img: () => '' } };
await import('../game/src/base.js');
const { readBase, readBaseReceipt, commitBase } = await import('../game/src/base.commands.js');

const Base = window.SDT.Base;
const key = slot => `sdt-base-v2-slot${slot}`;
const copy = value => JSON.parse(JSON.stringify(value));

function changeFor(read, mutate, command = 'home.commitLayout', payload = { layoutId: 'layout-a' }, output) {
  const afterState = copy(read.value);
  mutate(afterState);
  return { beforeRevision: read.revision, command, payload, afterState,
    events: [{ type: 'home.changed', payload: { layoutId: payload.layoutId || 'layout-a' } }], output };
}

describe('M01 基地快照与提交边界', () => {
  beforeEach(() => localStorage.clear());

  it('M01-B：标题页未选档拒绝写命令', async () => {
    const read = readBase(1);
    const change = changeFor(read, state => { state.home.placements.push({ instanceId: 'chair-1' }); });
    const result = await commitBase({ slotId: 1, requestId: 'title-write', expectedRevision: read.revision }, change);
    expect(result).toMatchObject({ ok: false, code: 'INVALID_STATE' });
    expect(localStorage.getItem(key(1))).toBeNull();
  });

  it('M01-A：旧字段完整保留，新增分组补默认值，迁移读取可重复且快照只读', () => {
    const legacy = {
      version: 1, wood: 12, rations: 3, coins: 19, safeUp: 2,
      stash: [{ card: { id: 'old-card', name: '旧卡' }, count: 2 }],
      collection: { 'old-card': { name: '旧卡', rarity: '稀有', ts: 7 } },
    };
    const run = JSON.stringify({ version: 2, turn: 4, battleId: 'ongoing' });
    localStorage.setItem(key(1), JSON.stringify(legacy));
    localStorage.setItem('sdt-save-v2-slot1', run);

    const first = readBase(1);
    const second = readBase(1);
    expect(first).toEqual(second);
    expect(first.value).toMatchObject({
      wood: 12, rations: 3, coins: 19,
      stash: legacy.stash, collection: legacy.collection,
      home: { owned: {}, placements: [], displays: [] },
      appearance: { characterSkins: {}, selectedSkins: {} },
      goals: { tracked: [], presets: {} }, story: { flags: {}, outcomes: {} },
    });
    expect(first.value.pets.dog.ts).toBe(0);
    expect(Object.isFrozen(first.value)).toBe(true);
    expect(Object.isFrozen(first.value.home)).toBe(true);
    expect(() => first.value.home.placements.push({})).toThrow();
    expect(localStorage.getItem('sdt-save-v2-slot1')).toBe(run);
  });

  it('M01-A：未来版本与损坏档拒绝被历史 save 或新门面覆盖', async () => {
    const future = JSON.stringify({ version: Base.BASE_VERSION + 1, coins: 999 });
    localStorage.setItem(key(1), future);
    Base.use(1);
    Base.data.coins = 0;
    expect(Base.save()).toBe(false);
    expect(localStorage.getItem(key(1))).toBe(future);
    expect(readBase(1)).toMatchObject({ ok: false, code: 'INVALID_STATE' });

    const context = { slotId: 1, requestId: 'future-write', expectedRevision: 0 };
    const result = await commitBase(context, {
      beforeRevision: 0, command: 'home.purchase', payload: { furnitureId: 'chair' },
      afterState: { coins: 0, home: { owned: {}, placements: [], displays: [] } },
    });
    expect(result).toMatchObject({ ok: false, code: 'INVALID_STATE' });
    expect(localStorage.getItem(key(1))).toBe(future);

    const broken = '{broken';
    localStorage.setItem(key(2), broken);
    Base.use(2);
    expect(Base.save()).toBe(false);
    expect(localStorage.getItem(key(2))).toBe(broken);
  });

  it('M01-B：只写目标档位，档位 2～5 原始内容不变', async () => {
    const untouched = {};
    for (let slot = 2; slot <= 5; slot++) {
      untouched[slot] = JSON.stringify({ version: 2, wood: slot, marker: `slot-${slot}` });
      localStorage.setItem(key(slot), untouched[slot]);
    }
    Base.use(1);
    const read = readBase(1);
    const placement = { instanceId: 'chair-1', furnitureId: 'chair', zoneId: 'floor', x: 2, y: 3, rotation: 0 };
    const change = changeFor(read, state => { state.home.owned.chair = ['chair-1']; state.home.placements = [placement]; });
    const result = await commitBase({ slotId: 1, requestId: 'layout-slot-1', expectedRevision: read.revision }, change);

    expect(result).toMatchObject({ ok: true, revision: read.revision + 1 });
    expect(Base.data.home.placements).toEqual([placement]);
    for (let slot = 2; slot <= 5; slot++) expect(localStorage.getItem(key(slot))).toBe(untouched[slot]);
  });

  it('M01-C：写失败时内存与磁盘不变，重试只成功写入一次', async () => {
    Base.use(1);
    Base.data.coins = 50;
    Base.save();
    const read = readBase(1);
    const change = changeFor(read, state => {
      state.coins -= 10;
      state.home.owned.chair = ['chair-c'];
      state.home.placements = [{ instanceId: 'chair-c', furnitureId: 'chair', zoneId: 'floor', x: 0, y: 0, rotation: 0 }];
    }, 'home.purchase', { furnitureId: 'chair', cost: 10 }, { instanceId: 'chair-c', coins: 40 });
    const beforeMemory = copy(Base.data);
    const beforeDisk = localStorage.getItem(key(1));
    const published = [];
    const onDomainEvent = event => published.push(event.detail);
    window.addEventListener('sdt:domain-event', onDomainEvent);
    const nativeSet = Storage.prototype.setItem;
    const failedWrite = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (name, value) {
      if (name === key(1)) throw new DOMException('quota', 'QuotaExceededError');
      return nativeSet.call(this, name, value);
    });
    const context = { slotId: 1, requestId: 'purchase-retry', expectedRevision: read.revision };
    const failed = await commitBase(context, change);
    failedWrite.mockRestore();

    expect(failed).toMatchObject({ ok: false, code: 'SAVE_FAILED', retryable: true });
    expect(Base.data).toEqual(beforeMemory);
    expect(localStorage.getItem(key(1))).toBe(beforeDisk);
    expect(published).toEqual([]);

    let targetWrites = 0;
    const successfulWrite = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (name, value) {
      if (name === key(1)) targetWrites++;
      return nativeSet.call(this, name, value);
    });
    const first = await commitBase(context, change);
    const retry = await commitBase(context, change);
    successfulWrite.mockRestore();
    window.removeEventListener('sdt:domain-event', onDomainEvent);
    expect(first).toEqual(retry);
    expect(first.value.output).toEqual({ instanceId: 'chair-c', coins: 40 });
    expect(targetWrites).toBe(1);
    expect(published).toHaveLength(1);
    expect(published[0]).toMatchObject({ type: 'home.changed', slotId: 1, revision: first.revision });
    expect(Base.data.coins).toBe(40);
  });

  it('M01-D：重载后重放原收据，异参冲突，新请求旧修订号失败', async () => {
    Base.use(1);
    const read = readBase(1);
    const payload = { cardId: 'card-a', count: 1 };
    const change = changeFor(read, state => { state.collection['card-a'] = { name: 'A', rarity: '稀有', ts: 1 }; },
      'collection.commit', payload, { cardId: 'card-a', registered: true });
    const context = { slotId: 1, requestId: 'collect-once', expectedRevision: read.revision };
    const committed = await commitBase(context, change);
    Base.use(1); // 模拟页面重开后从持久层恢复

    expect(readBaseReceipt(context, { command: 'collection.commit', payload })).toEqual(committed);
    expect(await commitBase(context, change)).toEqual(committed);
    expect(readBaseReceipt(context, { command: 'collection.commit', payload: { cardId: 'card-b', count: 1 } }))
      .toMatchObject({ ok: false, code: 'REQUEST_ID_CONFLICT' });

    const staleRead = readBase(1);
    Base.data.wood += 1;
    Base.save(); // 历史直写也推进 revision，并保留已有请求记录
    const staleChange = changeFor(staleRead, state => { state.home.displays.push({ slotId: 'wall-1', ref: { kind: 'collection', refId: 'card-a' } }); });
    expect(await commitBase({ slotId: 1, requestId: 'new-stale-request', expectedRevision: staleRead.revision }, staleChange))
      .toMatchObject({ ok: false, code: 'STALE_REVISION' });
    expect(readBaseReceipt(context, { command: 'collection.commit', payload })).toEqual(committed);
  });
});
