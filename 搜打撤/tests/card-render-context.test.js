import { describe, expect, it } from 'vitest';
import { createCardRenderContext } from '../game/src/cards/card-render-context.js';
import { isHeroLine, rarityOf } from '../game/src/cards/card-rarity.js';

const findIn = (catalog, id) => catalog.find(card => card.id === id);

describe('card render context', () => {
  it('keeps first-match ID semantics and shares rarity rules with the Cards facade', () => {
    const first = { id: 'creator', rarity: '稀有' };
    const duplicate = { id: 'creator', hero: true, rarity: '传说' };
    const token = { id: 'token', rarity: '衍生', tokenOf: 'creator' };
    const catalog = [first, duplicate, token];
    const context = createCardRenderContext(catalog);

    expect(isHeroLine(token, id => findIn(catalog, id))).toBe(false);
    expect(context.rarityOf(token)).toBe(rarityOf(token, id => findIn(catalog, id)));
    expect(context.rarityOf(token)).toBe('稀有');
  });

  it('uses a fresh first-ID snapshot after catalog edits', () => {
    const original = { id: 'creator', rarity: '稀有' };
    const token = { rarity: '衍生', tokenOf: 'creator' };
    const catalog = [original, token];
    const firstRender = createCardRenderContext(catalog);
    const insertedEarlier = { id: 'creator', hero: true, rarity: '传说' };
    catalog.unshift(insertedEarlier);
    const nextRender = createCardRenderContext(catalog);

    expect(firstRender.rarityOf(token)).toBe('稀有');
    expect(nextRender.rarityOf(token)).toBe('棱彩');
  });

  it('replaces repeated catalog scans with one index build per 271-card render batch', () => {
    let baselineIdReads = 0;
    let indexedIdReads = 0;
    const makeCountedCatalog = (onId) => {
      const rows = Array.from({ length: 271 }, (_, index) => {
        if (index < 223) return { id: `plain-${index}`, rarity: '古朴' };
        if (index < 247) return { id: `creator-${index - 223}`, rarity: '稀有' };
        return { id: `token-${index - 247}`, rarity: '衍生', tokenOf: `creator-${index - 247}` };
      });
      return rows.map(row => new Proxy(row, {
        get(target, property, receiver) {
          if (property === 'id') onId();
          return Reflect.get(target, property, receiver);
        },
      }));
    };
    const baselineCatalog = makeCountedCatalog(() => { baselineIdReads++; });
    const tokenBatch = baselineCatalog.slice(247);
    const baselineRarities = tokenBatch.map(card =>
      rarityOf(card, id => findIn(baselineCatalog, id)));
    const baselineRenderReads = baselineIdReads;

    const indexedCatalog = makeCountedCatalog(() => { indexedIdReads++; });
    const context = createCardRenderContext(indexedCatalog);
    const indexedRarities = indexedCatalog.slice(247).map(card => context.rarityOf(card));

    expect(indexedRarities).toEqual(baselineRarities);
    expect(indexedIdReads).toBe(271);
    expect(baselineRenderReads).toBe(11304);
    expect(baselineRenderReads).toBeGreaterThan(indexedIdReads * 30);
  });
});
