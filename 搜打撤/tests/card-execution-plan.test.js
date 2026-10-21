import { describe, expect, it } from 'vitest';
import {
  triggerExecutionPlan, equipmentExecutionPlan, registeredExecutionPlan,
  cardPlayExecutionPlan, cardRulePreflightView, createCardRuleExecutionView,
} from '../game/src/cards/card-execution-plan.js';
import { createCardRuleExecutionView as schemaExecutionView } from '../game/src/cards/card-rules.schema.js';
import { inspectCardRuleCapability } from '../game/src/cards/card-rules.capability.js';
import { directTriggerSource } from '../game/src/battle/effects/battle.trigger-source.js';
import { assertCardRulesExecutable } from '../game/src/battle/effects/battle.rule-guard.js';

const card = rules => ({ id: 'plan', name: '规则来源', type: '法术', cost: 0,
  desc: '抽到时施放：获得 9 点能量。消耗该牌时：获得 8 点能量。', rules: { version: 1, ...rules } });

describe('card execution authority plan', () => {
  it.each(['onPlay', 'onDraw', 'onConsume', 'onTurnStart'])('an empty %s owns only its declared point', point => {
    const value = card({ triggers: { [point]: [] } });
    expect(triggerExecutionPlan(value, point)).toEqual({ kind: 'structured', ops: [] });
    const other = point === 'onDraw' ? 'onConsume' : 'onDraw';
    expect(triggerExecutionPlan(value, other).kind).toBe('text');
    expect(directTriggerSource(value, other).texts).toHaveLength(1);
  });

  it('uses preserved declarations for both onPlay and registered plans', () => {
    const draw = [{ op: 'energy', n: 0 }];
    const value = { ...card({ triggers: {} }), _registeredTriggers: { onPlay: [], onDraw: draw, onTurnStart: draw, duration: 2 } };
    expect(cardPlayExecutionPlan(value).onPlay).toEqual({ kind: 'structured', ops: [] });
    expect(triggerExecutionPlan(value, 'onDraw').ops).toBe(draw);
    expect(registeredExecutionPlan(value)).toEqual({ points: new Map([['onTurnStart', draw]]), left: 2 });
    expect(cardRulePreflightView(value).rules.triggers).toBe(value._registeredTriggers);
  });

  it('does not register direct events or empty event containers', () => {
    const value = card({ triggers: { onDraw: [{ op: 'energy', n: 1 }], onTurnStart: [] } });
    expect(registeredExecutionPlan(value).points.size).toBe(0);
  });

  it('rejects hidden unsupported declarations before accepting the isolated play view', () => {
    const value = { ...card({ triggers: { onPlay: [] } }),
      _registeredTriggers: { onPlay: [], onDraw: [{ op: 'transform', into: 'anything' }] } };
    expect(inspectCardRuleCapability(value).ok).toBe(false);
    expect(() => assertCardRulesExecutable(value)).toThrow();
  });

  it('retains invalid false declarations for schema rejection rather than falling back to text', () => {
    const value = card({ triggers: { onDraw: false } });
    expect(triggerExecutionPlan(value, 'onDraw')).toEqual({ kind: 'structured', ops: false });
    expect(directTriggerSource(value, 'onDraw').texts).toEqual([]);
    expect(inspectCardRuleCapability(value).ok).toBe(false);
  });

  it('keeps zero amounts and false operation flags in the shared execution view', () => {
    const value = { ...card({}), heal: 0, dmg: 7 };
    const ops = [{ op: 'heal', amountField: 'heal' }, { op: 'draw', amount: 0, firstFree: false }];
    const execution = createCardRuleExecutionView(value, ops);
    expect(execution.rules.triggers.onPlay).toEqual([
      { op: 'heal', amount: 0 }, { op: 'draw', amount: 0, firstFree: false },
    ]);
    expect(execution.dmg).toBeUndefined();
    expect(value.heal).toBe(0);
    expect(ops[0]).toEqual({ op: 'heal', amountField: 'heal' });
    expect(schemaExecutionView).toBe(createCardRuleExecutionView);
  });

  it('suppresses onEquip text without suppressing an undeclared turnStart point', () => {
    const value = card({ equip: { onEquip: [], passive: { aura: { atk: 0 } } } });
    const plan = cardPlayExecutionPlan(value);
    expect(plan.suppressImmediateText).toBe(true);
    expect(plan.equipment('passive').kind).toBe('structured');
    expect(plan.ownsField('heal')).toBe(false);
    expect(triggerExecutionPlan(value, 'onTurnStart').kind).toBe('text');
    expect(equipmentExecutionPlan(value, 'battleStart').kind).toBe('text');
  });

  it('owns numeric fallback fields across onEquip, battleStart, and skill only', () => {
    const value = card({ equip: { onEquip: [{ op: 'armor', amount: 0 }],
      skill: { ops: [{ op: 'heal', amountField: 'heal' }] } } });
    const plan = cardPlayExecutionPlan(value);
    expect(plan.ownsField('heal')).toBe(true);
    expect(plan.ownsField('armor')).toBe(true);
    expect(plan.ownsField('draw')).toBe(false);
    expect(equipmentExecutionPlan(value, 'skill').ops).toBe(value.rules.equip.skill.ops);
  });
});
