/* 职业收藏室（2026-09-09）：收藏池 / 收藏经验 / 一次性里程碑奖励 单元测试 */
import { describe, it, expect, beforeAll } from 'vitest';

window.SDT = window.SDT || { Icons: { img: () => '' } };
await import('../game/src/cards.js');
await import('../game/src/base.js');
await import('../game/src/meta.js');

let Base, Meta, Cards;
beforeAll(() => {
  Base = window.SDT.Base;
  Meta = window.SDT.Meta;
  Cards = window.SDT.Cards;
  // 仓库容量走 rules.js 的基地数值（本文件不加载完整地图模块，按真实值补桩）
  window.SDT.MAP = window.SDT.MAP || { rules: {
    bagSize: 16, bagMax: 30, safeStart: 2, safeMax: 6,
    stashStart: 25, stashMax: 49, stashUpgradeSlots: 3,
  } };
  Cards.ensureTabletop();   // 播入全部卡牌种子（含职业卡 / 能力卡 / 宠物蛋）
  Base.use(1);
  Base.data.stash = [];     // 清空仓库，避免别的用例残留
});

// 把一张卡直接放入仓库（模拟撤离入库）
const intoStash = (card, n = 1) => { Base.data.stash.push({ card: { ...card }, count: n }); Base.save(); };
// 仓库 → 收藏（与 UI collCollectOne 同一结算路径，2026-09-16 Item 15 定版）：
// 首次登记进度、每次都结算经验，并从仓库用掉一张；非收藏池不结算也不消耗
const collectById = (id) => {
  const stack = Base.data.stash.find(s => s.card.id === id);
  expect(stack, `仓库里应有 ${id}`).toBeTruthy();
  if (!Meta.isCollectible(stack.card)) return null;
  const first = !Base.isCollected(stack.card);
  if (first) Base.collectToggle(stack.card);
  const r = Meta.onCollect(stack.card, true);
  stack.count--;
  if (stack.count <= 0) Base.data.stash.splice(Base.data.stash.indexOf(stack), 1);
  return r;
};
const resetBase = () => {
  Base.data.collClaimed = {}; Base.data.collXp = {}; Base.data.collection = {};
  Base.data.wood = 0; Base.data.rations = 0; Base.data.keys = 0; Base.data.coins = 0;
  Base.data.characters = {}; Base.data.stash = [];
  Base.save();
};

describe('收藏池与进度', () => {
  it('收藏池 = 职业卡 + 能力卡（有归属），退役旧职业卡与衍生牌不入池', () => {
    const pool = Meta.collectPool();
    expect(pool.every(c => c.cls && Cards.CLASSES.includes(c.cls))).toBe(true);
    expect(pool.every(c => c.rarity === '职业' || c.type === '能力卡')).toBe(true);
    // 卡库里确有退役旧职业卡（rarity=职业 但无 cls）与衍生牌，但都被排除
    expect(Cards.all().some(c => c.rarity === '职业' && !c.cls)).toBe(true);
    expect(Cards.all().some(c => c.rarity === '衍生' && c.cls)).toBe(true);
    pool.forEach(c => expect(c.rarity).not.toBe('衍生'));
  });
  it('全收集目标 = 池内卡牌总数，且不小于最高里程碑 45', () => {
    expect(Meta.collTotal()).toBe(Meta.collectPool().length);
    expect(Meta.collTotal()).toBeGreaterThanOrEqual(45);
  });
  it('进度只计收藏图鉴中不同的职业卡与能力卡', () => {
    resetBase();
    const pool = Meta.collectPool();
    expect(Meta.collProgress()).toBe(0);
    Base.data.collection[pool[0].id] = { name: pool[0].name, rarity: pool[0].rarity, ts: 1 };
    Base.data.collection[pool[1].id] = { name: pool[1].name, rarity: pool[1].rarity, ts: 2 };
    // 非收藏池的卡（衍生牌）不计进度
    const derived = Cards.all().find(c => c.rarity === '衍生' && c.cls);
    Base.data.collection[derived.id] = { name: derived.name, rarity: derived.rarity, ts: 3 };
    expect(Meta.collProgress()).toBe(2);
    resetBase();
  });
});

describe('收藏经验', () => {
  it('收藏职业卡为对应人物 +10 经验；重复收藏重复获得经验（2026-09-16 Item 15 定版）', () => {
    resetBase();
    const card = Meta.collectPool().find(c => c.rarity === '职业');
    intoStash(card);
    const r1 = collectById(card.id);
    expect(r1).toMatchObject({ cls: card.cls, amount: 10 });
    expect(Meta.classXP(card.cls)).toBe(10);
    // 再收一张同名卡：经验照发（进度只记首次，不再翻倍）
    intoStash(card);
    const r2 = collectById(card.id);
    expect(r2 && r2.amount).toBe(10);
    expect(Meta.classXP(card.cls)).toBe(20);
    expect(Object.keys(Base.data.collection).length).toBe(1);   // 进度只记首次
    resetBase();
  });
  it('收藏能力卡为对应人物 +50 经验', () => {
    resetBase();
    const card = Meta.collectPool().find(c => c.type === '能力卡');
    intoStash(card);
    expect(collectById(card.id).amount).toBe(50);
    // Lv.1→2 恰需 50 经验：50 点正好升 1 级（经验条清零）
    expect(Meta.classLv(card.cls)).toBe(2);
    expect(Meta.classXP(card.cls)).toBe(0);
    resetBase();
  });
  it('非收藏池的卡收藏不发经验', () => {
    resetBase();
    const plain = Cards.all().find(c => !Meta.isCollectible(c) && c.id && c.rarity !== '衍生');
    intoStash(plain);
    expect(collectById(plain.id)).toBeNull();
    resetBase();
  });
  it('老档回填：已收藏的职业卡标记为已结算，能力卡留待补结算', () => {
    resetBase();
    const clsCard = Meta.collectPool().find(c => c.rarity === '职业');
    const abilCard = Meta.collectPool().find(c => c.type === '能力卡');
    Base.data.collection[clsCard.id] = { name: clsCard.name, rarity: clsCard.rarity, ts: 1 };
    Base.data.collection[abilCard.id] = { name: abilCard.name, rarity: abilCard.rarity, ts: 2 };
    Meta.syncCollXp();
    expect(Base.data.collXp[clsCard.id]).toBe(true);
    expect(Base.data.collXp[abilCard.id]).toBeUndefined();
    resetBase();
  });
});

describe('收藏里程碑（一次性奖励）', () => {
  it('收藏 5 张领 3 木材，重复领取被拒，未达标不能领', () => {
    resetBase();
    const pool = Meta.collectPool();
    pool.slice(0, 4).forEach(c => { Base.data.collection[c.id] = { name: c.name, rarity: c.rarity, ts: 1 }; });
    expect(Meta.claimColl('m5').ok).toBe(false);          // 4 张未达标
    Base.data.collection[pool[4].id] = { name: pool[4].name, rarity: pool[4].rarity, ts: 2 };
    expect(Base.data.wood).toBe(0);
    expect(Meta.claimColl('m5').ok).toBe(true);
    expect(Base.data.wood).toBe(3);
    expect(Meta.claimColl('m5').ok).toBe(false);          // 一次性
    expect(Meta.pendingColl().map(m => m.id)).not.toContain('m5');
    resetBase();
  });
  it('15 张领 5 口粮、30 张领 10 钥匙', () => {
    resetBase();
    const pool = Meta.collectPool();
    pool.slice(0, 15).forEach((c, i) => {
      Base.data.collection[c.id] = { name: c.name, rarity: c.rarity, ts: i };
    });
    expect(Meta.claimColl('m15').ok).toBe(true);
    expect(Base.data.rations).toBe(5);
    pool.slice(15, 30).forEach((c, i) => {
      Base.data.collection[c.id] = { name: c.name, rarity: c.rarity, ts: 100 + i };
    });
    expect(Meta.claimColl('m30').ok).toBe(true);
    expect(Base.data.keys).toBe(10);
    resetBase();
  });
  it('45 张领 2 张不同的传说卡入仓库', () => {
    resetBase();
    const pool = Meta.collectPool();
    pool.slice(0, 45).forEach((c, i) => {
      Base.data.collection[c.id] = { name: c.name, rarity: c.rarity, ts: i };
    });
    expect(Meta.claimColl('m45').ok).toBe(true);
    const legends = Base.data.stash.filter(s => s.card.rarity === '传说');
    expect(legends.reduce((a, b) => a + b.count, 0)).toBe(2);
    expect(new Set(legends.map(s => s.card.id)).size).toBe(2);   // 两张不同
    resetBase();
  });
  it('全收集领 1 张宠物蛋入仓库', () => {
    resetBase();
    Meta.collectPool().forEach((c, i) => {
      Base.data.collection[c.id] = { name: c.name, rarity: c.rarity, ts: i };
    });
    expect(Meta.collProgress()).toBe(Meta.collTotal());
    expect(Meta.claimColl('mAll').ok).toBe(true);
    const eggs = Base.data.stash.filter(s => s.card.id === Base.PET_EGG_ID);
    expect(eggs.reduce((a, b) => a + b.count, 0)).toBe(1);
    expect(Meta.claimColl('mAll').ok).toBe(false);
    resetBase();
  });
  it('仓库容量不足时卡牌奖励缓发（不吞奖励、不占容量）', () => {
    resetBase();
    const cap = Base.stashCap();
    // 塞满仓库（一堆 1 张的不同名卡）
    for (let i = 0; i < cap; i++) {
      Base.data.stash.push({ card: { id: 'tmp-' + i, name: '占位' + i, rarity: '古朴', type: '道具' }, count: 1 });
    }
    Meta.collectPool().forEach((c, i) => {
      Base.data.collection[c.id] = { name: c.name, rarity: c.rarity, ts: i };
    });
    const r = Meta.claimColl('m45');
    expect(r.ok).toBe(false);
    expect(r.why).toBe('full');
    expect(Base.data.collClaimed['m45']).toBeUndefined();    // 未落领奖记录，可再来
    expect(Meta.claimColl('mAll').ok).toBe(false);
    resetBase();
  });
});


describe('收藏即用掉（2026-09-16 Item 15 定版，取代 09-10 保留口径）', () => {
  it('收藏后卡牌从仓库移除（不再占格）；收藏记录照常', () => {
    resetBase();
    const pool = Cards.classPool('侠客').filter(c => c.rarity === '职业' && !c.hero);
    const card = pool[0];
    intoStash(card, 3);
    collectById(card.id);
    const stack = Base.data.stash.find(s2 => s2.card.id === card.id);
    expect(stack && stack.count).toBe(2);                     // 3 张收 1 张：剩 2 张
    expect(Base.data.collection[card.id]).toBeTruthy();       // 收藏记录照常
    collectById(card.id); collectById(card.id);               // 再收 2 张：全部用掉
    expect(Base.data.stash.some(s2 => s2.card.id === card.id)).toBe(false);
    resetBase();
  });
});

describe('老档兼容', () => {
  it('没有收藏室字段的旧基地档读取后自动补齐', () => {
    localStorage.setItem('sdt-base-v2-slot4', JSON.stringify({ wood: 7, version: 2 }));
    const peeked = Base.peek(4);
    expect(peeked.wood).toBe(7);
    expect(peeked.collClaimed).toEqual({});
    expect(peeked.collXp).toEqual({});
    Base.wipe(4);
  });
});
