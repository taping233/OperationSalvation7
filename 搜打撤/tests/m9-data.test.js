import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { M9_HOSTED_BY_ID, ensureM9HostedRules } from '../game/src/cards/cards.sync.m9.js';
import { KEY } from '../game/src/cards/cards.consts.js';

const MARKER = 'sdt-cards-m9-hosted-rules-v1-seeded';
const ids = [...Object.keys(M9_HOSTED_BY_ID), 'tt5-galaxy-voyage'];
let tables, canonical;
beforeAll(async () => {
  vi.stubGlobal('SDT', { Icons: { img: () => '', TYPE_ART: {} } });
  await import('../game/src/cards/cards.js');
  const Cards = window.SDT.Cards;
  tables = Object.fromEntries(['CARDS_SYNC', 'TABLETOP11', 'TABLETOP10'].map(key => [key, Cards[key]]));
  canonical = ids.map(id => Object.values(tables).flat().find(card => card?.id === id));
  expect(canonical.every(Boolean)).toBe(true);
});
afterAll(() => vi.unstubAllGlobals());

function harness(cards = canonical) {
  let current = structuredClone(cards);
  const values = new Map([[KEY, JSON.stringify(current)]]);
  const storage = { getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)) };
  const library = { ...tables, all: () => current,
    saveAll: vi.fn(next => { current = next; storage.setItem(KEY, JSON.stringify(next)); return true; }) };
  return { storage, library };
}

describe('M9 canonical migration persistence', () => {
  it('migrates all 27 canonical cards and persists once without rewriting their faces', () => {
    const h = harness();
    ensureM9HostedRules(h);
    expect(h.storage.getItem(MARKER)).toBe('1');
    expect(h.library.saveAll).toHaveBeenCalledTimes(1);
    h.library.all().forEach((card, index) => {
      const { rules, ...face } = card;
      expect(face).toEqual(canonical[index]);
      if (M9_HOSTED_BY_ID[card.id]) expect(rules.battle.hosted).toEqual([M9_HOSTED_BY_ID[card.id]]);
      else expect(rules.triggers.onPlay).toEqual([{ op: 'registerRule', rule: 'meleeCost1' }]);
    });
    expect(JSON.parse(h.storage.getItem(KEY))).toEqual(h.library.all());
    ensureM9HostedRules(h);
    expect(h.library.saveAll).toHaveBeenCalledTimes(1);
  });

  it.each(ids)('preserves player edits and existing rules on %s', id => {
    for (const edit of [{ name: '自定义名字' }, { cost: 99 }, { rules: { version: 1, triggers: { onPlay: [] } } }]) {
      const cards = structuredClone(canonical);
      const card = cards.find(value => value.id === id);
      Object.assign(card, edit);
      const h = harness(cards);
      ensureM9HostedRules(h);
      expect(h.library.all().find(value => value.id === id)).toEqual(card);
    }
  });

  it('does not partially save or mark a library with missing target cards', () => {
    const h = harness(canonical.slice(1));
    ensureM9HostedRules(h);
    expect(h.library.saveAll).not.toHaveBeenCalled();
    expect(h.storage.getItem(MARKER)).toBeNull();
  });

  it('does not mark failure or a mismatching persisted snapshot', () => {
    const h = harness();
    h.library.saveAll.mockImplementation(() => false);
    ensureM9HostedRules(h);
    expect(h.storage.getItem(MARKER)).toBeNull();
    h.library.saveAll.mockImplementation(() => true);
    ensureM9HostedRules(h);
    expect(h.storage.getItem(MARKER)).toBeNull();
  });

  it('does not use an unsaved hot cache as the migration source', () => {
    const h = harness();
    h.library.all()[0].cost++;
    ensureM9HostedRules(h);
    expect(h.library.saveAll).not.toHaveBeenCalled();
    expect(h.storage.getItem(MARKER)).toBeNull();
  });
});
