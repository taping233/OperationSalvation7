import { describe, it, expect } from 'vitest';
import { DATA } from '../game/src/core/data-loader.js';
import { buildCanonicalCardMap, resolveCardCatalog } from '../game/src/cards/cards.catalog.js';

const canonical = DATA.cardsSync.cards.find(card => card.id === 'tt8-hero-sealer');

describe('TT10/TT11 canonical catalog resolver', () => {
  it('uses canonical fields and preserves snapshot-only metadata', () => {
    const [resolved] = resolveCardCatalog([{
      ref: canonical.id,
      metadata: { name: 'stale name', desc: 'stale text', art: 'hero-art', battle: true },
    }], 'test batch');
    expect(resolved).toMatchObject(canonical);
    expect(resolved.name).toBe(canonical.name);
    expect(resolved.desc).toBe(canonical.desc);
    expect(resolved.art).toBe('hero-art');
    expect(resolved.battle).toBe(true);
  });

  it('leaves rows without a sync definition unchanged', () => {
    const row = { id: 'warehouse-only', name: '仓库独有卡', desc: '保留原行' };
    expect(resolveCardCatalog([row], 'test batch')[0]).toBe(row);
  });

  it('fails clearly for missing references and duplicate ids', () => {
    expect(() => resolveCardCatalog(['missing-canonical-id'], 'TT10')).toThrow(/missing cards-sync id/);
    expect(() => resolveCardCatalog([canonical.id, canonical.id], 'TT11')).toThrow(/duplicate id/);
    expect(() => resolveCardCatalog([
      canonical.id,
      { id: canonical.id, name: 'duplicate inline definition' },
    ], 'TT11')).toThrow(/duplicate id/);
    expect(() => resolveCardCatalog([
      { id: 'warehouse-only', name: 'one' },
      { id: 'warehouse-only', name: 'two' },
    ], 'TT11')).toThrow(/duplicate id/);
  });

  it('fails when the canonical source itself has duplicate or missing ids', () => {
    expect(() => buildCanonicalCardMap([{ id: 'same' }, { id: 'same' }])).toThrow(/duplicate id/);
    expect(() => buildCanonicalCardMap([{ name: 'missing id' }])).toThrow(/without an id/);
  });

  it('rejects a metadata value that would otherwise shadow a canonical field', () => {
    const [resolved] = resolveCardCatalog([{
      ref: canonical.id,
      metadata: { name: 'wrong', rarity: '错误', art: 'decorative-art' },
    }], 'test batch');
    expect(resolved.name).toBe(canonical.name);
    expect(resolved.rarity).toBe(canonical.rarity);
    expect(resolved.art).toBe('decorative-art');
  });
});
