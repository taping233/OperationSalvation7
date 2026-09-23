import { describe, expect, it } from 'vitest';
import { createBattleSnapshot } from '../game/src/battle.snapshot.js';

describe('battle snapshot builder', () => {
  it('isolates nested state and freezes collections without mutating source values', () => {
    const foe = { hp: 4, status: { bleed: 2 }, defense: { armor: 1 }, intent: { type: 'attack' } };
    const hand = ['a'];
    const picked = new Set(['fuel']);
    const input = {
      battleToken: 't1', mode: 'boss', turn: 2, energy: 3, maxEnergy: 4, busy: false,
      phase: 'player', actionQueueLength: 0, opts: { stage: 1 }, player: { hp: 8 },
      pdef: { armor: 2 }, pstat: { hp: 8, status: { poison: 1 } }, foes: [foe], allies: [],
      hand, drawPile: [], discard: [], grave: [],
      infusing: { uid: 'a', card: { name: 'card' }, picked }, discovering: null,
      handSelecting: null, choosing: null, pendingTarget: null, pendingHint: '',
      viewingGrave: false, viewingBag: false, dreadShown: false, selectingDeck: false,
      deckNeed: 15, selDeckMax: 15, selShaN: 0, sel: new Set(), selPool: [],
      potionBar: [{ uid: 'p', name: 'potion', count: 1 }], pendingItem: null,
      slamPending: false, dartPending: false, equipped: [],
    };
    const snapshot = createBattleSnapshot(input);
    expect(Object.isFrozen(snapshot)).toBe(true);
    expect(Object.isFrozen(snapshot.foes[0].status)).toBe(true);
    expect(Object.isFrozen(snapshot.infusing.picked)).toBe(true);
    expect(Object.isFrozen(snapshot.potionBar[0])).toBe(true);
    hand.push('b');
    picked.add('later');
    foe.status.bleed = 9;
    expect(snapshot.hand).toEqual(['a']);
    expect(snapshot.infusing.picked).toEqual(['fuel']);
    expect(snapshot.foes[0].status.bleed).toBe(2);
    expect(foe.status.bleed).toBe(9);
  });
});
