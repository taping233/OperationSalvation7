import { describe, expect, it, vi } from 'vitest';
import { createBattleTurnEffects } from '../game/src/battle/core/battle.turn-effects.domain.js';

function state() {
  return { G: { battleActive: true, hp: 10, log: vi.fn() }, battleState: { token: 1 },
    activeActionSignal: {}, delayed: [], foes: [{ name: '靶', hp: 100 }], turn: 1,
    cardOverrides: new Map(), hand: ['a', 'b'], drawPile: [], discard: [], grave: [],
    consumed: [], granted: [], cardAnims: [], growth: {}, consumeFireballN: 0 };
}
function setup(overrides = {}) {
  let current = state();
  const ports = {
    readState: () => current, throwIfActionCancelled: vi.fn(),
    alive: () => current.foes.filter(f => !f.dead), foeIdx: target => current.foes.indexOf(target),
    findCard: uid => ({ uid, card: { name: uid, cost: 2 } }), findEffectiveCard: () => null,
    fireTurnStart: vi.fn(), resolveCardWithFeedback: vi.fn(), applyTextEffects: vi.fn(() => ({ did: true })),
    runStagedSteps: vi.fn(async steps => { if (steps) for (const _ of steps) void _; }),
    set$playerCurseImmune: vi.fn(), set$delayed: value => { current.delayed = value; },
    set$meleeCost1: value => { current.meleeCost1 = value; },
    set$spellCost1: value => { current.spellCost1 = value; },
    battleBagItems: () => [], onHandConsumed: vi.fn(function* () {}), consumeFireballSteps: vi.fn(function* () {}),
    ...overrides,
  };
  const domain = createBattleTurnEffects(ports);
  return { domain, ports, get current() { return current; }, replace: next => { current = next; } };
}

describe('battle duration and turn effect ports', () => {
  it('applies the moves rule to the replacement battle and forwards stripped text exactly once', () => {
    const h = setup();
    const original = h.current;
    h.replace(state());
    const card = { name: '银河之旅' };
    const target = h.current.foes[0];
    expect(h.domain.registerBattle(card, '本局对战内：你的所有招式均为 1 费', target)).toBe(true);
    expect(h.current.meleeCost1).toBe(true);
    expect(h.current.spellCost1).toBe(true);
    expect(original.meleeCost1).toBeUndefined();
    expect(h.ports.applyTextEffects).toHaveBeenCalledExactlyOnceWith(card, '你的所有招式均为 1 费', target);
  });

  it('re-reads piles after a staged consumption replaces state and deduplicates UIDs', async () => {
    const h = setup();
    const first = h.current;
    const next = state();
    next.hand = ['b'];
    next.mode = 'boss';
    h.ports.runStagedSteps.mockImplementationOnce(async () => { h.replace(next); });
    expect(await h.domain.consumeHandUids(['a', 'a', 'b'], '临时卡')).toBe(2);
    expect(first.consumed).toEqual(['a']);
    expect(next.hand).toEqual([]);
    expect(next.consumed).toEqual(['b']);
    expect(next.grave).toEqual(['b']);
    expect(h.ports.onHandConsumed.mock.calls.map(([card]) => card.name)).toEqual(['a', 'b']);
  });

  it('stops before mutating the next UID when the staged action is cancelled', async () => {
    const h = setup();
    const cancelled = new Error('cancelled');
    h.ports.throwIfActionCancelled.mockImplementationOnce(() => {}).mockImplementationOnce(() => { throw cancelled; });
    await expect(h.domain.consumeHandUids(['a', 'b'], '临时卡')).rejects.toBe(cancelled);
    expect(h.current.hand).toEqual(['b']);
    expect(h.current.consumed).toEqual(['a']);
  });

  it('keeps new schedules for the next batch while decrementing a finite repeating clause', async () => {
    const h = setup();
    h.domain.registerTurnStart({ name: '持续卡', type: '法术', desc: '持续2回合' }, [{ text: '获得1甲' }], h.current.foes[0]);
    const added = { text: '下次效果', cardName: '新任务' };
    h.ports.applyTextEffects.mockImplementation(() => { h.current.delayed.push(added); return { did: true }; });
    await h.domain.processDelayed();
    expect(h.ports.applyTextEffects).toHaveBeenCalledTimes(1);
    expect(h.current.delayed).toHaveLength(2);
    expect(h.current.delayed[0].left).toBe(1);
    expect(h.current.delayed[1]).toBe(added);
  });
});
