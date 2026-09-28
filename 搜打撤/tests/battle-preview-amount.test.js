import { describe, expect, it } from 'vitest';
import { previewAction } from '../game/src/battle/battle.preview.js';

function preview(card, damageGrowth) {
  return previewAction({
    snapshot: {
      foes: [{ hp: 8, dead: false, status: {}, defense: { shield: 0, armor: 0, guard: false }, intent: null }],
      player: { atk: 0, spellPower: 0 }, pstat: null,
    },
    action: { kind: 'play-card', uid: 'preview', targetIndex: 0 },
    cardContext: { card, targetIndexes: [0], legal: true, effectiveCost: 0, damageGrowth },
  });
}

describe('battle preview amount compatibility', () => {
  it('treats a null structured amount as zero damage', () => {
    const result = preview({
      type: '武术', dmgType: 'fixed', dmg: 0,
      rules: { triggers: { onPlay: [{ op: 'damage', amount: null }] } },
    }, 0);

    expect(result).toMatchObject({ legal: true, confidence: 'exact', damage: { hits: [0], total: 0 } });
  });

  it('normalizes non-finite growth to zero before computing exact damage', () => {
    const result = preview({
      type: '武术', dmgType: 'fixed', dmg: 2,
      rules: { triggers: { onPlay: [{ op: 'damage', amountField: 'dmg' }] } },
    }, Number.NaN);

    expect(result).toMatchObject({ legal: true, confidence: 'exact', damage: { hits: [2], total: 2 } });
  });

  it('keeps null card damage equivalent to zero for amountField previews', () => {
    const result = preview({
      type: '武术', dmgType: 'fixed', dmg: null,
      rules: { triggers: { onPlay: [{ op: 'damage', amountField: 'dmg' }] } },
    }, 0);

    expect(result).toMatchObject({ legal: true, confidence: 'exact', damage: { hits: [0], total: 0 } });
  });
});
