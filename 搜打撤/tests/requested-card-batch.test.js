import { describe, expect, it } from 'vitest';
import { GUN_POOL_IDS, advanceBiphasicAstrolabe, canMindControl, capNonLethalDamage, chooseMissingCurse, nextChaosRarity, soulContractTargets, transformChaosDeck } from '../game/src/battle/effects/requested-card-batch.js';

describe('requested card batch pure mechanics', () => {
  it('exposes the bounded five-card gun pool without name-based expansion', () => {
    expect(GUN_POOL_IDS).toEqual(['tt2-shoot', 'tt3-noon-duel', 'tt3-double-shot', 'cc-rapid-fire', 'tt13-snipe']);
    expect(Object.isFrozen(GUN_POOL_IDS)).toBe(true);
  });
  it('chooses only absent curse kinds and does not repeat when all are present', () => {
    expect(chooseMissingCurse({ bleed: 2 }, ['bleed', 'poison'], () => 0)).toBe('poison');
    expect(chooseMissingCurse({ bleed: 2, poison: 1 }, ['bleed', 'poison'], () => 0)).toBeNull();
    expect(chooseMissingCurse({ bleed: 0 }, ['bleed', 'bleed'], () => 0)).toBe('bleed');
  });

  it('promotes standard rarity with a legendary ceiling and leaves undecided rarities explicit', () => {
    expect(['初始', '古朴', '稀有', '史诗', '传说'].map(nextChaosRarity)).toEqual(['古朴', '稀有', '史诗', '传说', '传说']);
    expect(['职业', '衍生', '棱彩'].map(nextChaosRarity)).toEqual([null, null, null]);
  });

  it('replaces only the same type and permutes costs without mutating source or pool', () => {
    const cards = [{ id: 'a', type: '武术', rarity: '古朴', cost: 0 }, { id: 'b', type: '装备', rarity: '史诗', cost: 1 }, { id: 'c', type: '道具', rarity: '古朴', cost: 8 }];
    const pool = [{ id: 'x', type: '武术', rarity: '稀有', cost: 2 }, { id: 'y', type: '装备', rarity: '传说', cost: 4 }, { id: 'z', type: '法术', rarity: '稀有', cost: 9 }];
    const result = transformChaosDeck(cards, pool, { random: () => 0 });
    expect(result.map(card => card.id)).toEqual(['x', 'y', 'c']);
    expect(result.map(card => card.cost)).toEqual([4, 2, 8]);
    expect(cards.map(card => card.cost)).toEqual([0, 1, 8]);
    expect(pool.map(card => card.cost)).toEqual([2, 4, 9]);
    expect(transformChaosDeck(cards, pool, { random: () => 0, eligible: () => false })).toEqual(cards);
  });

  it('accepts only living wounded non-boss enemies', () => {
    const foe = { hp: 2, maxHp: 3 };
    expect(canMindControl(foe)).toBe(true);
    for (const patch of [{ boss: true }, { dead: true }, { hp: 0 }, { hp: 3 }, { maxHp: undefined }]) expect(canMindControl({ ...foe, ...patch })).toBe(false);
    expect(canMindControl(null)).toBe(false);
  });

  it('alternates phase by turn and refunds only the first matching play', () => {
    const call = (state, turn, type) => advanceBiphasicAstrolabe(state, { turn, type, firstType: '武术' });
    const miss = call(null, 1, '法术');
    expect(miss.refund).toBe(0);
    const first = call(miss.state, 1, '武术');
    expect(first.refund).toBe(1);
    expect(call(first.state, 1, '武术').refund).toBe(0);
    expect(call(first.state, 2, '法术').refund).toBe(1);
    expect(call(first.state, 3, '武术').refund).toBe(1);
    expect(miss.state.triggered).toBe(false);
  });

  it('spreads to other living enemies once and blocks marked-target recursion', () => {
    const a = { hp: 1, marked: true }, b = { hp: 2, marked: true }, c = { hp: 0 };
    const isMarked = foe => foe.marked;
    expect(soulContractTargets(a, [a, b, c], { isMarked })).toEqual([b]);
    expect(soulContractTargets(b, [a, b, c], { isMarked, chain: true })).toEqual([]);
    expect(soulContractTargets({ hp: 2 }, [a, b], { isMarked })).toEqual([]);
  });

  it('caps final damage to leave one HP and never heals or revives', () => {
    expect(capNonLethalDamage(4, 8)).toBe(3);
    expect(capNonLethalDamage(4, 2)).toBe(2);
    for (const hp of [1, 0, -1, NaN]) expect(capNonLethalDamage(hp, 8)).toBe(0);
    expect(capNonLethalDamage(4, -2)).toBe(0);
  });
});
