import { describe, expect, it } from 'vitest';
import { presentHome, homeErrorMessage } from '../game/src/home/home.presenter.js';
import { readBase } from '../game/src/hub/base.commands.js';
import { buyFurniture } from '../game/src/home/home.commands.js';

const snapshot = () => ({
  coins: 12, wood: 3, rations: 4, selClass: 'wu',
  home: { owned: { chair: ['chair-1'] }, placements: [], displays: [{ slotId: 'display-left', ref: { kind: 'collection', refId: 'card-a' } }] },
  collection: { 'card-a': { name: '长名字收藏卡' } }, stash: [], characters: {}, appearance: {},
});

describe('M05 presenter', () => {
  it('只读组合 M02/M03 快照，不改源数据并保留修订号', () => {
    const source = snapshot();
    const before = structuredClone(source);
    const view = presentHome(source, { revision: 7, cardCatalog: [{ id: 'card-a', name: '长名字收藏卡', cls: '武', rarity: '职业' }] });
    expect(view.revision).toBe(7);
    expect(view.resources).toEqual({ coins: 12, wood: 3, rations: 4 });
    expect(view.collectionDisplays[0].label).toBe('长名字收藏卡');
    expect(view.collectionDisplays[0].ownedCount).toBe(0);
    expect(view.home.room).toMatchObject({ id: 'base-room-01', width: 8, height: 6 });
    expect(source).toEqual(before);
    expect(Object.isFrozen(view)).toBe(true);
  });

  it('消费真实 readBase 的公开修订号后可以购买，不依赖被隐藏的提交元数据', async () => {
    const base = window.SDT.Base;
    base.wipe(5);
    base.use(5);
    base.data.coins = 6;
    expect(base.save()).toBe(true);
    const read = readBase(5);
    expect(read.ok).toBe(true);
    expect(read.value._m01).toBeUndefined();
    const view = presentHome(read.value, { revision: read.revision, cardCatalog: [] });
    const result = await buyFurniture({ slotId: 5, requestId: 'presenter-real-purchase', expectedRevision: view.revision }, { furnitureId: 'chair', quantity: 1 });
    expect(result.ok).toBe(true);
    expect(readBase(5).value.coins).toBe(3);
    expect(readBase(5).value.home.owned.chair).toHaveLength(1);
  });

  it('失败文案不伪报成功', () => {
    expect(homeErrorMessage({ ok: false, code: 'SAVE_FAILED' })).toContain('原布局');
    expect(homeErrorMessage({ ok: false, code: 'STALE_REVISION' })).toContain('刷新');
  });
});
