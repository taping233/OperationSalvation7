// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { GameStore } from '../game/src/hub/game.store.js';
import { claimEntrySupply, claimResourceReward } from '../game/src/run/node-reward-state.js';

describe('GameStore snapshot isolation', () => {
  it('keeps unclaimed rewards stable when real claim commands mutate the live run', () => {
    const store = new GameStore({ rules: { playerMaxHp: 30, playerAtk: 4 } });
    store.state.entrySupply = { version: 1, layerIdx: 0, trackPos: 0, cardIds: ['supply'], taken: [] };
    const reward = { version: 1, type: 'resource', cardIds: ['resource'], taken: null };
    store.state.nodeRewards = { '0,0': reward };
    store.state.pendingEventLoot = { text: '物资箱', chests: ['medium'] };
    store.state.pendingExtraction = { remainingCards: [{ card: { id: 'held' }, count: 1 }] };
    store.state.pendingRunePick = [{ attrs: ['火'] }];
    const before = store.getSnapshot();

    expect(() => before.entrySupply.taken.push(0)).toThrow();
    expect(() => { before.nodeRewards['0,0'].taken = 0; }).toThrow();
    expect(() => before.pendingEventLoot.chests.push('large')).toThrow();
    expect(() => { before.pendingExtraction.remainingCards[0].count = 99; }).toThrow();
    expect(() => before.pendingRunePick[0].attrs.push('水')).toThrow();
    expect(claimEntrySupply(store.state, {
      findCard: id => ({ id }), canReceive: () => true, newUid: () => 'claim-1',
    })).toHaveLength(1);
    expect(claimResourceReward(reward, 0, () => true)).toBe(true);
    store.state.pendingEventLoot.chests.push('large');
    store.state.pendingExtraction.remainingCards[0].count = 0;
    store.state.pendingRunePick[0].attrs.push('水');

    expect(before.entrySupply.taken).toEqual([]);
    expect(before.nodeRewards['0,0'].taken).toBeNull();
    expect(before.ownedCards).toEqual([]);
    expect(before.pendingEventLoot.chests).toEqual(['medium']);
    expect(before.pendingExtraction.remainingCards[0].count).toBe(1);
    expect(before.pendingRunePick[0].attrs).toEqual(['火']);
    const after = store.getSnapshot();
    expect(after.entrySupply.taken).toEqual([0]);
    expect(after.nodeRewards['0,0'].taken).toBe(0);
    expect(after.ownedCards[0].card.id).toBe('supply');
  });

  it('isolates future plain fields, aliases and cycles without traversing opaque runtime objects', () => {
    const store = new GameStore({ rules: { playerMaxHp: 30, playerAtk: 4 } });
    const shared = { count: 1 };
    const callback = () => 'runtime';
    class RuntimePort {
      get live() { throw new Error('must not inspect runtime internals'); }
    }
    const port = new RuntimePort();
    const element = document.createElement('div');
    const future = { shared, alias: shared, port, element, callback, optional: undefined };
    future.self = future;
    const runtimeGetter = () => { throw new Error('must not execute runtime accessors'); };
    store.state.accessorExtension = Object.defineProperty({}, 'live', { enumerable: true, get: runtimeGetter });
    Object.defineProperty(store.state, 'runtimePort', { enumerable: true, get: runtimeGetter });
    store.state.rootAlias = store.state;
    store.state.futureSession = future;
    const record = Object.create(null);
    record.shared = shared;
    store.state.nullPrototype = record;
    store.state.inventory = [{ name: 'item', value: 1, tier: 'test', count: 1, extra: shared }];

    const snapshot = store.getSnapshot();
    expect(snapshot.futureSession).not.toBe(future);
    expect(snapshot.futureSession.self).toBe(snapshot.futureSession);
    expect(snapshot.futureSession.shared).toBe(snapshot.futureSession.alias);
    expect(snapshot.nullPrototype.shared).toBe(snapshot.futureSession.shared);
    expect(Object.getPrototypeOf(snapshot.nullPrototype)).toBeNull();
    expect(snapshot.futureSession.port).toBe(port);
    expect(snapshot.futureSession.element).toBe(element);
    expect(snapshot.futureSession.callback).toBe(callback);
    expect(Object.getOwnPropertyDescriptor(snapshot.accessorExtension, 'live').get).toBe(runtimeGetter);
    expect(Object.getOwnPropertyDescriptor(snapshot, 'runtimePort').get).toBe(runtimeGetter);
    expect(snapshot.rootAlias === snapshot).toBe(true);
    expect(Object.hasOwn(snapshot.futureSession, 'optional')).toBe(true);
    expect(snapshot.futureSession.optional).toBeUndefined();
    expect(Object.isFrozen(port)).toBe(false);
    expect(Object.isFrozen(element)).toBe(false);
    expect(Object.isFrozen(future)).toBe(false);
    expect(Object.isFrozen(shared)).toBe(false);
    expect(() => { snapshot.futureSession.shared.count = 9; }).toThrow();
    shared.count = 2;
    expect(snapshot.futureSession.shared.count).toBe(1);
    expect(snapshot.inventory[0].extra.count).toBe(1);
    expect(store.getSnapshot().futureSession.shared.count).toBe(2);
  });

  it('preserves the existing map, interaction and shallow ring reference boundary', () => {
    const store = new GameStore({ rules: { playerMaxHp: 30, playerAtk: 4 } });
    const node = { visited: false };
    const row = { node };
    store.state.rings = [row];
    store.state.hover = node;
    store.state.moveTarget = node;
    store.state.altarFrom = node;
    const snapshot = store.getSnapshot();
    expect(snapshot.map).toBe(store.state.map);
    expect(snapshot.hover).toBe(node);
    expect(snapshot.moveTarget).toBe(node);
    expect(snapshot.altarFrom).toBe(node);
    expect(snapshot.rings).not.toBe(store.state.rings);
    expect(snapshot.rings[0]).not.toBe(row);
    expect(snapshot.rings[0].node).toBe(node);
    expect(Object.isFrozen(snapshot.rings[0])).toBe(true);
    expect(Object.isFrozen(node)).toBe(false);
    node.visited = true;
    expect(snapshot.rings[0].node.visited).toBe(true);
  });

  it('isolates nested card and used-pocket data across snapshots while preserving runtime references', () => {
    const map = { rules: { playerMaxHp: 30, playerAtk: 4 } };
    const store = new GameStore(map);
    const node = { visited: false };
    const moveTarget = { li: 1, idx: 2 };
    const card = {
      id: 'snapshot-card',
      rules: { triggers: { onPlay: [{ op: 'damage', amount: 2 }] } },
    };
    store.state.ownedCards = [{ uid: 'owned-1', card }];
    store.state.usedPocket = [{ card, count: 1 }];
    store.state.shopStock = [{ card, price: 3, sold: false }];
    store.state.shopStocks = { 'layer-1:shop-1': [{ card, price: 3, sold: false }] };
    store.state.hover = node;
    store.state.moveTarget = moveTarget;

    const first = store.getSnapshot();
    const second = store.getSnapshot();

    expect(first.ownedCards[0]).not.toBe(store.state.ownedCards[0]);
    expect(first.ownedCards[0].card).not.toBe(card);
    expect(first.ownedCards[0].card.rules.triggers.onPlay[0]).not.toBe(card.rules.triggers.onPlay[0]);
    expect(first.usedPocket[0].card).not.toBe(card);
    expect(first.shopStock[0].card).not.toBe(card);
    expect(first.shopStock[0].card.rules.triggers.onPlay[0]).not.toBe(card.rules.triggers.onPlay[0]);
    expect(first.shopStocks['layer-1:shop-1'][0].card).not.toBe(card);
    expect(first.shopStocks['layer-1:shop-1'][0].card.rules.triggers.onPlay[0]).not.toBe(second.shopStocks['layer-1:shop-1'][0].card.rules.triggers.onPlay[0]);
    expect(first.ownedCards[0].card.rules.triggers.onPlay[0]).not.toBe(second.ownedCards[0].card.rules.triggers.onPlay[0]);
    expect(Object.isFrozen(first.ownedCards[0].card.rules.triggers.onPlay[0])).toBe(true);
    expect(Object.isFrozen(first.shopStock[0].card.rules.triggers.onPlay[0])).toBe(true);
    expect(Object.isFrozen(first.shopStocks['layer-1:shop-1'][0].card.rules.triggers.onPlay[0])).toBe(true);
    expect(() => { first.ownedCards[0].card.rules.triggers.onPlay[0].amount = 99; }).toThrow();
    expect(card.rules.triggers.onPlay[0].amount).toBe(2);
    expect(first.map).toBe(map);
    expect(first.hover).toBe(node);
    expect(first.moveTarget).toBe(moveTarget);
    expect(Object.isFrozen(card)).toBe(false);
  });
});
