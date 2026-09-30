import { describe, expect, it } from 'vitest';
import { GameStore } from '../game/src/hub/game.store.js';

describe('GameStore snapshot isolation', () => {
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
