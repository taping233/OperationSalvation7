import { battleRules } from './helpers/environment-fixtures.js';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
window.SDT = { Icons: { img: () => '', TYPE_ART: {} }, Sound: { music() {}, sfx() {}, setDucked() {}, setBoss() {} },
  MAP: { rules: { ...battleRules(20, 30, 15, 0, 0, 0) }, items: {} } };
await import('../game/src/cards/cards.js');
const C = window.SDT.Cards;
C.ensureSha(); C.ensureStarters(); C.ensureTabletop(); C.ensureDmgTypes(); C.ensureEffectFields();
const { BattleSession } = await import('../game/src/battle/core/battle.core.js');
const E = await import('../game/src/battle/core/battle.engine.js');
const R = await import('../game/src/battle/runtime/battle.runtime.js');
const { setRandomService, SeededRandomService } = await import('../game/src/core/random.js');
const canonical = id => { const card = C.all().find(c => c.id === id); expect(card, id).toBeTruthy(); return card; };
let serial = 0;
function start({ count = 3, spellPower = 0 } = {}) {
  const game = { ownedCards: [], hp: 200, maxHp: 200, atk: 5, spellPower, coins: 0, myClass: '战士', characterId: null,
    state: 'idle', battleActive: false, logs: [], log(message) { this.logs.push(message); },
    heal(n) { this.hp = Math.min(this.maxHp, this.hp + n); }, addItem() {}, onBattleEnd() {} };
  BattleSession.start(game, Array.from({ length: count }, (_, i) => ({ id: `foe-${i}`, name: `靶${i}`, hp: 100, atk: 0 })), { isBoss: false });
  return game;
}
function grant(id, pile = R.hand) {
  const uid = `batch-equip-${serial++}`;
  R.granted.push({ uid, card: structuredClone(typeof id === 'string' ? canonical(id) : id) }); pile.push(uid); return uid;
}
async function settle() { await vi.advanceTimersByTimeAsync(2000); expect(R.busy).toBe(false); }
async function play(id, target = undefined) { const definition = typeof id === 'string' ? canonical(id) : id; target ??= definition.rules?.battle?.target?.side === 'enemy' ? 0 : 'self'; const uid = grant(id); BattleSession.commands.playCard(uid, target); await settle(); return uid; }
async function next(extra = false) { if (extra) R.set$extraTurn(true); BattleSession.commands.endTurn(); await settle(); }
function fixedRandom(value) { setRandomService({ random: () => value, reseed() {}, snapshot: () => ({}), restore() {} }); }
beforeEach(() => { vi.useFakeTimers(); R.set$lastDeckSel([]); });
afterEach(() => { setRandomService(new SeededRandomService(123)); vi.restoreAllMocks(); vi.clearAllTimers(); vi.useRealTimers(); });

it('cast-on-draw targeting chooses a still-living foe after an earlier queued copy kills the first', async () => {
  start({count:2}); R.set$mode('boss'); R.foes[0].hp=4;
  grant({...canonical('tt12-freezeray'),_castOnDraw:true},R.drawPile);
  grant({...canonical('tt12-freezeray'),_castOnDraw:true},R.drawPile);
  expect(E.drawCards(2)).toBe(2); await settle();
  expect(R.foes[1].hp).toBe(96);
});
it('poison-triggered scale draw of healing copy preserves healing', async () => {
  start(); await play('tt13-scale-armor'); R.set$mode('boss'); R.foes.forEach(f => f.atk=0); R.G.hp=100; R.pstat.status.poison=1; fixedRandom(0);
  grant({...canonical('tt3-holy-water'),_castOnDraw:true},R.drawPile);
  await next();
  expect(R.G.hp).toBe(104);
});
it('enemy attacks pause for both discovered choices and resume each enemy exactly once', async () => {
  start({count:2}); await play('tt13-scale-armor'); R.set$mode('boss'); fixedRandom(0);
  R.foes[0].atk=1; R.foes[1].atk=2;
  const option=structuredClone(canonical('tt13-guard'));
  const spell=structuredClone(canonical('tt12-magicfind'));
  vi.spyOn(C,'all').mockReturnValue([option]);
  const a=grant({...spell,_castOnDraw:true},R.drawPile), b=grant({...spell,_castOnDraw:true},R.drawPile);
  BattleSession.commands.endTurn(); await vi.advanceTimersByTimeAsync(2000);
  expect(R.discovering).toBeTruthy(); expect(R.turn).toBe(1); expect(R.G.hp).toBe(199);
  expect(E.hasPendingEndTurn()).toBe(true); expect(R.battleState.phase).toBe('player'); expect(R.busy).toBe(false);
  BattleSession.commands.endTurn(); // cannot start a second enemy phase while suspended
  BattleSession.commands.pickDiscover(0); await vi.advanceTimersByTimeAsync(2000);
  expect(R.discovering).toBeTruthy(); expect(R.turn).toBe(1); expect(R.G.hp).toBe(197);
  BattleSession.commands.pickDiscover(0); await settle();
  expect(R.discovering).toBeNull(); expect(R.turn).toBe(2); expect(R.G.hp).toBe(197);
  expect(E.hasPendingEndTurn()).toBe(false); expect(R.battleState.phase).toBe('player');
  expect(R.discard.filter(u=>u===a||u===b)).toHaveLength(2);
  expect(R.granted.filter(e=>e.card.id===option.id)).toHaveLength(2);
});
it('full-hand reactive damage copies resolve before remaining enemies attack', async () => {
  start({count:2}); await play('tt13-scale-armor'); R.set$mode('boss'); fixedRandom(0);
  R.set$drawPile([]); // Isolate the BOSS reactive draw without the normal-only starter library.
  R.foes[0].atk=1; R.foes[1].atk=2; R.foes[1].hp=2;
  R.set$hand(Array.from({length:30},(_,i)=>`filler-${i}`));
  const uid=grant({...canonical('tt3-ice-spike'),_castOnDraw:true},R.drawPile);
  await next();
  expect(R.hand).toHaveLength(30); expect(R.discard).toContain(uid); expect(R.turn).toBe(2);
  expect(R.foes[0].hp).toBe(92); // two reflections (6), plus one ice spike (2); consumed cards do not auto-return.
  expect(R.G.hp).toBe(197);
});
it('normal next-turn draw casts while enemy continuation is still active', async () => {
  start({count:1}); R.set$mode('boss'); R.foes[0].atk=0;
  const uid=grant({...canonical('tt3-holy-water'),_castOnDraw:true},R.drawPile); R.G.hp=100;
  window.SDT.MAP.rules.battleTurnDraw=1;
  try { await next(); expect(R.G.hp).toBe(105); expect(R.turn).toBe(2); expect(R.discard).toContain(uid); }
  finally { window.SDT.MAP.rules.battleTurnDraw=0; }
});
it('ending a suspended battle cancels the enemy continuation without touching the next battle', async () => {
  start({count:2}); await play('tt13-scale-armor'); R.set$mode('boss'); fixedRandom(0);
  R.foes[0].atk=1; R.foes[1].atk=2;
  const option=structuredClone(canonical('tt13-guard')), spell=structuredClone(canonical('tt12-magicfind'));
  vi.spyOn(C,'all').mockReturnValue([option]);
  grant({...spell,_castOnDraw:true},R.drawPile);
  BattleSession.commands.endTurn(); await vi.advanceTimersByTimeAsync(1000); expect(R.discovering).toBeTruthy();
  E.finish(false); start({count:1}); const token=R.battleState.token;
  await settle(); expect(R.battleState.token).toBe(token); expect(R.turn).toBe(1); expect(R.G.hp).toBe(200); expect(E.hasPendingEndTurn()).toBe(false);
});
it('a reactive lethal copy ends battle without resuming enemy attacks or advancing the turn', async () => {
  start({count:1}); await play('tt13-scale-armor'); R.set$mode('boss'); fixedRandom(0);
  R.foes[0].atk=1; R.foes[0].hp=5;
  grant({...canonical('tt3-ice-spike'),_castOnDraw:true},R.drawPile);
  await next(); expect(R.G.battleActive).toBe(false); expect(R.foes[0].dead).toBe(true); expect(R.turn).toBe(1); expect(R.G.hp).toBe(199);
});
it('concurrent triggered waits share ownership and an existing continuation is never stolen', async () => {
  start({count:1}); R.set$battleState({...R.battleState,phase:'enemy'});
  R.set$discovering({options:[],act:'add'});
  const resumed=vi.fn(); E.deferEndTurn(resumed);
  const first=E.awaitTriggeredActions(), second=E.awaitTriggeredActions();
  expect(first).toBe(second); await first;
  expect(R.battleState.phase).toBe('enemy'); expect(E.hasPendingEndTurn()).toBe(true); expect(resumed).not.toHaveBeenCalled();
  R.set$discovering(null); R.set$battleState({...R.battleState,phase:'player'}); E.settlePendingSelections();
  expect(resumed).toHaveBeenCalledTimes(1); expect(E.hasPendingEndTurn()).toBe(false);
});
