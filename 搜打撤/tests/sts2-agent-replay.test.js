import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const fixture = vi.hoisted(() => ({ game: {} }));
vi.mock('../game/src/run/game.session.js', () => ({
  game: fixture.game, getActiveSlot: () => null, startNewGame() {},
  curLayer: () => null, bagCap: () => 30, usedSlots: () => fixture.game.ownedCards?.length || 0,
}));
vi.mock('../game/src/run/game.run.flow.js', () => ({ moveTo: () => false, reenterCell: () => false }));

window.SDT = { Icons: { img: () => '', TYPE_ART: {} },
  Sound: { music() {}, sfx() {}, setDucked() {}, setBoss() {} },
  UI: { _acts: {}, log() {} },
  MAP: { rules: { battleEnergy: 3, battleHandMax: 30, bossDeckSize: 15, starterSha: 0,
    battleStartDraw: 3, battleTurnDraw: 1, diceSides: 6 }, items: {} } };
await import('../game/src/cards/cards.js');
const { BattleSession, configureBattleRenderer } = await import('../game/src/battle/core/battle.core.js');
const { Random } = await import('../game/src/core/random.js');
const piles = await import('../game/src/battle/runtime/battle.runtime.piles.js');
const { setTurbo } = await import('../game/src/core/turbo.js');
await import('../game/src/agent/agent.js');
const { bustSigCache } = await import('../game/src/agent/agent.state.js');
const Agent = window.SDT.Agent;
const fingerprint = { version: 'replay-integration-v1', code: 'explicit-test-rules-fixture' };
const descriptor = { id: 'two-target-battle-v1', params: { seed: 72831, enemyHp: 80 } };
const stepOptions = { allowEmpty: true, quietMs: 1, timeoutMs: 1000, commandTimeoutMs: 1000 };
const command = (name, ...args) => ({ type: 'battle', name, args });
const jsonCopy = value => JSON.parse(JSON.stringify(value));

async function prepare(data = descriptor) {
  if (data.id !== descriptor.id) throw new Error('Unknown local fixture');
  const card = window.SDT.Cards.all().find(entry => entry.id === 'starter-attack');
  if (!card) throw new Error('Missing actual starter attack');
  Object.keys(fixture.game).forEach(key => { delete fixture.game[key]; });
  Object.assign(fixture.game, { runActive: true, nestActive: false, battleActive: false, state: 'idle',
    discoveredPairs: new Set(), nestRunes: [], turn: 1, mode: 'standard', mapSeed: data.params.seed,
    hp: 100, maxHp: 100, atk: 5, spellPower: 0, coins: 0, myClass: '战士',
    inventory: [], usedPocket: [], cardOrder: ['hit-a', 'hit-b', 'hit-c'],
    ownedCards: ['hit-a', 'hit-b', 'hit-c'].map(uid => ({ uid, card: { ...card }, safe: false })),
    log() {}, heal(amount) { this.hp = Math.min(this.maxHp, this.hp + amount); },
    onBattleEnd() {},
  });
  window.SDT.game = fixture.game;
  window.SDT.Battle = BattleSession;
  Random.reseed(data.params.seed);
  BattleSession.start(fixture.game, [0, 1].map(i => ({ id: `foe-${i}`, name: `目标${i}`,
    hp: data.params.enemyHp, atk: 3, behavior: 'strike' })), { isBoss: false, name: '真实命令重放' });
  // Production starter UIDs contain the live battle token, intentionally separating sessions.
  // This trusted fixture explicitly rebuilds all 99 entities with its own stable physical IDs;
  // replay still compares every UID and complete pile contents without normalization or omissions.
  const stableUids = new Map(piles.granted.filter(entry => entry.uid.startsWith('normal-sha-'))
    .map((entry, index) => [entry.uid, `normal-sha-fixture-${data.params.seed}-${index}`]));
  piles.restoreBattlePiles({
    hand: piles.hand,
    drawPile: piles.drawPile.map(uid => stableUids.get(uid) || uid),
    discard: piles.discard, grave: piles.grave, played: piles.played, consumed: piles.consumed,
    granted: piles.granted.map(entry => ({ ...entry, uid: stableUids.get(entry.uid) || entry.uid })),
  });
  bustSigCache();
  const settled = await Agent.waitSettle(stepOptions);
  expect(settled.ok).toBe(true);
}

beforeEach(async () => {
  document.body.innerHTML = '<div id="overlay" hidden><h2 id="ovTitle"></h2><div id="ovBody"></div></div>';
  setTurbo(true);
  configureBattleRenderer(() => {});
  window.SDT.Cards.ensureSha(); window.SDT.Cards.ensureStarters();
  window.SDT.Cards.ensureDmgTypes(); window.SDT.Cards.ensureEffectFields();
  await prepare();
});

afterEach(async () => {
  if (fixture.game.battleActive) BattleSession.commands.flee();
  configureBattleRenderer(null);
  vi.restoreAllMocks();
});

async function record({ policyRandom = false } = {}) {
  const actions = [command('playCard', 'hit-a'), command('playCard', 'hit-a', 0), command('endTurn')];
  let index = 0;
  const captured = await Agent.replay.capture({ fixture: descriptor, fingerprint, prepare, stepOptions,
    maxCommands: actions.length, decide: () => {
      if (policyRandom) Random.random('agent-policy');
      return actions[index++];
    } });
  expect(captured.ok, JSON.stringify(captured).slice(0, 500)).toBe(true);
  expect(captured.packet.commands).toHaveLength(3);
  return jsonCopy(captured.packet);
}

describe('battle-entry replay through the real Agent and BattleSession commands', () => {
  it('rebuilds the fixture with 99 stable unique physical starter IDs and matching granted sources', async () => {
    const first = BattleSession.getSnapshot();
    await prepare();
    const second = BattleSession.getSnapshot();
    expect(second.battleToken).not.toBe(first.battleToken);
    expect(first.drawPile).toHaveLength(99);
    expect(new Set(first.drawPile).size).toBe(99);
    expect(second.drawPile).toEqual(first.drawPile);
    expect(second.drawPile.every(uid => piles.granted.some(entry => entry.uid === uid))).toBe(true);
    expect(fixture.game.ownedCards.map(entry => entry.uid)).toEqual(['hit-a', 'hit-b', 'hit-c']);
  });

  it('records target selection and an enemy turn, then replays recorded commands without rerunning a policy', async () => {
    const packet = await record({ policyRandom: true });
    expect(packet.checkpoint.restartVersion).toBe(1);
    expect(packet.commands[0].after.battle.pendingTarget.uid).toBe('hit-a');
    expect(packet.commands[1].after.battle.foes[0].hp).toBeLessThan(80);
    expect(packet.commands[2].after.battle.turn).toBe(2);
    expect(packet.commands[2].after.battle.pstat).toBeTruthy();
    expect(packet.commands[2].after.rng.streams).toBeTruthy();
    const outcome = await Agent.replay.play(packet, { prepare, fingerprint, stepOptions });
    expect(outcome, JSON.stringify(outcome)).toMatchObject({ ok: true, executed: 3 });
    expect(BattleSession.getSnapshot().turn).toBe(2);
  });

  it('stops on the changed target at command 1 and never executes the next endTurn', async () => {
    const packet = await record();
    packet.commands[1].action.args[1] = 1;
    const outcome = await Agent.replay.play(packet, { prepare, fingerprint, stepOptions });
    expect(outcome).toMatchObject({ ok: false, code: 'REPLAY_DIVERGED', executed: 2, index: 1, stage: 'after' });
    expect(outcome.difference.path).toContain('foes.0.hp');
    expect(BattleSession.getSnapshot().turn).toBe(1);
    expect(BattleSession.getSnapshot().foes[1].hp).toBeLessThan(80);
  });

  it('validates deep initial status and ordered piles before any recorded command', async () => {
    const packet = await record();
    packet.initial.battle.drawPile.push('unrecorded-hidden-card');
    const outcome = await Agent.replay.play(packet, { prepare, fingerprint, stepOptions });
    expect(outcome).toMatchObject({ ok: false, code: 'REPLAY_DIVERGED', executed: 0, index: -1, stage: 'initial' });
    expect(outcome.difference.path).toContain('battle.drawPile');
  });

  it('rejects a different code fingerprint before preparing or executing the fixture', async () => {
    const packet = await record(), adapter = vi.fn(prepare);
    const outcome = await Agent.replay.play(packet, { prepare: adapter,
      fingerprint: { ...fingerprint, code: 'other-runtime' }, stepOptions });
    expect(outcome).toMatchObject({ ok: false, code: 'REPLAY_FINGERPRINT_MISMATCH', executed: 0 });
    expect(adapter).not.toHaveBeenCalled();
  });

  it('refuses decisions that advance a gameplay random stream before dispatch', async () => {
    const hp = BattleSession.getSnapshot().foes[0].hp;
    const captured = await Agent.replay.capture({ fixture: descriptor, fingerprint, prepare, stepOptions,
      decide: () => { Random.random('combat'); return command('playCard', 'hit-a', 0); } });
    expect(captured).toMatchObject({ ok: false, code: 'CAPTURE_STOPPED', packet: { replayable: false } });
    expect(captured.result.error).toContain('rng.streams.combat');
    expect(BattleSession.getSnapshot().foes[0].hp).toBe(hp);
  });

  it('rejects mid-battle recovery claims and executable fixture data', async () => {
    const packet = await record();
    expect(await Agent.replay.capture({ fixture: descriptor, fingerprint, decide: () => null, stepOptions }))
      .toMatchObject({ ok: false, code: 'CAPTURE_OPTIONS_INVALID' });
    await prepare();
    const captured = await Agent.replay.capture({ fixture: { id: 'script', params: { run: () => {} } },
      fingerprint, decide: () => null, stepOptions });
    expect(captured).toMatchObject({ ok: false, code: 'CAPTURE_INVALID' });
    expect(packet.fingerprint.source).toBe('caller-provided');
  });

  it('requires explicit fixture rebuilding after an action in the first turn', async () => {
    await Agent.step(() => command('playCard', 'hit-a', 0), stepOptions);
    expect(BattleSession.getSnapshot().turn).toBe(1);
    expect(BattleSession.getSnapshot().foes[0].hp).toBeLessThan(80);
    expect(await Agent.replay.capture({ fixture: descriptor, fingerprint, decide: () => null, stepOptions }))
      .toMatchObject({ ok: false, code: 'CAPTURE_OPTIONS_INVALID' });
    const rebuilt = await Agent.replay.capture({ fixture: descriptor, fingerprint, prepare,
      decide: () => null, stepOptions });
    expect(rebuilt.ok).toBe(true);
    expect(rebuilt.packet.initial.battle.foes[0].hp).toBe(80);
    expect(rebuilt.packet.boundary).toBe('trusted-fixture-battle-entry');
  });

  it('detects hidden free-cast rules before the first replay command', async () => {
    const packet = await record();
    const runtime = await import('../game/src/battle/runtime/battle.runtime.piles.js');
    const outcome = await Agent.replay.play(packet, { fingerprint, stepOptions,
      prepare: async data => { await prepare(data); runtime.freeCast.add('hit-a'); } });
    expect(outcome).toMatchObject({ ok: false, code: 'REPLAY_DIVERGED', executed: 0, stage: 'initial' });
    expect(outcome.difference.path).toContain('battleRules.piles.freeCast');
  });

  it('stops recording immediately on an ACTION_THREW receipt', async () => {
    let commands = 0;
    const captured = await Agent.replay.capture({ fixture: descriptor, fingerprint, stepOptions,
      prepare: async data => {
        await prepare(data);
        window.SDT.Battle = { ...BattleSession, commands: { ...BattleSession.commands,
          playCard() { throw new Error('injected command failure'); } } };
      },
      decide: () => commands++ === 0 ? command('playCard', 'hit-a', 0) : command('endTurn'),
    });
    expect(captured).toMatchObject({ ok: false, code: 'CAPTURE_STOPPED', packet: { replayable: false } });
    expect(captured.packet.commands).toHaveLength(1);
    expect(captured.packet.commands[0].result.code).toBe('ACTION_THREW');
    expect(BattleSession.getSnapshot().turn).toBe(1);
    expect(commands).toBe(1);
  });

  it('returns detached immutable diagnostic rules without exposing mutable runtime maps', async () => {
    const runtime = await import('../game/src/battle/runtime/battle.runtime.piles.js');
    const state = BattleSession.getReplayState();
    expect(Object.isFrozen(state.rules.piles.freeCast.setValues)).toBe(true);
    expect(() => state.rules.piles.freeCast.setValues.push('injected')).toThrow();
    runtime.freeCast.add('later');
    expect(state.rules.piles.freeCast.setValues).not.toContain('later');
    runtime.freeCast.delete('later');
  });

  it('does not invoke getters or prepare from an executable packet object', async () => {
    const getter = vi.fn(() => 'script'), adapter = vi.fn();
    const packet = Object.defineProperty({}, 'format', { enumerable: true, get: getter });
    const outcome = await Agent.replay.play(packet, { prepare: adapter, fingerprint, stepOptions });
    expect(outcome).toMatchObject({ ok: false, code: 'REPLAY_INVALID', executed: 0 });
    expect(getter).not.toHaveBeenCalled();
    expect(adapter).not.toHaveBeenCalled();
  });
});
