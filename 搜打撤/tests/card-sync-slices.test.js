import { describe, expect, it, vi } from 'vitest';
import { KEY } from '../game/src/cards/cards.consts.js';
import { createCatalogCardMigrations } from '../game/src/cards/cards.sync.catalog.js';
import { createCardRenameMigrations } from '../game/src/cards/cards.sync.renames.js';
import { createNumericCardMigrations } from '../game/src/cards/cards.sync.numeric.js';
import { createCardRuleBackfillMigrations } from '../game/src/cards/cards.sync.rule-backfill.js';

function fixture(initial = []) {
  const values = new Map([[KEY, JSON.stringify(initial)]]);
  const store = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, String(value)) };
  let cards = structuredClone(initial);
  const library = { all: () => cards, saveAll: vi.fn(next => {
    cards = next;
    store.setItem(KEY, JSON.stringify(cards));
    return true;
  }) };
  const ports = { library: () => library, storage: () => store,
    data: { cardsSync: { version: 123, cards: [], retire: [] } }, random: { random: () => 0 } };
  return { library, store, ports };
}

describe('explicit card migration family ports', () => {
  it('keeps failed seeds retryable and acknowledges only the persisted snapshot', () => {
    const h = fixture();
    const catalog = createCatalogCardMigrations(h.ports);
    const batch = [{ id: 'custom-seed', name: '新卡', heal: 0 }];
    h.library.saveAll.mockReturnValueOnce(false);
    catalog.seedBatch(batch, 'seed-marker');
    expect(h.library.all()).toEqual([]);
    expect(h.store.getItem('seed-marker')).toBeNull();
    catalog.seedBatch(batch, 'seed-marker');
    expect(h.library.all()).toEqual(batch);
    expect(h.store.getItem('seed-marker')).toBe('1');
    catalog.seedBatch(batch, 'seed-marker');
    expect(h.library.saveAll).toHaveBeenCalledTimes(2);
  });

  it('preserves receiver-owned live catalog definitions', () => {
    const h = fixture([{ id: 'retired', name: '旧卡' }]);
    const catalog = createCatalogCardMigrations(h.ports);
    const receiver = { ...catalog, RETIRE_CARDS_SYNC: ['retired'], CARDS_SYNC: [{ id: 'receiver', name: '调用方定义' }] };
    receiver.ensureCardsSyncLive();
    expect(h.library.all()).toEqual(receiver.CARDS_SYNC);
    expect(h.store.getItem('sdt-cards-sync-v123-seeded')).toBe('1');
  });

  it('reads replacement libraries lazily and leaves unrelated custom fields intact', () => {
    const first = fixture([{ id: 'first', type: '英雄卡' }]);
    const second = fixture([{ id: 'custom', type: '英雄卡', heal: 0, desc: '玩家文本' }]);
    let active = first.library;
    const renames = createCardRenameMigrations({ ...first.ports, library: () => active });
    active = second.library;
    second.library.applyAbilityRename=renames.applyAbilityRename;
    renames.ensureAbilityRename();
    expect(second.library.all()).toEqual([{ id: 'custom', type: '能力卡', heal: 0, desc: '玩家文本' }]);
    expect(first.library.all()[0].type).toBe('英雄卡');
  });

  it('keeps explicit zero numeric derivations without issuing a redundant write', () => {
    const h = fixture([{ id: 'custom', draw: 0, infuse: 0, heal: 0, armor: 0 }]);
    Object.assign(h.library, { deriveDraw: () => 0, deriveInfuse: () => 0, deriveHeal: () => 0, deriveArmor: () => 0 });
    createNumericCardMigrations(h.ports).ensureEffectFields();
    expect(h.library.all()[0]).toEqual({ id: 'custom', draw: 0, infuse: 0, heal: 0, armor: 0 });
    expect(h.library.saveAll).not.toHaveBeenCalled();
  });

  it('retains the receiver when chaining TT12 preplay into onPlay migration', () => {
    const h = fixture();
    h.library.TABLETOP12 = [];
    const receiver = { ...createCardRuleBackfillMigrations(h.ports), ensureTT12OnPlayRules: vi.fn() };
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      receiver.ensureTT12PreplayRules();
      expect(receiver.ensureTT12OnPlayRules).toHaveBeenCalledExactlyOnceWith();
    } finally { error.mockRestore(); }
  });

  it('backfills rules without replacing valid explicit amounts and retries rejected persistence', () => {
    const initial = [
      { id: 'tt3-bandage', name: '玩家包扎', type: '道具', heal: 1 },
      { id: 'tt3-hold-fast', name: '玩家坚守', type: '道具', armor: 1 },
    ];
    const h = fixture(initial);
    h.library.TABLETOP10 = initial.map(card => ({ ...card, heal: 5, armor: 5,
      rules: { version: 1, battle: { target: { side: 'self', area: false } },
        triggers: { onPlay: [{ op: card.id === 'tt3-bandage' ? 'heal' : 'armor', amountField: card.id === 'tt3-bandage' ? 'heal' : 'armor' }] } } }));
    const rules = createCardRuleBackfillMigrations(h.ports);
    h.library.saveAll.mockReturnValueOnce(false);
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      rules.ensureTT10OnPlayRules();
      expect(h.library.all()).toEqual(initial);
      expect(h.store.getItem('sdt-cards-tt10-onplay-v1-seeded')).toBeNull();
      rules.ensureTT10OnPlayRules();
      expect(h.store.getItem('sdt-cards-tt10-onplay-v1-seeded')).toBe('1');
      expect(h.library.all()[0]).toMatchObject({ name: '玩家包扎', heal: 1 });
      expect(h.library.all()[1]).toMatchObject({ name: '玩家坚守', armor: 1 });
      const writes = h.library.saveAll.mock.calls.length;
      rules.ensureTT10OnPlayRules();
      expect(h.library.saveAll).toHaveBeenCalledTimes(writes);
    } finally { error.mockRestore(); }
  });
});
