import { afterEach, describe, expect, it, vi } from 'vitest';
import { createBagContainerPages } from '../game/src/hub/bag-container-pages.js';
import { cardStacksForZone } from '../game/src/core/bag-render-derivation.js';

const spell = { id:'spell', name:'法术甲', type:'法术' };
function setup(kind) {
  const container = { id:kind === 'pouch' ? 'tt7-stratagem' : 'tt2-pearlbox', name:'容器' };
  const item = kind === 'pouch' ? spell : {id:'resource',name:'资源甲',type:'资源'};
  const game = {runActive:true,state:'modal',ownedCards:[{uid:'container',card:container},{uid:'item',card:item}],stackCapOf:() => 3};
  const overlay = document.createElement('section'), body = document.createElement('div'); overlay.append(body); document.body.append(overlay);
  const acts = {}; let active = true;
  const UI = { el:{ovBody:body,overlay}, showOverlay:vi.fn((title, html) => { body.innerHTML = html; }),
    log:vi.fn(), hideOverlay:vi.fn(), showCardZoom:vi.fn() };
  const ports = { UI,game,cards:{cardHTML:card => `<span>${card.name}</span>`},sound:vi.fn(),baseCap:() => 4,
    cardStacks:safe => cardStacksForZone(game.ownedCards,safe),usedSlots:() => 1,bagCap:() => 4,
    saveGame:vi.fn(),showBackpack:vi.fn(),rememberBagPosition:vi.fn(),decorateInventoryZoom:vi.fn(),
    captureContext:() => () => active,
    captureBagView:rootFor => { const root = body.firstElementChild; return () => active && body.firstElementChild === (rootFor ? rootFor() : root); },
    bagAct:(name, handler, current) => { acts[name] = data => { if(current()) return handler(data); }; } };
  return {...ports,...createBagContainerPages({...ports,readCards:() => ports.cards}),acts,item,setCards:cards => { ports.cards=cards; },invalidate:() => { active=false; }};
}
afterEach(() => { document.body.innerHTML=''; });
function putData(h, kind, name) {
  const button = [...h.UI.el.ovBody.querySelectorAll(`[data-act="${kind}Put"]`)].find(item => item.dataset.name === name);
  expect(button).not.toBeUndefined(); return { ...button.dataset };
}

describe('container page command lifecycle', () => {
  it('reads the current card renderer on open and after a successful transfer repaint', async () => {
    const h=setup('pouch');
    h.setCards({cardHTML:card => `<span data-current-renderer="first">${card.name}</span>`});
    h.openPouchStore();
    expect(h.UI.el.ovBody.querySelector('[data-current-renderer="first"]')).not.toBeNull();
    h.setCards({cardHTML:card => `<span data-current-renderer="second">${card.name}</span>`});
    await h.acts.pouchPut(putData(h, 'pouch', h.item.name));
    expect(h.UI.el.ovBody.querySelector('[data-current-renderer="second"]')).not.toBeNull();
    expect(h.UI.el.ovBody.querySelector('[data-current-renderer="first"]')).toBeNull();
    expect(h.saveGame).toHaveBeenCalledOnce();
  });

  it.each(['pouch','pearl'])('%s saves only successful transfers and ignores expired page callbacks', async kind => {
    const h=setup(kind); h[kind === 'pouch' ? 'openPouchStore' : 'openPearlStore']();
    const root=h.UI.el.ovBody.firstElementChild, data=putData(h, kind, h.item.name);
    const put=h.acts[`${kind}Put`]; await put(data);
    expect(h.game.ownedCards.find(entry => entry.uid==='item').stored).toBe(1);
    expect(h.saveGame).toHaveBeenCalledOnce(); expect(h.UI.showOverlay).toHaveBeenCalledOnce();
    expect(h.UI.el.ovBody.firstElementChild).toBe(root);
    await put(data); expect(h.saveGame).toHaveBeenCalledOnce();
    const take=h.acts[`${kind}Take`]; h.invalidate(); take({name:h.item.name});
    expect(h.game.ownedCards.find(entry => entry.uid==='item').stored).toBe(1);
    expect(h.saveGame).toHaveBeenCalledOnce();
  });

  it('rejects a full pouch with denial feedback and no save or repaint', () => {
    const h=setup('pouch');
    h.game.ownedCards.push(...[1,2,3].map(uid => ({uid,card:{...spell,name:'已存法术'},stored:1,pouchOf:'tt7-stratagem'})));
    h.openPouchStore(); h.acts.pouchPut(putData(h, 'pouch', spell.name));
    expect(h.sound).toHaveBeenCalledWith('deny'); expect(h.saveGame).not.toHaveBeenCalled();
    expect(h.UI.showOverlay).toHaveBeenCalledOnce(); expect(h.game.ownedCards.find(entry => entry.uid==='item')).not.toHaveProperty('stored');
  });
});
