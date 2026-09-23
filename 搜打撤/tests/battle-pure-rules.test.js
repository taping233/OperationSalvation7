import { describe, expect, it } from 'vitest';
import { calculateEffectiveCardCost, pocketSpellDiscountFor } from '../game/src/battle.card-cost.js';
import { isAreaEffect, targetSideFor, unplayableReasonFor } from '../game/src/battle.rules.js';
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

describe('结构化战斗出牌前规则', () => {
  it('结构化费用不受描述改写影响，并保留全局费用优先级', () => {
    const card = {
      type: '法术', cost: 4, desc: '原始描述',
      rules: { version: 1, battle: { costModifiers: [
        { kind: 'previousCardTypeFree', type: '武术' },
        { kind: 'martialPlayedDiscount', amount: 1 },
        { kind: 'armorZeroFree' },
        { kind: 'consumedSpellDiscount', amount: 2 },
      ] } },
    };
    const state = { lastPlayedType: '武术', playedMartialThisTurn: 2, armor: 0, consumedSpellCount: 2 };
    expect(cost(card, state)).toBe(0);
    expect(cost({ ...card, desc: '任意重写后的文案' }, state)).toBe(0);
    expect(cost({ ...card, desc: '重写', rules: { ...card.rules, battle: { costModifiers: [{ kind: 'previousCardTypeFree', type: '武术' }] } } }, {
      ...state, zeroFeeTurn: 1, turn: 1,
    })).toBe(0);
    expect(pocketSpellDiscountFor(card)).toBe(2);
    expect(pocketSpellDiscountFor({ ...card, desc: '没有提到口袋法术' })).toBe(2);
  });

  it('结构化 requirements 控制禁用、牌库限制和手牌代价，改写描述不改变合法性', () => {
    const seal = { type: '法术', desc: '完全不同的说明', rules: { version: 1, battle: { requirements: [{ kind: 'unplayable' }] } } };
    expect(unplayableReasonFor(seal, 'boss')).toContain('封印之牌');
    expect(unplayableReasonFor({ ...seal, desc: '没有规则词语' }, 'boss')).toContain('封印之牌');

    const deck = { type: '法术', desc: '可以在牌库外打出', rules: { version: 1, battle: { requirements: [{ kind: 'deckOnly' }] } } };
    expect(unplayableReasonFor(deck, 'normal')).toContain('牌库');
    expect(unplayableReasonFor(deck, 'boss')).toBe(null);
    expect(unplayableReasonFor({ type: '能力卡', rules: { version: 1, battle: { requirements: [] } } }, 'normal')).toContain('能力卡');

    const discard = { type: '武术', desc: '无需手牌', rules: { version: 1, battle: { requirements: [{ kind: 'handCards', count: 2, type: '初始攻击' }] } } };
    const handCards = [{ card: { name: '初始攻击' } }, { card: { name: '初始攻击' } }];
    expect(unplayableReasonFor(discard, 'boss', { handCards: handCards.slice(0, 1), selfCard: discard })).toContain('需要 2 张');
    expect(unplayableReasonFor(discard, 'boss', { handCards, selfCard: discard })).toBe(null);
    expect(unplayableReasonFor({ ...discard, desc: '改写描述' }, 'boss', { handCards, selfCard: discard })).toBe(null);
  });

  it('结构化 target 提供目标侧和群体范围，描述改写不改变两者', () => {
    const card = { type: '法术', desc: '没有目标词', rules: { version: 1, battle: { target: { side: 'enemy', area: true } } } };
    expect(targetSideFor(card, ['武术'])).toBe('enemy');
    expect(isAreaEffect(card)).toBe(true);
    const rewritten = { ...card, desc: '回复自己并只影响单体' };
    expect(targetSideFor(rewritten, ['武术'])).toBe('enemy');
    expect(isAreaEffect(rewritten)).toBe(true);

    const self = { type: '法术', desc: '对所有敌人造成伤害', rules: { version: 1, battle: { target: { side: 'self', area: false } } } };
    expect(targetSideFor(self, ['武术'])).toBe('self');
    expect(isAreaEffect(self)).toBe(false);

    expect(targetSideFor({ type: '装备', desc: '装配到自己', rules: { version: 1, battle: { target: { side: 'enemy', area: false } } } }, ['武术'])).toBe('enemy');
    expect(targetSideFor({ type: '装备', desc: '旧装备' }, ['武术'])).toBe('self');
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
