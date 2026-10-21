// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { createBattleEngineInstance } from '../game/src/battle/core/battle.engine.instance.js';
import { createBattleEngine } from '../game/src/battle/core/battle.engine.factory.js';

function harness({ seed = 123, damage = 3, energy = 4, presentation = {}, factory = createBattleEngineInstance } = {}) {
  const card = { id: 'independent-hit', name: '实例攻击', type: '武术', cost: 1, dmg: damage,
    dmgType: 'fixed', desc: '只作展示', rules: { version: 1,
      battle: { target: { side: 'enemy', area: false } },
      triggers: { onPlay: [{ op: 'damage', amountField: 'dmg', target: 'chosenEnemy' }] } } };
  const sha = { ...card, id: 'starter-attack', name: '初始攻击', cost: 0 };
  const cards = { all: () => [card, sha], deriveDraw: () => 0, deriveInfuse: () => 0,
    isRandomObtainable: () => true, sellPrice: () => 1, randomClassCard: () => card,
    SHA: sha, TABLETOP10: [], DMG_TYPES: ['武术', '法术'], DMG_TYPE_META: { fixed: { name: '固定' } } };
  const rules = { battleEnergy: energy, battleHandMax: 9, bossDeckSize: 15,
    starterSha: 0, battleStartDraw: 2, battleTurnDraw: 1, diceSides: 6 };
  const ended = [];
  const makeGame = () => ({ ownedCards: [{ uid: 'same-uid', card }], hp: 20, maxHp: 20,
    atk: 1, spellPower: 0, coins: 0, state: 'idle', battleActive: false,
    log() {}, heal(n) { this.hp = Math.min(this.maxHp, this.hp + n); }, addItem() {},
    onBattleEnd(...args) { ended.push(args); } });
  const engine = factory({ cards, readRules: () => rules, seed, sound() {}, evaluateRunes: () => ({}),
    presentation: { demoMs: () => 0, waitMs: async () => {}, ...presentation }, testMode: true });
  const game = makeGame();
  const start = target => engine.start(target, [{ id: 'same-foe', name: '实例敌人', hp: 30, atk: 1 }], { isBoss: false });
  start(game);
  return { engine, game, ended, start, makeGame, card };
}

async function settled(engine, predicate = state => !state.busy && state.phase === 'player') {
  for (let attempt = 0; attempt < 100; attempt++) {
    await engine.idle();
    await new Promise(resolve => setTimeout(resolve, 0));
    const snapshot = engine.getSnapshot();
    if (predicate(snapshot)) return snapshot;
  }
  throw new Error('Independent battle did not settle');
}

function holdPresentation() {
  let release;
  let observed;
  const gate = new Promise(resolve => { release = resolve; });
  return {
    get signal() { return observed; }, release,
    waitMs(_ms, signal) {
      observed = signal;
      return new Promise((resolve, reject) => {
        const cancel = () => { signal.removeEventListener('abort', cancel); reject(signal.reason); };
        signal.addEventListener('abort', cancel, { once: true });
        gate.then(() => { signal.removeEventListener('abort', cancel); resolve(); });
        if (signal.aborted) cancel();
      });
    },
  };
}

describe('independent battle instances in Node', () => {
  it('imports and runs actual start, queued play, enemy turn and finish without browser globals', async () => {
    expect(typeof globalThis.window).toBe('undefined');
    expect(typeof globalThis.document).toBe('undefined');
    const { engine, game, ended } = harness({ factory: createBattleEngine });
    expect(engine.runtime.drawPile).toHaveLength(99);
    expect(engine.submitCardPlay('same-uid', 0).status).toBe('queued');
    expect((await settled(engine)).foes[0].hp).toBe(27);
    engine.endTurn();
    const turn = await settled(engine, state => state.turn === 2 && !state.busy);
    expect(turn.energy).toBe(4);
    expect(game.hp).toBe(19);
    expect(engine.runtime.G).toBe(game);
    engine.flee();
    await engine.idle();
    expect(game.battleActive).toBe(false);
    expect(ended).toHaveLength(1);
  });

  it('keeps identical UIDs, cards, rules, random streams and hooks local under interleaved turns', async () => {
    const a = harness({ damage: 3, energy: 4 });
    const b = harness({ damage: 7, energy: 8 });
    expect(a.engine.runtime).not.toBe(b.engine.runtime);
    expect(a.engine.runtime.combat.COMBAT_HOOKS).not.toBe(b.engine.runtime.combat.COMBAT_HOOKS);
    const randomBefore = a.engine.random.snapshot();
    b.engine.random.random('battle');
    expect(a.engine.random.snapshot()).toEqual(randomBefore);
    a.engine.submitCardPlay('same-uid', 0);
    b.engine.submitCardPlay('same-uid', 0);
    const [sa, sb] = await Promise.all([settled(a.engine), settled(b.engine)]);
    expect([sa.foes[0].hp, sb.foes[0].hp]).toEqual([27, 23]);
    expect([sa.energy, sb.energy]).toEqual([3, 7]);
    expect(a.engine.runtime.played).toEqual(['same-uid']);
    expect(b.engine.runtime.played).toEqual(['same-uid']);
    const ruleCard = { id: 'only-a-rule', name: '仅甲实例持续规则', type: '法术', cost: 0, desc: '',
      rules: { version: 1, battle: { target: { side: 'self', area: false } },
        triggers: { onPlay: [], onTurnStart: [{ op: 'energy', n: 2 }] } } };
    a.engine.runtime.granted.push({ uid: 'rule-a', card: ruleCard });
    a.engine.runtime.hand.push('rule-a');
    a.engine.submitCardPlay('rule-a', 'self');
    await settled(a.engine);
    a.engine.endTurn();
    const nextA = await settled(a.engine, state => state.turn === 2 && !state.busy);
    expect(nextA.energy).toBe(6);
    expect(b.engine.getSnapshot().turn).toBe(1);
    expect(b.game.hp).toBe(20);
    b.engine.endTurn();
    const nextB = await settled(b.engine, state => state.turn === 2 && !state.busy);
    expect(nextB.energy).toBe(8);
    expect(a.game.hp).toBe(19);
    a.engine.flee(); b.engine.flee();
    await Promise.all([a.engine.idle(), b.engine.idle()]);
  });

  it.each(['preparation', 'windup'])('cancels a paused %s instance and starts its next battle while another async action stays valid', async boundary => {
    const pa = holdPresentation(), pb = holdPresentation();
    const a = harness({ presentation: boundary === 'windup' ? { waitMs: pa.waitMs } : {} });
    const b = harness({ damage: 7, presentation: boundary === 'windup' ? { waitMs: pb.waitMs } : {} });
    if (boundary === 'preparation') {
      // Exercise the actual action runner's renderer readiness Promise before
      // payment. Waiting for a later windup has already committed that payment.
      for (const [engine, gate] of [[a.engine, pa], [b.engine, pb]]) {
        engine.runtime.bindBattleRenderer(() => {
          const signal = engine.runtime.activeActionSignal;
          if (signal) return gate.waitMs(0, signal);
        });
      }
    }
    const submittedA = a.engine.submitCardPlay('same-uid', 0);
    const submittedB = b.engine.submitCardPlay('same-uid', 0);
    for (let attempt = 0; attempt < 20 && (!pa.signal || !pb.signal); attempt++) await Promise.resolve();
    expect(pa.signal).toBeDefined(); expect(pb.signal).toBeDefined();
    expect(pa.signal).not.toBe(pb.signal);
    expect([a.engine.getSnapshot().energy, b.engine.getSnapshot().energy]).toEqual(boundary === 'preparation' ? [4, 4] : [3, 3]);
    expect([a.engine.getSnapshot().foes[0].hp, b.engine.getSnapshot().foes[0].hp]).toEqual([30, 30]);
    a.engine.flee();
    const nextGame = a.makeGame();
    a.start(nextGame);
    expect(pa.signal.aborted).toBe(true);
    expect(pb.signal.aborted).toBe(false);
    pb.release(); pa.release();
    const other = await settled(b.engine);
    expect(await submittedA.settled).toMatchObject({ status: boundary === 'preparation' ? 'cancelled' : 'committed', receipt: submittedA.receipt });
    expect(await submittedB.settled).toMatchObject({ status: 'committed', receipt: submittedB.receipt });
    await a.engine.idle();
    expect(other.foes[0].hp).toBe(23);
    expect(a.engine.getSnapshot().foes[0].hp).toBe(30);
    expect(a.engine.getSnapshot().hand).toContain('same-uid');
    expect(a.engine.runtime.activeActionSignal).toBeNull();
    expect(b.game.battleActive).toBe(true);
    a.engine.flee(); b.engine.flee();
    await Promise.all([a.engine.idle(), b.engine.idle()]);
  });
});
