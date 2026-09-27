import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { KEY } from '../game/src/cards/cards.consts.js';
import { M11_HOSTED_BY_ID, ensureM11HostedRules } from '../game/src/cards/cards.sync.m11.js';

const MARKER = 'sdt-cards-m11-hosted-rules-v1-seeded';
const ids = Object.keys(M11_HOSTED_BY_ID);
let tables, canonical;
beforeAll(async () => {
  vi.stubGlobal('SDT', { Icons: { img: () => '', TYPE_ART: {} } });
  await import('../game/src/cards/cards.js');
  const Cards = window.SDT.Cards;
  tables = Object.fromEntries(['CARDS_SYNC', 'TABLETOP12', 'TABLETOP11', 'TABLETOP10', 'TABLETOP7'].map(key => [key, Cards[key]]));
  canonical = ids.map(id => Object.values(tables).flat().find(card => card?.id === id));
  expect(canonical.every(Boolean), `missing canonical: ${ids.filter((_, index) => !canonical[index]).join(', ')}`).toBe(true);
});
afterAll(() => vi.unstubAllGlobals());

function harness(cards = canonical) {
  let current = structuredClone(cards);
  const values = new Map([[KEY, JSON.stringify(current)]]);
  const storage = { getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)) };
  const library = { ...tables, all: () => current,
    saves: 0,
    saveAll(next) { this.saves += 1; current = structuredClone(next); storage.setItem(KEY, JSON.stringify(current)); return true; } };
  return { storage, library };
}

describe('M11 named hosted data migration', () => {
  it('migrates all canonical cards once and leaves every face unchanged', () => {
    const h = harness();
    ensureM11HostedRules(h);
    expect(h.storage.getItem(MARKER)).toBe('1');
    expect(h.library.saves).toBe(1);
    h.library.all().forEach((card, index) => {
      const { rules, ...face } = card;
      expect(face).toEqual(canonical[index]);
      if (card.id === 'tt-token-color') {
        expect(rules).toEqual({ version: 1, bag: { use: [{ op: 'acquire', pool: { kind: 'classAbility' } }] } });
      } else {
        expect(rules).toEqual({ version: 1, battle: { hosted: [M11_HOSTED_BY_ID[card.id]] } });
      }
    });
    expect(JSON.parse(h.storage.getItem(KEY))).toEqual(h.library.all());
    ensureM11HostedRules(h);
    expect(h.library.saves).toBe(1);
  });

  it.each(ids)('preserves player edits and owned rules on %s', id => {
    for (const edit of [{ name: '玩家改名' }, { cost: 99 }, { rules: { version: 1, triggers: { onPlay: [] } } }]) {
      const cards = structuredClone(canonical);
      Object.assign(cards.find(card => card.id === id), edit);
      const h = harness(cards);
      ensureM11HostedRules(h);
      expect(h.library.all().find(card => card.id === id)).toEqual(cards.find(card => card.id === id));
    }
  });

  it('does not partially save for missing cards, failed saves, or unsaved cache changes', () => {
    const missing = harness(canonical.slice(1));
    ensureM11HostedRules(missing);
    expect(missing.library.saves).toBe(0);
    expect(missing.storage.getItem(MARKER)).toBeNull();

    const failed = harness();
    failed.library.saveAll = () => false;
    ensureM11HostedRules(failed);
    expect(failed.storage.getItem(MARKER)).toBeNull();

    const unsaved = harness();
    unsaved.library.all()[0].cost++;
    ensureM11HostedRules(unsaved);
    expect(unsaved.library.saves).toBe(0);
    expect(unsaved.storage.getItem(MARKER)).toBeNull();
  });
});
