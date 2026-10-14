import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { KEY } from '../game/src/cards/cards.consts.js';
import { TT10_KEY, TT11_KEY, EVENTS_0919_KEY, ITEM_RENAME_KEY, TT7_KEY_V2, CC_KEY } from '../game/src/cards/cards.consts.js';
import { ensureCanonicalFaceRefresh } from '../game/src/cards/cards.sync.face-refresh.js';
import { DATA } from '../game/src/core/data-loader.js';

window.SDT = window.SDT || { Icons: { img: () => '' } };
await import('../game/src/cards/cards.js');
const Cards = window.SDT.Cards;
const marker = 'fixture-seed-commit-marker';
const clone = value => JSON.parse(JSON.stringify(value));

describe('card migrations only acknowledge persisted snapshots', () => {
  beforeEach(() => {
    localStorage.clear();
    Cards.clearAll();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => { vi.restoreAllMocks(); });

  const replaceOutsideCachedPage = initial => {
    Cards.saveAll(initial);
    const external = [
      { ...initial[0], name: 'external update', custom: 'keep this' },
      { id: 'external-addition', name: 'added externally' },
    ];
    const raw = JSON.stringify(external);
    localStorage.setItem(KEY, raw);
    return { external, raw };
  };

  it('face refresh preserves external additions, updates and deletions after a stale-cache rejection', () => {
    const petal = Cards.TABLETOP11.find(card => card.id === 'tt3-petal');
    const initial = [{ ...clone(petal), heal: 2, desc: 'old face' }, { id: 'removed-externally' }];
    const { external, raw } = replaceOutsideCachedPage(initial);
    ensureCanonicalFaceRefresh();
    expect(localStorage.getItem(KEY)).toBe(raw);
    expect(Cards.all()).toEqual(external);
  });

  it('seedBatch preserves external additions, updates and deletions and leaves rejected work unmarked', () => {
    const initial = [{ id: 'existing', name: 'old cached name' }, { id: 'removed-externally' }];
    const { external, raw } = replaceOutsideCachedPage(initial);
    const batch = [{ id: 'fixture-new-card', name: 'new seeded card' }];
    Cards.seedBatch(batch, marker);
    expect(localStorage.getItem(KEY)).toBe(raw);
    expect(Cards.all()).toEqual(external);
    expect(localStorage.getItem(marker)).toBeNull();
    // The next invocation reads the current catalog before applying only this batch.
    Cards.seedBatch(batch, marker);
    expect(Cards.all()).toEqual([...external, ...batch]);
    expect(localStorage.getItem(marker)).toBe('1');
  });

  it('seedBatch leaves a failed write unmarked, then retries successfully after storage recovers', () => {
    const initial = [{ id: 'existing', name: 'existing' }];
    Cards.saveAll(initial);
    const setItem = Storage.prototype.setItem;
    const write = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (key, value) {
      if (key === KEY) throw new DOMException('quota', 'QuotaExceededError');
      return setItem.call(this, key, value);
    });
    const batch = [{ id: 'fixture-new-card', name: 'new seeded card' }];
    Cards.seedBatch(batch, marker);
    expect(localStorage.getItem(marker)).toBeNull();
    expect(Cards.all()).toEqual(initial);
    write.mockRestore();
    Cards.seedBatch(batch, marker);
    expect(Cards.all()).toEqual([...initial, ...batch]);
    expect(localStorage.getItem(marker)).toBe('1');
  });

  it('seedBatch does not mark a stale no-op snapshot after the batch card was deleted externally', () => {
    const batch = [{ id: 'fixture-present', name: 'already cached' }];
    Cards.saveAll(batch);
    localStorage.setItem(KEY, '[]');
    Cards.seedBatch(batch, marker);
    expect(localStorage.getItem(KEY)).toBe('[]');
    expect(localStorage.getItem(marker)).toBeNull();
  });

  it('seedBatch confirms the stored snapshot before marking a save that was replaced externally', () => {
    Cards.saveAll([{ id: 'existing', name: 'existing' }]);
    const setItem = Storage.prototype.setItem;
    const external = [{ id: 'replacement', name: 'external replacement' }];
    const raw = JSON.stringify(external);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (key, value) {
      setItem.call(this, key, value);
      if (key === KEY) setItem.call(this, KEY, raw);
    });
    Cards.seedBatch([{ id: 'fixture-new-card', name: 'new seeded card' }], marker);
    expect(localStorage.getItem(KEY)).toBe(raw);
    expect(localStorage.getItem(marker)).toBeNull();
  });

  it('normal successful seeding is one-shot and respects later edits or deletions', () => {
    const batch = [{ id: 'fixture-card', name: 'seeded original', rarity: '古朴' }];
    Cards.seedBatch(batch, marker, 'fixture-');
    expect(localStorage.getItem(marker)).toBe('1');
    expect(Cards.all()).toEqual(batch);
    Cards.upsert({ ...batch[0], name: 'player edited' });
    Cards.seedBatch(batch, marker, 'fixture-');
    expect(Cards.all()[0].name).toBe('player edited');
    Cards.remove(batch[0].id);
    Cards.seedBatch(batch, marker, 'fixture-');
    expect(Cards.all()).toEqual([]);
  });

  const oneShotMigrations = [
    ['ensureCardFixes', 'sdt-mig-burnharvest', [{ id: 'tt7-burnharvest', infuse: 1 }]],
    ['ensureTabletopSync', TT10_KEY, [{ id: 'fixture-existing' }]],
    ['ensureTabletopSync11', TT11_KEY, [{ id: 'fixture-existing' }]],
    ['ensureCardsSyncLive', `sdt-cards-sync-v${DATA.cardsSync.version}-seeded`, [{ id: 'fixture-existing' }]],
    ['ensureEvents0919', EVENTS_0919_KEY, [{ id: 'fixture-existing' }]],
    ['ensureItemRenames', ITEM_RENAME_KEY, [{ id: 'tt-crystal', name: 'legacy name' }]],
    ['ensureClassRarity', TT7_KEY_V2, [{ id: 'tt7-throwblade', rarity: '古朴' }]],
    ['ensureClassConsolidation', CC_KEY, [{ id: 'tt7-throwblade', cls: '刺客', rarity: '古朴' }]],
  ];
  for (const [method, migrationMarker, fixture] of oneShotMigrations) {
    it(`${method} does not mark a failed catalog write and retries after storage recovers`, () => {
      const initial = clone(fixture);
      Cards.saveAll(clone(initial));
      const before = localStorage.getItem(KEY);
      const setItem = Storage.prototype.setItem;
      const write = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (key, value) {
        if (key === KEY) throw new DOMException('quota', 'QuotaExceededError');
        return setItem.call(this, key, value);
      });
      Cards[method]();
      expect(localStorage.getItem(KEY)).toBe(before);
      expect(localStorage.getItem(migrationMarker)).toBeNull();
      expect(Cards.all()).toEqual(initial);
      write.mockRestore();
      Cards[method]();
      expect(localStorage.getItem(migrationMarker)).toBe('1');
      expect(localStorage.getItem(KEY)).not.toBe(before);
      const successful = localStorage.getItem(KEY);
      Cards[method]();
      expect(localStorage.getItem(KEY)).toBe(successful);
    });

    it(`${method} preserves a conflicting external snapshot and leaves the migration unmarked`, () => {
      const initial = clone(fixture);
      Cards.saveAll(clone(initial));
      const external = [...initial, { id: 'fixture-external', name: 'external addition' }];
      const raw = JSON.stringify(external);
      localStorage.setItem(KEY, raw);
      Cards[method]();
      expect(localStorage.getItem(KEY)).toBe(raw);
      expect(localStorage.getItem(migrationMarker)).toBeNull();
      expect(Cards.all()).toEqual(external);
    });

    it(`${method} verifies that a saved result was not externally replaced before marking it`, () => {
      Cards.saveAll(clone(fixture));
      const setItem = Storage.prototype.setItem;
      const raw = JSON.stringify([{ id: 'fixture-replacement', name: 'external replacement' }]);
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (key, value) {
        setItem.call(this, key, value);
        if (key === KEY) setItem.call(this, KEY, raw);
      });
      Cards[method]();
      expect(localStorage.getItem(KEY)).toBe(raw);
      expect(localStorage.getItem(migrationMarker)).toBeNull();
    });

    it(`${method} can acknowledge a valid already-migrated snapshot without changing its content`, () => {
      Cards.saveAll(clone(fixture));
      Cards[method]();
      const raw = localStorage.getItem(KEY);
      expect(localStorage.getItem(migrationMarker)).toBe('1');
      localStorage.removeItem(migrationMarker);
      Cards[method]();
      expect(localStorage.getItem(KEY)).toBe(raw);
      expect(localStorage.getItem(migrationMarker)).toBe('1');
    });
  }

  const prototypeIdFixtures = () => ['toString', 'constructor', '__proto__'].map(id => ({
    id, name: `custom ${id}`, rarity: '古朴', type: '法术', desc: 'custom unchanged',
  }));

  it('item renames preserve custom IDs that match Object prototype property names', () => {
    const fixture = prototypeIdFixtures();
    Cards.saveAll(clone(fixture));
    Cards.ensureItemRenames();
    expect(JSON.parse(localStorage.getItem(KEY))).toEqual(fixture);
  });

  it('class consolidation does not reinterpret prototype-named custom IDs as fixed cards', () => {
    const fixture = prototypeIdFixtures();
    Cards.saveAll(clone(fixture));
    Cards.ensureClassConsolidation();
    for (const card of fixture) expect(Cards.all().find(entry => entry.id === card.id)).toEqual(card);
    const persisted = JSON.parse(localStorage.getItem(KEY));
    for (const card of fixture) expect(persisted.find(entry => entry.id === card.id)).toEqual(card);
  });

  it('duplicate renames ignore inherited keys and preserve custom card names', () => {
    const fixture = prototypeIdFixtures();
    const cards = clone(fixture);
    expect(Cards.applyDuplicateRenames(cards)).toBe(false);
    expect(cards).toEqual(fixture);
  });
});
