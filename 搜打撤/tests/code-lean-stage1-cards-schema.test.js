import { describe, expect, it } from 'vitest';
import { validateCardRules } from '../game/src/cards/card-rules.schema.js';

const values = [undefined, null, NaN, Infinity, -1, 0, 0.5, 1, 2, true, false, '', '1', [], {}];
const validate = rules => validateCardRules({
  id: 'lean-schema', type: '法术', dmg: 2, draw: 2, rules: { version: 1, ...rules },
});
const operation = op => validate({ triggers: { onPlay: [op] } });

describe('stage 1 cards schema shared guards', () => {
  it('retains the ordered numeric modifier errors across equivalent kinds', () => {
    for (const amount of values) for (const type of values) {
      const result = kind => validate({ battle: { costModifiers: [{ kind, amount, type, unknown: true }] } });
      const expected = result('martialPlayedDiscount');
      expect(result('movesPlayedDiscount')).toEqual(expected);
      expect(result('consumedSpellDiscount')).toEqual(expected);
      expect(expected.errors.map(error => error.path)).toEqual([
        'rules.battle.costModifiers[0]',
        ...(type === undefined ? [] : ['rules.battle.costModifiers[0].type']),
        ...(Number.isInteger(amount) && amount >= 1 ? [] : ['rules.battle.costModifiers[0].amount']),
      ]);
    }
  });

  it('retains optional nonnegative integer acceptance and error text', () => {
    for (const value of values) {
      for (const [op, path] of [
        [{ op: 'summon', name: 'test', count: 1, atk: value }, 'atk'],
        [{ op: 'transform', what: 'self', cost: value }, 'cost'],
        [{ op: 'stealAtk', amount: 1, capTo: value }, 'capTo'],
        [{ op: 'acquire', n: 1, pool: { kind: 'all' }, filter: { cost: value } }, 'filter.cost'],
        [{ op: 'acquire', n: 1, pool: { kind: 'all' }, filter: { costMax: value } }, 'filter.costMax'],
      ]) {
        const errors = operation(op).errors.filter(error => error.path === `rules.triggers.onPlay[0].${path}`);
        expect(errors).toEqual(value === undefined || (Number.isInteger(value) && value >= 0) ? [] : [{
          cardId: 'lean-schema', path: `rules.triggers.onPlay[0].${path}`, message: 'must be a nonnegative integer',
        }]);
      }
    }
  });

  it('rejects empty, non-record and unknown-key structures before child validation', () => {
    for (const value of [null, [], 0, '', {}, { unknown: 1 }]) {
      for (const [rules, path] of [
        [{ equip: value }, 'rules.equip'],
        [{ equip: { passive: value } }, 'rules.equip.passive'],
        [{ equip: { passive: { aura: value } } }, 'rules.equip.passive.aura'],
        [{ equip: { passive: { cond: value } } }, 'rules.equip.passive.cond'],
      ]) {
        expect(validate(rules).errors.map(error => error.path)).toEqual([path]);
      }
      for (const [op, field] of [
        [{ op: 'damage', amount: 2, cond: value }, 'cond'],
        [{ op: 'damage', amount: 2, onKill: value }, 'onKill'],
        [{ op: 'draw', amount: 2, filter: value }, 'filter'],
        [{ op: 'execute', cap: value }, 'cap'],
        [{ op: 'acquire', n: 1, pool: { kind: 'all' }, filter: value }, 'filter'],
      ]) {
        expect(operation(op).errors.filter(error => error.path === `rules.triggers.onPlay[0].${field}`)).toHaveLength(1);
      }
    }
  });

  it('keeps own keys with undefined values distinct from an empty object', () => {
    expect(validate({ equip: { passive: { aura: { atk: undefined } } } }).errors).toEqual([]);
    expect(validate({ equip: { passive: { cond: { hasCurse: undefined } } } }).errors).toEqual([]);
    expect(validateCardRules({ id: 'lean-draw', type: '法术', draw: 2, rules: {
      version: 1, battle: { target: { side: 'self', area: false } },
      triggers: { onPlay: [{ op: 'draw', amount: 2, filter: { type: undefined } }] },
    } }).errors).toEqual([]);
  });
});
