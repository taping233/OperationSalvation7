import { afterEach, describe, expect, it, vi } from 'vitest';

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

  it.each(['large', 'boss'])('%s 第 150 次奖励同时保留宠物蛋和史诗稀有度保底', kind => {
    const ordinary = [
      { id: 'ordinary-a', name: '普通牌甲', rarity: '古朴', type: '法术' },
      { id: 'ordinary-b', name: '普通牌乙', rarity: '古朴', type: '法术' },
    ];
    const epic = { id: 'epic-pity', name: '史诗保底牌', rarity: '史诗', type: '法术' };
    window.SDT.MAP.chestKinds[kind] = { cards: 2, coins: null, coinCards: [], tokenChance: 0 };
    let nextOrdinary = 0;
    window.SDT.Cards.randomDropCard = () => ordinary[nextOrdinary++];
    window.SDT.Cards.pickOfRarity = () => epic;
    setRandomService({ random: vi.fn(() => 0.5), reseed: vi.fn(), snapshot: vi.fn(), restore: vi.fn() });
    base.petEggDropChance.mockReturnValueOnce(1);

    const result = chestFacade.Chests.rollContents(kind);

    expect(result.cards).toEqual([ordinary[0], epic, egg]);
    expect(result.cards.some(card => card.id === 'pet-egg')).toBe(true);
    expect(result.cards.some(card => card.rarity === '史诗')).toBe(true);
    expect(result.pity).toBe('史诗');
    expect(base.recordPetEggChestResult).toHaveBeenCalledExactlyOnceWith({ eggGranted: true });
  });
});
