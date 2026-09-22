import { beforeEach, describe, expect, it, vi } from 'vitest';

window.SDT = window.SDT || { Icons: { img: () => '' } };
await import('../game/src/cards.js');
const { readBase } = await import('../game/src/base.commands.js');
const {
  convertCollection, getCharacter, getCollection, selectSkin, stackKeyOf,
} = await import('../game/src/collection.commands.js');

const Base = window.SDT.Base;
const Cards = window.SDT.Cards;
Cards.ensureTabletop();
const SLOT = 5;
const CARD_ID = 'tt7-throwblade';
const card = () => Cards.all().find(item => item.id === CARD_ID);
const context = requestId => {
  const read = readBase(SLOT);
  if (!read.ok) throw new Error(read.message);
  return { slotId: SLOT, requestId, expectedRevision: read.revision };
};
const put = (item, count = 1) => {
  Base.data.stash.push({ card: { ...item }, count });
  Base.save();
  return stackKeyOf(Base.data.stash.at(-1));
};

beforeEach(() => {
  Base.wipe(SLOT);
  Base.use(SLOT);
  Base.save();
});

describe('M02-A/B 收藏转换与幂等事务', () => {
  it('真实职业卡 2→1→0，首次只登记一次，两次都按现行规则增加 10 XP', async () => {
    const key = put(card(), 2);
    const first = await convertCollection(context('m02-a-1'), { stackKey: key, count: 1 });
    expect(first.ok).toBe(true);
    expect(first.value.firstRegistrations).toEqual([{ cardId: CARD_ID }]);
    expect(first.value.xpChanges[0]).toMatchObject({ characterId: 'wu', before: { lv: 1, xp: 0 }, after: { lv: 1, xp: 10 } });
    expect(Base.data.stash.find(stack => stack.card.id === CARD_ID).count).toBe(1);

    const second = await convertCollection(context('m02-a-2'), { stackKey: key, count: 1 });
    expect(second.ok).toBe(true);
    expect(second.value.firstRegistrations).toEqual([]);
    expect(second.value.xpChanges[0].after).toEqual({ lv: 1, xp: 20 });
    expect(Base.data.stash.some(stack => stack.card.id === CARD_ID)).toBe(false);
    expect(Object.keys(Base.data.collection).filter(id => id === CARD_ID)).toHaveLength(1);
  });

  it('同请求重试返回原收据且不重复扣卡/加经验；异参冲突', async () => {
    const key = put(card(), 2);
    const ctx = context('m02-b-retry');
    const first = await convertCollection(ctx, { stackKey: key, count: 1 });
    const retry = await convertCollection(ctx, { stackKey: key, count: 1 });
    expect(retry).toEqual(first);
    expect(Base.data.stash.find(stack => stack.card.id === CARD_ID).count).toBe(1);
    expect(Base.data.characters.wu).toEqual({ lv: 1, xp: 10 });
    expect((await convertCollection(ctx, { stackKey: key, count: 2 })).code).toBe('REQUEST_ID_CONFLICT');
  });

  it('数量不足和存储失败均不留下部分写入', async () => {
    const key = put(card(), 1);
    const beforeShort = JSON.stringify(Base.data);
    const short = await convertCollection(context('m02-b-short'), { stackKey: key, count: 2 });
    expect(short.code).toBe('INSUFFICIENT_CARDS');
    expect(JSON.stringify(Base.data)).toBe(beforeShort);

    const beforeMemory = JSON.stringify(Base.data);
    const beforeDisk = localStorage.getItem('sdt-base-v2-slot5');
    const original = Storage.prototype.setItem;
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (key2, value) {
      if (key2 === 'sdt-base-v2-slot5') throw new Error('quota');
      return original.call(this, key2, value);
    });
    const failed = await convertCollection(context('m02-b-save-fail'), { stackKey: key, count: 1 });
    spy.mockRestore();
    expect(failed.code).toBe('SAVE_FAILED');
    expect(JSON.stringify(Base.data)).toBe(beforeMemory);
    expect(localStorage.getItem('sdt-base-v2-slot5')).toBe(beforeDisk);
  });
});

describe('M02-C/D 永久展示、里程碑与满级', () => {
  it('实体卡耗尽后永久登记仍可展示，但 ownedCount/canConvert 不伪造战力', async () => {
    const key = put(card(), 1);
    await convertCollection(context('m02-c'), { stackKey: key, count: 1 });
    const snapshot = readBase(SLOT).value;
    const diskBeforeQuery = localStorage.getItem('sdt-base-v2-slot5');
    const view = getCollection(snapshot, Cards).find(item => item.card.cardId === CARD_ID);
    expect(view).toMatchObject({ registered: true, ownedCount: 0, canConvert: false, characterId: 'wu' });
    expect(Object.isFrozen(view)).toBe(true);
    expect(getCharacter(snapshot, 'wu')).toMatchObject({ characterId: 'wu', level: 1, xp: 10 });
    expect(localStorage.getItem('sdt-base-v2-slot5')).toBe(diskBeforeQuery);
    Base.data.collection['retired-card-id'] = { name: '退役收藏', rarity: '职业', ts: 1 };
    Base.save();
    expect(getCollection(readBase(SLOT).value, Cards).find(item => item.card.cardId === 'retired-card-id'))
      .toMatchObject({ registered: true, ownedCount: 0, canConvert: false });
  });

  it('新达成里程碑只回报可领取，不自动发奖；满级不虚构 nextReward', async () => {
    const pool = Cards.all().filter(item => item.cls && (item.rarity === '职业' || item.type === '能力卡'));
    pool.slice(0, 4).forEach((item, index) => {
      Base.data.collection[item.id] = { name: item.name, rarity: item.rarity, ts: index + 1 };
    });
    const fifth = pool[4];
    const key = put(fifth, 1);
    const woodBefore = Base.data.wood;
    const result = await convertCollection(context('m02-d-ms'), { stackKey: key, count: 1 });
    expect(result.value.newUnlocks).toContain('m5');
    expect(result.value.rewards).toEqual([]);
    expect(Base.data.wood).toBe(woodBefore);
    expect(Base.data.collClaimed.m5).toBeUndefined();

    Base.data.characters.xingyue = { lv: 10, xp: 0 };
    Base.save();
    const character = getCharacter(readBase(SLOT).value, 'xingyue');
    expect(character.maxed).toBe(true);
    expect(character).not.toHaveProperty('nextReward');
  });
});

describe('M02-E 外观资格与持久化', () => {
  it('既有皮肤可选且重载保持，未知皮肤不写档', async () => {
    const selected = await selectSkin(context('m02-e-select'), { characterId: 'wu', skinId: 'casual' });
    expect(selected.ok).toBe(true);
    expect(selected.value).toMatchObject({ characterId: 'wu', selectedSkinId: 'casual', assetFallback: false });
    Base.use(SLOT);
    expect(getCharacter(readBase(SLOT).value, 'wu').selectedSkinId).toBe('casual');

    const before = localStorage.getItem('sdt-base-v2-slot5');
    const unknown = await selectSkin(context('m02-e-unknown'), { characterId: 'wu', skinId: 'does-not-exist' });
    expect(unknown.code).toBe('NOT_FOUND');
    expect(localStorage.getItem('sdt-base-v2-slot5')).toBe(before);
  });

  it('已解锁但缺当前场景素材的皮肤保留选择并标记默认图回退', async () => {
    Base.data.appearance ||= { characterSkins: {}, selectedSkins: {} };
    Base.data.appearance.characterSkins.wu = ['legacy-missing-art'];
    Base.save();
    const result = await selectSkin(context('m02-e-fallback'), { characterId: 'wu', skinId: 'legacy-missing-art' });
    expect(result.ok).toBe(true);
    expect(result.value).toMatchObject({ selectedSkinId: 'legacy-missing-art', assetFallback: true, fallbackSkinId: 'default' });
    expect(readBase(SLOT).value.appearance.characterSkins.wu).toContain('legacy-missing-art');
  });
});
