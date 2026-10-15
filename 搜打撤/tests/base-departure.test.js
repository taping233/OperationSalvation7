import { describe, expect, it, vi } from 'vitest';
import { createBaseDepartureCommands } from '../game/src/hub/base-departure.commands.js';

function harness(initial, shouldSave = () => true) {
  let state = structuredClone(initial);
  const persist = vi.fn(candidate => shouldSave(candidate));
  const mutate = (prepare, failure) => {
    const draft = structuredClone(state);
    const value = prepare(draft);
    if (!persist(draft)) return failure;
    state = draft;
    return value;
  };
  return { commands: createBaseDepartureCommands({ read: () => state, mutate }), persist, read: () => state };
}

describe('Base 出征准备事务', () => {
  it('一次保存同时扣除可携带仓库卡并清空消耗区', () => {
    const h = harness({
      stash: [
        { card: { id: 'a', name: '攻击卡', rarity: '稀有' }, count: 3 },
        { card: { id: 'job', name: '职业卡', rarity: '职业' }, count: 2 },
      ],
      pocket: [{ card: { id: 'spent', name: '消耗卡' }, count: 2 }],
    });

    const result = h.commands.prepareDeparture({ 攻击卡: 2, 职业卡: 1, 不存在: 4 });

    expect(result).toEqual({
      ok: true,
      cards: [{ card: { id: 'a', name: '攻击卡', rarity: '稀有' }, count: 2 }],
      rejectedClassNames: ['职业卡'],
      pocketCleared: true,
      dispersedPocketCount: 2,
    });
    expect(h.read().stash.map(stack => [stack.card.name, stack.count])).toEqual([['攻击卡', 1], ['职业卡', 2]]);
    expect(h.read().pocket).toEqual([]);
    expect(h.persist).toHaveBeenCalledTimes(1);
  });

  it('同名卡按仓库首项匹配，数量先向下取整再按库存封顶', () => {
    const first = { card: { id: 'first', name: '同名卡', rarity: '稀有' }, count: 1 };
    const duplicate = { card: { id: 'duplicate', name: '同名卡', rarity: '稀有' }, count: 6 };
    const capped = { card: { id: 'capped', name: '库存卡', rarity: '古朴' }, count: 2 };
    const h = harness({ stash: [first, duplicate, capped], pocket: [] });

    const result = h.commands.prepareDeparture({ 同名卡: 2.9, 库存卡: 99.7 });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.cards).toEqual([
      { card: first.card, count: 1 },
      { card: capped.card, count: 2 },
    ]);
    expect(h.read().stash).toEqual([duplicate]);
  });

  it('没有实际库存变化时不写盘', () => {
    const h = harness({ stash: [{ card: { name: '职业卡', rarity: '职业' }, count: 1 }], pocket: [] });

    expect(h.commands.prepareDeparture({ 职业卡: 1, 缺失卡: 1 })).toEqual({
      ok: true, cards: [], rejectedClassNames: ['职业卡'], pocketCleared: false, dispersedPocketCount: 0,
    });
    expect(h.persist).not.toHaveBeenCalled();
  });

  it('保存失败时仓库与口袋都保留原值', () => {
    const initial = {
      stash: [{ card: { id: 'a', name: '攻击卡', rarity: '稀有' }, count: 2 }],
      pocket: [{ card: { id: 'spent', name: '消耗卡' }, count: 1 }],
    };
    const h = harness(initial, () => false);

    expect(h.commands.prepareDeparture({ 攻击卡: 1 })).toEqual({ ok: false, why: 'save' });
    expect(h.read()).toEqual(initial);
    expect(h.persist).toHaveBeenCalledTimes(1);
  });
});
