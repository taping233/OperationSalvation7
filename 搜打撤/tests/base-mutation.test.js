import { installImmediateWebLocks } from './helpers/web-locks.js';
installImmediateWebLocks();
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { commitBaseMutation } from '../game/src/hub/base-mutation.js';
import { RULES } from '../game/src/core/rules.js';
import { Random } from '../game/src/core/random.js';

await import('../game/src/hub/base.js');
await import('../game/src/hub/meta.js');
const Base = window.SDT.Base;
const card = { id: 'audit-card', name: '审计卡', type: '武术', rarity: '古朴' };
const read = () => JSON.parse(localStorage.getItem(Base.SLOT_KEY(1)));

beforeEach(async () => {
  localStorage.clear();
  window.SDT.MAP = { rules: RULES };
  window.SDT.Sound = { sfx: vi.fn() };
  window.SDT.UI = { log: vi.fn() };
  window.SDT.Cards = { sellPrice: () => 3 };
  Base.use(1);
  Object.assign(Base.data, {
    wood: 10, rations: 20, coins: 80, keys: 10,
    runes: [{ kind: 'red' }, { kind: 'blue' }],
    stash: [{ card, count: 2 }], pocket: [{ card, count: 2 }],
  });
  expect((await Base.save())).toBe(true);
});
afterEach(() => vi.restoreAllMocks());

function failWrites() {
  const original = Storage.prototype.setItem;
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (key, value) {
    if (key === Base.SLOT_KEY(1)) throw new Error('quota');
    return original.call(this, key, value);
  });
}

describe('基地同步草稿提交', () => {
  it.each([['古朴', 2], ['稀有', 3], ['史诗', 4], ['传说', 5]])('仓库%s按稀有度售出，整堆收入保存后读档一致', async (rarity, price) => {
    Base.data.stash = [{ card: { ...card, rarity, value: 99 }, count: 3 }];
    await Base.save();
    expect(await Base.sellStashCards(card.name, 3)).toMatchObject({ ok: true, qty: 3, coins: price * 3 });
    expect(Base.data.coins).toBe(80 + price * 3);
    Base.use(1);
    expect(Base.data.coins).toBe(80 + price * 3);
    expect(Base.data.stash).toEqual([]);
  });

  it('符文不足时能力判定和执行均拒绝，木材不变', async () => {
    Base.data.stashUp = 9;
    Base.data.runes = [];
    (await Base.save());
    const before = structuredClone(Base.data);
    expect(Base.stashCap()).toBe(52);
    expect(Base.canUpgradeStash()).toBe(false);
    expect((await Base.upgradeStash())).toBe(false);
    expect(Base.data).toEqual(before);
    expect(read()).toEqual(before);
  });

  it.each(['upgradeBag', 'upgradeStash', 'upgradeNestBag'])('%s 保存失败不扣资源/升级/播成功音', async method => {
    const before = structuredClone(Base.data);
    failWrites();
    expect((await Base[method]())).toBe(false);
    expect(Base.data).toEqual(before);
    expect(read()).toEqual(before);
    expect(window.SDT.Sound.sfx).not.toHaveBeenCalled();
  });

  it('宠物升级失败不扣口粮且保留等级', async () => {
    const before = structuredClone(Base.data);
    failWrites();
    expect((await Base.upgradePet('dog'))).toBe(false);
    expect(Base.data).toEqual(before);
  });

  it('卡背选择失败返回false并保留原选择', async () => {
    Base.data.backs.wolf = true;
    (await Base.save());
    const before = structuredClone(Base.data);
    failWrites();
    expect((await Base.setBack('wolf'))).toBe(false);
    expect(Base.data).toEqual(before);
  });

  it('其他标签页更新档位后拒绝旧基地升级且保留两边状态', async () => {
    const before = structuredClone(Base.data);
    const external = { ...before, wood: 100 };
    localStorage.setItem(Base.SLOT_KEY(1), JSON.stringify(external));
    expect((await Base.upgradeBag())).toBe(false);
    expect(Base.data).toEqual(before);
    expect(read()).toEqual(external);
  });

  it('待恢复双键事务期间，旧基地入口不能改变内存', async () => {
    const before = structuredClone(Base.data);
    localStorage.setItem('sdt-tx-v1-slot1', '{}');
    expect((await Base.upgradeBag())).toBe(false);
    expect(Base.data).toEqual(before);
  });

  it('成功升级只写一次，回读资源与容量一致', async () => {
    Base.data.stashUp = 9;
    (await Base.save());
    const spy = vi.spyOn(Storage.prototype, 'setItem');
    expect((await Base.upgradeStash())).toBe(true);
    expect(spy.mock.calls.filter(([key]) => key === Base.SLOT_KEY(1))).toHaveLength(1);
    expect(Base.stashCap()).toBe(55);
    expect(Base.data.wood).toBe(8);
    expect(Base.data.runes).toEqual([]);
    expect(read()).toEqual(Base.data);
  });

  it('复原整堆只提交一次；失败时不消耗钥匙和口袋', async () => {
    const before = structuredClone(Base.data);
    failWrites();
    expect((await Base.restore(0))).toBe(false);
    expect(Base.data).toEqual(before);
    vi.restoreAllMocks();
    const spy = vi.spyOn(Storage.prototype, 'setItem');
    expect((await Base.restore(0))).toBe(true);
    expect(spy.mock.calls.filter(([key]) => key === Base.SLOT_KEY(1))).toHaveLength(1);
    expect(Base.data.keys).toBe(8);
    expect(Base.data.stash[0].count).toBe(4);
    expect(Base.data.pocket).toEqual([]);
  });

  it('出售、取卡、入库与收藏在失败时保持状态，收藏失败区别于取消', async () => {
    const before = structuredClone(Base.data);
    failWrites();
    expect((await Base.sellStashCards(card.name, 1))).toMatchObject({ ok: false, why: 'save' });
    expect((await Base.takeStashCards(card.name, 1))).toBe(0);
    expect((await Base.depositCards([{ card, count: 1 }]))).toBe(false);
    expect((await Base.deposit([{ name: '木材', count: 3 }]))).toBe(false);
    expect((await Base.collectToggle(card))).toBeNull();
    expect(Base.data).toEqual(before);
  });

  it('孵化保存失败不消耗蛋、币或发宠物，材料使用失败不吞卡', async () => {
    Base.data.stash = [
      { card: { id: Base.PET_EGG_ID, name: '蛋' }, count: 1 },
      { card: { id: 'wood', name: '木材', type: '资源', desc: '木材 ×3' }, count: 2 },
    ];
    (await Base.save());
    const before = structuredClone(Base.data);
    Random.reseed('base-mutation-hatch');
    failWrites();
    expect((await Base.hatchPet())).toMatchObject({ ok: false, why: 'save' });
    expect((await Base.useStashMaterial('木材', true))).toMatchObject({ ok: false, why: 'save' });
    expect(Base.data).toEqual(before);
  });

  it('隔离嵌套草稿，准备异常和异步生产者都不能提交', () => {
    const state = { bag: { count: 2 } };
    const persist = vi.fn(() => false);
    expect(commitBaseMutation(state, draft => { draft.bag.count--; return 1; }, persist)).toEqual({ ok: false, code: 'SAVE_FAILED' });
    expect(state.bag.count).toBe(2);
    persist.mockClear();
    expect(() => commitBaseMutation(state, () => { throw new Error('prepare'); }, persist)).toThrow('prepare');
    expect(() => commitBaseMutation(state, async draft => { draft.bag.count--; }, persist)).toThrow('synchronous');
    expect(persist).not.toHaveBeenCalled();
  });

  it('收藏成功保留未变化的仓库卡堆引用，失败仍不改任何引用', async () => {
    const stash = Base.data.stash;
    const stack = stash[0];
    const characters = structuredClone(Base.data.characters);
    expect((await Base.collectToggle(card))).toBe(true);
    expect(Base.isCollected(card)).toBe(true);
    expect(Base.isCollectionProtected(card)).toBe(true);
    expect(Base.data.characters).toEqual(characters);
    expect(Base.data.stash).toBe(stash);
    expect(Base.data.stash[0]).toBe(stack);
    const collection = Base.data.collection;
    failWrites();
    expect((await Base.collectToggle(card))).toBeNull();
    expect(Base.data.collection).toBe(collection);
    expect(Base.data.stash[0]).toBe(stack);
  });

  it('购买失败不先扣币；成功买材料和卡都只提交一次', async () => {
    const before = structuredClone(Base.data);
    failWrites();
    expect((await Base.purchase({ price: 5, card }))).toMatchObject({ ok: false, why: 'save' });
    expect((await Base.purchase({ price: 5, material: 'wood' }))).toMatchObject({ ok: false, why: 'save' });
    expect(Base.data).toEqual(before);
    vi.restoreAllMocks();
    const spy = vi.spyOn(Storage.prototype, 'setItem');
    expect((await Base.purchase({ price: 5, card }))).toEqual({ ok: true });
    expect(Base.data.coins).toBe(75);
    expect(Base.data.stash[0].count).toBe(3);
    expect((await Base.purchase({ price: 5, material: 'wood' }))).toEqual({ ok: true });
    expect(Base.data.coins).toBe(70);
    expect(Base.data.wood).toBe(11);
    expect(spy.mock.calls.filter(([key]) => key === Base.SLOT_KEY(1))).toHaveLength(2);
  });

  it('拆卡包不能在保存失败时消耗来源；成功完整提交来源与奖励', async () => {
    Base.data.stash.push({ card: { id: 'tt-econpack', name: '经济卡包' }, count: 1 });
    (await Base.save());
    const before = structuredClone(Base.data);
    failWrites();
    expect((await Base.openCardPack('tt-econpack', [{ card, count: 5 }]))).toMatchObject({ ok: false });
    expect(Base.data).toEqual(before);
    vi.restoreAllMocks();
    expect((await Base.openCardPack('tt-econpack', [{ card, count: 5 }]))).toEqual({ ok: true });
    expect(Base.data.stash).toEqual([{ card, count: 7 }]);
    expect(read()).toEqual(Base.data);
  });

  it('成就奖励保存失败不标记领取；重试一次性保存奖励、卡背和领取标记', async () => {
    Base.data.stats.kills = 10;
    (await Base.save());
    const before = structuredClone(Base.data);
    failWrites();
    expect((await window.SDT.Meta.claim('kill10'))).toMatchObject({ ok: false, why: 'save' });
    expect(Base.data).toEqual(before);
    vi.restoreAllMocks();
    const spy = vi.spyOn(Storage.prototype, 'setItem');
    expect((await window.SDT.Meta.claim('kill10')).ok).toBe(true);
    expect(Base.data.achClaimed.kill10).toBe(true);
    expect(Base.data.backs.wolf).toBe(true);
    expect(spy.mock.calls.filter(([key]) => key === Base.SLOT_KEY(1))).toHaveLength(1);
    const after = structuredClone(Base.data);
    expect((await window.SDT.Meta.claim('kill10')).ok).toBe(false);
    expect(Base.data).toEqual(after);
  });

  it('收藏奖励失败不吞领奖资格，重复领取不再发物资', async () => {
    const request = { kind: 'collection', id: 'audit-milestone', reward: { wood: 3 }, cards: [{ card, count: 2 }] };
    const before = structuredClone(Base.data);
    failWrites();
    expect((await Base.grantReward(request))).toMatchObject({ ok: false, why: 'save' });
    expect(Base.data).toEqual(before);
    vi.restoreAllMocks();
    expect((await Base.grantReward(request))).toEqual({ ok: true });
    expect(Base.data.wood).toBe(13);
    expect(Base.data.stash[0].count).toBe(4);
    expect((await Base.grantReward(request))).toMatchObject({ ok: false, why: 'claimed' });
    expect(Base.data.wood).toBe(13);
  });
});
