import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import beforeCatalog from '../docs/evidence/e8-card-migration-2026-09-27/catalog-before.json';

const IDS = ['tt-jinchuangyao', 'tt4-woodify', 'starter-emergency-bandage'];
const clone = value => JSON.parse(JSON.stringify(value));
const oldCards = IDS.map(id => clone(beforeCatalog.production.cards.find(row => row.id === id).card));
function memoryStorage() {
  const values = new Map();
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, String(value)),
    removeItem: key => values.delete(key), clear: () => values.clear() };
}
const storage = memoryStorage();
vi.stubGlobal('localStorage', storage);
window.SDT = window.SDT || {};
window.SDT.Icons = { img: () => '', TYPE_ART: {} };
window.SDT.Sound = { music() {}, sfx() {}, setDucked() {}, setBoss() {} };
window.SDT.MAP = { rules: { battleEnergy: 9, battleHandMax: 99, bossDeckSize: 15,
  starterSha: 0, battleStartDraw: 5, battleTurnDraw: 1, diceSides: 6 }, items: {} };
await import('../game/src/cards/cards.js');
const Cards = window.SDT.Cards;
const { BattleSession } = await import('../game/src/battle/battle.core.js');
const runtime = await import('../game/src/battle/battle.runtime.js');
let activeGame;
const tick = () => new Promise(resolve => setTimeout(resolve, 5));
async function idle() {
  for (let n = 0; n < 1000; n++) {
    if (!runtime.busy && !BattleSession.getSnapshot().actionQueueLength) {
      await tick();
      if (!runtime.busy && !BattleSession.getSnapshot().actionQueueLength) return;
    }
    await tick();
  }
  throw new Error('E8 real BattleSession did not settle');
}
async function finish() {
  if (activeGame?.battleActive) { BattleSession.commands.flee(); await idle(); }
  activeGame = null;
}
afterEach(async () => { await finish(); vi.restoreAllMocks(); });
async function start(card, { hp = 50, status = {}, boss = false, hand = true } = {}) {
  await finish();
  activeGame = { ownedCards: [{ uid: 'e8-card', card: clone(card), safe: false }],
    hp: 100, maxHp: 100, atk: 5, spellPower: 0, coins: 0, myClass: '侠客',
    characterId: null, state: 'idle', battleActive: false, logs: [], healCalls: [],
    log(message) { this.logs.push(message); },
    heal(amount) { this.healCalls.push(amount); this.hp = Math.min(this.maxHp, this.hp + amount); },
    addItem() {}, onBattleEnd() {} };
  BattleSession.start(activeGame, [{ id: 'e8-foe', name: 'E8靶子', hp: 1000, atk: 1 }], { isBoss: boss });
  await idle();
  if (runtime.selectingDeck) { BattleSession.commands.confirmDeck(); await idle(); }
  activeGame.hp = hp;
  runtime.set$pstat({ ...runtime.pstat, status: { ...runtime.pstat.status, ...status } });
  // Startup excludes items from the ordinary hand and boss deck. This fixture
  // exercises their existing public onPlay command without changing card type.
  expect(runtime.hand).not.toContain('e8-card');
  if (hand) runtime.set$hand([...runtime.hand, 'e8-card']);
  return activeGame;
}
const cases = [
  ['normal', 50, {}, true], ['full', 100, {}, true], ['near-full', 98, {}, true],
  ['silenced', 50, { silence: 1 }, false], ['healban', 50, { healban: 2 }, false],
  ['both', 50, { silence: 1, healban: 2 }, false],
];
function resources(game) {
  return { hp: game.hp, energy: runtime.energy, hand: [...runtime.hand],
    consumed: [...runtime.consumed], played: [...runtime.played], calls: [...game.healCalls] };
}
describe('E8 legacy BattleSession contract investigation (not migration benefit)', () => {
  it.each(oldCards)('$id keeps the recorded fixed heal and status gates', async card => {
    expect(card.rules).toBeUndefined();
    for (const [label, hp, status, heals] of cases) {
      const game = await start(card, { hp, status });
      const energy = runtime.energy;
      BattleSession.commands.playCard('e8-card', 'self'); await idle();
      expect(game.hp, label).toBe(heals ? Math.min(100, hp + card.heal) : hp);
      expect(game.healCalls, label).toEqual(heals ? [card.heal] : []);
      expect(runtime.energy).toBe(energy);
      expect(runtime.hand).not.toContain('e8-card');
      expect(runtime.played.filter(uid => uid === 'e8-card')).toHaveLength(1);
      expect(runtime.discard).toEqual([]);
      expect(runtime.consumed).toEqual([]);
    }
  });
  it.each(oldCards)('$id waits for self, ignores wrong targets and consumes once', async card => {
    const game = await start(card);
    const before = resources(game);
    for (const target of [undefined, 0, 999]) {
      BattleSession.commands.playCard('e8-card', target); await idle();
      expect(resources(game)).toEqual(before);
    }
    BattleSession.commands.playCard('e8-card', 'self'); await idle();
    const after = resources(game);
    BattleSession.commands.playCard('e8-card', 'self'); await idle();
    expect(resources(game)).toEqual(after);
    expect(game.hp).toBe(50 + card.heal);
  });
  it.each(oldCards)('$id is rejected from boss hand, usable from ordinary/boss bag', async card => {
    const game = await start(card, { boss: true });
    const before = resources(game);
    BattleSession.commands.playCard('e8-card', 'self'); await idle();
    expect(resources(game)).toEqual(before);
    expect(game.logs.some(line => line.includes('道具卡只能在普通战斗中使用'))).toBe(true);
    for (const boss of [false, true]) {
      const bagGame = await start(card, { boss, hand: false });
      BattleSession.commands.useItem('e8-card'); await idle();
      expect(bagGame.hp).toBe(50 + card.heal);
      expect(bagGame.healCalls).toEqual([card.heal]);
      expect(bagGame.ownedCards).toHaveLength(0);
    }
  });
  it('keeps the actual STARTERS two-point bandage and an existing run copy legacy', async () => {
    const starter = clone(Cards.STARTERS.find(card => card.id === 'starter-emergency-bandage'));
    expect(starter.heal).toBeUndefined(); expect(starter.rules).toBeUndefined();
    expect(starter.desc).toContain('2 点生命');
    const runCopy = clone(starter);
    const game = await start(runCopy);
    BattleSession.commands.playCard('e8-card', 'self'); await idle();
    expect(game.hp).toBe(52); expect(game.healCalls).toEqual([2]);
    expect(runCopy).toEqual(starter);
  });
});

let mapGame, mapUI, showBackpack, grantEventCard, mapSaves;
async function mapSetup() {
  await finish(); vi.resetModules();
  mapSaves = vi.fn();
  mapGame = { runActive: true, myClass: '侠客', state: 'idle', battleActive: false, cap: 6,
    inventory: [], ownedCards: [], usedPocket: [], cardOrder: [], fragments: 0,
    hp: 50, maxHp: 100, healCalls: [], canReceiveCard: () => true,
    heal(amount) { this.healCalls.push(amount); this.hp = Math.min(100, this.hp + amount); } };
  mapUI = { el: { overlay: { hidden: true } }, acts: {},
    act(name, fn) { this.acts[name] = fn; }, hideOverlay() { this.el.overlay.hidden = true; },
    helpBtn: () => '', log: vi.fn(), registerHelp: vi.fn(), refresh: vi.fn(),
    showOverlay() { this.el.overlay.hidden = false; }, showCardZoom: vi.fn() };
  Object.assign(window.SDT, { UI: mapUI, Base: { bagCap: () => 6 } });
  vi.doMock('../game/src/run/game.session.js', () => ({
    MAP: window.SDT.MAP, game: mapGame, bagCap: () => 6, safeCap: () => 0,
    safeUsed: () => 0, usedSlots: () => mapGame.ownedCards.length,
    newUid: () => 'map-e8', saveGame: mapSaves, pick: array => array[0], scaledEnemy: value => value,
    cardStacks: safe => mapGame.ownedCards.filter(entry => !!entry.safe === !!safe)
      .map(entry => ({ card: entry.card, count: 1, uids: [entry.uid] })),
  }));
  vi.doMock('../game/src/hub/game.cardslib.js', () => ({ _set_cardPageOpen() {}, cardHTML: () => '' }));
  vi.doMock('../game/src/hub/game.bag.drag.js', () => ({ bagDrag: null, resetBagDrag() {} }));
  vi.doMock('../game/src/hub/game.bag.settle.js', () => ({ bindBagMixins() {} }));
  vi.doMock('../game/src/hub/game.bag.bridge.js', () => ({ bagSlots: { bindBagDrag() {} } }));
  ({ showBackpack } = await import('../game/src/hub/game.bag.js'));
  ({ grantEventCard } = await import('../game/src/run/game.run.scenes.js'));
}
function bindMapUse(card, hp = 50, acquire = false) {
  mapGame.hp = hp; mapGame.healCalls = []; mapGame.ownedCards = [];
  if (acquire) {
    expect(grantEventCard(card, { silent: true })).toBe(true);
    expect(mapGame.ownedCards[0].card).not.toBe(card);
    expect(mapGame.ownedCards[0].card).toEqual(card);
  } else mapGame.ownedCards.push({ uid: 'map-e8', card: clone(card), safe: false });
  mapSaves.mockClear();
  showBackpack(true);
  mapUI.acts.inspectStack({ name: card.name, safe: '0' });
  expect(mapUI.acts.useDetailCard).toBeTypeOf('function');
  return mapUI.acts.useDetailCard;
}
describe('E8 recorded legacy real map backpack UI baseline', () => {
  it.each(oldCards)('$id heals, caps and consumes once through actual UI-bound useOwnedCard', async card => {
    await mapSetup();
    for (const hp of [50, 98, 100]) {
      const use = bindMapUse(card, hp); use();
      expect(mapGame.hp).toBe(Math.min(100, hp + card.heal));
      expect(mapGame.healCalls).toEqual(hp === 100 ? [] : [card.heal]);
      expect(mapGame.ownedCards).toHaveLength(hp === 100 ? 1 : 0);
      expect(mapSaves).toHaveBeenCalledTimes(hp === 100 ? 0 : 1);
      use(); // stale UI callback retains the same UID: no second effect or save.
      expect(mapGame.healCalls).toEqual(hp === 100 ? [] : [card.heal]);
      expect(mapSaves).toHaveBeenCalledTimes(hp === 100 ? 0 : 1);
    }
  });
  it('retains actual STARTERS and pre-existing run two-point copies in the real map bag', async () => {
    await mapSetup();
    const starter = clone(Cards.STARTERS.find(card => card.id === IDS[2]));
    expect(starter.heal).toBeUndefined(); expect(starter.rules).toBeUndefined();
    const runCopy = clone(starter); const use = bindMapUse(runCopy); use();
    expect(mapGame.hp).toBe(52); expect(mapGame.healCalls).toEqual([2]);
    expect(runCopy).toEqual(starter);
  });
});

let migratedCards;
describe('E8 migrated rules against recorded legacy outcomes', () => {
  beforeAll(() => {
    Cards.ensureStarters(); Cards.ensureSha(); Cards.ensureTabletop();
    Cards.ensureDmgTypes(); Cards.ensureEffectFields();
    migratedCards = IDS.map(id => clone(Cards.all().find(card => card.id === id)));
    for (const [index, card] of migratedCards.entries()) {
      const { rules, ...fields } = card;
      expect(fields).toEqual(oldCards[index]);
      expect(rules).toEqual({ version: 1, bag: { use: [{ op: 'heal', amountField: 'heal' }] } });
    }
  });
  it.each(IDS)('%s acquired production copy matches old map use and ignores rewritten desc', async id => {
    await mapSetup();
    const old = oldCards.find(card => card.id === id);
    const migrated = migratedCards.find(card => card.id === id);
    for (const hp of [50, 98, 100]) {
      const outcomes = [];
      for (const card of [old, migrated, { ...migrated, desc: '全新展示文案。' },
        { ...migrated, desc: '回复 99 点生命。' }]) {
        const use = bindMapUse(card, hp, true); use();
        const outcome = () => ({ hp: mapGame.hp, healCalls: [...mapGame.healCalls],
          count: mapGame.ownedCards.length, saves: mapSaves.mock.calls.length });
        outcomes.push(outcome()); use();
        expect(outcome()).toEqual(outcomes.at(-1));
      }
      expect(outcomes.slice(1)).toEqual([outcomes[0], outcomes[0], outcomes[0]]);
    }
  });
  it.each(IDS)('%s preserves BOSS rejection and uses fields for structured battle bag behavior', async id => {
    for (const card of [oldCards.find(card => card.id === id), migratedCards.find(card => card.id === id)]) {
      const game = await start(card, { boss: true });
      const before = resources(game);
      BattleSession.commands.playCard('e8-card', 'self'); await idle();
      expect(resources(game)).toEqual(before);
      expect(game.logs.some(line => line.includes('道具卡只能在普通战斗中使用'))).toBe(true);
      for (const boss of [false, true]) for (const [, hp, status] of cases) {
        const bagGame = await start(card, { hp, status, boss, hand: false });
        BattleSession.commands.useItem('e8-card'); await idle();
        const heals = !status.healban;
        expect(bagGame.hp, JSON.stringify({ id, structured: !!card.rules, boss, hp, status,
          actualStatus: runtime.pstat.status, logs: bagGame.logs })).toBe(heals ? Math.min(100, hp + card.heal) : hp);
        expect(bagGame.healCalls).toEqual(heals ? [card.heal] : []);
        expect(bagGame.ownedCards).toHaveLength(0);
      }
      const textProbe = await start({ ...card, heal: 77, desc: '回复 3 点生命。' }, { hand: false });
      BattleSession.commands.useItem('e8-card'); await idle();
      expect(textProbe.healCalls).toEqual([card.rules ? 77 : 3]);
    }
  });
  it('does not rewrite an existing run copy when the catalogue gains rules', async () => {
    const starter = clone(Cards.STARTERS.find(card => card.id === 'starter-emergency-bandage'));
    await mapSetup();
    const use = bindMapUse(starter);
    Cards.ensureE8FixedHealRules();
    expect(mapGame.ownedCards[0].card).toEqual(starter);
    use(); expect(mapGame.healCalls).toEqual([2]);
  });
});

const KEY = 'sdt-cards-v1';
const MARKER = 'sdt-cards-e8-fixed-heal-bag-rules-v1-seeded';
async function isolatedLibrary(cards = oldCards) {
  await finish(); vi.resetModules();
  const memory = memoryStorage();
  if (cards !== null) memory.setItem(KEY, JSON.stringify(cards));
  vi.stubGlobal('localStorage', memory);
  await import('../game/src/cards/cards.js');
  return { cards: window.SDT.Cards, memory };
}
describe('E8 conservative persistent backfill in isolated memory', () => {
  it('adds only three rules, saves once, leaves sync and existing object references untouched', async () => {
    const { cards, memory } = await isolatedLibrary();
    const previous = cards.all(); const previousSnapshot = clone(previous);
    const sync = JSON.stringify(cards.CARDS_SYNC);
    const save = vi.spyOn(cards, 'saveAll');
    cards.ensureE8FixedHealRules();
    expect(save).toHaveBeenCalledOnce(); expect(previous).toEqual(previousSnapshot);
    expect(cards.all().map(card => Object.fromEntries(Object.entries(card).filter(([key]) => key !== 'rules')))).toEqual(oldCards);
    expect(cards.all().every(card => card.rules?.bag?.use?.[0]?.op === 'heal')).toBe(true);
    expect(JSON.stringify(cards.CARDS_SYNC)).toBe(sync); expect(memory.getItem(MARKER)).toBe('1');
    const saved = memory.getItem(KEY); cards.ensureE8FixedHealRules();
    expect(save).toHaveBeenCalledOnce(); expect(memory.getItem(KEY)).toBe(saved);
  });
  it('ignores key order but preserves extra fields, edited metadata, old values and existing rules', async () => {
    const variants = [card => ({ ...card, extra: true }), card => ({ ...card, desc: '自定义文案' }),
      card => ({ ...card, heal: 2 }), card => ({ ...card, rarity: '自定义' }),
      card => ({ ...card, rules: { version: 1 } }), card => ({ ...card, value: 999 })];
    for (const mutate of variants) {
      const custom = oldCards.map(mutate);
      const { cards, memory } = await isolatedLibrary(custom);
      const save = vi.spyOn(cards, 'saveAll'); cards.ensureE8FixedHealRules();
      expect(cards.all()).toEqual(custom); expect(save).not.toHaveBeenCalled();
      expect(memory.getItem(MARKER)).toBe('1'); vi.restoreAllMocks();
    }
    const reordered = oldCards.map(card => Object.fromEntries(Object.entries(card).reverse()));
    const { cards } = await isolatedLibrary(reordered); cards.ensureE8FixedHealRules();
    expect(cards.all().every(card => card.rules)).toBe(true);
  });
  it('does not reseed missing cards or replace an actual two-point STARTERS copy', async () => {
    const starter = clone(Cards.STARTERS.find(card => card.id === IDS[2]));
    const unrelated = { id: 'custom', name: '自建卡', desc: '回复 20 点生命。' };
    const { cards, memory } = await isolatedLibrary([starter, unrelated]);
    cards.ensureE8FixedHealRules();
    expect(cards.all()).toEqual([starter, unrelated]); expect(memory.getItem(MARKER)).toBe('1');
  });
  it.each(['false', 'throw', 'storage-write'])('does not mark or pollute cache on %s save failure', async failure => {
    const { cards, memory } = await isolatedLibrary();
    const before = clone(cards.all()); const raw = memory.getItem(KEY);
    if (failure === 'false') vi.spyOn(cards, 'saveAll').mockReturnValue(false);
    if (failure === 'throw') vi.spyOn(cards, 'saveAll').mockImplementation(() => { throw new Error('save failure'); });
    if (failure === 'storage-write') {
      const set = memory.setItem; vi.spyOn(memory, 'setItem').mockImplementation((key, value) => {
        if (key === KEY) throw new Error('quota'); return set(key, value);
      });
    }
    cards.ensureE8FixedHealRules();
    expect(cards.all()).toEqual(before); expect(memory.getItem(KEY)).toBe(raw);
    expect(memory.getItem(MARKER)).toBeNull();
  });
  it('retries marker failure without another card save', async () => {
    const { cards, memory } = await isolatedLibrary();
    const save = vi.spyOn(cards, 'saveAll'); const set = memory.setItem;
    const markerWrite = vi.spyOn(memory, 'setItem').mockImplementation((key, value) => {
      if (key === MARKER) throw new Error('marker write'); return set(key, value);
    });
    cards.ensureE8FixedHealRules(); expect(save).toHaveBeenCalledOnce();
    const raw = memory.getItem(KEY); expect(memory.getItem(MARKER)).toBeNull();
    markerWrite.mockRestore(); cards.ensureE8FixedHealRules();
    expect(save).toHaveBeenCalledOnce(); expect(memory.getItem(KEY)).toBe(raw);
    expect(memory.getItem(MARKER)).toBe('1');
  });
  it.each([MARKER, KEY])('does not interpret %s read failure as an unmarked empty library', async failingKey => {
    const { cards, memory } = await isolatedLibrary(); const raw = memory.getItem(KEY);
    cards.all(); const get = memory.getItem;
    vi.spyOn(memory, 'getItem').mockImplementation(key => {
      if (key === failingKey) throw new Error('read failure'); return get(key);
    });
    cards.ensureE8FixedHealRules(); expect(get(KEY)).toBe(raw); expect(get(MARKER)).toBeNull();
    expect(cards.all()).toEqual(oldCards);
  });
  it.each([null, '[]', '{bad', '{}', '[null]', '[{"id":"same"},{"id":"same"}]'])(
    'does not stamp an absent, empty, corrupt or ambiguous library: %s', async raw => {
      const { cards, memory } = await isolatedLibrary(null);
      if (raw !== null) memory.setItem(KEY, raw);
      cards.ensureE8FixedHealRules(); expect(memory.getItem(MARKER)).toBeNull();
      expect(memory.getItem(KEY)).toBe(raw);
    });
  it('preserves external replacement when original saveAll sees a concurrent change', async () => {
    const { cards, memory } = await isolatedLibrary(); cards.all();
    const replacement = JSON.stringify([{ id: 'external', name: '外部新卡' }]);
    const save = cards.saveAll;
    vi.spyOn(cards, 'saveAll').mockImplementation(next => {
      memory.setItem(KEY, replacement); return save(next);
    });
    cards.ensureE8FixedHealRules(); expect(memory.getItem(KEY)).toBe(replacement);
    expect(memory.getItem(MARKER)).toBeNull(); expect(cards.all()).toEqual(JSON.parse(replacement));
  });
  it('does not repair later imported legacy data once any marker exists', async () => {
    const { cards, memory } = await isolatedLibrary(); memory.setItem(MARKER, 'already-checked');
    cards.ensureE8FixedHealRules(); expect(cards.all()).toEqual(oldCards);
    expect(memory.getItem(MARKER)).toBe('already-checked');
  });
  it('will not bless a hot cache that differs from externally replaced storage', async () => {
    const { cards, memory } = await isolatedLibrary(); cards.all();
    const changed = JSON.stringify(oldCards.map(card => ({ ...card, value: 123 })));
    memory.setItem(KEY, changed);
    const save = vi.spyOn(cards, 'saveAll'); cards.ensureE8FixedHealRules();
    expect(save).not.toHaveBeenCalled(); expect(memory.getItem(KEY)).toBe(changed);
    expect(memory.getItem(MARKER)).toBeNull();
  });
  it('will not mark a previously degraded corrupt cache after storage is replaced', async () => {
    const { cards, memory } = await isolatedLibrary(null); memory.setItem(KEY, '{broken');
    expect(cards.all()).toEqual([]);
    const restored = JSON.stringify(oldCards); memory.setItem(KEY, restored);
    cards.ensureE8FixedHealRules();
    expect(memory.getItem(KEY)).toBe(restored); expect(memory.getItem(MARKER)).toBeNull();
  });
  it('does not mark when the all-skipped library changes during its final check', async () => {
    const custom = oldCards.map(card => ({ ...card, desc: 'custom' }));
    const { cards, memory } = await isolatedLibrary(custom);
    cards.all(); const get = memory.getItem; let reads = 0;
    const replacement = JSON.stringify([{ id: 'changed-before-marker' }]);
    vi.spyOn(memory, 'getItem').mockImplementation(key => {
      if (key === KEY && ++reads === 2) memory.setItem(KEY, replacement);
      return get(key);
    });
    cards.ensureE8FixedHealRules();
    expect(get(KEY)).toBe(replacement); expect(get(MARKER)).toBeNull();
  });
  it.each(['read-failure', 'replacement'])('does not stamp after successful save followed by %s', async fault => {
    const { cards, memory } = await isolatedLibrary(); const get = memory.getItem;
    const save = cards.saveAll; let saved = false;
    const replacement = JSON.stringify([{ id: 'post-save-external' }]);
    const saveSpy = vi.spyOn(cards, 'saveAll').mockImplementation(next => {
      const result = save(next); saved = result === true;
      if (saved && fault === 'replacement') memory.setItem(KEY, replacement);
      return result;
    });
    const readSpy = vi.spyOn(memory, 'getItem').mockImplementation(key => {
      if (saved && key === KEY && fault === 'read-failure') throw new Error('post-save read');
      return get(key);
    });
    cards.ensureE8FixedHealRules();
    expect(saveSpy).toHaveBeenCalledOnce(); expect(get(MARKER)).toBeNull();
    if (fault === 'replacement') expect(get(KEY)).toBe(replacement);
    else {
      expect(JSON.parse(get(KEY)).every(card => card.rules?.bag)).toBe(true);
      readSpy.mockRestore(); cards.ensureE8FixedHealRules();
      expect(saveSpy).toHaveBeenCalledOnce(); expect(get(MARKER)).toBe('1');
    }
  });
});
