// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { buildDiscoverPool, pickRandomDiscoverCandidate } from '../game/src/battle/battle.discover-candidates.js';

describe('pure battle discovery candidates', () => {
  it('preserves specified-pool exclusions, catalog order, and original card identity', () => {
    const cards = [
      { id: 'valid', rarity: '衍生外', type: '道具' },
      { id: 'derivative', rarity: '衍生', type: '武术' },
      { id: 'creature', rarity: '稀有', type: '生物' },
      { id: 'event', rarity: '稀有', type: '事件' },
      { id: 'resource', rarity: '稀有', type: '资源' },
      { id: 'rejected', rarity: '稀有', type: '武术' },
    ];
    const predicate = vi.fn(card => card.id === 'valid' || card.id === 'rejected');
    const pool = buildDiscoverPool(cards, {
      myClass: 'class-a', pred: predicate, isRandomObtainable: () => false,
    });

    expect(pool).toEqual([cards[0], cards[5]]);
    expect(pool[0]).toBe(cards[0]);
    expect(predicate.mock.calls.map(([card]) => card.id)).toEqual(['valid', 'rejected']);
  });

  it('preserves general filters and the other-class fallback precedence', () => {
    const cards = [
      { id: 'ordinary', rarity: '稀有', type: '武术', cls: 'class-b' },
      { id: 'not-random', rarity: '稀有', type: '武术', cls: 'class-b' },
      { id: 'class-fallback', rarity: '职业', type: '道具', cls: 'class-b' },
      { id: 'same-class', rarity: '职业', type: '武术', cls: 'class-a' },
      { id: 'derived', rarity: '衍生', type: '武术', cls: 'class-b' },
    ];
    const pool = buildDiscoverPool(cards, {
      myClass: 'class-a', otherCls: true, isRandomObtainable: card => card.id !== 'not-random',
    });

    expect(pool).toEqual([cards[0], cards[2]]);
  });

  it('keeps per-build custom predicate calls and does not consume randomness for an empty pool', () => {
    const cards = [
      { id: 'one', rarity: '稀有', type: '武术' },
      { id: 'two', rarity: '稀有', type: '武术' },
    ];
    const predicate = vi.fn(() => true);
    const options = { myClass: 'class-a', pred: predicate, isRandomObtainable: () => true };
    const first = buildDiscoverPool(cards, options);
    buildDiscoverPool(cards, options);
    expect(predicate).toHaveBeenCalledTimes(4);

    const random01 = vi.fn(() => 0.5);
    expect(pickRandomDiscoverCandidate([], random01)).toBeNull();
    expect(random01).not.toHaveBeenCalled();
    expect(pickRandomDiscoverCandidate(first, random01)).toBe(cards[1]);
    expect(random01).toHaveBeenCalledTimes(1);
    expect(first).toEqual(cards);
  });
});
