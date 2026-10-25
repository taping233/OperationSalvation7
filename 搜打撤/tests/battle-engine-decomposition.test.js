// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { createBattleDamage } from '../game/src/battle/core/battle.damage.js';
import { createBattleCardPlay } from '../game/src/battle/core/battle.card-play.js';
import { createBattleTurnStart } from '../game/src/battle/core/battle.turn-start.js';
import { createBattleTurnContinuation } from '../game/src/battle/core/battle.turn-continuation.js';
import { createBattleExecutionSession } from '../game/src/battle/runtime/battle.execution-session.js';
import { BATTLE_PHASES, createBattleState, transitionBattle } from '../game/src/battle/runtime/battle.state.js';

const playerState = () => transitionBattle(createBattleState(), BATTLE_PHASES.PLAYER);
function cardHarness(card) {
  const state = { G: { battleActive: true, log: vi.fn() }, battleState: playerState(),
    hand: ['main', 'fuel'], foes: [{ id: 'foe', hp: 5 }], equipped: [], energy: 2,
    freeCast: new Set(), mode: 'boss', interaction: null, infusing: null };
  const submitExecution = vi.fn(() => ({ status: 'accepted' }));
  const queueCardExecution = vi.fn();
  const ports = { readState: () => state, damageTypes: () => ['武术', '法术'], sound: vi.fn(),
    alive: () => state.foes.filter(f => !f.dead), findCard: uid => ({ uid, card }),
    findEffectiveCard: uid => ({ uid, card }), infuseOf: () => 1, effCostOf: () => 1,
    infusionFuelReason: () => null, equipCap: () => 3, hasPendingEndTurn: () => false,
    interactionOf: kind => state.interaction?.kind === kind ? state.interaction : null,
    cardIdentity: c => c.id, warnCardRuleRejection: vi.fn(), requestBattleRender: vi.fn(),
    requestedTargetReason: () => null, executeTargetReason: () => null,
    executionAvailability: () => null, submitExecution, queueCardExecution, resumeTurnEnd: vi.fn(),
    set$interaction: value => { state.interaction = value; },
    set$pendingHint: vi.fn(), set$battleState: value => { state.battleState = value; },
    set$infusing: value => { state.infusing = value; },
    clearTargetHint: () => { state.interaction = null; },
    cancelTargetingState: () => { state.battleState = transitionBattle(state.battleState, BATTLE_PHASES.PLAYER); },
  };
  return { state, ports, flow: createBattleCardPlay(ports), submitExecution, queueCardExecution };
}
function turnHarness(jobs = []) {
  const state = { G: { battleActive: true, hp: 10, log: vi.fn() }, battleState: playerState(),
    delayed: jobs, foes: [{ id: 'a' }], turn: 1, cardOverrides: new Map(),
    hand: [], drawPile: [], discard: [], grave: [], growth: {} };
  const ports = { throwIfActionCancelled: signal => signal?.throwIfAborted(), readState: () => state, alive: () => state.foes, foeIdx: () => 0,
    findCard: () => null, findEffectiveCard: () => null, fireTurnStart: vi.fn(),
    consumeHandUids: vi.fn(), resolveCardWithFeedback: vi.fn(), applyTextEffects: vi.fn(),
    runStagedSteps: async iterator => { for (const step of iterator) await step; },
    set$playerCurseImmune: vi.fn(), set$delayed: value => { state.delayed = value; } };
  return { state, ports };
}

describe('battle engine use-case ports in a browser-free runtime', () => {
  it('reads replacement live state and preserves selected fuel through target submission', () => {
    const card = { id: 'custom', name: '注能斩', type: '武术', cost: 1, desc: '造成 2 点伤害' };
    const { state, flow, submitExecution } = cardHarness(card);
    expect(flow.submitCardPlay('main').kind).toBe('infusion');
    flow.toggleInfusePick('fuel');
    expect(state.infusing.picked.has('fuel')).toBe(true);
    state.foes = [{ id: 'new-a' }, { id: 'new-b' }];
    flow.confirmInfuse();
    expect(state.interaction.fuelUids).toEqual(['fuel']);
    expect(flow.submitCardPlay('main', 1).status).toBe('accepted');
    expect(submitExecution).toHaveBeenCalledWith('main', card, ['fuel'], state.foes[1], false);
    expect(state.interaction).toBe(null);
  });

  it('cancels only the previous target session free-cast grant and resumes its owner', () => {
    const { state, ports, flow } = cardHarness({ id: 'c', name: 'c', type: '武术' });
    state.freeCast = new Set(['old', 'main']);
    flow.beginCardTargeting('old', {}, ['foe']);
    flow.beginCardTargeting('main', {}, ['foe']);
    expect([...state.freeCast]).toEqual(['main']);
    flow.cancelInteraction();
    expect(state.freeCast.size).toBe(0);
    expect(ports.resumeTurnEnd).toHaveBeenCalledTimes(1);
    expect(state.battleState.phase).toBe(BATTLE_PHASES.PLAYER);
  });

  it('commits newly scheduled work only to the next turn-start batch', async () => {
    const first = { text: 'first', cardName: 'x', repeat: true, left: 2 };
    const added = { text: 'later', cardName: 'x' };
    const { state, ports } = turnHarness([first]);
    ports.applyTextEffects = vi.fn(() => state.delayed.push(added));
    await createBattleTurnStart(ports).processDelayed();
    expect(ports.applyTextEffects).toHaveBeenCalledTimes(1);
    expect(state.delayed).toEqual([{ ...first, left: 1 }, added]);
  });

  it('retains unvisited jobs on cancellation and does not overwrite a replacement battle', async () => {
    const first = { text: 'first', cardName: 'x' };
    const second = { text: 'second', cardName: 'x' };
    const abort = new AbortController();
    const { state, ports } = turnHarness([first, second]);
    ports.applyTextEffects = vi.fn(() => abort.abort());
    const flow = createBattleTurnStart(ports);
    await expect(flow.processDelayed(abort.signal)).rejects.toBeTruthy();
    expect(state.delayed).toEqual([second]);
    const replacement = [{ text: 'new battle' }];
    ports.applyTextEffects = vi.fn(() => { state.battleState = { ...state.battleState, token: 'new' }; state.delayed = replacement; });
    await createBattleTurnStart(ports).processDelayed();
    expect(state.delayed).toBe(replacement);
  });

  it('accrues each uid once across all zones using current effective cards', () => {
    const { state, ports } = turnHarness();
    state.hand = ['a']; state.drawPile = ['b', 'a']; state.discard = ['c']; state.grave = ['d'];
    ports.findEffectiveCard = () => ({ card: { desc: '回合开始时，本牌伤害 +2' } });
    createBattleTurnStart(ports).accrueGrowth();
    expect(state.growth).toEqual({ a: 2, b: 2, c: 2, d: 2 });
  });

  it('deduplicates waiters and settles cancellation without transferring the replacement phase', async () => {
    const executionSession = createBattleExecutionSession();
    const state = { G: { battleActive: true }, battleState: playerState(), interaction: {}, discoverQueue: [] };
    const setState = vi.fn(value => { state.battleState = value; });
    const flow = createBattleTurnContinuation({ executionSession, readState: () => state,
      settlePendingSelections: vi.fn(), set$battleState: setState, set$busy: vi.fn(), requestBattleRender: vi.fn() });
    const pending = flow.awaitTriggeredActions();
    expect(flow.awaitTriggeredActions()).toBe(pending);
    await Promise.resolve();
    expect(flow.hasPendingEndTurn()).toBe(true);
    const replacement = { ...playerState(), token: 'new-token' };
    state.battleState = replacement;
    executionSession.reset();
    await pending;
    expect(state.battleState).toBe(replacement);
    expect(flow.hasPendingEndTurn()).toBe(false);
  });
});


describe('shared damage boundary ports', () => {
  function harness(foe) {
    const state = { G: { atk: 0, spellPower: 0, log: vi.fn() }, foes: [foe], turn: 2,
      pstat: { status: {} }, equipped: [], nestSyn: {}, floats: [] };
    const order = [];
    const flow = createBattleDamage({ readState: () => state, sound: vi.fn(), alive: () => state.foes,
      recordRequestedDamage: (target, dealt) => order.push(['record', target.hp, dealt]),
      resolveFoeDefeat: target => order.push(['defeat', target.hp]),
    });
    return { state, flow, order };
  }

  it('commits heart damage once, consumes actual defenses during conversion, and records before defeat', () => {
    const foe = { name: '心', hp: 4, maxHp: 4, heartsMode: true, status: {}, defense: { armor: 1 } };
    const { state, flow, order } = harness(foe);
    const card = { name: 'hit' };
    expect(flow.hitFoe(foe, card, 10, 'attack')).toBe(2);
    expect(foe.defense.armor).toBe(0);
    expect(order).toEqual([['record', 2, 2], ['defeat', 2]]);
    expect(state.floats[0]).toMatchObject({ text: '-2♥', hpBefore: 4, hpAfter: 2 });
  });

  it('applies the same protection gate to prepared effects and card hits using live foe state', () => {
    const foe = { name: '元素', hp: 10, maxHp: 10, affix: 'aegis', status: {}, defense: {} };
    const { flow, state, order } = harness(foe);
    const card = { name: 'hit' };
    expect(flow.hitFoe(foe, card, 3, 'true')).toBe(0);
    expect(flow.dealEffectDamage({ caster: {}, target: foe, amount: 3, type: 'true', card }).dealt).toBe(0);
    expect(order).toEqual([]);
    state.turn = 3;
    expect(flow.dealEffectDamage({ caster: {}, target: foe, amount: 3, type: 'true', card }).dealt).toBe(3);
    expect(order).toEqual([['record', 7, 3]]);
  });
});
