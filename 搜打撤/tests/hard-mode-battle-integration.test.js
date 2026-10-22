// Regression coverage for elite-mode 1.35 scaling through real battle session flows.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import mapData from '../game/data/map.json';

const H = vi.hoisted(() => ({ game:{ mode:'elite' }, MAP:{
  rules:{ fireHeal:10, battleEnergy:2, battleHandMax:8, bossDeckSize:15,
    starterSha:5, battleStartDraw:5, battleTurnDraw:1, diceSides:6 }, items:{},
} }));
// The actual scaler is not mocked; only its session-state dependency is isolated.
vi.mock('../game/src/run/game.session.kernel.js', () => ({ game:H.game, MAP:H.MAP }));
window.SDT = { Icons:{ img:() => '', TYPE_ART:{} },
  Sound:{ music(){}, sfx(){}, setDucked(){}, setBoss(){} }, MAP:H.MAP,
  Meta:{ setXpMul(){} },
};
await import('../game/src/cards/cards.js');
window.SDT.Cards.ensureSha();
window.SDT.Cards.ensureStarters();
const { scaledEnemy } = await import('../game/src/run/game.session.modes.js');
const { BattleSession } = await import('../game/src/battle/core/battle.core.js');
const runtime = await import('../game/src/battle/runtime/battle.runtime.js');
const { forecastEnemyTurn } = await import('../game/src/battle/view/battle.turn-forecast.js');
const { Random } = await import('../game/src/core/random.js');
const json = value => JSON.parse(JSON.stringify(value));
let game;

function start(mode, defs, options = {}) {
  H.game.mode = mode;
  game = { mode, ownedCards:[], inventory:[], usedPocket:[], cardOrder:[], eventLog:[],
    hp:200, maxHp:200, atk:4, spellPower:0, coins:8, turn:1,
    state:'idle', battleActive:false, myClass:null, characterId:null,
    log(message) { this.eventLog.push(String(message)); },
    heal(n) { this.hp = Math.min(this.maxHp, this.hp + n); }, addItem(){}, onBattleEnd(){},
  };
  BattleSession.start(game, defs, { isBoss:false, ...options });
  if (BattleSession.getSnapshot().deckSelection) BattleSession.commands.confirmDeck();
  expect(BattleSession.getSnapshot().phase).toBe('player');
}
async function until(predicate, message) {
  for (let i = 0; i < 1000; i++) {
    await new Promise(resolve => setTimeout(resolve, 2));
    const snapshot = BattleSession.getSnapshot();
    if (predicate(snapshot)) return snapshot;
  }
  throw new Error(message);
}
async function endActualTurn() {
  const turn = BattleSession.getSnapshot().turn;
  BattleSession.commands.endTurn();
  return until(snapshot => !snapshot.busy && snapshot.phase === 'player' && snapshot.turn === turn + 1,
    'real enemy phase did not settle at the next player turn');
}
const foeStats = () => BattleSession.getSnapshot().foes.map(({ id, hp, maxHp, atk }) => ({ id, hp, maxHp, atk }));
const curseStacks = () => {
  const status = BattleSession.getSnapshot().pstat.status;
  return (status.bleed || 0) + (status.poison || 0);
};
beforeEach(() => { Random.reseed('hard-mode-battle-v2'); H.game.mode = 'elite'; });
afterEach(() => { if (game?.battleActive) BattleSession.commands.flee(); });

// Run callers supply already-scaled defs. Battle entry must never apply mode a second time.
describe('real scaler to public battle entry', () => {
  it.each([
    ['standard',4,4,3,3], ['elite',5,5,4,4],
  ])('%s preserves exact input stats through entry and checkpoint', (mode, aAtk, aHp, bAtk, bHp) => {
    H.game.mode = mode;
    const bases = [Object.freeze({ ...mapData.monsters.infantry }), Object.freeze({ ...mapData.monsters.bandit })];
    const before = json(bases);
    const defs = bases.map(scaledEnemy);
    expect(defs.map(({ atk, hp }) => ({ atk, hp }))).toEqual([{ atk:aAtk, hp:aHp }, { atk:bAtk, hp:bHp }]);
    start(mode, defs);
    expect(foeStats()).toEqual([
      { id:'infantry', hp:aHp, maxHp:aHp, atk:aAtk }, { id:'bandit', hp:bHp, maxHp:bHp, atk:bAtk },
    ]);
    expect(BattleSession.serialize().enemyDefs).toEqual(defs);
    expect(bases).toEqual(before);
    expect(defs.map(({ atk, hp }) => ({ atk, hp }))).toEqual([{ atk:aAtk, hp:aHp }, { atk:bAtk, hp:bHp }]);
  });

  it('keeps rounded-zero ATK in saved defs but the existing atk || 2 fallback in live combat', () => {
    const base = Object.freeze({ id:'tiny', name:'边界样本', hp:10, atk:0.1, behavior:'strike' });
    const def = scaledEnemy(base);
    expect(def).toMatchObject({ hp:14, atk:0 });
    start('elite', [def]);
    const saved = json(BattleSession.serialize());
    expect(saved.enemyDefs[0]).toMatchObject({ hp:14, atk:0 });
    expect(foeStats()).toEqual([{ id:'tiny', hp:14, maxHp:14, atk:2 }]);
    for (let i = 0; i < 3; i++) {
      expect(BattleSession.restore(game, json(saved))).toBe(true);
      expect(foeStats()).toEqual([{ id:'tiny', hp:14, maxHp:14, atk:2 }]);
      expect(BattleSession.serialize().enemyDefs).toEqual(saved.enemyDefs);
    }
    expect(base).toEqual({ id:'tiny', name:'边界样本', hp:10, atk:0.1, behavior:'strike' });
  });
});

describe('JSON checkpoint restoration does not retroactively rescale enemyDefs', () => {
  it.each([
    ['old-hard','elite',75,8], ['new-hard','elite',68,7], ['normal','standard',50,5],
  ])('%s preserves literal HP/maxHP/ATK on repeated public restore', async (kind, mode, hp, atk) => {
    H.game.mode = mode;
    const base = Object.freeze({ ...mapData.altar.bosses.find(foe => foe.id === 'boss_general'), boss:true });
    // Historical saves already contain the old rounded stats; do not run them through today's scaler.
    const def = kind === 'old-hard' ? { ...base, hp:75, atk:8 } : scaledEnemy(base);
    expect(def).toMatchObject({ hp, atk });
    start(mode, [def], { isBoss:true, name:base.name });
    const saved = json(BattleSession.serialize());
    expect(saved).toMatchObject({ restartVersion:1, enemyDefs:[{ id:'boss_general', hp, atk }], selectedDeck:[] });
    const expectedDefs = json(saved.enemyDefs);
    for (let i = 0; i < 3; i++) {
      // Perturb HP through a real played starter, then ATK through the real +2 grow end-turn rule.
      const beforePlay = BattleSession.getSnapshot();
      expect(beforePlay.hand.length).toBeGreaterThan(0);
      BattleSession.commands.playCard(beforePlay.hand[0], 0);
      await until(s => !s.busy && !s.actionQueueLength && s.foes[0].hp < hp, 'starter attack did not damage the boss');
      await endActualTurn();
      expect(BattleSession.getSnapshot().foes[0].atk).toBe(atk + 2);
      expect(game.hp).toBeLessThan(200);
      // A restore is governed by saved defs even if current configuration is changed between calls.
      H.game.mode = game.mode = i % 2 ? 'standard' : 'elite';
      expect(BattleSession.restore(game, json(saved))).toBe(true);
      expect(foeStats()).toEqual([{ id:'boss_general', hp, maxHp:hp, atk }]);
      expect(BattleSession.getSnapshot().turn).toBe(1);
      expect(game.hp).toBe(200);
      expect(BattleSession.serialize().enemyDefs).toEqual(expectedDefs);
      expect(saved.enemyDefs).toEqual(expectedDefs);
    }
  });
});

describe('intent, forecast and real damage use the same scaled attack', () => {
  it.each([
    ['standard',0,4], ['elite',0,5], ['standard',2,4], ['elite',2,5],
  ])('%s with armor %s uses attack %s once', async (mode, armor, atk) => {
    H.game.mode = mode;
    start(mode, [scaledEnemy(Object.freeze({ ...mapData.monsters.infantry }))]);
    // Fixture setup for a known defense state; the ensuing endTurn path is real.
    runtime.pdef.armor = armor;
    const before = BattleSession.getSnapshot(), untouched = JSON.stringify(before);
    expect(before.foes[0].intent).toMatchObject({ damage:atk, hits:1 });
    const forecast = forecastEnemyTurn(before);
    expect(forecast).toMatchObject({ damage:atk - armor, hpAfter:200 - atk + armor, lethal:false });
    expect(JSON.stringify(before)).toBe(untouched);
    await endActualTurn();
    expect(game.hp).toBe(forecast.hpAfter);
    expect(BattleSession.getSnapshot().pdef.armor).toBe(0);
  });

  it.each([['standard',5], ['elite',7]])('%s boss growth stays +2, not multiplied with base ATK', async (mode, atk) => {
    H.game.mode = mode;
    start(mode, [scaledEnemy(Object.freeze({ ...mapData.altar.bosses[0] }))], { isBoss:true });
    for (let round = 0; round < 2; round++) {
      const before = BattleSession.getSnapshot();
      expect(before.foes[0].atk).toBe(atk + round * 2);
      expect(before.foes[0].intent.damage).toBe(atk + round * 2);
      const forecast = forecastEnemyTurn(before);
      expect(forecast.damage).toBe(atk + round * 2);
      await endActualTurn();
      expect(game.hp).toBe(forecast.hpAfter);
      expect(BattleSession.getSnapshot().foes[0].atk).toBe(atk + (round + 1) * 2);
    }
  });
});

describe('fixed status magnitudes remain conditional on actual damage', () => {
  it.each(['standard','elite'])('%s curse attack still applies exactly one stack', async mode => {
    H.game.mode = mode;
    start(mode, [scaledEnemy(Object.freeze({ ...mapData.monsters.grass_el }))]);
    await endActualTurn();
    expect(curseStacks()).toBe(1);
  });
  it.each(['standard','elite'])('%s frenzy retains two attacks and one stack per successful hit', async mode => {
    H.game.mode = mode;
    start(mode, [scaledEnemy(Object.freeze({ ...mapData.altar.bosses.find(foe => foe.id === 'boss_orc') }))], { isBoss:true });
    expect(BattleSession.getSnapshot().foes[0].intent.hits).toBe(2);
    await endActualTurn();
    expect(curseStacks()).toBe(2);
    // Random first-hit bleed may raise second-hit damage, so do not equate the entire outcome to a static forecast.
  });
  it.each([['standard',5], ['elite',7]])('%s fully absorbed %s-ATK curse attack grants no stack', async (mode, atk) => {
    H.game.mode = mode;
    start(mode, [scaledEnemy(Object.freeze({ ...mapData.monsters.grass_el }))]);
    expect(BattleSession.getSnapshot().foes[0].atk).toBe(atk);
    runtime.pdef.armor = atk;
    await endActualTurn();
    expect(game.hp).toBe(200);
    expect(curseStacks()).toBe(0);
  });
});
