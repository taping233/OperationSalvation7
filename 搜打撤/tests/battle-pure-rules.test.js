import { describe, expect, it } from 'vitest';
import { calculateEffectiveCardCost, pocketSpellDiscountFor } from '../game/src/battle.card-cost.js';
import { calculateEnemyIntent } from '../game/src/battle.intent.js';

const cost = (card, state = {}, uid) => calculateEffectiveCardCost(card, uid, {
  unlimitedRune: false,
  zeroFeeTurn: undefined,
  turn: 1,
  cosmosForm: 0,
  spellCost1: false,
  meleeCost1: false,
  lastPlayedType: '',
  playedMartialThisTurn: 0,
  armor: null,
  pocketDiscount: 0,
  consumedSpellCount: 0,
  ...state,
});

describe('纯费用规则：优先级与限时折扣', () => {
  it('无限符文优先于限时零费与形态折扣，且仅折扣战斗内获得的招式', () => {
    const card = { type: '武术', cost: 2 };
    expect(cost(card, { unlimitedRune: true, zeroFeeTurn: 4, turn: 3, cosmosForm: 1 }, 'bts-1')).toBe(1);
    expect(cost(card, { unlimitedRune: true }, 'deck-1')).toBe(2);
    expect(cost({ type: '道具', cost: 2 }, { unlimitedRune: true }, 'bts-2')).toBe(2);
  });

  it('零费有效期含截止回合，过期后恢复原费；零费高于宇宙形态', () => {
    const card = { type: '法术', cost: 3 };
    expect(cost(card, { zeroFeeTurn: 3, turn: 3, cosmosForm: 1 }, 'uid')).toBe(0);
    expect(cost(card, { zeroFeeTurn: 2, turn: 3 }, 'uid')).toBe(3);
  });

  it('宇宙形态、法术单费、武术单费按既有顺序压过文本折扣', () => {
    const martial = { type: '武术', cost: 4, desc: '上一张牌是武术时，本牌0费' };
    const spell = { type: '法术', cost: 4, desc: '上一张牌是武术时，本牌0费' };
    expect(cost(spell, { cosmosForm: 1, spellCost1: true, lastPlayedType: '武术' })).toBe(1);
    expect(cost(spell, { spellCost1: true, lastPlayedType: '武术' })).toBe(1);
    expect(cost(martial, { meleeCost1: true, lastPlayedType: '武术' })).toBe(1);
  });
});

describe('纯费用规则：卡牌条件与 TT12 消耗口袋', () => {
  it('上一张武术可归零；追斩按其他武术数折扣并封底为零', () => {
    expect(cost({ cost: 2, desc: '上一张牌是武术时，本牌0费' }, { lastPlayedType: '武术' })).toBe(0);
    const chase = { cost: 2, desc: '本回合每打出一张其他武术，本牌费用-1' };
    expect(cost(chase, { playedMartialThisTurn: 1 })).toBe(1);
    expect(cost(chase, { playedMartialThisTurn: 4 })).toBe(0);
  });

  it('两种无护甲描述都在护甲为零时减费，护甲存在时保留费用', () => {
    const descriptions = [
      '护甲为0，本牌变为0费',
      '如果你此时没有护甲，该牌变为0费',
    ];
    descriptions.forEach(desc => {
      expect(cost({ cost: 2, desc }, { armor: 0 })).toBe(0);
      expect(cost({ cost: 2, desc }, { armor: 1 })).toBe(2);
    });
  });

  it('后备能源只按消耗口袋法术数折扣并最低为零；无匹配牌时原样回传费用', () => {
    const card = { cost: 3, desc: '消耗口袋中每有一张法术牌，本牌费用-1' };
    expect(pocketSpellDiscountFor(card)).toBe(1);
    expect(cost(card, { pocketDiscount: 1, consumedSpellCount: 2 })).toBe(1);
    expect(cost(card, { pocketDiscount: 1, consumedSpellCount: 5 })).toBe(0);
    expect(cost(card, { pocketDiscount: 1, consumedSpellCount: 0 })).toBe(3);
    expect(cost({ cost: '3' })).toBe('3');
  });
});

describe('纯敌方意图：蓄力与实际攻击预告', () => {
  it('偶数回合敌人奇数回合蓄力，下一回合按攻击力和流血预告伤害', () => {
    const foe = { behavior: 'dragon', evenAttack: true, atk: 8 };
    expect(calculateEnemyIntent(foe, 1, { bleed: 3 })).toEqual({
      kind: 'dragon', icon: '[[icon:crystal]]', label: '蓄力·下回合行动', damage: null, hits: 1,
    });
    expect(calculateEnemyIntent(foe, 2, { bleed: 3 })).toEqual({
      kind: 'dragon', icon: '[[icon:demon]]', label: '攻击·阶段效果', damage: 11, hits: 1, bleedBonus: 3,
    });
  });

  it('狂乱敌人的双击预告保持原样，伤害不低于玩家流血加成', () => {
    expect(calculateEnemyIntent({ affix: 'frenzy', atk: -2 }, 2, { bleed: 4 })).toEqual({
      kind: 'orc_boss', icon: '[[icon:tools]]', label: '双击并施加诅咒', damage: 4, hits: 2, bleedBonus: 4,
    });
  });
});
