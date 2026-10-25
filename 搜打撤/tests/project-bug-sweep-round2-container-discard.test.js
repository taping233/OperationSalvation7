import { describe, expect, it } from 'vitest';
import { discardInventoryCard, transferContainerStack } from '../game/src/hub/bag-inventory-commands.js';
import { cardStacksForZone } from '../game/src/core/bag-render-derivation.js';

const sha = { id:'sha', name:'初始攻击' };
const pouch = { id:'tt7-stratagem', name:'法师锦囊', type:'武术' };
const pearl = { id:'tt2-pearlbox', name:'珍珠盒', type:'装备' };
const spell = { id:'spell', name:'测试法术', type:'法术' };
const resource = { id:'wood', name:'木材', type:'资源' };
const entry = (uid, card, flags = {}) => ({ uid, card, ...flags });
const ports = { stackCapOf:() => 3, usedSlots:() => 1, bagCap:() => 20, baseCap:() => 10 };

describe('discarding a storage container', () => {
  it.each([
    ['pouch', pouch, spell, false],
    ['pearl', pearl, resource, false],
    ['pearl', pearl, resource, true],
  ])('preserves contents when discarding the only %s (case %#)', (kind, container, card, safe) => {
    const state = { ownedCards:[entry('container', container, safe ? {safe:1} : {}), entry('content', card)] };
    expect(transferContainerStack(state, {kind, take:false, name:card.name}, ports).ok).toBe(true);
    expect(cardStacksForZone(state.ownedCards, false).some(stack => stack.card.id === card.id)).toBe(false);
    const before = structuredClone(state);
    expect(discardInventoryCard(state, {name:container.name, fromSafe:safe, uid:'container'}, sha))
      .toMatchObject({ok:false, code:'container-not-empty'});
    expect(state).toEqual(before);
    expect(transferContainerStack(state, {kind, take:true, name:card.name}, ports).ok).toBe(true);
    expect(state.ownedCards.find(item => item.uid === 'content')).not.toHaveProperty('stored');
  });

  it.each([['pouch', pouch, spell], ['pearl', pearl, resource]])('allows discarding empty %s', (_kind, container) => {
    const state = { ownedCards:[entry('container', container)] };
    expect(discardInventoryCard(state, {name:container.name, fromSafe:false, uid:'container'}, sha).ok).toBe(true);
    expect(state.ownedCards).toEqual([]);
  });

  it.each([['pouch', pouch, spell], ['pearl', pearl, resource]])('allows discarding redundant %s when remaining capacity holds contents', (kind, container, card) => {
    const state = { ownedCards:[entry('container', container), entry('spare', container), entry('content', card)] };
    expect(transferContainerStack(state, {kind, take:false, name:card.name}, ports).ok).toBe(true);
    expect(discardInventoryCard(state, {name:container.name, fromSafe:false, uid:'container'}, sha).ok).toBe(true);
    expect(transferContainerStack(state, {kind, take:true, name:card.name}, ports).ok).toBe(true);
    expect(state.ownedCards.some(item => item.uid === 'spare')).toBe(true);
  });
});
