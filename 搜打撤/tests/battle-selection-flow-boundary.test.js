// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createBattleSelectionFlow } from '../game/src/battle/battle.selection-flow.js';
import { pdef, set$choosing, set$discovering, set$G, set$handSelecting, set$pdef } from '../game/src/battle/battle.runtime.js';

function createFlow({ cards, random01 = () => 0, deny = () => {} }) {
  return createBattleSelectionFlow({
    cards, random01, deny, throwIfActionCancelled: () => {},
    session: { handSelectQueue: [], choiceQueue: [] },
  });
}

afterEach(() => {
  set$discovering(null);
  set$G(null);
  set$pdef(null);
  set$handSelecting(null);
  set$choosing(null);
});

describe('battle selection flow ports', () => {
  it('imports and constructs without browser globals, and random discovery uses injected catalog and RNG', () => {
    expect(globalThis.window).toBeUndefined();
    expect(globalThis.document).toBeUndefined();

    const first = { id: 'first', name: '常见牌', type: '法术', rarity: '普通' };
    const second = { id: 'second', name: '稀有牌', type: '法术', rarity: '稀有' };
    const all = vi.fn(() => [first, second]);
    const isRandomObtainable = vi.fn(() => true);
    const random01 = vi.fn(() => 0.99);
    const flow = createFlow({
      cards: { all, isRandomObtainable, sellPrice: vi.fn(() => 0) },
      random01,
    });

    expect(flow.randomDiscoverCard(null, '稀有')).toBe(second);
    expect(all).toHaveBeenCalledTimes(1);
    expect(isRandomObtainable).toHaveBeenCalledTimes(2);
    expect(random01).toHaveBeenCalledTimes(1);
  });

  it('does not consume battle randomness for an empty candidate pool', () => {
    const random01 = vi.fn(() => 0.5);
    const flow = createFlow({
      cards: { all: () => [], isRandomObtainable: () => true, sellPrice: () => 0 },
      random01,
    });

    expect(flow.randomDiscoverCard(null, '不存在')).toBeNull();
    expect(random01).not.toHaveBeenCalled();
  });

  it('uses the injected deny port when a mandatory hand selection cannot be skipped', () => {
    const deny = vi.fn();
    const flow = createFlow({
      cards: { all: () => [], isRandomObtainable: () => true, sellPrice: () => 0 },
      deny,
    });
    set$handSelecting({ mandatory: true });

    flow.skipHandSelect();
    expect(deny).toHaveBeenCalledTimes(1);
  });

  it('forwards an absent action signal to the injected cancellation check', async () => {
    let queuedAction;
    const throwIfActionCancelled = vi.fn();
    const flow = createBattleSelectionFlow({
      cards: { all: () => [], isRandomObtainable: () => true, sellPrice: () => 0 },
      deny: vi.fn(), random01: vi.fn(() => 0), throwIfActionCancelled,
      session: { handSelectQueue: [], choiceQueue: [{ cardName: '抉择牌', options: ['继续'] }] },
      requestBattleRender: vi.fn(),
      queueBattleAction: action => { queuedAction = action; },
      runStagedSteps: vi.fn(async () => {}),
      applyTextEffects: { steps: vi.fn(() => []) },
      sweepDead: vi.fn(), finish: vi.fn(),
    });
    set$G({ battleActive: true, log: vi.fn() });

    flow.processChoice();
    flow.pickChoice(0);
    await queuedAction(undefined);

    expect(throwIfActionCancelled).toHaveBeenCalledOnce();
    expect(throwIfActionCancelled).toHaveBeenCalledWith(undefined);
  });

  it('routes price armor through the injected card pricing port', () => {
    const card = { id: 'price', name: '挖宝牌', type: '法术', rarity: '稀有' };
    const sellPrice = vi.fn(() => 5);
    const log = vi.fn();
    const flow = createBattleSelectionFlow({
      cards: { all: () => [], isRandomObtainable: () => true, sellPrice },
      deny: vi.fn(), random01: vi.fn(() => 0),
      throwIfActionCancelled: () => {},
      session: { handSelectQueue: [], choiceQueue: [] },
      fireCatGift: vi.fn(), addTempCard: () => 'temp-1', sweepDead: vi.fn(), finish: vi.fn(),
      requestBattleRender: vi.fn(),
    });
    set$G({ log });
    set$pdef({ armor: 0 });
    set$discovering({
      options: [card], n: 1, rarity: null, pred: null, act: null, priceArmor: true,
      pouchUid: null, consumeTempAtTurn: false, tempUids: [], swapPair: null,
      deckBottom: false, deckBottomUids: [], zeroCost: false, decayEachTurn: false,
      costDecayPerTurn: 0, sourceCardId: null, pool: [],
    });

    flow.pickDiscover(0);

    expect(sellPrice).toHaveBeenCalledWith(card);
    expect(pdef.armor).toBe(5);
  });
});
