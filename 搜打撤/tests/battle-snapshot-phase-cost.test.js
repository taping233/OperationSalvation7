import { afterEach, beforeAll, beforeEach, expect, it, vi } from 'vitest';

window.SDT = { Icons: { img: () => '', TYPE_ART: {} },
  Sound: { music() {}, sfx() {}, setDucked() {}, setBoss() {} },
  MAP: { rules: { battleEnergy: 6, battleHandMax: 200, bossDeckSize: 3,
    starterSha: 0, battleStartDraw: 2, battleTurnDraw: 1, diceSides: 6 }, items: {} },
};
await import('../game/src/cards/cards.js');
const { BattleSession } = await import('../game/src/battle/core/battle.core.js');
const Runtime = await import('../game/src/battle/runtime/battle.runtime.js');
const Cards = window.SDT.Cards;
const snapshot = () => BattleSession.getSnapshot();
let game;

beforeAll(() => {
  Cards.ensureSha(); Cards.ensureStarters(); Cards.ensureTabletop();
  Cards.ensureDmgTypes(); Cards.ensureEffectFields();
});
beforeEach(() => {
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation(() => 1);
  Runtime.set$selPool([]); Runtime.set$sel(new Set()); Runtime.set$lastDeckSel([]);
});
afterEach(() => {
  vi.restoreAllMocks();
  if (game?.battleActive) BattleSession.commands.flee();
});

function makeCard(index) {
  return { id: `snapshot-phase-${index}`, name: `快照探针${index}`, cost: 0,
    type: '武术', desc: '造成1点攻击伤害。', dmg: 1, dmgType: 'attack',
    rules: { version: 1, battle: { target: { side: 'enemy', area: false } },
      triggers: { onPlay: [{ op: 'damage', amountField: 'dmg', target: 'chosenEnemy' }] } },
  };
}
function start(options = {}, count = 120) {
  game = { ownedCards: Array.from({ length: count }, (_, index) => ({ uid: `owned-${index}`, card: makeCard(index) })),
    inventory: [], usedPocket: [], hp: 100, maxHp: 100, atk: 4, spellPower: 0,
    coins: 0, myClass: '战士', state: 'idle', battleActive: false,
    log() {}, heal(n) { this.hp = Math.min(this.maxHp, this.hp + n); }, onBattleEnd() {},
  };
  BattleSession.start(game, [{ id: 'phase-target', name: '快照靶子', hp: 100, atk: 1 }], options);
  return snapshot();
}
function confirmDeck() {
  const selection = snapshot().deckSelection;
  for (const entry of selection.cards.slice(0, selection.need)) {
    if (!snapshot().deckSelection.selected.includes(entry.uid)) BattleSession.commands.selectDeckCard(entry.uid);
  }
  BattleSession.commands.confirmDeck();
  expect(snapshot().deckSelection).toBeNull();
}

// Count actual callbacks as well as method calls, rather than using elapsed time
// as a flaky CI threshold. Spies wrap the real collection methods unchanged.
function measure(label, reads = 50) {
  const warm = snapshot();
  const counts = { label, reads, poolSize: Runtime.selPool.length, ownedSize: game.ownedCards.length,
    poolFilterCalls: 0, poolFilterVisits: 0, poolMapCalls: 0, poolMapVisits: 0,
    ownedForEachCalls: 0, ownedForEachVisits: 0 };
  const spies = [];
  const count = (collection, method, prefix) => {
    const original = collection[method];
    spies.push(vi.spyOn(collection, method).mockImplementation(function (callback, thisArg) {
      counts[`${prefix}Calls`]++;
      return original.call(this, function (...args) {
        counts[`${prefix}Visits`]++;
        return callback.apply(thisArg, args);
      });
    }));
  };
  count(Runtime.selPool, 'filter', 'poolFilter');
  count(Runtime.selPool, 'map', 'poolMap');
  count(game.ownedCards, 'forEach', 'ownedForEach');
  try {
    for (let i = 0; i < reads; i++) expect(snapshot()).toBe(warm);
  } finally {
    spies.forEach(spy => spy.mockRestore());
  }
  console.info(`SNAPSHOT_PHASE_COUNTS ${JSON.stringify(counts)}`);
  return counts;
}
function expectNoSelectionScans(counts) {
  expect(counts).toMatchObject({ poolFilterCalls: 0, poolFilterVisits: 0,
    poolMapCalls: 0, poolMapVisits: 0, ownedForEachCalls: 0, ownedForEachVisits: 0 });
}

it.each(['normal', 'confirmed boss', 'direct boss', 'nest'])(
  'does no inactive formation work on stable %s snapshots', mode => {
    start(mode === 'normal' ? {} : { isBoss: true, directBossStart: mode === 'direct boss', nest: mode === 'nest' });
    if (mode === 'confirmed boss') confirmDeck();
    expect(snapshot().deckSelection).toBeNull();
    expectNoSelectionScans(measure(mode));
  },
);

it('continues reading the live formation pool and capacity while selection is active', () => {
  start({ isBoss: true });
  const counts = measure('active formation');
  expect(counts).toMatchObject({ poolFilterCalls: 100, poolFilterVisits: 12000,
    poolMapCalls: 50, poolMapVisits: 6000, ownedForEachCalls: 50, ownedForEachVisits: 6000 });
  const old = snapshot();
  game.ownedCards[0].card.rules.triggers.onPlay.push({ op: 'damage', amount: 2, target: 'chosenEnemy' });
  const changed = snapshot();
  expect(changed).not.toBe(old);
  expect(changed.deckSelection.cards[0].card.rules.triggers.onPlay).toHaveLength(2);
  expect(old.deckSelection.cards[0].card.rules.triggers.onPlay).toHaveLength(1);
  BattleSession.commands.selectDeckCard('owned-0');
  expect(snapshot().deckSelection.selected).toContain('owned-0');
  Runtime.set$selDeckMax(7); Runtime.set$selShaN(2);
  window.SDT.MAP.rules.bossDeckSize = 2;
  try { expect(snapshot().deckSelection).toMatchObject({ max: 7, starterCount: 2, need: 2 }); }
  finally { window.SDT.MAP.rules.bossDeckSize = 3; }
});

it('preserves runtime selections, ignores inactive pool-only changes, and reprojects after reentry', () => {
  start({ isBoss: true }, 5); confirmDeck();
  const pool = Runtime.selPool, selected = Runtime.sel;
  const combat = snapshot();
  pool[4].card.rules.triggers.onPlay.push({ op: 'damage', amount: 2, target: 'chosenEnemy' });
  Runtime.set$selDeckMax(7); Runtime.set$selShaN(2);
  expect(snapshot()).toBe(combat);
  expect(Runtime.selPool).toBe(pool); expect(Runtime.sel).toBe(selected);
  expect([...selected]).toEqual(['owned-0', 'owned-1', 'owned-2']);
  // Force the supported runtime phase flag back on to verify projection alone;
  // no game command or selection rules are replaced by this test setup.
  Runtime.set$selectingDeck(true);
  const reopened = snapshot();
  expect(reopened).not.toBe(combat);
  expect(reopened.deckSelection).toMatchObject({ max: 7, starterCount: 2, selected: [...selected] });
  expect(reopened.deckSelection.cards[4].card.rules.triggers.onPlay).toHaveLength(2);
  Runtime.set$selectingDeck(false);
  expect(snapshot().deckSelection).toBeNull();
});

it('continues invalidating in-place card rules in a pending target outside formation', () => {
  start({}, 1);
  BattleSession.commands.playCard('owned-0', null);
  const before = snapshot();
  expect(before.pendingTarget?.card.id).toBe('snapshot-phase-0');
  game.ownedCards[0].card.rules.triggers.onPlay.push({ op: 'damage', amount: 2, target: 'chosenEnemy' });
  const after = snapshot();
  expect(after).not.toBe(before);
  expect(after.pendingTarget.card.rules.triggers.onPlay).toHaveLength(2);
  expect(before.pendingTarget.card.rules.triggers.onPlay).toHaveLength(1);
  BattleSession.commands.cancelPendingTarget();
});

it('preserves equipped-card invalidation when the same card is also retained in the inactive pool', () => {
  start({ isBoss: true }, 5); confirmDeck();
  const card = Runtime.selPool[0].card;
  Runtime.set$equipped([{ uid: 'owned-0', card, used: false }]);
  const before = snapshot();
  card.rules.triggers.onPlay.push({ op: 'damage', amount: 2, target: 'chosenEnemy' });
  const after = snapshot();
  expect(after).not.toBe(before);
  expect(after.equipped[0].card.rules.triggers.onPlay).toHaveLength(2);
  expect(before.equipped[0].card.rules.triggers.onPlay).toHaveLength(1);
});

it('skips the retained old pool after exiting a boss battle and entering ordinary combat', () => {
  start({ isBoss: true }, 120); confirmDeck();
  const oldPool = Runtime.selPool, token = snapshot().battleToken;
  BattleSession.commands.flee();
  start({}, 6);
  expect(Runtime.selPool).toBe(oldPool);
  expect(snapshot().battleToken).not.toBe(token);
  expect(snapshot().deckSelection).toBeNull();
  expectNoSelectionScans(measure('normal after boss'));
});

it('restarts a confirmed boss deck without losing its saved choice or recapturing formation work', () => {
  start({ isBoss: true }, 5); confirmDeck();
  const checkpoint = BattleSession.serialize(), token = snapshot().battleToken;
  expect(checkpoint.selectedDeck).toEqual(['owned-0', 'owned-1', 'owned-2']);
  expect(BattleSession.restore(game, checkpoint)).toBe(true);
  expect(snapshot()).toMatchObject({ deckSelection: null, turn: 1 });
  expect(snapshot().battleToken).not.toBe(token);
  expect([...Runtime.sel]).toEqual(checkpoint.selectedDeck);
  expect(BattleSession.serialize().selectedDeck).toEqual(checkpoint.selectedDeck);
  expectNoSelectionScans(measure('restarted boss'));
});
