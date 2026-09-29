// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { isHandPaymentCandidate, matchesHandSelectKey } from '../game/src/battle/core/battle.hand-selection.js';

describe('pure hand-selection rules', () => {
  it('preserves wildcard and initial-attack key matching', () => {
    expect(matchesHandSelectKey(null, null)).toBe(true);
    expect(matchesHandSelectKey({ name: '杀' }, '初始攻击')).toBe(true);
    expect(matchesHandSelectKey({ name: '斩击', type: '攻击' }, '杀')).toBe(false);
    expect(matchesHandSelectKey({ type: '武术' }, '武术')).toBe(true);
  });

  it('requires a live card entry even when the key is a wildcard', () => {
    expect(isHandPaymentCandidate({
      uid: 'missing-card', handUids: new Set(['missing-card']), card: null, type: null,
    })).toBe(false);
    expect(isHandPaymentCandidate({
      uid: 'valid-card', handUids: new Set(['valid-card']), card: { name: '招式' }, type: null,
    })).toBe(true);
  });

  it('requires current hand membership, a matching type, and no exclusions or prior selection', () => {
    const input = {
      uid: 'candidate', handUids: new Set(['candidate']), card: { type: '武术' }, type: '武术',
    };
    expect(isHandPaymentCandidate(input)).toBe(true);
    expect(isHandPaymentCandidate({ ...input, handUids: new Set() })).toBe(false);
    expect(isHandPaymentCandidate({ ...input, excludedUids: new Set(['candidate']) })).toBe(false);
    expect(isHandPaymentCandidate({ ...input, selectedUids: new Set(['candidate']) })).toBe(false);
    expect(isHandPaymentCandidate({ ...input, type: '法术' })).toBe(false);
  });
});
