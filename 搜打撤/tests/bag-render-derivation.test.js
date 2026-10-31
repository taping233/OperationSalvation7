import { describe, expect, it, vi } from 'vitest';
import { bagCardOrderIndex, cardStacksForZone, deriveBagRenderState, syncBagCardOrder } from '../game/src/core/bag-render-derivation.js';
import { resourceContainerBonus, stackCapOf } from '../game/src/core/card-capacity.js';
import { bagUseStatus, restorationCapacityReason } from '../game/src/hub/game.bag.rules.js';

const spell = { id:'spell', name:'法术', type:'法术' };
const crystal = { id:'tt-crystal', name:'能源结晶', type:'道具',
  rules:{ bag:{ use:[{ op:'restoreConsumed', amount:3 }] } } };
const entry = (uid, card, flags = {}) => ({ uid, card, ...flags });
const state = ownedCards => ({ ownedCards, inventory:[], cardOrder:[], usedPocket:[{ card:spell, count:1 }], hp:10, maxHp:20 });

// Independent pre-change reference, including first face/name and UID ordering.
function referenceStacks(ownedCards, safe) {
  const groups = new Map(), stacks = [];
  ownedCards.forEach(item => {
    if (item.stored || !!item.safe !== !!safe) return;
    if (!groups.has(item.card.name)) groups.set(item.card.name, { card:item.card, uids:[] });
    groups.get(item.card.name).uids.push(item.uid);
  });
  groups.forEach(({ card, uids }) => {
    const cap = card.type === '装备' ? 1 : 3;
    for (let i = 0; i < uids.length; i += cap) {
      stacks.push({ card, count:Math.min(cap, uids.length - i), uids:uids.slice(i, i + cap) });
    }
  });
  return stacks;
}
function livePorts(game, baseCap) {
  return { game, usedSlots:() => referenceStacks(game.ownedCards, false).length
    + game.inventory.reduce((n, item) => n + Math.ceil((item.count || 1) / 3), 0),
  bagCap:() => baseCap + resourceContainerBonus(game.ownedCards) };
}

describe('背包单 render 派生', () => {
  it('对空库存及混合区域、同名不同卡面保持旧分堆与容量口径', () => {
    for (let size = 0; size < 100; size++) {
      const cards = Array.from({ length:size }, (_, i) => entry(`uid-${i}`, {
        id:`card-${i}`, name:`卡${i % 7}`, type:i % 3 ? '法术' : '装备',
      }, { safe:i % 4 === 0, stored:i % 6 === 0, pouchOf:i % 12 === 0 ? 'tt7-stratagem' : undefined }));
      const game = { ...state(cards), inventory:[{ count:0, value:2 }, { count:7, value:3 }],
        cardOrder:['卡4', '过期', '卡1', '卡4'] };
      const before = JSON.stringify(game), derived = deriveBagRenderState(game, 24);
      const bag = referenceStacks(cards, false), safe = referenceStacks(cards, true);
      expect(derived.bagStacks).toEqual(bag);
      expect(derived.safeStacks).toEqual(safe);
      expect(cardStacksForZone(cards, false)).toEqual(bag);
      expect(cardStacksForZone(cards, true)).toEqual(safe);
      expect(derived.used).toBe(4 + bag.length);
      expect(derived.supplyN).toBe(8); expect(derived.total).toBe(23);
      expect(derived.bagCardN).toBe(bag.reduce((n, stack) => n + stack.count, 0));
      expect(derived.safeCardN).toBe(safe.reduce((n, stack) => n + stack.count, 0));
      expect(derived.pearlStoredN).toBe(cards.filter(card => card.stored && !card.pouchOf).length);
      const known = [...bag, ...safe].map(stack => stack.card.name);
      const order = game.cardOrder.filter(name => known.includes(name));
      known.forEach(name => { if (!order.includes(name)) order.push(name); });
      expect(derived.cardOrder).toEqual(order);
      order.forEach(name => expect(derived.orderIndex.get(name)).toBe(order.indexOf(name)));
      expect(JSON.stringify(game)).toBe(before);
    }
  });

  it('资源扩容跟随声明式容器规则与历史适配，并在每次刷新重新计算', () => {
    const custom = { id:'custom-box', name:'资源袋', type:'装备', rules:{ equip:{ container:{ slots:5, accepts:'资源' } } } };
    const game = state([
      entry('custom', custom, { safe:true }),
      entry('legacy', { id:'tt2-pearlbox', name:'旧珍珠盒', type:'装备' }, { stored:1 }),
      entry('disabled', { id:'tt2-pearlbox', name:'已撤容器', type:'装备', rules:{ equip:{} } }),
      entry('spells', { id:'spells', name:'法术盒', type:'装备', rules:{ equip:{ container:{ slots:18, accepts:'法术' } } } }),
    ]);
    const first = deriveBagRenderState(game, 2);
    expect(first.resourceBonus).toBe(resourceContainerBonus(game.ownedCards));
    expect(first.cap).toBe(16); expect(first.capacityText).toBe('已用 2/16 格 · 普通可用 0 格 · 资源可用 14 格');
    custom.rules.equip.container.slots = 7;
    game.ownedCards[0].safe = false; game.ownedCards[1].stored = false;
    game.inventory.push({ name:'木材', count:4, value:2 });
    const second = deriveBagRenderState(game, 2);
    expect(second.cap).toBe(18); expect(second.used).toBe(6);
    expect(second.capacityText).toBe('已用 6/18 格 · 普通可用 0 格 · 资源可用 0 格');
    expect(second.ordinarySlots).toBe(6); expect(second.resourceSlots).toBe(0);
    expect(second.bagCardN).toBe(4); expect(second.safeCardN).toBe(0); expect(second.pearlStoredN).toBe(0);
    expect(first.cap).toBe(16); expect(first.used).toBe(2);
  });

  it('UID 与显示顺序保留首次命中，缺失 UID 不借用另一张牌', () => {
    const game = state([entry('duplicate', crystal, { safe:true }), entry('duplicate', crystal), entry('other', spell)]);
    game.cardOrder = ['法术', '能源结晶', '法术'];
    const snapshot = deriveBagRenderState(game, 1);
    expect(snapshot.ownedIndexByUid.get('duplicate')).toBe(0);
    expect(snapshot.bagNameCounts.get(crystal.name)).toBe(1);
    expect(snapshot.orderIndex.get('法术')).toBe(0);
    expect(bagCardOrderIndex(['a', 'b', 'a']).get('a')).toBe(0);
    expect(syncBagCardOrder([], [], ['stale'])).toEqual([]);
    expect(bagUseStatus(crystal, 'missing', { ...livePorts(game, 1), renderState:snapshot })).toEqual(bagUseStatus(crystal, 'missing', livePorts(game, 1)));
    expect(bagUseStatus(crystal, 'duplicate', { ...livePorts(game, 1), renderState:snapshot }))
      .toEqual(bagUseStatus(crystal, 'duplicate', livePorts(game, 1)));
  });

  it('复原显示复用索引、同名数量与容量，但动作调用继续检查即时状态', () => {
    for (const count of [1, 2, 3, 4, 6]) for (const safe of [false, true]) for (const stored of [false, true]) {
      const game = state(Array.from({ length:count }, (_, i) => entry(`crystal-${i}`, crystal, { safe, stored })));
      const ports = livePorts(game, 1), renderState = deriveBagRenderState(game, 1);
      expect(bagUseStatus(crystal, 'crystal-0', { ...ports, renderState })).toEqual(bagUseStatus(crystal, 'crystal-0', ports));
    }
    const game = state(Array.from({ length:3 }, (_, i) => entry(`crystal-${i}`, crystal)));
    const ports = livePorts(game, 2), renderState = deriveBagRenderState(game, 2);
    expect(bagUseStatus(crystal, 'crystal-0', { ...ports, renderState }).reason).toBe('');
    game.inventory.push({ name:'新增木材', count:3, value:1 });
    expect(restorationCapacityReason(game, 0, ports)).toContain('背包空间不足');
    const next = deriveBagRenderState(game, 2);
    expect(bagUseStatus(crystal, 'crystal-0', { ...ports, renderState:next }).reason).toContain('背包空间不足');
  });

  it('大量复原卡的单次渲染只遍历 ownedCards 一次，不逐堆重新查询', () => {
    const game = state(Array.from({ length:600 }, (_, i) => entry(`crystal-${i}`,
      { ...crystal, name:`复原卡${i % 100}` })));
    const scans = ['filter', 'reduce', 'findIndex'].map(method => vi.spyOn(game.ownedCards, method));
    const visits = vi.spyOn(game.ownedCards, 'forEach'), ports = { game, usedSlots:vi.fn(), bagCap:vi.fn() };
    const renderState = deriveBagRenderState(game, 100);
    renderState.bagStacks.forEach(stack => {
      expect(stack.count).toBe(stackCapOf(stack.card));
      expect(bagUseStatus(stack.card, stack.uids[0], { ...ports, renderState }).reason).toContain('背包空间不足');
    });
    expect(renderState.bagStacks).toHaveLength(200);
    expect(visits).toHaveBeenCalledTimes(1);
    scans.forEach(spy => expect(spy).not.toHaveBeenCalled());
    expect(ports.usedSlots).not.toHaveBeenCalled(); expect(ports.bagCap).not.toHaveBeenCalled();
  });
});
