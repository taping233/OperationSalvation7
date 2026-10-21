// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createTargetTurnCostModifier, targetTurnCostStatus, targetTurnCardCost } from '../game/src/battle/effects/battle.cost-modifiers.js';
import { calculateEffectiveCardCost } from '../game/src/battle/effects/battle.card-cost.js';
import { createBattleCardInspection } from '../game/src/battle/effects/battle.card-inspection.js';
import { createBattleSelectionFlow } from '../game/src/battle/core/battle.selection-flow.js';
import { createBattleRuntime } from '../game/src/battle/runtime/battle.runtime.factory.js';
const runtime = createBattleRuntime();

const spell = { id: 'cost-lifecycle-spell', name: '费用测试牌', type: '法术', cost: 4, desc: '' };
const cost = (modifier, state = {}, card = spell, uid = 'selected', reader = null) =>
  calculateEffectiveCardCost(card, uid, {
    turn: 3, temporaryCostModifier: modifier, playedMartialThisTurn: 0,
    playedMovesThisTurn: 0, lastPlayedType: '', armor: 1, ...state,
  }, reader);

afterEach(() => {
  runtime.resetCastOverrides();
  runtime.set$turn(1);
  runtime.set$hand([]);
  runtime.set$consumed([]);
  runtime.set$handSelecting(null);
  runtime.set$G(null);
});

describe('临时费用记录的真实自然法杖接入', () => {
  it('选中实例当前回合原费，下一目标回合免费，错过后恢复且不修改卡定义', () => {
    const original = Object.freeze({ ...spell });
    const entries = ['selected', 'other-instance'].map(uid => ({ uid, card: original }));
    runtime.resetCastOverrides();
    runtime.set$turn(2);
    runtime.set$hand(entries.map(entry => entry.uid));
    runtime.set$consumed([]);
    runtime.set$G({ battleActive: true, ownedCards: entries, log: vi.fn() });
    const inspection = createBattleCardInspection({ cards: {}, curseMeta: {}, readState: () => ({
      game: runtime.G, granted: [], cardOverrides: runtime.cardOverrides,
      zeroFeeUntil: runtime.zeroFeeUntil, turn: runtime.turn, consumed: runtime.consumed,
    }) });
    const flow = createBattleSelectionFlow({ runtime, cards: {}, deny: vi.fn(), random01: () => 0,
      throwIfActionCancelled: vi.fn(), session: { handSelectQueue: [], choiceQueue: [] },
      requestBattleRender: vi.fn(), findCard: inspection.findCard });
    runtime.set$handSelecting({ act: 'zero', n: 1, type: null });
    flow.pickHandSelect('selected');
    const stored = runtime.zeroFeeUntil.get('selected');
    expect(stored).toMatchObject({ version: 1, kind: 'set', lifetime: 'targetTurn', amount: 0, targetTurn: 3 });
    expect(targetTurnCostStatus(stored, 2)).toBe('pending');
    expect(inspection.effCostOf(original, 'selected')).toBe(4);
    runtime.set$turn(3);
    expect(inspection.effCostOf(original, 'selected')).toBe(0);
    expect(inspection.effCostOf(original, 'selected')).toBe(0);
    expect(inspection.effCostOf(original, 'other-instance')).toBe(4);
    expect(inspection.effCostOf(original)).toBe(4);
    expect(runtime.zeroFeeUntil.get('selected')).toBe(stored);
    runtime.set$turn(4);
    expect(targetTurnCostStatus(stored, 4)).toBe('expired');
    expect(inspection.effCostOf(original, 'selected')).toBe(4);
    expect(original).toEqual(spell);
    expect(runtime.cardOverrides.size).toBe(0);
    expect(runtime.hand).toEqual(['selected', 'other-instance']);
  });

  it.each([3, createTargetTurnCostModifier(0, 3)])('新旧记录JSON恢复后保留同一目标回合语义：%j', modifier => {
    const saved = JSON.parse(JSON.stringify({ zeroFeeUntil: [['selected', modifier]] }));
    runtime.restorePilesBookkeeping(saved);
    const restored = runtime.zeroFeeUntil.get('selected');
    expect(cost(restored, { turn: 2 })).toBe(4);
    expect(cost(restored, { turn: 3 })).toBe(0);
    expect(cost(restored, { turn: 4 })).toBe(4);
    runtime.resetCastOverrides();
    expect(cost(runtime.zeroFeeUntil.get('selected'))).toBe(4);
  });
});

describe('临时费用和现有优先级组合', () => {
  it('无限符文仍优先；自然法杖仍压过形态、固定1费和条件折扣', () => {
    const modifier = createTargetTurnCostModifier(0, 3);
    const conditional = { ...spell, rules: { battle: { costModifiers: [
      { kind: 'previousCardTypeFree', type: '武术' },
      { kind: 'martialPlayedDiscount', amount: 1 },
      { kind: 'movesPlayedDiscount', amount: 2 },
      { kind: 'armorZeroFree' },
      { kind: 'consumedSpellDiscount', amount: 1 },
    ] } } };
    const countConsumed = vi.fn(() => 99);
    const state = { unlimitedRune: true, cosmosForm: 1, spellCost1: true,
      lastPlayedType: '武术', playedMartialThisTurn: 9, playedMovesThisTurn: 9, armor: 0 };
    expect(cost(modifier, state, conditional, 'bts-1', countConsumed)).toBe(3);
    expect(cost(modifier, state, conditional, 'owned-1', countConsumed)).toBe(0);
    expect(countConsumed).not.toHaveBeenCalled();
    expect(cost(modifier, { ...state, turn: 4 }, conditional, 'owned-1', countConsumed)).toBe(1);
  });

  it('过期后沿用原条件费用优先级，不按声明插入顺序叠加折扣', () => {
    const modifier = createTargetTurnCostModifier(0, 2);
    const ordered = [
      { kind: 'consumedSpellDiscount', amount: 4 },
      { kind: 'movesPlayedDiscount', amount: 3 },
      { kind: 'martialPlayedDiscount', amount: 1 },
    ];
    const state = { playedMartialThisTurn: 1, playedMovesThisTurn: 3, consumedSpellCount: 4 };
    expect(cost(modifier, state, { ...spell, rules: { battle: { costModifiers: ordered } } })).toBe(3);
    expect(cost(modifier, state, { ...spell, rules: { battle: { costModifiers: [...ordered].reverse() } } })).toBe(3);
  });

  it('onlyReduce不提高基础费或其他规则算出的更低费用', () => {
    const reduction = createTargetTurnCostModifier(2, 3, { onlyReduce: true });
    expect(cost(reduction)).toBe(2);
    expect(cost(reduction, {}, { ...spell, cost: 1 })).toBe(1);
    expect(cost(reduction, { cosmosForm: 1 })).toBe(1);
    expect(cost(reduction, { spellCost1: true })).toBe(1);
    const free = { ...spell, rules: { battle: { costModifiers: [{ kind: 'previousCardTypeFree', type: '武术' }] } } };
    expect(cost(reduction, { lastPlayedType: '武术' }, free)).toBe(0);
    expect(cost(createTargetTurnCostModifier(2, 3), { lastPlayedType: '武术' }, free)).toBe(2);
    expect(targetTurnCardCost(1, reduction, 3)).toBe(1);
  });

  it('旧zeroFeeTurn调用合同、原始费用类型和无UID规则保持', () => {
    expect(calculateEffectiveCardCost(spell, 'selected', { turn: 3, zeroFeeTurn: 3 })).toBe(0);
    expect(calculateEffectiveCardCost(spell, 'selected', { turn: 4, zeroFeeTurn: 3 })).toBe(4);
    expect(cost(createTargetTurnCostModifier(0, 3), {}, spell, null)).toBe(4);
    expect(cost(undefined, {}, { ...spell, cost: '4' })).toBe('4');
  });

  it.each([
    null, undefined, NaN, '3', [], {},
    { version: 2, kind: 'set', lifetime: 'targetTurn', targetTurn: 3, amount: 0, onlyReduce: false },
    { version: 1, kind: 'set', lifetime: 'nextPlay', targetTurn: 3, amount: 0, onlyReduce: false },
    { version: 1, kind: 'set', lifetime: 'targetTurn', targetTurn: 3, amount: -1, onlyReduce: false },
  ])('不支持或损坏记录不产生免费费用：%j', modifier => {
    expect(targetTurnCostStatus(modifier, 3)).toBe('invalid');
    expect(cost(modifier)).toBe(4);
  });
});
