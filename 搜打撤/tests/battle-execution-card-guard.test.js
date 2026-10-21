import { describe, expect, it } from 'vitest';
import { assertCardRulesExecutable } from '../game/src/battle/effects/battle.rule-guard.js';

describe('existing battle execution rule boundary', () => {
  it('retains valid structured card data without rewriting it', () => {
    const card = { name: '规则边界', type: '法术', dmgType: 'fixed', rules: { version: 1, battle: { target: { side: 'enemy', area: false } }, triggers: { onPlay: [{ op: 'damage', amount: 2, target: 'chosenEnemy' }] } } };
    const before = JSON.stringify(card);
    expect(() => assertCardRulesExecutable(card)).not.toThrow();
    expect(JSON.stringify(card)).toBe(before);
  });
  it('rejects malformed rule containers at the original schema boundary', () => {
    expect(() => assertCardRulesExecutable({ name: '规则边界', rules: { version: 1, triggers: { onPlay: 'damage' } } })).toThrow();
    expect(() => assertCardRulesExecutable({ name: '规则边界', rules: { version: 1, triggers: { onPlay: [{ op: 'damage', amount: 'two' }] } } })).toThrow();
  });
  it('rejects unsupported operations at the original capability boundary', () => {
    expect(() => assertCardRulesExecutable({ name: '规则边界', rules: { version: 1, triggers: { onPlay: [{ op: 'unknown-operation' }] } } })).toThrow();
  });
});
