import { afterEach, describe, expect, it, vi } from 'vitest';
import mapData from '../game/data/map.json';

const egg = { id: 'pet-egg', name: '宠物蛋', rarity: '稀有', type: '道具' };
const other = { id: 'other', name: '普通牌', rarity: '古朴', type: '法术' };
const base = {
  petEggDropChance: vi.fn(() => 1),
  recordPetEggChestResult: vi.fn(),
};
window.SDT = {
  UI: { showOverlay: vi.fn(), hideOverlay: vi.fn(), act: vi.fn(), refresh: vi.fn(), log: vi.fn(), el: {} },
  MAP: { chestKinds: { small: { name: '小宝箱', cards: 0, coins: [0, 0] } } },
  Cards: {
    RARITIES: ['古朴', '稀有', '史诗', '传说'],
    all: () => [egg],
    randomDropCard: () => other,
    pickOfRarity: () => other,
    classPool: () => [],
    rarityOf: card => card.rarity,
  },
  Base: base,
  Sound: { sfx: vi.fn() },
  Icons: { rich: html => html },
};
const { SeededRandomService, setRandomService } = await import('../game/src/core/random.js');
const { SDT: chestFacade } = await import('../game/src/run/chests.js');

afterEach(() => {
  vi.restoreAllMocks();
  setRandomService(new SeededRandomService(1));
  base.recordPetEggChestResult.mockClear();
  base.petEggDropChance.mockClear();
  base.petEggDropChance.mockReturnValue(1);
});

describe('宝箱宠物蛋结算', () => {
  it('空宝箱命中但蛋目录缺失时累加 pity，仍只消耗原随机序列', () => {
    window.SDT.Cards.all = () => [];
    const random = vi.fn(() => 0.5);
    setRandomService({ random, reseed: vi.fn(), snapshot: vi.fn(), restore: vi.fn() });

    const result = chestFacade.Chests.rollContents('small');

    expect(result.eggHit).toBeUndefined();
    expect(base.recordPetEggChestResult).toHaveBeenCalledExactlyOnceWith({ eggGranted: false });
    expect(random).toHaveBeenCalledTimes(2);
    expect(random.mock.calls).toEqual([['loot'], ['loot']]);
  });

  it('蛋已作为普通候选出现时不重复加入，仍记录为未实际出蛋', () => {
    window.SDT.Cards.all = () => [egg];
    window.SDT.MAP.chestKinds.small.cards = 1;
    window.SDT.Cards.randomDropCard = () => egg;
    setRandomService({ random: vi.fn(() => 0.5), reseed: vi.fn(), snapshot: vi.fn(), restore: vi.fn() });

    const result = chestFacade.Chests.rollContents('small');

    expect(result.cards).toEqual([egg]);
    expect(result.eggHit).toBeUndefined();
    expect(base.recordPetEggChestResult).toHaveBeenCalledExactlyOnceWith({ eggGranted: false });
  });

  it('只有实际加入蛋才向 Base 报告成功', () => {
    window.SDT.Cards.all = () => [egg];
    window.SDT.MAP.chestKinds.small.cards = 0;
    setRandomService({ random: vi.fn(() => 0.5), reseed: vi.fn(), snapshot: vi.fn(), restore: vi.fn() });

    const result = chestFacade.Chests.rollContents('small');

    expect(result.cards).toEqual([egg]);
    expect(result.eggHit).toBe(true);
    expect(base.recordPetEggChestResult).toHaveBeenCalledExactlyOnceWith({ eggGranted: true });
  });

  it('职业宝箱奖励也推进同一保底计数', () => {
    const classCard = { id: 'class-card', name: '职业牌', rarity: '职业', type: '武术' };
    window.SDT.MAP.chestKinds.small.pickFrom = 1;
    window.SDT.MAP.chestKinds.small.cards = 1;
    window.SDT.Cards.classPool = () => [classCard];
    const random = vi.fn(() => 0.5);
    setRandomService({ random, reseed: vi.fn(), snapshot: vi.fn(), restore: vi.fn() });
    chestFacade.Chests.open({ myClass: '武术', state: 'idle' }, [], vi.fn());

    const result = chestFacade.Chests.rollContents('small', true);

    expect(result.cards).toEqual([classCard, egg]);
    expect(result.eggHit).toBe(true);
    expect(base.recordPetEggChestResult).toHaveBeenCalledExactlyOnceWith({ eggGranted: true });
    expect(random).toHaveBeenCalledTimes(3);
    expect(random.mock.calls).toEqual([['loot'], ['loot'], ['loot']]);
  });

  it.each(['medium', 'large', 'boss'].flatMap(kind => [false, true].map(withEgg => ({ kind, withEgg }))))(
    '$kind 不升级全古朴候选，宠物蛋附赠=$withEgg', ({ kind, withEgg }) => {
    const count = kind === 'boss' ? 5 : 3;
    const ordinary = Array.from({ length: count }, (_, i) => ({
      id: `ordinary-${i}`, name: `普通牌${i}`, rarity: '古朴', type: '法术',
    }));
    window.SDT.MAP.chestKinds[kind] = {
      ...(kind === 'medium' ? { pickFrom: count } : { cards: count }),
      coins: null, coinCards: [],
    };
    let nextOrdinary = 0;
    window.SDT.Cards.randomDropCard = vi.fn(() => ordinary[nextOrdinary++]);
    window.SDT.Cards.pickOfRarity = vi.fn(() => ({ id: 'epic', name: '史诗牌', rarity: '史诗', type: '法术' }));
    setRandomService({ random: vi.fn(() => 0.5), reseed: vi.fn(), snapshot: vi.fn(), restore: vi.fn() });
    base.petEggDropChance.mockReturnValueOnce(withEgg ? 1 : 0);

    const result = chestFacade.Chests.rollContents(kind);

    expect(result.cards).toEqual(withEgg ? [...ordinary, egg] : ordinary);
    expect(result.claimMode).toBe(kind === 'medium' ? 'one' : 'all');
    if (kind === 'medium') expect(result.choiceCount).toBe(count);
    expect(result.pity).toBeUndefined();
    expect(window.SDT.Cards.randomDropCard).toHaveBeenCalledTimes(count);
    expect(window.SDT.Cards.pickOfRarity).not.toHaveBeenCalled();
    expect(base.recordPetEggChestResult).toHaveBeenCalledExactlyOnceWith({ eggGranted: withEgg });
  });

  it.each([false, true])('首脑箱不额外附赠通行证 B，基础抽取命中=%s', drawnToken => {
    const token = { id: 'tt-token-gold', name: '员工通行证B', rarity: '传说', type: '道具' };
    const coins = mapData.chestKinds.boss.coinCards.map((name, i) => ({
      id: `coin-${i}`, name, rarity: '古朴', type: '资源',
    }));
    const ordinary = Array.from({ length: 5 }, (_, i) => ({
      id: `base-${i}`, name: `基础牌${i}`, rarity: '古朴', type: '法术',
    }));
    if (drawnToken) ordinary[0] = token;
    window.SDT.MAP.chestKinds.boss = structuredClone(mapData.chestKinds.boss);
    window.SDT.Cards.all = () => [egg, token, ...coins];
    let next = 0;
    window.SDT.Cards.randomDropCard = () => ordinary[next++];
    base.petEggDropChance.mockReturnValueOnce(0);
    const random = vi.fn(() => 0.1);
    setRandomService({ random, reseed: vi.fn(), snapshot: vi.fn(), restore: vi.fn() });

    const result = chestFacade.Chests.rollContents('boss');

    expect(result.cards).toEqual([...ordinary, coins[0]]);
    expect(result.cards.filter(card => card.id === token.id)).toHaveLength(drawnToken ? 1 : 0);
    expect(result.tokenHit).toBeUndefined();
    expect(mapData.chestKinds.boss.tokenChance).toBeUndefined();
    expect(random).toHaveBeenCalledTimes(2); // 宠物蛋与货币卡；没有额外通行证掷骰。
  });
});
