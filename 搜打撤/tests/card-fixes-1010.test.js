// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { sourceCardLibrary } from '../scripts/sync-cards-from-live.mjs';
import sync from '../game/data/cards-sync.json';

describe('老板10-10卡牌修正', () => {
  const cards = sourceCardLibrary();
  it('完整播种链保持费用、品质与单一通行证A', () => {
    expect(cards.find(c => c.id === 'cc-poison-burst').cost).toBe(1);
    expect(cards.find(c => c.id === 'tt4-shine-token').rarity).toBe('传说');
    expect(cards.filter(c => c.name === '员工通行证A').map(c => c.id)).toEqual(['cmtmvq6ss84l']);
    expect(cards.find(c => c.id === 'cmtn125e1nk0').rules.triggers.onPlay[0].pool.kind).toBe('传说');
  });
  it.each(['tt3-deep-seal', 'tt3eq-boiler', 'tt-medneedle', 'tt-token-color'])('%s从卡库移除且进入旧档退役名单', id => {
    expect(cards.some(c => c.id === id)).toBe(false);
    expect(sync.retire).toContain(id);
  });
});
