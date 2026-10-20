// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
vi.mock('../game/src/run/game.session.js',()=>({MAP:{rules:{safeStart:2,safeMax:6}}}));
vi.mock('../game/src/hub/collection.commands.js',()=>({getCharacter:()=>({selectedSkinId:'default',availableSkinIds:['default']})}));
vi.mock('../game/src/ui/inventory-zoom.js',()=>({decorateInventoryZoom:vi.fn()}));
import { collectionCardsHTML,bindCollectionCards } from '../game/src/hub/hub.collection-v4.js';
import { personnelHTML,bindPersonnel,setPersonnelGroup,setPersonnelSection } from '../game/src/hub/hub.personnel.js';
let slot=0;
afterEach(async()=>{document.body.replaceChildren();await Promise.resolve();vi.unstubAllGlobals();});
function setup(){
 vi.stubGlobal('matchMedia',()=>({matches:true}));
 const catalog=Array.from({length:40},(_,i)=>({id:`card-${i}`,name:`测试牌${i}`,desc:`条件${i}`,type:i%2?'法术':'武术'}));
 const cards={all:()=>catalog,classPool:()=>catalog,cardHTML:vi.fn(card=>`<div class="hs-card">${card.name}</div>`)};
 const base={slot:++slot,data:{collection:Object.fromEntries(catalog.map(card=>[card.id,true])),stash:[]},isCollected:card=>Number(card.id.split('-')[1])%2===0};
 window.SDT={Cards:cards,Base:base,Meta:{classSummary:()=>[{cls:'侠客',lv:1,xp:0,need:50}],perkText:()=>'',isCollectible:()=>true},Art:{listSkins:()=>[],skinUrl:()=>'/wu.webp',classAvatarArt:()=>'<img alt="">'}};
 const actions=new Map();const ui={act:(key,fn)=>actions.set(key,fn),showCardZoom:vi.fn()};
 return {cards,base,catalog,ui,actions};
}
describe('visible-only hub card faces',()=>{
 it('collection retains all identities and exact zoom data while constructing only the current page',()=>{
  const {cards,base,catalog,ui,actions}=setup();const before=JSON.stringify(base.data);
  document.body.innerHTML=`<main id="hubMain">${collectionCardsHTML(base,cards)}</main>`;
  expect(cards.cardHTML).toHaveBeenCalledTimes(1);
  const root=document.querySelector('#hubMain');bindCollectionCards({root,base,cards,ui});
  expect(root.querySelectorAll('[data-browser-key]')).toHaveLength(40);expect(root.querySelectorAll('.hs-card')).toHaveLength(4);
  const query=root.querySelector('input');query.value='测试牌39';query.dispatchEvent(new Event('input'));
  const chosen=root.querySelector('[data-browser-key="card-39"]');expect(chosen.hidden).toBe(false);expect(chosen.querySelector('.hs-card').textContent).toBe('测试牌39');
  chosen.click();actions.get('collectionV12Zoom')({id:'card-39'});expect(ui.showCardZoom).toHaveBeenCalledWith(catalog[39],expect.any(Object));
  expect(JSON.stringify(base.data)).toBe(before);
  // A new page with the same saved filter must not build the unfiltered first page.
  cards.cardHTML.mockClear();document.body.innerHTML=`<main id="hubMain">${collectionCardsHTML(base,cards)}</main>`;
  bindCollectionCards({root:document.querySelector('#hubMain'),base,cards,ui});
  expect(cards.cardHTML.mock.calls.every(([card])=>card.id==='card-39')).toBe(true);
 });
 it('personnel builds four of forty faces, filters through all metadata and opens the original card',()=>{
  const {cards,base,catalog,ui}=setup();const before=JSON.stringify(base.data);setPersonnelGroup('people');setPersonnelSection('pool');
  document.body.innerHTML=personnelHTML('wu');expect(cards.cardHTML).not.toHaveBeenCalled();
  bindPersonnel({ui,refresh:()=>{},sound:{tick:()=>{}}});expect(cards.cardHTML).toHaveBeenCalledTimes(4);
  const query=document.querySelector('[data-person-pool="query"]');query.value='条件39';query.dispatchEvent(new Event('input'));
  const chosen=document.querySelector('[data-browser-key="card-39"]');expect(chosen.hidden).toBe(false);expect(chosen.querySelector('.hs-card')).not.toBeNull();chosen.click();
  expect(ui.showCardZoom).toHaveBeenCalledWith(catalog[39],expect.objectContaining({from:chosen}));expect(JSON.stringify(base.data)).toBe(before);
  cards.cardHTML.mockClear();document.body.innerHTML=personnelHTML('wu');bindPersonnel({ui,refresh:()=>{},sound:{tick:()=>{}}});
  expect(cards.cardHTML.mock.calls.map(([card])=>card.id)).toEqual(['card-39']);
 });
});
