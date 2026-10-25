import {afterEach,expect,it,vi} from 'vitest';
vi.mock('../../../../../game/src/hub/collection.commands.js',()=>({getCharacter:()=>({selectedSkinId:'default',availableSkinIds:['default']})}));
vi.mock('../../../../../game/src/run/game.session.js',()=>({MAP:{rules:{}}}));
afterEach(()=>{document.body.replaceChildren();vi.unstubAllGlobals();});
const source=()=>Array.from({length:40},(_,id)=>({id:String(id),name:`卡${id}`,desc:'说明',type:'法术',rarity:'古朴'}));
const shape=()=>({keys:[...document.querySelectorAll('[data-browser-key]')].map(item=>item.dataset.browserKey),
  visible:[...document.querySelectorAll('[data-browser-key]')].filter(item=>!item.hidden).map(item=>item.dataset.browserKey),
  selected:[...document.querySelectorAll('[aria-pressed="true"][data-browser-key]')].map(item=>item.dataset.browserKey),
  detail:document.querySelector('.collection-v12-info')?.textContent});
async function owned(before){
  vi.resetModules();vi.stubGlobal('matchMedia',()=>({matches:true}));
  const pool=source(),cards={all:vi.fn(()=>pool),cardHTML:vi.fn(card=>`<b>${card.name}</b>`)};
  const base={slot:91000,data:{collection:Object.fromEntries(pool.map(card=>[card.id,true])),stash:[]}},ui={act:vi.fn(),showCardZoom:vi.fn()};
  window.SDT={Base:base};
  const feature=before ? await import('collection-before:game/src/hub/hub.collection-v4.js') : await import('../../../../../game/src/hub/hub.collection-v4.js');
  document.body.innerHTML=feature.collectionCardsHTML(base,cards);feature.bindCollectionCards({root:document.body,base,cards,ui});
  const initial={all:cards.all.mock.calls.length,faces:cards.cardHTML.mock.calls.length},trace=[shape()];
  cards.all.mockClear();cards.cardHTML.mockClear();const input=document.querySelector('input');input.value='卡39';input.dispatchEvent(new Event('input'));
  const filter={all:cards.all.mock.calls.length,faces:cards.cardHTML.mock.calls.length};trace.push(shape());
  const button=document.querySelector('[data-browser-key="39"]');button.focus();pool[39].name='即时更新';button.click();trace.push({...shape(),retained:button===document.querySelector('[data-browser-key="39"]'),focused:document.activeElement===button});
  return {initial,filter,trace};
}
async function personnel(before){
  vi.resetModules();vi.stubGlobal('matchMedia',()=>({matches:true}));const pool=source(),classPool=vi.fn(()=>pool),isCollectible=vi.fn(()=>true),cardHTML=vi.fn(card=>`<b>${card.name}</b>`);
  window.SDT={Base:{slot:91001,data:{characters:{}},isCollected:()=>false},Meta:{classSummary:()=>[{cls:'侠客',lv:1,xp:0,need:50}],isCollectible,perkText:()=>''},Art:{listSkins:()=>[],skinUrl:()=>'/wu.webp',classAvatarArt:()=>''},Cards:{classPool,cardHTML}};
  const feature=before ? await import('collection-before:game/src/hub/hub.personnel.js') : await import('../../../../../game/src/hub/hub.personnel.js');
  feature.setPersonnelGroup('people');feature.setPersonnelSection('pool');document.body.innerHTML=feature.personnelHTML('wu');feature.bindPersonnel({ui:{act:vi.fn()},refresh:vi.fn(),sound:{tick:vi.fn()}});
  return {pool:classPool.mock.calls.length,records:isCollectible.mock.calls.length,faces:cardHTML.mock.calls.length,shape:shape()};
}
it('reduces the actual owned/pool computation chains while retaining semantic output and nodes',async()=>{
  const oldOwned=await owned(true),newOwned=await owned(false),oldPool=await personnel(true),newPool=await personnel(false);
  expect(newOwned.trace).toEqual(oldOwned.trace);expect(newPool.shape).toEqual(oldPool.shape);
  expect(oldOwned.initial).toEqual({all:4,faces:4});expect(newOwned.initial).toEqual({all:1,faces:4});
  expect(oldOwned.filter).toEqual({all:2,faces:2});expect(newOwned.filter).toEqual({all:1,faces:2});
  expect([oldPool.pool,newPool.pool,oldPool.records,newPool.records,oldPool.faces,newPool.faces]).toEqual([5,2,80,40,4,4]);
  console.log(JSON.stringify({owned:{before:oldOwned.initial,after:newOwned.initial,filterBefore:oldOwned.filter,filterAfter:newOwned.filter},personnel:{before:oldPool,after:newPool}},null,2));
});
