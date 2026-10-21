import { installImmediateWebLocks } from './helpers/web-locks.js';
installImmediateWebLocks();
// Real Cards/Base/Meta modules with jsdom storage. Never accesses player storage.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RULES } from '../game/src/core/rules.js';
import { Random } from '../game/src/core/random.js';
window.SDT = window.SDT || {};
window.SDT.Icons ||= { img: () => '', rich: text => text };
await import('../game/src/cards/cards.js');
await import('../game/src/hub/base.js');
await import('../game/src/hub/meta.js');
const { Cards, Base, Meta } = window.SDT;
window.SDT.MAP = { rules: RULES };
window.SDT.Sound = { sfx() {} };
window.SDT.UI = { log() {} };
Cards.ensureTabletop();
const catalog = JSON.parse(JSON.stringify(Cards.all()));
const raw = () => localStorage.getItem(Base.SLOT_KEY(1));
const disk = () => JSON.parse(raw());
async function registerCollection(count = Meta.collectPool().length) {
  const selected = Meta.collectPool().slice(0, count);
  expect(selected).toHaveLength(count);
  for (const card of selected) Base.data.collection[card.id] = { name:card.name, rarity:card.rarity, ts:1 };
  expect((await Base.save())).toBe(true);
}
function replaceField(field, value) {
  const saved = disk(); saved[field] = value;
  localStorage.setItem(Base.SLOT_KEY(1), JSON.stringify(saved)); Base.use(1);
}
beforeEach(async () => {
  Cards.all(); expect(Cards.saveAll(JSON.parse(JSON.stringify(catalog)))).toBe(true);
  localStorage.removeItem(Base.SLOT_KEY(1)); Base.use(1); expect((await Base.save())).toBe(true);
});
afterEach(() => vi.restoreAllMocks());

describe('一次性奖励必须整套可兑现', () => {
  it.each(['labScore2', 'labScore3'])('删除%s指定奖励卡后不消费资格；恢复卡库后仅领取一次', async id => {
    Base.data.stats.labTotalScore = 4000; expect((await Base.save())).toBe(true);
    const reward = Meta.achById(id).reward.card, card = Cards.all().find(item => item.id === reward);
    expect(card).toBeTruthy(); Cards.remove(reward);
    const before = structuredClone(Base.data), beforeRaw = raw();
    expect((await Meta.claim(id))).toMatchObject({ ok:false, why:'unavailable', msg:expect.stringContaining('尚未领取') });
    expect(Base.data).toEqual(before); expect(raw()).toBe(beforeRaw);
    Cards.upsert(card); expect((await Meta.claim(id)).ok).toBe(true); Base.use(1);
    expect(Base.data.stash).toEqual([expect.objectContaining({ card:expect.objectContaining({ id:reward }), count:1 })]);
    expect((await Meta.claim(id)).ok).toBe(false); expect(disk().achClaimed[id]).toBe(true);
  });

  it('缺失宠物蛋时整单缓发，恢复后实际发蛋并持久化领取记录', async () => {
    (await registerCollection()); const egg = Cards.all().find(card => card.id === Base.PET_EGG_ID); expect(egg).toBeTruthy();
    Cards.remove(egg.id); const before = structuredClone(Base.data), beforeRaw = raw();
    expect((await Meta.claimColl('mAll'))).toMatchObject({ ok:false, why:'unavailable', msg:expect.stringContaining('宠物蛋') });
    expect(Base.data).toEqual(before); expect(raw()).toBe(beforeRaw);
    Cards.upsert(egg); expect((await Meta.claimColl('mAll')).ok).toBe(true); Base.use(1);
    expect(Base.data.stash).toEqual([expect.objectContaining({ card:expect.objectContaining({ id:egg.id }), count:1 })]);
    expect((await Meta.claimColl('mAll')).ok).toBe(false);
  });

  it.each([0, 1])('独立传说仅%s种时不抽牌、不改库存/资源/资格；补足后完整发两张', async available => {
    (await registerCollection(45));
    const legends = Cards.all().filter(card => card.rarity === '传说' && Cards.isRandomObtainable(card));
    expect(legends.length).toBeGreaterThan(1);
    const remove = new Set(legends.slice(available).map(card => card.id));
    expect(Cards.saveAll(Cards.all().filter(card => !remove.has(card.id)))).toBe(true);
    const before = structuredClone(Base.data), beforeRaw = raw(), rng = Random.snapshot();
    expect((await Meta.claimColl('m45'))).toMatchObject({ ok:false, why:'unavailable', msg:expect.stringContaining('不足 2 种') });
    expect(Base.data).toEqual(before); expect(raw()).toBe(beforeRaw); expect(Random.snapshot()).toEqual(rng);
    Cards.all(); expect(Cards.saveAll(JSON.parse(JSON.stringify(catalog)))).toBe(true);
    expect((await Meta.claimColl('m45')).ok).toBe(true); Base.use(1);
    expect(Base.data.stash).toHaveLength(2); expect(new Set(Base.data.stash.map(stack => stack.card.id)).size).toBe(2);
    expect(Base.data.stash.every(stack => stack.count === 1 && stack.card.rarity === '传说')).toBe(true);
    expect((await Meta.claimColl('m45')).ok).toBe(false);
  });

  it('重复卡库ID不被当成两种独立传说来凑数', async () => {
    (await registerCollection(45));
    const legend = catalog.find(card => card.rarity === '传说' && Cards.isRandomObtainable(card));
    vi.spyOn(Cards, 'all').mockReturnValue([...catalog.filter(card => card.rarity !== '传说'), legend, { ...legend }]);
    const beforeRaw = raw(); expect((await Meta.claimColl('m45'))).toMatchObject({ ok:false, why:'unavailable' });
    expect(raw()).toBe(beforeRaw);
  });

  it('卡库完整但仓库仅余一格时两张传说奖励整单缓发，腾位后整单入库', async () => {
    (await registerCollection(45));
    const filler = catalog.find(card => card.type === '法术' && card.rarity === '古朴');
    Base.data.stash = [{ card:filler, count:Base.stashCap() - 1 }]; expect((await Base.save())).toBe(true);
    const beforeRaw = raw(); expect((await Meta.claimColl('m45'))).toMatchObject({ ok:false, why:'full' }); expect(raw()).toBe(beforeRaw);
    Base.data.stash[0].count--; expect((await Base.save())).toBe(true);
    expect((await Meta.claimColl('m45')).ok).toBe(true); expect(Base.stashRoom()).toBe(0); expect(disk().collClaimed.m45).toBe(true);
  });

  it('完整随机奖励保存失败时不加资源/卡或标记；重试后整单保存且不能重复领', async () => {
    (await registerCollection(45)); const before = structuredClone(Base.data), beforeRaw = raw();
    const original = Storage.prototype.setItem;
    const failure = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (key, value) {
      if (key === Base.SLOT_KEY(1)) throw new Error('isolated quota failure');
      return original.call(this, key, value);
    });
    expect((await Meta.claimColl('m45'))).toMatchObject({ ok:false, why:'save' });
    expect(Base.data).toEqual(before); expect(raw()).toBe(beforeRaw);
    failure.mockRestore(); expect((await Meta.claimColl('m45')).ok).toBe(true); Base.use(1);
    expect(Base.data.stash).toHaveLength(2); expect((await Meta.claimColl('m45')).ok).toBe(false);
  });
});

describe('旧坏档对象容器逐字段恢复', () => {
  it.each([[], 'broken', 3, null])('collClaimed=%j恢复为可持久化字典，一次奖励读档后不能再领', async value => {
    (await registerCollection(5)); const warnings = vi.spyOn(console, 'warn').mockImplementation(() => {});
    replaceField('collClaimed', value); const originalRaw = raw();
    expect(Base.data.collClaimed).toEqual({}); expect(Array.isArray(Base.data.collClaimed)).toBe(false);
    expect(warnings.mock.calls.some(([text]) => String(text).includes('collClaimed'))).toBe(true);
    expect(raw()).toBe(originalRaw); // 读取规范化不写回旧档
    expect((await Meta.claimColl('m5')).ok).toBe(true); expect(disk().wood).toBe(3); expect(disk().collClaimed).toEqual({ m5:true });
    Base.use(1); expect((await Meta.claimColl('m5')).ok).toBe(false); expect(Base.data.wood).toBe(3);
  });

  it.each(['collection', 'collClaimed', 'collXp', 'backs'])('%s数组仅重置该字段，不丢有效字典、库存、资源和统计；peek不写回', field => {
    const saved = disk(); Object.assign(saved, { wood:17, coins:23, stats:{ ...saved.stats, kills:11 },
      stash:[{ card:catalog.find(card => card.rarity === '古朴'), count:2 }],
      collection:{ preserved:{ name:'保留记录', rarity:'职业', ts:1 } }, collClaimed:{ m15:true }, collXp:{ preserved:true }, backs:{ classic:true, wolf:true } });
    saved[field] = []; const serialized = JSON.stringify(saved); localStorage.setItem(Base.SLOT_KEY(1), serialized);
    vi.spyOn(console, 'warn').mockImplementation(() => {}); const peek = Base.peek(1);
    expect(peek.wood).toBe(17); expect(peek.coins).toBe(23); expect(peek.stats.kills).toBe(11); expect(peek.stash).toEqual(saved.stash);
    for (const other of ['collection', 'collClaimed', 'collXp', 'backs'].filter(key => key !== field)) expect(peek[other]).toEqual(saved[other]);
    expect(peek[field]).toEqual(field === 'backs' ? { classic:true } : {}); expect(raw()).toBe(serialized);
  });

  it('数组收藏/经验/卡背恢复后新记录可往返保存，不会在下一次升级或读档中消失', async () => {
    const warnings = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const saved = disk(); Object.assign(saved, { collection:[], collXp:[], backs:[], wood:10 });
    localStorage.setItem(Base.SLOT_KEY(1), JSON.stringify(saved)); Base.use(1);
    const card = Meta.collectPool()[0]; expect(card).toBeTruthy(); expect((await Base.collectToggle(card))).toBe(true);
    expect((await Base.markCollXpSettled([card.id])).persisted).toBe(true); expect((await Base.unlockBack('wolf'))).toBe(true);
    expect((await Base.upgradeBag())).toBe(true); Base.use(1);
    expect(Base.data.collection[card.id]).toMatchObject({ name:card.name }); expect(Base.data.collXp[card.id]).toBe(true);
    expect(Base.isBackUnlocked('wolf')).toBe(true); expect(warnings).toHaveBeenCalled();
  });
});
