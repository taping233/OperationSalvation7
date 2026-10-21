import { beforeEach, afterEach, expect, it, vi } from 'vitest';
window.SDT = { Icons: { img: () => '', TYPE_ART: {} },
  Sound: { music() {}, sfx() {}, setDucked() {}, setBoss() {} },
  MAP: { rules: { battleEnergy: 99, battleHandMax: 200, bossDeckSize: 15, starterSha: 0,
    battleStartDraw: 0, battleTurnDraw: 0, diceSides: 6 }, items: {} } };
await import('../game/src/cards/cards.js');
const C = window.SDT.Cards;
C.ensureSha(); C.ensureStarters(); C.ensureTabletop(); C.ensureDmgTypes(); C.ensureEffectFields();
const { BattleSession } = await import('../game/src/battle/core/battle.core.js');
const E = await import('../game/src/battle/core/battle.engine.js');
const R = await import('../game/src/battle/runtime/battle.runtime.js');
const canonical = id => { const card = C.all().find(c => c.id === id); expect(card, id).toBeTruthy(); return card; };
function start(id) {
  const game = { ownedCards: [{ uid: 'owned-test-card', card: structuredClone(canonical(id)) }],
    hp: 100, maxHp: 100, atk: 5, spellPower: 0, coins: 0, characterId: null, myClass: '战士',
    state: 'idle', battleActive: false, log() {}, heal() {}, addItem() {}, onBattleEnd() {} };
  BattleSession.start(game, [{ id: 'real-deck-target', name: '牌库靶', hp: 9999, atk: 0 }], { isBoss: false });
}
beforeEach(() => { vi.useFakeTimers(); R.set$lastDeckSel([]); });
afterEach(() => { if (R.G?.battleActive) E.finish(null); vi.clearAllTimers(); vi.useRealTimers(); });
async function playOwned() {
  BattleSession.commands.playCard('owned-test-card', 'self');
  await vi.advanceTimersByTimeAsync(3000);
  expect(R.busy).toBe(false);
}

it('real 铁甲阵 shuffles five real cards into the normal pile and later drawing consumes those exact entities', async () => {
  start('tt7-ironphalanx');
  const original = new Set(R.drawPile);
  expect(original.size).toBe(99);
  await playOwned();
  expect(R.drawPile).toHaveLength(104);
  const inserted = R.drawPile.filter(uid => !original.has(uid));
  expect(inserted).toHaveLength(5);
  expect(inserted.every(uid => E.findCard(uid)?.card)).toBe(true);
  const grantedBeforeDraw = R.granted.length;
  expect(E.drawCards(104)).toBe(104);
  expect(R.drawPile).toHaveLength(0);
  expect(inserted.every(uid => R.hand.includes(uid))).toBe(true);
  expect(E.drawCards(2)).toBe(0);
  expect(R.granted).toHaveLength(grantedBeforeDraw);
});

it('real 武装 cannot invent equipment or starter replacements when the normal pile has only starters', async () => {
  start('tt7-armup'); const original = [...R.drawPile];
  expect(E.unplayableReason(canonical('tt7-armup'))).toBeNull();
  await playOwned();
  expect(R.hand).toHaveLength(0);
  expect(R.drawPile).toEqual(original);
  expect(R.granted).toHaveLength(99);
});

it('normal deck browsing opens and returns without moving any cards', () => {
  start('tt7-armup'); const original = [...R.drawPile];
  BattleSession.commands.openDeckView(); expect(R.viewingDeck).toBe(true);
  BattleSession.commands.closeDeckView(); expect(R.viewingDeck).toBe(false);
  expect(R.drawPile).toEqual(original);
});
