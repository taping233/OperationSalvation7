import { describe, expect, it } from 'vitest';
import { createBaseDepartureCommands, departureStackKey, findDepartureStack } from '../game/src/hub/base-departure.commands.js';
import { stackKeyOf } from '../game/src/hub/collection.commands.js';
describe('出征身份与现有收藏stackKey协议一致', () => {
  it.each([
    { stackKey: 'explicit:instance:3', card: { id: 'a', name: '卡', variantKey: 'card-variant' }, variantKey: 'stack-variant', count: 1 },
    { card: { id: 'a', name: '卡' }, count: 1 },
    { card: { id: 'a', name: '卡', variantKey: 'card-variant' }, count: 1 },
    { card: { id: 'a', name: '卡', variantKey: 'card-variant' }, variantKey: 'stack-variant', count: 1 },
    { card: { name: '旧卡' }, count: 1 },
  ])('完整key/fallback: %j', stack => { expect(departureStackKey(stack)).toBe(stackKeyOf(stack) || stack.card.name); });
  it('显式key失效不能退而扣同id变体；重复stable key也不猜', () => {
    const stack = { stackKey: 'exact-instance', card: { id: 'a', name: '卡' }, count: 2 };
    expect(findDepartureStack([stack], 'card:a')).toBeNull();
    expect(findDepartureStack([stack, structuredClone(stack)], 'exact-instance')).toBeNull();
    expect(findDepartureStack([stack], '卡')).toBe(stack);
  });
  it('Base命令事务端口保存失败保持仓库和口袋，成功精确扣显式key', () => {
    let state = { stash: [{ card: { id: 'a', name: '卡' }, count: 2 }, { stackKey: 'instance:b', card: { id: 'b', name: '卡' }, count: 2 }], pocket: [{ card: { id: 'p', name: '口袋' }, count: 1 }] }, save = false;
    const initial = structuredClone(state);
    const commands = createBaseDepartureCommands({ read: () => state, mutate: (prepare, failure) => { const next = structuredClone(state), result = prepare(next); if (!save) return failure; state = next; return result; } });
    expect(commands.prepareDeparture({ 'instance:b': 1 })).toEqual({ ok: false, why: 'save' }); expect(state).toEqual(initial);
    save = true; const result = commands.prepareDeparture({ 'instance:b': 1 }); expect(result.cards[0].card.id).toBe('b'); expect(state.stash.map(stack => stack.count)).toEqual([2, 1]); expect(state.pocket).toEqual([]);
  });
});
