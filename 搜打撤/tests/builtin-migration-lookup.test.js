import { beforeEach, describe, expect, it, vi } from 'vitest';

// Transparent proxies count top-level table enumeration, not elapsed time.
const audit = vi.hoisted(() => ({ ownKeys: 0, descriptors: 0 }));
const counted = vi.hoisted(() => value => new Proxy(value, {
  ownKeys(target) { audit.ownKeys++; return Reflect.ownKeys(target); },
  getOwnPropertyDescriptor(target, key) { audit.descriptors++; return Reflect.getOwnPropertyDescriptor(target, key); },
}));
vi.mock('../game/src/cards/builtin-card-previous-rules.js', async importOriginal => {
  const actual = await importOriginal();
  return { ...actual, BUILTIN_PREVIOUS_RULES: counted(actual.BUILTIN_PREVIOUS_RULES) };
});
vi.mock('../game/src/cards/builtin-equipment-previous-rules.js', async importOriginal => {
  const actual = await importOriginal();
  return { ...actual, BUILTIN_EQUIPMENT_PREVIOUS_RULES: counted(actual.BUILTIN_EQUIPMENT_PREVIOUS_RULES) };
});
vi.mock('../game/src/cards/builtin-choice-execution.js', async importOriginal => {
  const actual = await importOriginal();
  return { ...actual, BUILTIN_CHOICE_PREVIOUS_RULES: counted(actual.BUILTIN_CHOICE_PREVIOUS_RULES) };
});

import { BUILTIN_EXECUTION_REVISIONS, migrateBuiltinExecutionCard } from '../game/src/cards/builtin-card-execution.js';
import { BUILTIN_PREVIOUS_RULES } from '../game/src/cards/builtin-card-previous-rules.js';
import { BUILTIN_EQUIPMENT_PREVIOUS_RULES } from '../game/src/cards/builtin-equipment-previous-rules.js';
import { BUILTIN_CHOICE_PREVIOUS_RULES } from '../game/src/cards/builtin-choice-execution.js';
import { BUILTIN_PREVIOUS_VARIANTS } from '../game/src/cards/builtin-card-previous-variants.js';
import { ensureBuiltinExecutionRules } from '../game/src/cards/cards.sync.builtin.js';
import { getHostedExecutionCard } from '../game/src/battle/effects/battle.hosted.js';

const tables = [BUILTIN_PREVIOUS_RULES, BUILTIN_EQUIPMENT_PREVIOUS_RULES, BUILTIN_CHOICE_PREVIOUS_RULES];
const previous = { ...BUILTIN_PREVIOUS_RULES, ...BUILTIN_EQUIPMENT_PREVIOUS_RULES, ...BUILTIN_CHOICE_PREVIOUS_RULES };
const entryCount = tables.reduce((sum, table) => sum + Object.keys(table).length, 0);
const oldCard = (id = 'tt7-arcanebolt') => ({ id, name: '玩家改名', desc: '玩家文案', type: id === 'tt3-wolf-bow' ? '装备' : '法术', ...(id === 'tt7-arcanebolt' ? { dmg: 1, dmgType: 'spell' } : {}), cost: 1, rules: structuredClone(previous[id]) });
const clearCounts = () => { audit.ownKeys = 0; audit.descriptors = 0; };
const counts = () => ({ ...audit });
beforeEach(clearCounts);

describe('immutable native migration lookup reuse', () => {
  it('does not enumerate immutable source catalogs during repeated public battle normalization', () => {
    const cards = [oldCard(), { ...oldCard(), rules: structuredClone(BUILTIN_EXECUTION_REVISIONS['tt7-arcanebolt'].rules) },
      { id: 'player-created', rules: { version: 1, triggers: { onPlay: [] } } }, oldCard('tt3-magic-lamp')];
    clearCounts();
    for (let iteration = 0; iteration < 25; iteration++) for (const card of cards) getHostedExecutionCard(card);
    const measured = counts();
    console.info('BUILTIN_MIGRATION_COUNTS', JSON.stringify({ path: 'getHostedExecutionCard', calls: 100, sourceEntries: entryCount, ...measured }));
    expect(measured).toEqual({ ownKeys: 0, descriptors: 0 });
  });

  it('does not enumerate immutable source catalogs in actual library migration, including late imports', () => {
    let cards = [oldCard(), oldCard('tt3-magic-lamp'), oldCard('tt3-wolf-bow'), { id: 'custom', rules: {} }];
    const saveAll = vi.fn(next => { cards = next; });
    const api = { all: () => cards, saveAll };
    clearCounts();
    expect(ensureBuiltinExecutionRules(api)).toBe(3);
    expect(ensureBuiltinExecutionRules(api)).toBe(0);
    cards.push(oldCard('tt3-magic-lamp'));
    expect(ensureBuiltinExecutionRules(api)).toBe(1);
    const measured = counts();
    console.info('BUILTIN_MIGRATION_COUNTS', JSON.stringify({ path: 'ensureBuiltinExecutionRules', calls: 13, sourceEntries: entryCount, ...measured }));
    expect(measured).toEqual({ ownKeys: 0, descriptors: 0 });
    expect(saveAll).toHaveBeenCalledTimes(2);
  });

  it('reuses the lookup on a real ordinary-battle play while preserving damage, draw and input ownership', async () => {
    window.SDT ||= {};
    window.SDT.Icons = { img: () => '', TYPE_ART: {} };
    window.SDT.Sound = { sfx() {}, music() {}, setDucked() {}, setBoss() {} };
    window.SDT.MAP = { rules: { battleEnergy: 9, battleHandMax: 99, bossDeckSize: 15,
      starterSha: 0, battleStartDraw: 0, battleTurnDraw: 1, diceSides: 6 }, items: {} };
    await import('../game/src/cards/cards.js');
    const { BattleSession } = await import('../game/src/battle/core/battle.core.js');
    const runtime = await import('../game/src/battle/runtime/battle.runtime.js');
    const card = oldCard(), before = structuredClone(card);
    const drawCard = { id: 'custom-draw', name: 'draw', type: '武术', cost: 0, rules: { version: 1, triggers: { onPlay: [] } } };
    const game = { ownedCards: [{ uid: 'source', card }, { uid: 'next', card: drawCard }],
      hp: 40, maxHp: 50, atk: 3, spellPower: 2, coins: 0, myClass: null, state: 'idle', battleActive: false,
      log() {}, heal(n) { this.hp = Math.min(this.maxHp, this.hp + n); }, addItem() {}, onBattleEnd() {} };
    BattleSession.start(game, [{ id: 'target', name: 'target', hp: 20, atk: 1 }], { isBoss: false });
    runtime.set$hand(['source']); runtime.set$drawPile(['next']);
    clearCounts();
    try {
      BattleSession.commands.playCard('source', 0);
      await vi.waitFor(() => {
        expect(BattleSession.getSnapshot().busy).toBe(false);
        expect(BattleSession.getSnapshot().actionQueueLength).toBe(0);
        expect(runtime.hand).not.toContain('source');
      });
      const measured = counts();
      console.info('BUILTIN_MIGRATION_COUNTS', JSON.stringify({ path: 'BattleSession.commands.playCard normal', sourceEntries: entryCount, ...measured }));
      expect(runtime.mode).toBe('normal'); expect(runtime.foes[0].hp).toBe(17);
      expect(runtime.hand).toContain('next'); expect(card).toEqual(before);
      expect(measured).toEqual({ ownKeys: 0, descriptors: 0 });
    } finally { BattleSession.commands.flee(); }
  });

  it('preserves all historical fingerprints and all released variants', () => {
    const ids = new Set([...Object.keys(previous), ...Object.keys(BUILTIN_PREVIOUS_VARIANTS)]);
    let histories = 0;
    for (const id of ids) {
      if (!BUILTIN_EXECUTION_REVISIONS[id]) continue;
      const priors = [...(Object.hasOwn(previous, id) ? [previous[id]] : []), ...(BUILTIN_PREVIOUS_VARIANTS[id] || [])];
      for (const prior of priors) {
        histories++;
        const card = { id, name: 'custom name', desc: 'custom text', rules: structuredClone(prior) };
        const before = structuredClone(card);
        const result = migrateBuiltinExecutionCard(card);
        expect(result, id).not.toBe(card);
        expect(result.rules, id).toEqual(BUILTIN_EXECUTION_REVISIONS[id].rules);
        expect(card, id).toEqual(before);
        expect(result.name).toBe(card.name); expect(result.desc).toBe(card.desc);
        expect(migrateBuiltinExecutionCard(result), id).toBe(result);
      }
    }
    const variants = Object.values(BUILTIN_PREVIOUS_VARIANTS).reduce((count, entries) => count + entries.length, 0);
    const variantOnly = Object.keys(BUILTIN_PREVIOUS_VARIANTS).filter(id => !Object.hasOwn(previous, id));
    expect(variantOnly).toContain('tt3-dig-treasure');
    expect(histories).toBe(Object.keys(previous).length + variants);
    console.info('BUILTIN_MIGRATION_HISTORY_COVERAGE', JSON.stringify({ histories, variants, variantOnly }));
    const oldTreasure = { id: 'tt3-dig-treasure', rules: structuredClone(BUILTIN_PREVIOUS_VARIANTS['tt3-dig-treasure'][0]) };
    expect(migrateBuiltinExecutionCard(oldTreasure).rules.triggers.onPlay[0].n).toBe(3);
  });

  it('does not cache mutable card results, ids, replacement rules or nested edits', () => {
    const card = oldCard();
    const migrated = migrateBuiltinExecutionCard(card);
    expect(migrated).not.toBe(card);
    card.rules.battle.hosted[0] = 'player-custom';
    expect(migrateBuiltinExecutionCard(card)).toBe(card);
    card.rules = structuredClone(previous['tt3-magic-lamp']);
    expect(migrateBuiltinExecutionCard(card)).toBe(card);
    card.id = 'tt3-magic-lamp';
    expect(migrateBuiltinExecutionCard(card).rules).toEqual(BUILTIN_EXECUTION_REVISIONS['tt3-magic-lamp'].rules);
    card.id = 'unknown';
    expect(migrateBuiltinExecutionCard(card)).toBe(card);
  });

  it('gives each migrated call an independent mutable rule tree', () => {
    const card = oldCard('tt3-magic-lamp');
    const first = migrateBuiltinExecutionCard(card), second = migrateBuiltinExecutionCard(card);
    expect(first).not.toBe(second); expect(first.rules).not.toBe(second.rules);
    first.rules.triggers.onPlay[0].options[0].ops[0].pool.kind = '玩家修改';
    expect(second.rules.triggers.onPlay[0].options[0].ops[0].pool.kind).toBe('招式');
    expect(migrateBuiltinExecutionCard(card).rules.triggers.onPlay[0].options[0].ops[0].pool.kind).toBe('招式');
    expect(BUILTIN_EXECUTION_REVISIONS[card.id].rules.triggers.onPlay[0].options[0].ops[0].pool.kind).toBe('招式');
  });

  it('retains exact JSON fingerprint comparison, including custom field order and explicit empty rules', () => {
    const reordered = { version: 1, battle: { hosted: ['three-choice-lamp'] } };
    const card = { id: 'tt3-magic-lamp', rules: { battle: reordered.battle, version: reordered.version } };
    expect(migrateBuiltinExecutionCard(card)).toBe(card);
    for (const rules of [{}, { version: 1, triggers: { onPlay: [] } }, null, undefined]) {
      const custom = { id: 'tt3-magic-lamp', rules };
      expect(migrateBuiltinExecutionCard(custom)).toBe(custom);
    }
  });

  it('preserves unknown and Object-prototype IDs as untouched custom cards', () => {
    // The compatibility fix does not widen the existing null-card contract.
    expect(() => migrateBuiltinExecutionCard(null)).toThrow(TypeError);
    expect(() => migrateBuiltinExecutionCard(undefined)).toThrow(TypeError);
    for (const id of ['unknown', '', 'constructor', 'toString', '__proto__']) {
      const card = { id, name: '玩家卡牌', rules: { version: 1, custom: true } };
      const before = structuredClone(card);
      expect(migrateBuiltinExecutionCard(card)).toBe(card);
      expect(card).toEqual(before);
    }
  });

  it('retains all frozen source tables and nested declarations', () => {
    const checkFrozen = value => {
      if (!value || typeof value !== 'object') return;
      expect(Object.isFrozen(value)).toBe(true);
      Object.values(value).forEach(checkFrozen);
    };
    [...tables, BUILTIN_EXECUTION_REVISIONS, BUILTIN_PREVIOUS_VARIANTS].forEach(checkFrozen);
  });

  it('preserves reentrant calls from live JSON inputs without sharing result state', () => {
    const inner = oldCard('tt3-magic-lamp');
    const outer = oldCard();
    let nested;
    outer.rules = { toJSON() { nested = migrateBuiltinExecutionCard(inner); return previous[outer.id]; } };
    const result = migrateBuiltinExecutionCard(outer);
    expect(result.rules).toEqual(BUILTIN_EXECUTION_REVISIONS[outer.id].rules);
    expect(nested.rules).toEqual(BUILTIN_EXECUTION_REVISIONS[inner.id].rules);
    expect(result.rules).not.toBe(nested.rules);
  });

  it('preserves failed-save behavior and caller-owned source cards', () => {
    const original = [oldCard('tt3-magic-lamp')], before = structuredClone(original);
    expect(ensureBuiltinExecutionRules({ all: () => original, saveAll: () => false })).toBe(false);
    expect(original).toEqual(before);
  });
});
