// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { createShopCommands } from '../game/src/run/shop-commands.js';
import { createEventCommands, settleEventCommand } from '../game/src/run/event-commands.js';

function shop(ports = {}) {
  const card = { id:'a', name:'A' }, slot = { card, price:3, sold:false };
  const state = { coins:5, shopStock:[slot], ownedCards:[] };
  const quote = { slot, card, price:3, free:undefined, replenish:false };
  const save = vi.fn(() => true);
  const commands = createShopCommands({ state, canReceive:() => true, newUid:() => 'new',
    isSellable:() => true, sellPrice:() => 2, save, ...ports });
  return { state, slot, quote, save, commands, buy:() => commands.buy({ index:0, quote }) };
}

describe('run domain admission without global facade or DOM', () => {
  it.each(['coins', 'capacity', 'quote', 'uid'])('preparing UID invalidates %s before admission: no partial purchase', failure => {
    let fits = true, h;
    h = shop({ canReceive:() => fits, newUid:() => {
      if (failure === 'coins') h.state.coins = 0;
      if (failure === 'capacity') fits = false;
      if (failure === 'quote') h.slot.price = 4;
      if (failure === 'uid') return '';
      return 'new';
    } });
    expect(h.buy().ok).toBe(false);
    expect(h.state.ownedCards).toEqual([]); expect(h.slot.sold).toBe(false);
    expect(h.state.coins).toBe(failure === 'coins' ? 0 : 5); expect(h.save).not.toHaveBeenCalled();
  });

  it.each(['false', 'throw'])('failed checkpoint %s keeps the entire purchase and rejects replay', mode => {
    let observed;
    const h = shop({ save:() => {
      observed = { coins:h.state.coins, cards:h.state.ownedCards.length, sold:h.slot.sold };
      if (mode === 'throw') throw Error('storage');
      return false;
    } });
    expect(h.buy()).toMatchObject({ ok:true, saved:false });
    expect(observed).toEqual({ coins:2, cards:1, sold:true });
    expect(h.buy().ok).toBe(false); expect(h.state.ownedCards).toHaveLength(1);
  });

  it('save reentry cannot purchase a replenishment twice', () => {
    let nested, h;
    h = shop({ save:() => { nested = h.commands.buy({ index:0, quote:h.quote, replenish:true }); return true; } });
    h.slot.shaReplenish = 2; h.quote.replenish = true;
    expect(h.commands.buy({ index:0, quote:h.quote, replenish:true }).ok).toBe(true);
    expect(nested).toEqual({ ok:false, reason:'busy' });
    expect(h.slot.shaReplenish).toBe(1); expect(h.state.coins).toBe(2);
  });

  it('sale-price port replacing the owned identity cannot sell the replacement', () => {
    let h;
    h = shop({ sellPrice:() => { h.state.ownedCards[0] = { uid:'owned', card:h.quote.card }; return 2; } });
    const owned = { uid:'owned', card:h.quote.card }; h.state.ownedCards.push(owned);
    expect(h.commands.sell({ uid:'owned', quote:{ owned, card:owned.card } }).ok).toBe(false);
    expect(h.state.ownedCards).toHaveLength(1); expect(h.state.coins).toBe(5); expect(h.save).not.toHaveBeenCalled();
  });

  it('event payment commits its deterministic receipt with the debit and retries without paying again', () => {
    const state = { coins:3 }, receipt = {};
    const commands = createEventCommands({ state });
    expect(commands.spendCoins(3, { receipt, field:'paid' })).toBe(true);
    expect(state.coins).toBe(0); expect(receipt.paid).toBe(true);
    expect(commands.spendCoins(3, { receipt, field:'paid' })).toBe(true);
    expect(commands.spendCoins(3, { receipt, field:'next' })).toBe(false);
    expect(receipt.next).toBeUndefined(); expect(state.coins).toBe(0);
  });

  it('recode rejects a stale member before changing any member', () => {
    const cards = ['a', 'b'].map(id => ({ id, name:id, type:'装备', rarity:'古朴' }));
    const entries = cards.map((card, i) => ({ uid:String(i), card }));
    const state = { ownedCards:[entries[0]] };
    const commands = createEventCommands({ state });
    expect(commands.recode(entries, cards.map(c => ({ ...c, id:c.id + 'new' })), undefined,
      () => cards.map(c => ({ ...c, id:c.id + 'new' })))).toBe(false);
    expect(entries.map(entry => entry.card)).toEqual(cards);
    expect(entries[0].card).toBe(cards[0]);
  });

  it('rejected event admission restores reservation; accepted reward survives a later presentation failure', () => {
    const state = { layerIdx:0, trackPos:1, coins:3, ownedCards:[], visited:{} };
    const record = { actionChoice:2 }, settling = new WeakSet();
    const args = { state, record, settling, consumeCell:() => { state.visited['0,1'] = true; } };
    expect(settleEventCommand({ ...args, run:() => false })).toBe(false);
    expect(record).toEqual({ actionChoice:2 }); expect(state.visited).toEqual({});
    expect(settleEventCommand({ ...args, run:() => { state.coins += 2; throw Error('presentation'); } })).toBe(true);
    expect(state.coins).toBe(5); expect(record.settled).toBe(true); expect(state.visited['0,1']).toBe(true);
    expect(settleEventCommand({ ...args, run:() => { state.coins += 2; } })).toBe(false);
  });
});
