import { beforeEach, describe, expect, it } from 'vitest';
import { rarityOf } from '../game/src/cards/card-rarity.js';
import { createCardRenderContext } from '../game/src/cards/card-render-context.js';
import { KEY } from '../game/src/cards/cards.consts.js';

window.SDT = window.SDT || {};
window.SDT.Icons = { ...window.SDT.Icons, img: () => '', TYPE_ART: {} };
await import('../game/src/cards/cards.js');
const Cards = window.SDT.Cards;

const token = (id, tokenOf, extra = {}) => ({ id, name: id, type: '法术', rarity: '衍生', tokenOf, ...extra });
const lookup = catalog => id => catalog.find(card => card.id === id);

describe('token rarity inheritance terminates without changing valid fallback semantics', () => {
  beforeEach(() => { localStorage.clear(); Cards.clearAll(); });

  it('self-referencing tokens retain derived rarity', () => {
    const card = token('self', 'self');
    expect(rarityOf(card, lookup([card]))).toBe('衍生');
  });

  it('both entries into a two-card cycle retain derived rarity', () => {
    const catalog = [token('a', 'b'), token('b', 'a')];
    for (const card of catalog) expect(rarityOf(card, lookup(catalog))).toBe('衍生');
  });

  it('a chain entering a cycle falls back without mutating the catalog', () => {
    const catalog = [token('entry', 'a'), token('a', 'b'), token('b', 'a')];
    const before = JSON.stringify(catalog);
    expect(createCardRenderContext(catalog).rarityOf(catalog[0])).toBe('衍生');
    expect(JSON.stringify(catalog)).toBe(before);
  });

  it('terminates when a lookup returns fresh object copies for the same source IDs', () => {
    const catalog = [token('a', 'b'), token('b', 'a')];
    expect(rarityOf(catalog[0], id => ({ ...catalog.find(card => card.id === id) }))).toBe('衍生');
  });

  it('resolves a deep valid source chain without consuming the call stack', () => {
    const catalog = Array.from({ length: 20000 }, (_, index) => token(`deep-${index}`, `deep-${index + 1}`));
    catalog.push({ id: 'deep-20000', rarity: '史诗' });
    const byId = new Map(catalog.map(card => [card.id, card]));
    expect(rarityOf(catalog[0], id => byId.get(id))).toBe('史诗');
  });

  it('retains the current rarity when a source is missing', () => {
    const card = token('missing', 'absent');
    expect(rarityOf(card, lookup([card]))).toBe('衍生');
    expect(rarityOf(token('entry', 'missing'), lookup([card]))).toBe('衍生');
  });

  it('does not inherit past a non-derived source', () => {
    const source = { id: 'source', rarity: '稀有', tokenOf: 'other' };
    const catalog = [source, { id: 'other', rarity: '传说' }];
    expect(rarityOf(token('entry', 'source'), lookup(catalog))).toBe('稀有');
  });

  it('retains undefined and unknown rarity without a derived source relationship', () => {
    expect(rarityOf({ id: 'unknown', rarity: 'custom' }, () => undefined)).toBe('custom');
    expect(rarityOf({ id: 'none' }, () => undefined)).toBeUndefined();
    expect(rarityOf({ id: 'derived', rarity: '衍生' }, () => undefined)).toBe('衍生');
  });

  it('hero identity takes priority over self-cycles and non-derived rarity', () => {
    const hero = token('hero', 'hero', { hero: true, rarity: '传说' });
    expect(rarityOf(hero, lookup([hero]))).toBe('棱彩');
    expect(rarityOf({ rarity: '古朴', tokenOf: 'hero' }, lookup([hero]))).toBe('棱彩');
  });

  it('inherits hero rarity through valid multi-level sources and cycles containing a hero', () => {
    const catalog = [token('a', 'b'), token('b', 'hero'), token('hero', 'a', { hero: true })];
    expect(rarityOf(catalog[0], lookup(catalog))).toBe('棱彩');
  });

  it('preserves first-match duplicate-ID lookup semantics', () => {
    const card = token('a', 'a');
    const catalog = [card, { id: 'a', rarity: '传说', hero: true }];
    expect(createCardRenderContext(catalog).rarityOf(card)).toBe('衍生');
  });

  it('old persisted custom tokens are reachable through the real Cards facade', () => {
    const catalog = [token('a', 'b'), token('b', 'a')];
    const raw = JSON.stringify(catalog);
    localStorage.setItem(KEY, raw);
    const loaded = Cards.all();
    expect(loaded).toEqual(catalog);
    expect(Cards.rarityOf(loaded[0])).toBe('衍生');
    expect(Cards.sellPrice(loaded[0])).toBe(1);
    expect(Cards.cardHTML(loaded[0])).toContain('rv5');
    expect(localStorage.getItem(KEY)).toBe(raw);
  });

  it('saveAll remains compatible with old custom tokens and does not rewrite their rarity', () => {
    const catalog = [token('self', 'self')];
    expect(Cards.saveAll(catalog)).toBe(true);
    expect(Cards.rarityOf(Cards.all()[0])).toBe('衍生');
    expect(JSON.parse(localStorage.getItem(KEY))).toEqual(catalog);
  });

  it('every seeded production card keeps its prior effective rarity', () => {
    Cards.ensureSha(); Cards.ensureStarters(); Cards.ensureTabletop();
    Cards.ensureDmgTypes(); Cards.ensureEffectFields();
    const catalog = Cards.all();
    const findById = lookup(catalog);
    const legacyRarity = card => {
      if (card.hero || (card.tokenOf && findById(card.tokenOf)?.hero)) return '棱彩';
      if (card.rarity === '衍生' && card.tokenOf) {
        const source = findById(card.tokenOf);
        if (source) return legacyRarity(source);
      }
      return card.rarity;
    };
    expect(catalog.length).toBeGreaterThan(200);
    const raw = localStorage.getItem(KEY);
    for (const card of catalog) expect(Cards.rarityOf(card), card.id).toBe(legacyRarity(card));
    expect(localStorage.getItem(KEY)).toBe(raw);
  });
});
