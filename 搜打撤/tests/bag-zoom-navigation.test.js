import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createCardZoomController } from '../game/src/ui/card-zoom-controller.js';

const H = vi.hoisted(() => ({ game:{}, save:vi.fn() }));
vi.mock('../game/src/run/game.session.js', () => ({
  MAP:{ items:{} }, game:H.game, bagCap:() => 16, safeCap:() => 6,
  newUid:() => 'new', safeUsed:() => 0, usedSlots:() => 2, saveGame:H.save,
  cardStacks:safe => {
    const stacks = new Map();
    for (const item of H.game.ownedCards.filter(item => !!item.safe === !!safe && !item.stored)) {
      if (!stacks.has(item.card.name)) stacks.set(item.card.name, { card:item.card, count:0, uids:[] });
      const stack = stacks.get(item.card.name); stack.count++; stack.uids.push(item.uid);
    }
    return [...stacks.values()].flatMap(stack => Array.from({ length:Math.ceil(stack.count / 3) }, (_, i) => ({
      card:stack.card,count:Math.min(3, stack.count - i * 3),uids:stack.uids.slice(i * 3, i * 3 + 3),
    })));
  },
}));
vi.mock('../game/src/hub/game.cardslib.js', () => ({ _set_cardPageOpen:vi.fn() }));
vi.mock('../game/src/hub/game.bag.settle.js', () => ({ bindBagMixins:vi.fn(), resumeBattleRewards:vi.fn() }));

const spell = { id:'spell', name:'法术', type:'法术', desc:'造成 3 点伤害' };
const potion = { id:'potion', name:'药剂', type:'道具', desc:'回复 3 点生命' };
let bag, ui, drag;
const zoom = () => document.getElementById('cardZoom');
const inspect = name => document.querySelector(`[data-act="inspectStack"][data-name="${name}"]`).click();
const arrow = key => zoom().dispatchEvent(new KeyboardEvent('keydown', { key,bubbles:true,cancelable:true }));

beforeEach(async () => {
  vi.resetModules(); vi.useFakeTimers(); H.save.mockReset();
  Object.assign(H.game, { seed:'navigation', discoveredPairs:new Set(), runActive:true, nestActive:false,
    state:'idle', battleActive:false, myClass:'法师', inventory:[], usedPocket:[], cardOrder:[],
    ownedCards:[{ uid:'spell',card:spell },{ uid:'potion-1',card:potion },{ uid:'potion-2',card:potion }],
    hp:10,maxHp:30,coins:0,fragments:0,stackCapOf:() => 3,heal:vi.fn(n => { H.game.hp += n; }) });
  document.body.innerHTML = '<div id="viewport"></div><div id="overlay" hidden><div id="ovBody"></div></div>';
  const overlay = document.getElementById('overlay'), body = document.getElementById('ovBody');
  ui = { el:{ overlay,ovBody:body }, _acts:{}, act(name,fn) { this._acts[name] = fn; },
    log:vi.fn(), refresh:vi.fn(), helpBtn:() => '', registerHelp:vi.fn(),
    showOverlay(_title,html,mode) { overlay.hidden = false; overlay.classList.toggle('bag-full',mode === 'bagpage'); body.innerHTML = html; },
    hideOverlay() { overlay.hidden = true; },
  };
  const cards = { SHA:{ id:'starter-attack',name:'初始攻击' }, all:() => [spell,potion],
    cardHTML:card => `<article class="hs-card"><h3>${card.name}</h3><div class="hsc-desc">${card.desc}</div></article>`,
    cardBackHTML:() => '', deriveDraw:() => 0 };
  window.SDT = { UI:ui,game:H.game,Base:{ slot:1,bagCap:() => 16 },Cards:cards,
    Icons:{ rich:html => html },Sound:{ sfx:vi.fn() } };
  const controller = createCardZoomController({ readCards:() => cards,readArt:() => ({}),
    readScale:() => ({ rect:() => ({ width:0,height:0,left:0,top:0 }),scale:() => 1 }),readSound:() => window.SDT.Sound });
  ui.showCardZoom = (card,options) => controller.show(ui,card,options);
  body.addEventListener('click', event => { const target = event.target.closest('[data-act]'); if (target && !target.disabled) ui._acts[target.dataset.act]?.({ ...target.dataset }); });
  document.elementFromPoint = vi.fn(() => null);
  bag = await import('../game/src/hub/game.bag.js'); drag = await import('../game/src/hub/game.bag.drag.js');
  bag.showBackpack(true);
});
afterEach(() => {
  zoom()?._closeCardZoom(true); drag?.resetBagDrag(); document.body.replaceChildren();
  vi.clearAllTimers(); vi.useRealTimers(); vi.unstubAllGlobals();
});

it('next-card click rebuilds the current inventory metadata and executes only its current action', () => {
  inspect(spell.name); zoom().querySelector('[data-cz-next]').click();
  expect(zoom().getAttribute('aria-label')).toBe('药剂卡牌详情');
  expect(zoom().querySelector('.inventory-zoom-info h2').textContent).toBe('药剂');
  expect(zoom().querySelector('.inspect-count').textContent).toContain('×2');
  zoom().querySelector('[data-act="useDetailCard"]').click();
  expect(H.game.heal).toHaveBeenCalledWith(3);
  expect(H.game.ownedCards.map(item => item.uid)).toEqual(['spell','potion-2']);
});

it('keyboard browsing keeps the first source focus and rejects the previous card action', () => {
  const source = document.querySelector('[data-stack="药剂"]'); source.focus(); inspect(potion.name);
  const oldUse = ui._acts.useDetailCard;
  arrow('ArrowLeft');
  expect(zoom().getAttribute('aria-label')).toBe('法术卡牌详情');
  expect(zoom().querySelector('[data-act="useDetailCard"]')).toBeNull();
  oldUse(); expect(H.game.heal).not.toHaveBeenCalled(); expect(H.save).not.toHaveBeenCalled();
  zoom()._closeCardZoom(true);
  expect(document.activeElement).toBe(source); expect(ui.el.overlay.inert).toBe(false);
});

it('stale navigation cannot replace another page after the original source is removed', () => {
  inspect(spell.name); const oldZoom = zoom();
  ui.el.ovBody.innerHTML = '<main>另一页</main>';
  oldZoom.querySelector('[data-cz-next]').click();
  expect(zoom()).toBe(oldZoom); expect(ui.el.ovBody.textContent).toBe('另一页');
});

it('consumed-card browsing rebuilds each current count and recovery rule without inventory actions', () => {
  H.game.usedPocket = [{ card:spell,count:2 },{ card:potion,count:3 }];
  document.querySelector('.bag-rz[data-zone="pocket"]').click(); inspect(spell.name); arrow('ArrowRight');
  expect(zoom().getAttribute('aria-label')).toBe('药剂卡牌详情');
  expect(zoom().querySelector('.cz-foot').textContent).toContain('已消耗 3 张');
  expect(zoom().querySelector('.cz-foot').textContent).toContain('火堆不可复原');
  expect(zoom().querySelector('[data-act]')).toBeNull();
});

it('same-name split stacks retain their own count, index and source through direct selection and browsing', () => {
  H.game.ownedCards = Array.from({ length:5 }, (_, i) => ({ uid:`spell-${i}`,card:spell }));
  bag.showBackpack(true);
  const tiles = [...document.querySelectorAll('[data-stack="法术"]')];
  expect(tiles).toHaveLength(2);
  tiles[1].focus(); tiles[1].click();
  expect(zoom().querySelector('.inspect-count').textContent).toContain('×2');
  expect(zoom().querySelector('.cz-list-nav').textContent).toContain('2 / 2');
  zoom().querySelector('[data-cz-prev]').click();
  expect(zoom().querySelector('.inspect-count').textContent).toContain('×3');
  expect(zoom().querySelector('.cz-list-nav').textContent).toContain('1 / 2');
  zoom().querySelector('[data-cz-next]').click();
  expect(zoom().querySelector('.inspect-count').textContent).toContain('×2');
  expect(zoom().querySelector('.cz-list-nav').textContent).toContain('2 / 2');
  zoom()._closeCardZoom(true); expect(document.activeElement).toBe(tiles[1]);
});

it('using a same-name second stack consumes that stacks representative UID', () => {
  H.game.ownedCards = Array.from({ length:5 }, (_, i) => ({ uid:`potion-${i}`,card:potion }));
  bag.showBackpack(true); document.querySelectorAll('[data-stack="药剂"]')[1].click();
  zoom().querySelector('[data-act="useDetailCard"]').click();
  expect(H.game.ownedCards.map(item => item.uid)).toEqual(['potion-0','potion-1','potion-2','potion-4']);
});
