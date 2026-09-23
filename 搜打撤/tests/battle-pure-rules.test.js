import { describe, expect, it } from 'vitest';
import { calculateEffectiveCardCost } from '../game/src/battle.card-cost.js';
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
  ...state,
});

describe('pure card cost rules', () => {
  it('prioritizes Infinite Rune and limits it to battle-acquired moves', () => {
    const card = { type: '武术', cost: 2 };
    expect(cost(card, { unlimitedRune: true, zeroFeeTurn: 4, turn: 3, cosmosForm: 1 }, 'bts-1')).toBe(1);
    expect(cost(card, { unlimitedRune: true }, 'deck-1')).toBe(2);
    expect(cost({ type: '道具', cost: 2 }, { unlimitedRune: true }, 'bts-2')).toBe(2);
  });

  it('keeps the zero-fee deadline inclusive and restores cost after expiry', () => {
    const card = { type: '法术', cost: 3 };
    expect(cost(card, { zeroFeeTurn: 3, turn: 3, cosmosForm: 1 }, 'uid')).toBe(0);
    expect(cost(card, { zeroFeeTurn: 2, turn: 3 }, 'uid')).toBe(3);
  });

  it('applies form and type-specific one-cost rules before text discounts', () => {
    const martial = { type: '武术', cost: 4, desc: '上一张牌是武术时，本牌0费' };
    const spell = { type: '法术', cost: 4, desc: '上一张牌是武术时，本牌0费' };
    expect(cost(spell, { cosmosForm: 1, spellCost1: true, lastPlayedType: '武术' })).toBe(1);
    expect(cost(spell, { spellCost1: true, lastPlayedType: '武术' })).toBe(1);
    expect(cost(martial, { meleeCost1: true, lastPlayedType: '武术' })).toBe(1);
  });

  it('applies previous-martial, chase, and the original zero-armor text rule', () => {
    expect(cost({ cost: 2, desc: '上一张牌是武术时，本牌0费' }, { lastPlayedType: '武术' })).toBe(0);
    const chase = { cost: 2, desc: '本回合每打出一张其他武术，本牌费用-1' };
    expect(cost(chase, { playedMartialThisTurn: 1 })).toBe(1);
    expect(cost(chase, { playedMartialThisTurn: 4 })).toBe(0);
    const armor = { cost: 2, desc: '护甲为0，本牌变为0费' };
    expect(cost(armor, { armor: 0 })).toBe(0);
    expect(cost(armor, { armor: 1 })).toBe(2);
    expect(cost({ cost: '3' })).toBe('3');
  });
});

describe('pure enemy intent projection', () => {
  it('previews an odd-round charge and even-round damage including player bleed', () => {
    const foe = { behavior: 'dragon', evenAttack: true, atk: 8 };
    expect(calculateEnemyIntent(foe, 1, { bleed: 3 })).toEqual({
      kind: 'dragon', icon: '[[icon:crystal]]', label: '蓄力·下回合行动', damage: null, hits: 1,
    });
    expect(calculateEnemyIntent(foe, 2, { bleed: 3 })).toEqual({
      kind: 'dragon', icon: '[[icon:demon]]', label: '攻击·阶段效果', damage: 11, hits: 1, bleedBonus: 3,
    });
  });

  it('keeps the frenzy double-hit preview and clamps attack before bleed bonus', () => {
    expect(calculateEnemyIntent({ affix: 'frenzy', atk: -2 }, 2, { bleed: 4 })).toEqual({
      kind: 'orc_boss', icon: '[[icon:tools]]', label: '双击并施加诅咒', damage: 4, hits: 2, bleedBonus: 4,
    });
  });
});
