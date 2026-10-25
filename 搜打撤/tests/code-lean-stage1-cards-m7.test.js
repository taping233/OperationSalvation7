import { expect, it, vi } from 'vitest';

it('M7 canonical defaults ignore inherited card-id fields in the exceptions table', async () => {
  const id = 'tt3-longsword';
  const previous = Object.getOwnPropertyDescriptor(Object.prototype, id);
  let reads = 0;
  vi.resetModules();
  vi.doMock('../game/src/cards/cards.sync.backfiller.js', () => ({ createRuleBackfiller: spec => spec }));
  try {
    Object.defineProperty(Object.prototype, id, {
      configurable: true,
      get() { reads += 1; return 'TABLETOP11'; },
    });
    const { ensureM7EquipRules: spec } = await import('../game/src/cards/cards.sync.m7.js');
    expect(spec.canonicalTableById.size).toBe(15);
    expect(spec.canonicalTableById.get(id)).toBe('TABLETOP10');
    expect(spec.canonicalTableById.get('tt8-archdemon')).toBe('TABLETOP10');
    expect(spec.canonicalTableById.get('tt2-treasuremap')).toBe('TABLETOP11');
    expect(spec.canonicalTableById.get('tt7-arcanescroll')).toBe('TABLETOP11');
    expect(spec.canonicalTableById.get('tt7-talisman')).toBe('TABLETOP11');
    expect(spec.canonicalTableById.get('tt12-raygun')).toBe('TABLETOP12');
    expect(reads).toBe(0);
  } finally {
    if (previous) Object.defineProperty(Object.prototype, id, previous);
    else delete Object.prototype[id];
    vi.doUnmock('../game/src/cards/cards.sync.backfiller.js');
    vi.resetModules();
  }
});
