// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createBattleSelectionFlow } from '../game/src/battle/battle.selection-flow.js';
import { discovering, pdef, set$choosing, set$discoverQueue, set$discovering, set$G, set$handSelecting, set$pdef } from '../game/src/battle/battle.runtime.js';

function createFlow({ cards, random01 = () => 0, deny = () => {}, requestBattleRender = () => {} }) {
  return createBattleSelectionFlow({
    cards, random01, deny, throwIfActionCancelled: () => {},
    session: { handSelectQueue: [], choiceQueue: [] },
    requestBattleRender,
  });
}

afterEach(() => {
  set$discovering(null);
  set$discoverQueue([]);
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

  it('builds one ordered pool for an entire built-in panel without changing draw or reroll order', () => {
    const catalog = [
      { id: 'same-1', name: '同名', type: '法术', rarity: '稀有' },
      { id: 'same-2', name: '同名', type: '法术', rarity: '稀有' },
      { id: 'other-1', name: '乙牌', type: '法术', rarity: '稀有' },
      { id: 'other-2', name: '丙牌', type: '法术', rarity: '稀有' },
    ];
    const all = vi.fn(() => catalog);
    const isRandomObtainable = vi.fn(() => true);
    const random01 = vi.fn()
      .mockReturnValueOnce(0.01) // 同名（第一版）
      .mockReturnValueOnce(0.26) // 同名（第二版），重抽
      .mockReturnValueOnce(0.51) // 乙牌
      .mockReturnValueOnce(0.76); // 丙牌
    const flow = createFlow({ cards: { all, isRandomObtainable, sellPrice: () => 0 }, random01 });
    set$G({ myClass: '射击', log: vi.fn() });
    set$discoverQueue([{ n: 1 }]);

    flow.processDiscoverQueue();

    expect(discovering.options).toEqual([catalog[0], catalog[2], catalog[3]]);
    expect(discovering.options[0]).toBe(catalog[0]);
    expect(all).toHaveBeenCalledTimes(1);
    expect(isRandomObtainable).toHaveBeenCalledTimes(catalog.length);
    expect(random01).toHaveBeenCalledTimes(4);
  });

  it('keeps the 40-reroll limit while reusing a single-card built-in pool', () => {
    const card = { id: 'only', name: '唯一牌', type: '法术', rarity: '稀有' };
    const all = vi.fn(() => [card]);
    const random01 = vi.fn(() => 0.5);
    const flow = createFlow({
      cards: { all, isRandomObtainable: () => true, sellPrice: () => 0 }, random01,
    });
    set$G({ myClass: '射击', log: vi.fn() });
    set$discoverQueue([{ n: 1, rarity: '稀有' }]);

    flow.processDiscoverQueue();

    expect(discovering.options).toEqual([card]);
    expect(all).toHaveBeenCalledTimes(1);
    // 首张一抽；后两槽各首抽一次并最多重抽 40 次。
    expect(random01).toHaveBeenCalledTimes(83);
  });

  it('reads an empty built-in catalog once and still consumes no random value', () => {
    const all = vi.fn(() => []);
    const random01 = vi.fn(() => 0.5);
    const log = vi.fn();
    const flow = createFlow({ cards: { all, isRandomObtainable: () => true, sellPrice: () => 0 }, random01 });
    set$G({ myClass: '射击', log });
    set$discoverQueue([{ n: 1 }]);

    flow.processDiscoverQueue();

    expect(all).toHaveBeenCalledTimes(1);
    expect(random01).not.toHaveBeenCalled();
    expect(discovering).toBeNull();
    expect(log).toHaveBeenCalledWith('（没有符合条件的卡牌可发现）', 'dim');
  });

  it('keeps custom predicate discovery on the per-draw fresh-catalog path', () => {
    const cardsInCatalog = [
      { id: 'a', name: '甲', type: '法术', rarity: '稀有' },
      { id: 'b', name: '乙', type: '法术', rarity: '稀有' },
      { id: 'c', name: '丙', type: '法术', rarity: '稀有' },
    ];
    const all = vi.fn(() => cardsInCatalog);
    const pred = vi.fn(() => true);
    const random01 = vi.fn()
      .mockReturnValueOnce(0.1)
      .mockReturnValueOnce(0.5)
      .mockReturnValueOnce(0.9);
    const flow = createFlow({ cards: { all, isRandomObtainable: () => true, sellPrice: () => 0 }, random01 });
    set$G({ myClass: '射击', log: vi.fn() });
    set$discoverQueue([{ n: 1, pred, rarity: '不存在', pool: { kind: 'moves', cost: 999 } }]);

    flow.processDiscoverQueue();

    expect(all).toHaveBeenCalledTimes(3);
    expect(pred).toHaveBeenCalledTimes(cardsInCatalog.length * 3);
    expect(random01).toHaveBeenCalledTimes(3);
    expect(discovering.options).toEqual(cardsInCatalog);
  });

  it('does not query the catalog or random stream for explicit options', () => {
    const all = vi.fn(() => []);
    const random01 = vi.fn(() => 0);
    const explicit = [{ id: 'provided', name: '给定卡', type: '法术' }];
    const flow = createFlow({ cards: { all, isRandomObtainable: () => true, sellPrice: () => 0 }, random01 });
    set$G({ myClass: '射击', log: vi.fn() });
    set$discoverQueue([{ n: 1, explicit }]);

    flow.processDiscoverQueue();

    expect(discovering.options).toEqual(explicit);
    expect(all).not.toHaveBeenCalled();
    expect(random01).not.toHaveBeenCalled();
  });

  it('reads the current queue after runtime replaces it during a reset', () => {
    const catalog = [
      { id: 'replacement-1', name: '新局甲', type: '法术' },
      { id: 'replacement-2', name: '新局乙', type: '法术' },
      { id: 'replacement-3', name: '新局丙', type: '法术' },
    ];
    const flow = createFlow({
      cards: { all: () => catalog, isRandomObtainable: () => true, sellPrice: () => 0 },
      random01: vi.fn().mockReturnValueOnce(0.1).mockReturnValueOnce(0.5).mockReturnValueOnce(0.9),
    });
    const replacementQueue = [{ n: 1 }];
    set$G({ myClass: '射击', log: vi.fn() });
    set$discoverQueue(replacementQueue);

    flow.processDiscoverQueue();

    expect(discovering.options).toEqual(catalog);
    expect(replacementQueue).toHaveLength(0);
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
