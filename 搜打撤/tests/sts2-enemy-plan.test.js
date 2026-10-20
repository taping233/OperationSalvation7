import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildEnemyActionPlan } from '../game/src/battle/core/battle.enemy-plan.js';
import { calculateEnemyIntent } from '../game/src/battle/core/battle.enemy-intent.js';
import { forecastEnemyTurn } from '../game/src/battle/view/battle.turn-forecast.js';
import { readBattleSummary } from '../game/src/battle/core/battle.summary.js';

window.SDT ||= { Icons: { img: () => '', TYPE_ART: {} } };
window.SDT.Sound = { music() {}, sfx() {}, setDucked() {}, setBoss() {} };
window.SDT.MAP = { rules: { battleEnergy: 3, battleHandMax: 30, bossDeckSize: 15,
  starterSha: 0, battleStartDraw: 3, battleTurnDraw: 1, diceSides: 6 }, items: {} };
await import('../game/src/cards/cards.js');
const Cards = window.SDT.Cards;
Cards.ensureSha(); Cards.ensureStarters(); Cards.ensureDmgTypes(); Cards.ensureEffectFields();
const { BattleSession, configureBattleRenderer } = await import('../game/src/battle/core/battle.core.js');
const R = await import('../game/src/battle/runtime/battle.runtime.js');
const { Random } = await import('../game/src/core/random.js');

const FOE_NAME = '敌方计划目标';
let game;

beforeEach(() => {
  vi.useFakeTimers();
  configureBattleRenderer(() => {});
  Random.reseed('enemy-plan-integration');
});

afterEach(() => {
  if (game?.battleActive) BattleSession.commands.flee();
  configureBattleRenderer(null);
  vi.clearAllTimers();
  vi.useRealTimers();
});

function begin(overrides = {}) {
  game = { hp: 1000, maxHp: 1000, atk: 1, spellPower: 0, coins: 0,
    myClass: '战士', state: 'idle', battleActive: false, inventory: [], usedPocket: [],
    ownedCards: [{ uid: 'held', card: { id: 'plan-held', name: '不打出的随身牌', type: '武术', cost: 99, desc: '' } }],
    logs: [], log(message) { this.logs.push(message); },
    heal(amount) { this.hp = Math.min(this.maxHp, this.hp + amount); }, onBattleEnd() {},
  };
  BattleSession.start(game, [{ id: 'plan-target', name: FOE_NAME, hp: 999, atk: 4, ...overrides }], { isBoss: false });
  // Real curse admission remains active; this flag keeps frenzy's random curses out of the fixed-damage fixture.
  R.set$playerCurseImmune(true);
  expect(BattleSession.getSnapshot().phase).toBe('player');
  expect(BattleSession.getSnapshot().drawPile).toHaveLength(99);
}

async function verifyNextTurn(expectedHits) {
  const snapshot = BattleSession.getSnapshot(), foe = snapshot.foes[0];
  const beforeHp = game.hp, round = snapshot.turn;
  const beforeHits = readBattleSummary(round, R.foes).damageTaken.length;
  const plan = buildEnemyActionPlan(foe, round);
  // The fighter view computes a fresh intent from current status; snapshot.foes[].intent is a cached compatibility field.
  const intent = calculateEnemyIntent(foe, round, snapshot.pstat.status);
  const forecast = forecastEnemyTurn(snapshot);
  expect(plan.canAttack ? plan.hits : 0).toBe(expectedHits);
  expect(intent.damage == null ? 0 : intent.hits).toBe(expectedHits);
  expect(forecast.damage).toBe(expectedHits * 4);

  BattleSession.commands.endTurn();
  await vi.advanceTimersByTimeAsync(1000);

  expect(R.busy).toBe(false);
  expect(R.turn).toBe(round + 1);
  const actual = readBattleSummary(R.turn, R.foes).damageTaken.slice(beforeHits);
  expect(actual).toHaveLength(expectedHits);
  expect(actual.every(hit => hit.source === FOE_NAME && hit.round === round && hit.damage === 4)).toBe(true);
  expect(beforeHp - game.hp).toBe(forecast.damage);
  expect(game.hp).toBe(forecast.hpAfter);
  expect(R.pstat.status.bleed || 0).toBe(0);
  expect(R.pstat.status.poison || 0).toBe(0);
  expect(BattleSession.getSnapshot().drawPile).toHaveLength(99);
  return { plan, intent, forecast };
}

describe('enemy plan, displayed intent, forecast and the real enemy phase', () => {
  it('ordinary attacks forecast and execute one hit without drawing the normal 99-card deck', async () => {
    begin();
    await verifyNextTurn(1);
  });

  it('evenAttack skips odd rounds and attacks on the even round', async () => {
    begin({ evenAttack: true });
    expect((await verifyNextTurn(0)).plan.skip).toBe('oddRound');
    await verifyNextTurn(1);
    expect((await verifyNextTurn(0)).plan.skip).toBe('oddRound');
  });

  it('noFirstAttack charges once and attacks from round two', async () => {
    begin({ noFirstAttack: true });
    expect((await verifyNextTurn(0)).plan.skip).toBe('firstRound');
    await verifyNextTurn(1);
  });

  it('the frenzy affix forecasts and executes two separate hits', async () => {
    begin({ affix: 'frenzy' });
    const { plan, intent } = await verifyNextTurn(2);
    expect(plan.hits).toBe(2);
    expect(intent.label).toContain('双击');
  });

  it('stunned skips one action, clears itself and resumes on the next round', async () => {
    begin();
    R.foes[0].stunned = true;
    expect((await verifyNextTurn(0)).plan.skip).toBe('stunned');
    expect(R.foes[0].stunned).toBe(false);
    await verifyNextTurn(1);
  });

  it('a freeze applied during the player turn is reflected by fresh intent and forecast, then expires normally', async () => {
    begin();
    R.foes[0].status.freeze = 1;
    const { plan, intent } = await verifyNextTurn(0);
    expect(plan.skip).toBe('frozen');
    expect(intent.label).toContain('冰冻');
    expect(R.foes[0].status.freeze).toBe(0);
    await verifyNextTurn(1);
  });

  it('orc_boss behavior without the frenzy affix displays and executes one hit', async () => {
    begin({ behavior: 'orc_boss' });
    const { plan, intent } = await verifyNextTurn(1);
    expect(plan.kind).toBe('orc_boss');
    expect(intent.label).toBe('攻击');
    expect(intent.hits).toBe(1);
  });

  it('plan, fresh intent and forecast queries leave the real battle and random streams unchanged', () => {
    begin({ affix: 'frenzy' });
    R.foes[0].status.freeze = 2;
    const snapshot = BattleSession.getSnapshot(), state = BattleSession.getReplayState(), rng = Random.snapshot();
    expect(buildEnemyActionPlan(snapshot.foes[0], snapshot.turn).canAttack).toBe(false);
    expect(calculateEnemyIntent(snapshot.foes[0], snapshot.turn, snapshot.pstat.status).damage).toBeNull();
    expect(forecastEnemyTurn(snapshot).damage).toBe(0);
    expect(BattleSession.getReplayState()).toEqual(state);
    expect(Random.snapshot()).toEqual(rng);
    expect(R.foes[0].status.freeze).toBe(2);
  });
});
