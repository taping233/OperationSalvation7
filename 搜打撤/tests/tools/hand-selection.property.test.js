// @vitest-environment node
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { isHandPaymentCandidate, matchesHandSelectKey } from '../../game/src/battle/core/battle.hand-selection.js';

const options = { seed: 20261018, numRuns: 500 };
const text = fc.string({ maxLength: 30 });

describe('hand payment property contracts', () => {
  it('requires a real card and current membership, and forbids excluded or already selected UIDs', () => {
    fc.assert(fc.property(text, fc.boolean(), fc.boolean(), fc.boolean(), fc.boolean(),
      (uid, present, excluded, selected, hasCard) => {
        const actual = isHandPaymentCandidate({
          uid, handUids: new Set(present ? [uid] : []), card: hasCard ? { type: '武术' } : null,
          type: '武术', excludedUids: new Set(excluded ? [uid] : []), selectedUids: new Set(selected ? [uid] : []),
        });
        expect(actual).toBe(hasCard && present && !excluded && !selected);
      }), options);
  });

  it('matches ordinary type keys exactly and does not mutate its inputs', () => {
    const key = text.filter(value => !!value && !['牌', '杀', '初始攻击'].includes(value));
    fc.assert(fc.property(text, key, text, (uid, required, actualType) => {
      const card = Object.freeze({ name: '普通牌', type: actualType });
      const handUids = new Set([uid]);
      expect(isHandPaymentCandidate({ uid, handUids, card, type: required })).toBe(actualType === required);
      expect([...handUids]).toEqual([uid]);
      expect(card).toEqual({ name: '普通牌', type: actualType });
    }), options);
  });

  it('wildcard keys match without changing the separate live-card requirement', () => {
    fc.assert(fc.property(fc.option(fc.record({ name: text, type: text }), { nil: null }),
      fc.constantFrom(null, undefined, '', '牌'), (card, key) => {
        expect(matchesHandSelectKey(card, key)).toBe(true);
      }), options);
    for (const key of ['武术', '杀', '初始攻击']) expect(matchesHandSelectKey(null, key)).toBe(false);
  });

  it('initial attack aliases match only the complete accepted card names', () => {
    fc.assert(fc.property(fc.oneof(text, fc.constantFrom('杀', '初始攻击', '杀额外', '额外杀', '初始攻击额外')),
      fc.constantFrom('杀', '初始攻击'), (name, key) => {
        expect(matchesHandSelectKey({ name }, key)).toBe(name === '杀' || name === '初始攻击');
      }), options);
    expect(matchesHandSelectKey({}, '杀')).toBe(false);
  });
});
