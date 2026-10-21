// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { createAcquireOperation } from '../game/src/battle/effects/battle.acquire-operation.domain.js';
import { createStatusOperations } from '../game/src/battle/effects/battle.status-operations.domain.js';
import { createSetupMechanics } from '../game/src/battle/core/battle.setup-mechanics.domain.js';

describe('extracted battle responsibilities', () => {
  it('decorates acquired deck copies without changing the named template or another instance', () => {
    const template = { id: 'named', name: '独立招式', type: '武术', cost: 3 };
    const deckA = [], deckB = [];
    const create = deck => createAcquireOperation({ getAllCards: () => [template], getMyClass: () => null,
      addDeckCard: card => deck.push(card), shuffleDeck: () => deck.length, esc: value => value, log() {} });
    const source = { id: 'source', name: '获取' };
    create(deckA).resolveAcquireOperation(source, { pool: { kind: template.name }, dest: 'deck', act: 'costMinusOne', n: 2 });
    create(deckB).resolveAcquireOperation(source, { pool: { kind: template.name }, dest: 'deck', act: 'noInfuse', n: 1 });
    expect(deckA.map(card => card.cost)).toEqual([2, 2]);
    expect(deckA[0]).not.toBe(deckA[1]);
    expect(deckB).toEqual([{ ...template, _noInfuse: true }]);
    expect(template).toEqual({ id: 'named', name: '独立招式', type: '武术', cost: 3 });
  });

  it('retains the actual bottom-deck uid list on the tracked discover job', () => {
    const cards = [{ uid: 'a', card: { name: '甲' } }, { uid: 'b', card: { name: '乙' } }];
    const jobs = [];
    const { resolveAcquireOperation } = createAcquireOperation({ getMyClass: () => null,
      deckBottomCount: () => cards.length, takeDeckBottom: n => cards.slice(0, n).map(card => card.uid),
      findCard: uid => cards.find(card => card.uid === uid), queueDiscoverTracked: job => jobs.push(job),
      esc: value => value, log() {} });
    resolveAcquireOperation({ id: 'tt3-dig-treasure', name: '挖宝' }, { pool: { kind: '牌库底' }, n: 1 });
    expect(jobs).toEqual([{ n: 1, explicit: cards.map(card => card.card), explicitUids: ['a', 'b'],
      deckBottom: true, sourceCardId: 'tt3-dig-treasure' }]);
  });

  it('rechecks a chosen curse target after windup before mutating any status', () => {
    const target = { name: '目标', status: {}, dead: false };
    const addCurse = vi.fn();
    const { resolveCurseOperation } = createStatusOperations({
      combat: { CURSE_META: { poison: { stack: true } }, addCurse }, getAliveFoes: () => [target],
      getDamageTypeMeta: () => ({}), fixedDamageType: 'fixed', esc: value => value, log() {} });
    const steps = resolveCurseOperation({ name: '施毒' }, { target: 'chosenEnemy', curse: 'poison', stacks: 2 }, target);
    expect(steps.next().value.kind).toBe('windup');
    target.dead = true;
    expect(steps.next()).toEqual({ value: false, done: true });
    expect(addCurse).not.toHaveBeenCalled();
  });

  it('collects sealed cards once and preserves boss consumed/grave settlement', () => {
    const sealed = { id: 'seal', rules: { battle: { setup: { collection: { ids: ['seal'], into: 'hero' } } } } };
    const runtime = { G: { ownedCards: [{ uid: 's', card: sealed }], log() {} }, hand: ['s'], granted: [],
      consumed: [], grave: [], cardAnims: [], mode: 'boss', set$sealDone(value) { this.sealDone = value; } };
    const granted = [];
    const sweepDead = vi.fn();
    const setup = createSetupMechanics({ runtime, cards: { all: () => [{ id: 'hero' }] },
      findCard: uid => runtime.G.ownedCards.find(card => card.uid === uid), addTempCard: card => granted.push(card), sweepDead });
    setup.checkSealTransformation();
    setup.checkSealTransformation();
    expect(runtime.hand).toEqual([]);
    expect(runtime.consumed).toEqual(['s']);
    expect(runtime.grave).toEqual(['s']);
    expect(granted).toEqual([{ id: 'hero' }]);
    expect(sweepDead).toHaveBeenCalledTimes(1);
  });
});
