// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { discardInventoryCard, craftInventoryToken, transferContainerStack } from '../game/src/hub/bag-inventory-commands.js';

const spell = { id:'spell', name:'法术甲', type:'法术' };
const resource = { id:'resource', name:'资源甲', type:'资源' };
const pouch = { id:'tt7-stratagem', name:'锦囊' };
const pearl = { id:'tt2-pearlbox', name:'珍珠盒' };
const entry = (uid, card, flags = {}) => ({ uid, card, ...flags });
const ports = (used = 0, total = 4, base = 2) => ({ stackCapOf:() => 3, usedSlots:() => used, bagCap:() => total, baseCap:() => base });

describe('inventory commands', () => {
  it('rejects stale contexts before calling dependencies or changing inventory', () => {
    const state = { ownedCards:[entry('a', spell)] }, before = structuredClone(state);
    const cards = vi.fn(), newUid = vi.fn();
    expect(craftInventoryToken(state, { kind:'gold', current:() => false }, { cards, newUid }).code).toBe('inactive');
    expect(transferContainerStack(state, { kind:'pouch', take:false, name:spell.name, current:() => false }, ports()).code).toBe('inactive');
    expect(cards).not.toHaveBeenCalled(); expect(newUid).not.toHaveBeenCalled(); expect(state).toEqual(before);
  });

  it('discards the exact UID and zone once, preserving stored entries and the protected card', () => {
    const state = { ownedCards:[entry('stored', spell, { stored:1 }), entry('safe', spell, { safe:1 }), entry('bag', spell)] };
    const sha = { id:'sha', name:'初始攻击' };
    expect(discardInventoryCard(state, { name:spell.name, fromSafe:false, uid:'safe' }, sha).code).toBe('missing');
    expect(discardInventoryCard(state, { name:spell.name, fromSafe:false, uid:'stored' }, sha).code).toBe('missing');
    expect(discardInventoryCard(state, { name:sha.id }, sha).code).toBe('protected');
    expect(discardInventoryCard(state, { name:spell.name, fromSafe:false, uid:'bag' }, sha).ok).toBe(true);
    expect(discardInventoryCard(state, { name:spell.name, fromSafe:false, uid:'bag' }, sha).code).toBe('missing');
    expect(state.ownedCards.map(item => item.uid)).toEqual(['stored','safe']);
  });

  it('allocates craft output only after recipe validation and leaves materials intact on allocation failure', () => {
    const gold = { id:'tt-token-gold', name:'B' }, color = { id:'tt-token-color', name:'A' };
    const state = { ownedCards:[entry('1',gold),entry('2',gold),entry('3',gold,{safe:1})], fragments:4 };
    const before = structuredClone(state), newUid = vi.fn(() => { throw new Error('allocation'); });
    expect(craftInventoryToken(state, { kind:'gold' }, { cards:() => [], newUid }).ok).toBe(false);
    expect(newUid).not.toHaveBeenCalled();
    expect(() => craftInventoryToken(state, { kind:'gold' }, { cards:() => [color], newUid })).toThrow('allocation');
    expect(state).toEqual(before);
    expect(craftInventoryToken(state, { kind:'gold' }, { cards:() => [color], newUid:() => 'out' }).ok).toBe(true);
    expect(state.ownedCards).toEqual([entry('out',color)]); expect(state.fragments).toBe(4);
  });

  it('enforces whole-stack pouch capacity without writing flags on rejection', () => {
    const state = { ownedCards:[entry('p',pouch),entry('s',spell,{stored:1,pouchOf:pouch.id}), ...[1,2,3].map(id => entry(id,spell))] };
    const before = structuredClone(state);
    expect(transferContainerStack(state, { kind:'pouch', take:false, name:spell.name }, ports())).toMatchObject({ ok:false, code:'container-full', storedCount:1, count:3 });
    expect(state).toEqual(before);
  });

  it('deposits only the first visible stack, leaving later stacks in the bag', () => {
    const state = { ownedCards:[entry('p',pearl), ...[1,2,3,4].map(id => entry(id,resource))] };
    expect(transferContainerStack(state, { kind:'pearl', take:false, name:resource.name }, ports())).toMatchObject({ ok:true, count:3 });
    expect(state.ownedCards.find(item => item.uid === 4)).not.toHaveProperty('stored');
  });

  it('checks live container existence, accepted type and safe ownership', () => {
    const state = { ownedCards:[entry('s',spell),entry('r',resource),entry('safe',spell,{safe:1})] };
    expect(transferContainerStack(state, { kind:'pouch', take:false, name:spell.name }, ports()).code).toBe('container');
    state.ownedCards.push(entry('p',pouch));
    expect(transferContainerStack(state, { kind:'pouch', take:false, name:resource.name }, ports()).code).toBe('missing');
    expect(transferContainerStack(state, { kind:'pouch', take:false, name:spell.name }, ports()).ok).toBe(true);
    expect(state.ownedCards.find(item => item.uid === 'safe')).not.toHaveProperty('stored');
    expect(transferContainerStack(state, { kind:'pouch', take:false, name:spell.name }, ports()).code).toBe('missing');
  });

  it('keeps container ownership separate and uses whole-stack slot increments on retrieval', () => {
    const state = { ownedCards:[entry('p',pearl),entry('s',spell,{stored:1,pouchOf:pouch.id}),
      ...[1,2,3,4].map(id => entry(id,resource,{stored:1}))] };
    const before = structuredClone(state);
    expect(transferContainerStack(state, { kind:'pearl', take:true, name:resource.name }, ports(3,4))).toMatchObject({ code:'bag-full', delta:2 });
    expect(state).toEqual(before);
    expect(transferContainerStack(state, { kind:'pearl', take:true, name:resource.name }, ports(2,4)).ok).toBe(true);
    expect(state.ownedCards.find(item => item.uid === 's')).toMatchObject({stored:1,pouchOf:pouch.id});
    expect(transferContainerStack(state, { kind:'pearl', take:true, name:resource.name }, ports()).code).toBe('missing');
  });

  it('lets pouch spells merge at zero slot cost while excluding resource-only bonus slots', () => {
    const state = { ownedCards:[entry('p',pouch),entry('a',spell),entry('b',spell,{stored:1,pouchOf:pouch.id})] };
    expect(transferContainerStack(state, { kind:'pouch', take:true, name:spell.name }, ports(3,5,2)).ok).toBe(true);
    state.ownedCards = [entry('p',pouch), ...[1,2,3].map(id => entry(id,spell)), entry('b',spell,{stored:1,pouchOf:pouch.id})];
    expect(transferContainerStack(state, { kind:'pouch', take:true, name:spell.name }, ports(2,5,2))).toMatchObject({ code:'bag-full', delta:1 });
  });
});
