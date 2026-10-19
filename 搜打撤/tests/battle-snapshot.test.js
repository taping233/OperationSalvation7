import { describe, expect, it } from 'vitest';
import { createBattleSnapshot, createBattleSnapshotSignature } from '../game/src/battle/runtime/battle.snapshot.js';

describe('battle snapshot builder', () => {
  it('preserves absent and explicit null cards in optional battle projections', () => {
    const snapshot = createBattleSnapshot({
      battleToken: 1, mode: 'normal', turn: 1, energy: 1, maxEnergy: 1, busy: false,
      phase: 'player', actionQueueLength: 0, opts: null, player: null, pdef: null, pstat: null,
      foes: [], allies: [], hand: [], drawPile: [], discard: [], grave: [],
      infusing: { uid: 'infuse', picked: new Set() }, discovering: null,
      handSelecting: null, choosing: null, pendingTarget: { uid: 'target', card: null }, pendingHint: null,
      viewingGrave: false, viewingDeck: false, viewingBag: false, dreadShown: false,
      selectingDeck: true, deckNeed: 1, selDeckMax: 1, selShaN: 0, sel: new Set(),
      selPool: [{ uid: 'deck' }], potionBar: null,
      pendingItem: { uid: 'item' }, slamPending: false, dartPending: false,
      equipped: [{ uid: 'equipped', name: '', desc: '', skill: '', used: false }],
    });

    expect(snapshot.infusing).toHaveProperty('card', undefined);
    expect(snapshot.pendingTarget).toHaveProperty('card', null);
    expect(snapshot.deckSelection.cards[0]).toHaveProperty('card', undefined);
    expect(snapshot.pendingItem).toHaveProperty('card', undefined);
    expect(snapshot.equipped[0]).toHaveProperty('card', undefined);
  });

  it('isolates nested state and freezes collections without mutating source values', () => {
    const foe = { hp: 4, status: { bleed: 2 }, defense: { armor: 1 }, intent: { type: 'attack' } };
    const hand = ['a'];
    const consumed = ['spent'];
    const picked = new Set(['fuel']);
    const input = {
      battleToken: 't1', mode: 'boss', turn: 2, energy: 3, maxEnergy: 4, busy: false,
      phase: 'player', actionQueueLength: 0, opts: { stage: 1 }, player: { hp: 8 },
      pdef: { armor: 2 }, pstat: { hp: 8, status: { poison: 1 } }, foes: [foe], allies: [],
      playerEffects: [{ key: 'nextSpell', name: '法术额外施放', icon: 'sparkles', duration: '下一张', description: '触发后消失' }],
      hand, drawPile: [], discard: [], grave: [], consumed,
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
    expect(Object.isFrozen(snapshot.playerEffects)).toBe(true);
    expect(Object.isFrozen(snapshot.playerEffects[0])).toBe(true);
    const effectSignature = createBattleSnapshotSignature(input, {});
    input.playerEffects[0].duration = 'changed';
    expect(snapshot.playerEffects[0].duration).toBe('下一张');
    expect(createBattleSnapshotSignature(input, {})).not.toBe(effectSignature);
    const beforeConsumedSignature=createBattleSnapshotSignature(input,{});
    consumed.push('later');
    expect(createBattleSnapshotSignature(input,{})).not.toBe(beforeConsumedSignature);
    expect(snapshot.consumed).toEqual(['spent']);
    expect(Object.isFrozen(snapshot.consumed)).toBe(true);
    hand.push('b');
    picked.add('later');
    foe.status.bleed = 9;
    expect(snapshot.hand).toEqual(['a']);
    expect(snapshot.infusing.picked).toEqual(['fuel']);
    expect(snapshot.foes[0].status.bleed).toBe(2);
    expect(foe.status.bleed).toBe(9);
  });

  it('deeply isolates and freezes every card-bearing projection while preserving undefined', () => {
    const makeCard = id => ({
      id,
      rules: {
        cost: 2,
        tags: ['battle', { name: 'nested' }],
        effects: [{ type: 'damage', values: [1, 2] }],
        optional: undefined,
      },
      extension: { labels: ['custom'], optional: undefined },
    });
    const cards = {
      infusing: makeCard('infusing'),
      discovering: makeCard('discovering'),
      deckSelection: makeCard('deckSelection'),
      pendingTarget: makeCard('pendingTarget'),
      pendingItem: makeCard('pendingItem'),
      equipped: makeCard('equipped'),
      handSelectingSource: makeCard('handSelectingSource'),
      handSelectingPayment: makeCard('handSelectingPayment'),
    };
    const onDone = () => {};
    const onResolved = () => {};
    const input = {
      battleToken: 'card-isolation', mode: 'normal', turn: 1, energy: 3, maxEnergy: 3,
      busy: false, phase: 'player', actionQueueLength: 0, opts: {}, player: {},
      pdef: {}, pstat: {}, foes: [], allies: [], hand: [], drawPile: [], discard: [], grave: [],
      infusing: { uid: 'infuse', card: cards.infusing, picked: new Set() },
      discovering: { options: [cards.discovering] },
      handSelecting: {
        srcCard: cards.handSelectingSource,
        onDone,
        payment: { uid: 'payment', card: cards.handSelectingPayment, onResolved },
      }, choosing: null,
      pendingTarget: { uid: 'target', card: cards.pendingTarget }, pendingHint: '',
      viewingGrave: false, viewingDeck: false, viewingBag: false, dreadShown: false,
      selectingDeck: true, deckNeed: 1, selDeckMax: 1, selShaN: 0, sel: new Set(),
      selPool: [{ uid: 'deck', card: cards.deckSelection }], potionBar: [],
      pendingItem: { uid: 'item', card: cards.pendingItem }, slamPending: false,
      dartPending: false, equipped: [{ uid: 'equip', card: cards.equipped, used: false }],
    };
    const cardAt = snapshot => ({
      infusing: snapshot.infusing.card,
      discovering: snapshot.discovering.options[0],
      deckSelection: snapshot.deckSelection.cards[0].card,
      pendingTarget: snapshot.pendingTarget.card,
      pendingItem: snapshot.pendingItem.card,
      equipped: snapshot.equipped[0].card,
      handSelectingSource: snapshot.handSelecting.srcCard,
      handSelectingPayment: snapshot.handSelecting.payment.card,
    });
    const snapshot = createBattleSnapshot(input);
    const snapshotCards = cardAt(snapshot);

    for (const key of Object.keys(cards)) {
      const source = cards[key];
      const projected = snapshotCards[key];
      expect(projected).toEqual(source);
      expect(projected).not.toBe(source);
      expect(Object.hasOwn(projected.rules, 'optional')).toBe(true);
      expect(projected.rules.optional).toBeUndefined();
      expect(Object.hasOwn(projected.extension, 'optional')).toBe(true);
      expect(Object.isFrozen(projected)).toBe(true);
      expect(Object.isFrozen(projected.rules)).toBe(true);
      expect(Object.isFrozen(projected.rules.tags)).toBe(true);
      expect(Object.isFrozen(projected.rules.tags[1])).toBe(true);
      expect(Object.isFrozen(projected.rules.effects[0].values)).toBe(true);
      expect(Object.isFrozen(projected.extension.labels)).toBe(true);
      expect(Reflect.set(projected.rules, 'cost', 99)).toBe(false);
      expect(() => projected.rules.effects[0].values.push(99)).toThrow(TypeError);
      expect(source.rules.cost).toBe(2);
      expect(source.rules.effects[0].values).toEqual([1, 2]);
      expect(Object.isFrozen(source)).toBe(false);
      expect(Object.isFrozen(source.rules)).toBe(false);
      expect(Object.isFrozen(source.rules.effects[0].values)).toBe(false);
    }
    expect(snapshot.handSelecting.onDone).toBe(onDone);
    expect(snapshot.handSelecting.payment.onResolved).toBe(onResolved);
    expect(Object.isFrozen(snapshot.handSelecting.payment)).toBe(false);

    for (const source of Object.values(cards)) {
      source.rules.cost = 7;
      source.rules.tags[1].name = 'changed';
      source.rules.effects[0].values.push(3);
      source.extension.labels.push('later');
    }
    for (const key of Object.keys(cards)) {
      expect(snapshotCards[key].rules.cost).toBe(2);
      expect(snapshotCards[key].rules.tags[1].name).toBe('nested');
      expect(snapshotCards[key].rules.effects[0].values).toEqual([1, 2]);
      expect(snapshotCards[key].extension.labels).toEqual(['custom']);
    }

    const freshCards = cardAt(createBattleSnapshot(input));
    for (const key of Object.keys(cards)) {
      expect(freshCards[key].rules.cost).toBe(7);
      expect(freshCards[key].rules.tags[1].name).toBe('changed');
      expect(freshCards[key].rules.effects[0].values).toEqual([1, 2, 3]);
      expect(freshCards[key].extension.labels).toEqual(['custom', 'later']);
    }
  });
});
