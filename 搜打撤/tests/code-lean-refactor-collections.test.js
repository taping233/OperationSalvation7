import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {collectionCardsHTML,bindCollectionCards} from '../game/src/hub/hub.collection-v4.js';
import {personnelHTML,bindPersonnel,setPersonnelGroup,setPersonnelSection} from '../game/src/hub/hub.personnel.js';
vi.mock('../game/src/hub/collection.commands.js',() => ({getCharacter:() => ({selectedSkinId:'default',availableSkinIds:['default']})}));
vi.mock('../game/src/run/game.session.js',() => ({MAP:{rules:{}}}));
beforeEach(() => vi.stubGlobal('matchMedia',() => ({matches:true})));
afterEach(() => {document.body.replaceChildren();vi.unstubAllGlobals();});
const catalog = () => Array.from({length:40},(_,id) => ({id:String(id),name:`卡${id}`,type:'法术',rarity:'古朴',desc:'说明'}));
it('shares one owned-catalog projection between visible art and selected detail in each operation',() => {
  const source=catalog(),base={slot:88001,data:{collection:Object.fromEntries(source.map(card => [card.id,true])),stash:[]}};
  const cards={all:vi.fn(() => source),cardHTML:vi.fn(card => `<b>${card.name}</b>`)};
  window.SDT={Base:base};const ui={act:vi.fn(),showCardZoom:vi.fn()};
  document.body.innerHTML=collectionCardsHTML(base,cards);bindCollectionCards({root:document.body,base,cards,ui});
  expect(cards.all).toHaveBeenCalledTimes(1);
  const button=document.querySelector('[data-browser-key="39"]'),input=document.querySelector('input');
  cards.all.mockClear();cards.cardHTML.mockClear();input.value='卡39';input.dispatchEvent(new Event('input'));
  expect(cards.all).toHaveBeenCalledTimes(1);expect(cards.cardHTML).toHaveBeenCalledTimes(2);
  expect(document.querySelector('.collection-v12-info h3').textContent).toBe('卡39');
  source[39].name='即时更新';cards.all.mockClear();button.click();
  expect(cards.all).toHaveBeenCalledTimes(1);expect(document.querySelector('.collection-v12-info h3').textContent).toBe('即时更新');
  expect(document.querySelector('[data-browser-key="39"]')).toBe(button);
});
it('projects each personnel record once and resolves the four visible faces from one live pool',() => {
  const pool=catalog(),classPool=vi.fn(() => pool),isCollectible=vi.fn(() => true),cardHTML=vi.fn(card => `<b>${card.name}</b>`);
  window.SDT={Base:{slot:88002,data:{characters:{}},isCollected:() => false},
    Meta:{classSummary:() => [{cls:'侠客',lv:1,xp:0,need:50}],isCollectible,perkText:() => ''},
    Art:{listSkins:() => [],skinUrl:() => '/wu.webp',classAvatarArt:() => ''},Cards:{classPool,cardHTML}};
  setPersonnelGroup('people');setPersonnelSection('pool');document.body.innerHTML=personnelHTML('wu');
  bindPersonnel({ui:{act:vi.fn()},refresh:vi.fn(),sound:{tick:vi.fn()}});
  expect(isCollectible).toHaveBeenCalledTimes(40);expect(classPool).toHaveBeenCalledTimes(2);
  expect(cardHTML).toHaveBeenCalledTimes(4);
  expect(document.querySelectorAll('[data-browser-key]')).toHaveLength(40);
});
