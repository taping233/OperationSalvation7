import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cardBrowserItems, filterCardBrowserItems, selectCardBrowserItems } from '../game/src/ui/card-browser-state.js';
import { bindCardBrowser, cardBrowserHTML, refreshCardBrowser } from '../game/src/ui/card-browser.js';
vi.mock('../game/src/hub/hub.presentation.js', () => ({ bindCardNavigation:vi.fn() }));
vi.mock('../game/src/hub/base-motion-v4.js', () => ({ animateBaseRefresh:vi.fn() }));
vi.mock('../game/src/ui/inventory-zoom.js', () => ({ decorateInventoryZoom:vi.fn() }));
vi.mock('../game/src/run/game.session.js', () => ({ MAP:{rules:{}} }));
vi.mock('../game/src/hub/hub.visuals.js', () => ({ partnerPortrait:vi.fn() }));
vi.mock('../game/src/hub/collection.commands.js', () => ({ getCharacter:vi.fn() }));
vi.mock('../game/src/ui/partner-interaction.js', () => ({ partnerInteractionHTML:() => '', mountPartnerInteraction:vi.fn() }));
import { collectionCardsHTML, bindCollectionCards } from '../game/src/hub/hub.collection-v4.js';
import { bindPersonnel } from '../game/src/hub/hub.personnel.js';
let ui, slot = 20;
beforeEach(() => {
  ui = { el:{}, acts:{}, act(name, fn) { this.acts[name] = fn; }, showCardZoom:vi.fn() };
  window.SDT = { UI:ui, Base:{slot:++slot} };
});
afterEach(() => { vi.restoreAllMocks(); document.body.replaceChildren(); });
function mount(size = 200) {
  document.body.innerHTML = cardBrowserHTML('shared-state', '列表', Array.from({length:size}, (_,i) =>
    `<button data-browser-key="${i}" data-id="${i}" data-browse-filtered="false" aria-pressed="false">${i}</button>`).join(''), {rows:1,columns:4});
  const root = document.body.firstElementChild; bindCardBrowser(root);
  return root;
}
function mutations(root) {
  const observer = new MutationObserver(() => {}); observer.observe(root, {subtree:true,attributes:true,childList:true});
  return { read:() => observer.takeRecords(), stop:() => observer.disconnect() };
}
describe('retained card browser state', () => {
  it('100 identical filters/selections keep 200 controls and emit zero list mutations', () => {
    const root = mount(), first = filterCardBrowserItems(root, () => true);
    selectCardBrowserItems(first.items, '0');
    const observer = mutations(root);
    for (let i=0;i<100;i++) {
      const result = filterCardBrowserItems(root, () => true);
      selectCardBrowserItems(result.items, '0'); refreshCardBrowser(root,{items:result.items});
    }
    expect(observer.read()).toHaveLength(0);
    expect(cardBrowserItems(root)).toEqual(first.items);
    selectCardBrowserItems(first.items, '1');
    expect(observer.read()).toHaveLength(4); observer.stop();
    console.log('200 retained controls, 100 unchanged projections: 0 list DOM mutations; selection change: 4 attribute mutations');
  });
  it('keeps keyboard focus on visible cards when paging and filtering, including an empty result', () => {
    const root=mount(9), items=cardBrowserItems(root);
    items[1].focus();items[1].dispatchEvent(new KeyboardEvent('keydown',{key:'PageDown',bubbles:true}));
    expect(document.activeElement).toBe(items[4]);expect(items[4].hidden).toBe(false);
    filterCardBrowserItems(root,item=>item.dataset.browserKey==='8');refreshCardBrowser(root,{reset:true});
    expect(document.activeElement).toBe(items[8]);
    filterCardBrowserItems(root,()=>false);refreshCardBrowser(root,{reset:true});
    expect(document.activeElement).toBe(root);expect(root.querySelector('.card-browser-position').textContent).toBe('暂无卡牌');
  });
  it('keeps the focused card visible across column changes without stealing search focus', () => {
    const root=mount(12), items=cardBrowserItems(root);
    root.querySelector('[data-browser-page="next"]').click();items[6].focus();
    root.dataset.browserColumns='2';refreshCardBrowser(root);
    expect(document.activeElement).toBe(items[6]);expect(items[6].hidden).toBe(false);
    const search=document.createElement('input');document.body.append(search);search.focus();
    filterCardBrowserItems(root,()=>false);refreshCardBrowser(root,{reset:true});expect(document.activeElement).toBe(search);
  });
  it.each(['inert','hidden','closing'])('does not page while the browser is %s', state => {
    const root=mount(9);
    if(state==='closing')root.classList.add('closing');else root.setAttribute(state,'');
    root.querySelector('[data-browser-page="next"]').click();
    expect(root.querySelector('.card-browser-position').textContent).toBe('1 / 3');
  });
  it('same-call items skip another selector scan; replacement and insertion require a fresh list', () => {
    const root = mount(8), track = root.querySelector('.card-browser-track');
    const {items} = filterCardBrowserItems(root, () => true);
    const query = vi.spyOn(track,'querySelectorAll');
    refreshCardBrowser(root,{items}); expect(query).not.toHaveBeenCalled();
    const replacement = items[0].cloneNode(true); replacement.dataset.browserKey='new'; items[0].replaceWith(replacement);
    refreshCardBrowser(root,{items}); expect(query).toHaveBeenCalledOnce();
    expect(cardBrowserItems(track,items)[0]).toBe(replacement);
    const extra = replacement.cloneNode(true); extra.dataset.browserKey='extra'; track.append(extra);
    expect(cardBrowserItems(track,items)).toHaveLength(9);
  });
  it('filter state is read fresh on each pagination refresh; no cross-call projection is cached', () => {
    const root = mount(9), {items} = filterCardBrowserItems(root, () => true);
    root.querySelector('[data-browser-page="next"]').click();
    items.slice(0,8).forEach(item => { item.dataset.browseFiltered='true'; });
    refreshCardBrowser(root,{items});
    expect(items.filter(item => !item.hidden).map(item => item.dataset.browserKey)).toEqual(['8']);
    expect(root.querySelector('.card-browser-position').textContent).toBe('1 / 1');
  });
  it('a connected old list outside current pageBody neither opens nor changes selection', () => {
    const root = mount(), list = cardBrowserItems(root);
    const other = document.createElement('section'); document.body.append(other); ui.el.ovBody=other;
    const observer=mutations(root); selectCardBrowserItems(list,'5'); refreshCardBrowser(root);
    root.querySelector('[data-browser-page="next"]').click();
    expect(cardBrowserItems(root)).toEqual([]); expect(observer.read()).toHaveLength(0); observer.stop();
  });
  it('detached browser callbacks do not open cards or mutate shared page state', () => {
    document.body.innerHTML = cardBrowserHTML('old-list','卡','<button data-browser-key="x">x</button>');
    const root=document.body.firstElementChild, open=vi.fn(); bindCardBrowser(root,{onOpen:open});
    root.remove(); root.querySelector('[data-browser-key]').click(); expect(open).not.toHaveBeenCalled();
  });
});

describe('collection and personnel consumers', () => {
  it('collection with no owned cards keeps its genuine empty state', () => {
    const base={slot:++slot,data:{stash:[],collection:{}}};
    const cards={all:()=>[],cardHTML:()=>''};
    window.SDT.Base=base;document.body.innerHTML=collectionCardsHTML(base,cards);
    bindCollectionCards({root:document.body,base,cards,ui});
    expect(document.querySelector('[data-collection-count]').textContent).toBe('0 张已收藏');
    expect(document.querySelector('.collection-browse-tools').hidden).toBe(true);
    expect(document.querySelector('.collection-empty h3').textContent).toBe('尚未收藏卡牌');
  });

  it('collection distinguishes filtered matches from total ownership and restores totals after reset', () => {
    const catalog=[{id:'a',name:'火球',type:'法术'},{id:'b',name:'长剑',type:'装备'}];
    const base={slot:++slot,data:{stash:[],collection:{a:{name:'火球'},b:{name:'长剑'}}}};
    const cards={all:()=>catalog,cardHTML:card=>`<b>${card.name}</b>`};
    window.SDT.Base=base; document.body.innerHTML=collectionCardsHTML(base,cards);
    bindCollectionCards({root:document.body,base,cards,ui});
    const count=()=>document.querySelector('[data-collection-count]').textContent;
    const nodes=[...document.querySelectorAll('[data-browser-key]')];
    const input=document.querySelector('[data-collection-query]');
    const typeInput=document.querySelector('[data-collection-type]');
    const search=value=>{input.value=value;input.dispatchEvent(new Event('input'));};
    expect(count()).toBe('2 张已收藏');
    search('火');expect(count()).toBe('匹配 1 / 已收藏 2');
    search('不存在');expect(count()).toBe('匹配 0 / 已收藏 2');
    expect(document.querySelector('.collection-empty').hidden).toBe(false);
    ui.acts.collectionReset();expect(count()).toBe('2 张已收藏');
    typeInput.value='装备';typeInput.dispatchEvent(new Event('change'));
    expect(count()).toBe('匹配 1 / 已收藏 2');
    search('火');expect(count()).toBe('匹配 0 / 已收藏 2');
    ui.acts.collectionReset();search('   ');expect(count()).toBe('2 张已收藏');
    expect([...document.querySelectorAll('[data-browser-key]')]).toEqual(nodes);
    expect(document.querySelector('.collection-empty').hidden).toBe(true);
  });

  it('collection repeated selection retains detail controls, resolves only the requested ownership record, and sees in-place changes', () => {
    const catalog=Array.from({length:40},(_,i)=>({id:String(i),name:`卡${i}`,type:'法术',rarity:'古朴'}));
    let reads=0;
    const collection=new Proxy(Object.fromEntries(catalog.map(card=>[card.id,{name:card.name}])),{get(target,key){if(typeof key==='string')reads++;return target[key];}});
    const base={slot:++slot,data:{stash:[],collection}}, cards={all:()=>catalog,cardHTML:card=>`<b>${card.name}</b>`};
    window.SDT.Base=base; document.body.innerHTML=collectionCardsHTML(base,cards);
    bindCollectionCards({root:document.body,base,cards,ui});
    const browser=document.querySelector('[data-card-browser]'), button=browser.querySelector('[data-browser-key="1"]');
    button.click(); const detail=document.querySelector('[data-act="collectionV12Zoom"]'); reads=0;
    const observer=mutations(browser); button.click();
    expect(reads).toBe(1); expect(document.querySelector('[data-act="collectionV12Zoom"]')).toBe(detail);
    expect(observer.read()).toHaveLength(0); observer.stop();
    catalog[1].name='更新后的卡'; button.click(); expect(document.querySelector('.collection-v12-stage').textContent).toContain('更新后的卡');
    const input=document.querySelector('[data-collection-query]'); input.value='无匹配';
    input.dispatchEvent(new InputEvent('input',{isComposing:true}));
    expect(browser.querySelector('[data-browser-key]').hidden).toBe(false);
    input.dispatchEvent(new window.CompositionEvent('compositionend'));
    expect([...browser.querySelectorAll('[data-browser-key]')].every(item=>item.hidden)).toBe(true);
    ui.acts.collectionReset(); expect(browser.querySelector('[data-browser-key]').hidden).toBe(false);
  });
  it('collection direct lookup preserves last-duplicate catalog and stash precedence', () => {
    const first={id:'dup',name:'旧卡'}, last={id:'dup',name:'新卡'};
    const base={slot:++slot,data:{collection:{dup:{name:'记录'}},stash:[{card:first},{card:last}]}};
    const cards={all:()=>[first,last],cardHTML:card=>`<b>${card.name}</b>`};
    window.SDT.Base=base; document.body.innerHTML=collectionCardsHTML(base,cards);
    bindCollectionCards({root:document.body,base,cards,ui});
    ui.acts.collectionV12Zoom({id:'dup'}); expect(ui.showCardZoom.mock.calls.at(-1)[0]).toBe(last);
    cards.all=()=>[]; ui.acts.collectionV12Zoom({id:'dup'}); expect(ui.showCardZoom.mock.calls.at(-1)[0]).toBe(last);
  });
  it('personnel repeated filtering leaves pool controls intact and changes only selected controls', () => {
    const catalog=Array.from({length:12},(_,i)=>({id:String(i),name:`招式${i}`}));
    window.SDT.Cards={classPool:()=>catalog};
    document.body.innerHTML=`<section class="personnel-v2" data-section="pool"><span data-person-pool-count></span><div class="pool-empty"></div>${cardBrowserHTML('pool-test','招式',catalog.map(card=>`<button class="person-pool-card" data-browser-key="${card.id}" data-id="${card.id}" data-search="${card.name}" data-type="法术" data-recorded="true">${card.name}</button>`).join(''),{rows:1,columns:4})}</section>`;
    bindPersonnel({ui,refresh:vi.fn(),sound:{tick:vi.fn()}});
    const root=document.querySelector('[data-card-browser]'), items=cardBrowserItems(root), observer=mutations(root);
    for(let i=0;i<20;i++)ui.acts.personPoolType({type:''});
    expect(observer.read()).toHaveLength(0); expect(cardBrowserItems(root)).toEqual(items);
    ui.acts.personPoolPick({id:'1'}); expect(observer.read()).toHaveLength(4);
    expect(ui.showCardZoom).toHaveBeenCalledOnce(); observer.stop();
    root.querySelector('[data-browser-page="next"]').click();
    expect(root.querySelector('.card-browser-position').textContent).toBe('2 / 3');
    ui.acts.personPoolType({type:''});expect(root.querySelector('.card-browser-position').textContent).toBe('2 / 3');
    const saved=document.body.innerHTML;document.body.innerHTML=saved;
    bindPersonnel({ui,refresh:vi.fn(),sound:{tick:vi.fn()}});
    expect(document.querySelector('.card-browser-position').textContent).toBe('2 / 3');
  });
});
