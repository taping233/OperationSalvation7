// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { intentSummary, intentViewModel } from '../game/src/battle/view/battle.intent.view.js';

describe('enemy intent presentation', () => {
  it('keeps zero-damage attacks distinct from non-damaging intents', () => {
    const [attack, charge, guard] = intentViewModel([
      { kind: 'strike', label: '攻击', damage: 0, hits: 2 },
      { kind: 'charge', label: '蓄力·下回合行动', damage: null },
      { kind: 'guard', label: '防御', damage: 0 },
    ]);
    expect(attack).toMatchObject({ damage: 0, hits: 2, totalDamage: 0 });
    expect(charge.damage).toBeNull();
    expect(guard.damage).toBeNull();
  });

  it('preserves every part of a compound intent in its text summary', () => {
    expect(intentSummary([
      { label: '攻击并灼烧', damage: 4, hits: 2, bleedBonus: 1 },
      { label: '庇幕', damage: null },
    ])).toBe('攻击并灼烧 · 4 ×2（共8） · 流血 1 层 / 庇幕');
    expect(intentSummary(null)).toBe('');
  });
});
