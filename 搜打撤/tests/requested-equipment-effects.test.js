import { afterEach, beforeEach, expect, it, vi } from 'vitest';
window.SDT = { Icons: { img: () => '', TYPE_ART: {} }, Sound: { music() {}, sfx() {}, setDucked() {}, setBoss() {} },
  MAP: { rules: { battleEnergy: 20, battleHandMax: 30, bossDeckSize: 15, starterSha: 0, battleStartDraw: 0, battleTurnDraw: 0, diceSides: 6 }, items: {} } };
await import('../game/src/cards/cards.js');
const C = window.SDT.Cards;
C.ensureSha(); C.ensureStarters(); C.ensureTabletop(); C.ensureDmgTypes(); C.ensureEffectFields();
const { BattleSession } = await import('../game/src/battle/core/battle.core.js');
const E = await import('../game/src/battle/core/battle.engine.js');
const R = await import('../game/src/battle/runtime/battle.runtime.js');
const { setRandomService, SeededRandomService } = await import('../game/src/core/random.js');
const { GUN_POOL_IDS } = await import('../game/src/battle/effects/requested-card-batch.js');
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

it('magazine costs zero, draws only the explicit five-gun pool and can activate once per battle', async () => {
  start(); const uid = await play('tt13-magazine'); const energy = R.energy;
  fixedRandom(0.99);
  const before = R.granted.length;
  BattleSession.commands.useEquipSkill(uid); await settle();
  const generated = R.granted.slice(before); expect(generated).toHaveLength(2);
  expect(generated.every(entry => GUN_POOL_IDS.includes(entry.card.id))).toBe(true);
  expect([...GUN_POOL_IDS]).toEqual(['tt2-shoot','tt3-noon-duel','tt3-double-shot','cc-rapid-fire','tt13-snipe']); expect(R.energy).toBe(energy);
  BattleSession.commands.useEquipSkill(uid); await settle(); expect(R.granted).toHaveLength(before + 2);
  await play('tt13-spring'); const afterSpring = R.granted.length;
  expect(R.equipped.find(entry => entry.uid === uid).used).toBe(true);
  BattleSession.commands.useEquipSkill(uid); await settle(); expect(R.granted).toHaveLength(afterSpring);
  start(); const second = await play('tt13-magazine'); const fresh = R.granted.length;
  BattleSession.commands.useEquipSkill(second); await settle(); expect(R.granted).toHaveLength(fresh + 2);
});

it('flame staff does no equip damage and applies one spell bonus to each enemy at next turn start', async () => {
  start({ spellPower: 3 });
  expect(canonical('tt13-flame-staff').rules.battle.target).toEqual({side:'self',area:false});
  await play('tt13-flame-staff'); expect(R.foes.map(f => f.hp)).toEqual([100,100,100]);
  await next(); expect(R.turn).toBe(2); expect(R.foes.map(f => f.hp)).toEqual([95,95,95]);
});

it.each([0.1, 0.9])('scale armor reacts only to real damage with fixed 3 and independent 50%% draw, rng=%s', async rng => {
  start(); await play('tt13-scale-armor'); R.set$mode('boss');
  const draw = grant('tt13-guard', R.drawPile); const before = R.hand.length;
  fixedRandom(rng);
  R.foes[0].atk = 0; E.playerTakeHit(R.foes[0]); expect(R.foes.reduce((sum,f) => sum + f.hp, 0)).toBe(300);
  expect(R.hand).toHaveLength(before);
  R.foes[0].atk = 2; R.pstat.status.immune = 1; E.playerTakeHit(R.foes[0]);
  expect(R.foes.reduce((sum,f) => sum + f.hp, 0)).toBe(300); expect(R.hand).toHaveLength(before);
  R.pstat.status.immune = 0; E.playerTakeHit(R.foes[0]);
  expect(R.foes.reduce((sum,f) => sum + f.hp, 0)).toBe(297);
  expect(R.hand.includes(draw)).toBe(rng < 0.5);
});

it('scale armor also reacts to self damage', async () => {
  start(); await play('tt13-scale-armor'); fixedRandom(0.9);
  // Cursed sword is a real self-damage turn-start equipment.
  await play('tt3-silver-runesword'); await next(true);
  expect(R.G.hp).toBe(198); expect(R.foes.reduce((sum,f) => sum + f.hp, 0)).toBe(297);
});

it('astrolabe refunds only the first matching move and alternates through ordinary and extra turns', async () => {
  start(); await play('tt13-astrolabe'); R.set$energy(10);
  await play('tt13-guard'); expect(R.energy).toBe(10); // cost 1, refund 1
  await play('tt13-guard'); expect(R.energy).toBe(9);
  await next(true); expect(R.turn).toBe(2); R.set$energy(10);
  await play('tt13-soul-contract', 0); expect(R.energy).toBe(11);
  await play('tt13-soul-contract', 1); expect(R.energy).toBe(11);
  await next(); expect(R.turn).toBe(3); R.set$energy(10);
  await play('tt13-guard'); expect(R.energy).toBe(10);
});

it('soul echoes hit other living enemies once, never recurse through multiple marks, and include lethal hits', async () => {
  start(); await play('tt13-soul-contract', 0); await play('tt13-soul-contract', 1);
  fixedRandom(0);
  E.hitFoe(R.foes[0], { name: '测试' }, 3, 'true');
  expect(R.foes.map(f => f.hp)).toEqual([97,98,100]);
  R.foes[2].dead = true; R.foes[0].hp = 1;
  E.hitFoe(R.foes[0], { name: '致死' }, 3, 'true');
  expect(R.foes[0].hp).toBeLessThanOrEqual(0); expect(R.foes[1].hp).toBe(96); expect(R.foes[2].hp).toBe(100);
});

it('soul marks react to poison damage', async () => {
  start({ count: 2 }); await play('tt13-soul-contract', 0); R.foes[0].status.poison = 1;
  fixedRandom(0);
  await next(); expect(R.foes.map(f => f.hp)).toEqual([99,98]);
});

it('flame form grants baseline spell power, adds one per two real fuels and does not persist across battles', async () => {
  start(); await play('cmtn1ntxzoc4'); expect(R.pstat.status.spellUp).toBe(1);
  for (let i = 0; i < 2; i++) {
    const uid = grant('tt12-raydragon'), fuel = grant('tt13-guard');
    E.queueCardExecution(uid, E.findCard(uid).card, [fuel], R.foes[0], true); await settle();
    expect(R.infuseFuels).toBe(i + 1); expect(R.pstat.status.spellUp).toBe(i === 0 ? 1 : 2);
  }
  start(); expect(R.pstat.status.spellUp || 0).toBe(0);
  const uid = grant('tt12-raydragon'), a = grant('tt13-guard'), b = grant('tt13-guard');
  E.queueCardExecution(uid, E.findCard(uid).card, [a,b], R.foes[0], true); await settle();
  expect(R.pstat.status.spellUp || 0).toBe(0);
});

it('chaos upgrades same types with legendary cap, discards the whole hand and leaves the catalog unchanged', async () => {
  start(); R.set$mode('boss');
  const source = canonical('tt13-chaos-deck');
  const pool = C.all().filter(c => ['武术','法术','装备'].includes(c.type) && C.isRandomObtainable(c));
  const inputs = ['古朴','稀有','史诗','传说'].map((rarity, i) => pool.find(c => c.rarity === rarity && c.type === (i % 2 ? '法术' : '武术')));
  expect(inputs.every(Boolean)).toBe(true); const snapshot = JSON.stringify(C.all());
  const uids = inputs.map(card => grant(card, R.drawPile)); const unwanted = grant('tt13-guard');
  await play(source);
  expect(R.hand).toEqual([]); expect(R.discard).toContain(unwanted);
  uids.forEach((uid, i) => {
    const effective = E.findEffectiveCard(uid).card;
    expect(effective.type).toBe(inputs[i].type); expect(effective.rarity).toBe(['稀有','史诗','传说','传说'][i]);
  });
  expect(JSON.stringify(C.all())).toBe(snapshot);
});

it.each(['tt13-magazine', 'tt13-flame-staff', 'tt13-scale-armor', 'tt13-astrolabe'])('new equipment %s respects occupied automatic slots without payment or early initialization', async id => {
  start();
  R.set$equipped([{ uid: 'auto-a', card: canonical('tt7-talisman') }, { uid: 'auto-b', card: canonical('tt3-chaos-eye') }]);
  const uid = grant(id); const before = BattleSession.getSnapshot();
  expect(BattleSession.commands.submitCardPlay(uid, 'self').reason.code).toBe('EQUIPMENT_FULL');
  expect(BattleSession.getSnapshot().energy).toBe(before.energy);
  expect(BattleSession.getSnapshot().hand).toEqual(before.hand);
  const { requestedBattleState } = await import('../game/src/battle/effects/requested-card-runtime.js');
  expect(requestedBattleState().astrolabes[uid]).toBeUndefined();
  if (id === 'tt13-astrolabe') {
    R.G.ownedCards.push({uid:'capacity',card:canonical('tt8-hero-guardian')});
    R.set$turn(3);
    BattleSession.commands.playCard(uid, 'self'); await settle();
    expect(requestedBattleState().astrolabes[uid]).toEqual({ firstTurn: 3, turn: 3, triggered: false });
    expect(R.equipped).toHaveLength(3);
  }
});
