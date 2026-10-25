import {afterEach,expect,it,vi} from 'vitest';
const game = {state:'title',devMode:true};
vi.mock('../../../../../game/src/run/game.session.js', () => ({game}));
afterEach(() => { document.dispatchEvent(new CustomEvent('sdt-overlay-close')); vi.clearAllTimers();vi.useRealTimers();vi.unstubAllGlobals();document.body.replaceChildren(); });

async function scenario(before, windowed) {
  vi.resetModules();vi.useFakeTimers();game.state='title';game.devMode=true;
  document.body.className='';document.body.innerHTML='<div id="overlay" hidden><div id="ovBody"></div></div>';
  const frames=[], observers=[], actions={}, logs=[], zooms=[], shows=[];
  vi.stubGlobal('requestAnimationFrame',fn => {frames.push(fn);return frames.length;});
  vi.stubGlobal('cancelAnimationFrame',() => {});
  vi.stubGlobal('matchMedia',() => ({matches:false}));
  vi.stubGlobal('IntersectionObserver',windowed ? class {
    constructor(callback){this.callback=callback;this.targets=new Set();observers.push(this);}
    observe(target){this.targets.add(target);}unobserve(target){this.targets.delete(target);}disconnect(){this.targets.clear();}
  } : undefined);
  const cards=Array.from({length:170},(_,index) => ({id:'photo-'+index,name:`照片${index}`,desc:'说明'+index,type:index%2 ? '道具':'法术',rarity:index%3 ? '古朴':'棱彩',cost:index%5}));
  const body=document.getElementById('ovBody'),overlay=document.getElementById('overlay');
  const UI={_acts:actions,el:{overlay,ovBody:body},act:(name,callback)=>{actions[name]=callback;},
    showOverlay(title,html,mode){shows.push({title,html,mode});body.innerHTML=html;overlay.hidden=false;document.dispatchEvent(new CustomEvent('sdt-overlay-mode',{detail:mode}));},
    hideOverlay(){document.dispatchEvent(new CustomEvent('sdt-overlay-close'));overlay.hidden=true;},
    refresh:()=>{},log:(...args)=>logs.push(args),showCardZoom:(card,options)=>zooms.push({id:card.id,presentation:options.presentation,note:options.note})};
  window.SDT={UI,Base:{slot:1},Sound:{sfx:()=>{}},Icons:{img:()=>'',rich:value=>value},Art:{cardIcon:card=>`<img data-lib-src="/${card.id}.png" alt="">`},Cards:{
    all:()=>cards,RARITIES:['古朴','棱彩'],TYPES:['法术','道具'],DMG_TYPES:['法术'],DMG_TYPE_META:{},TYPE_ART:{},
    deriveDraw:()=>0,deriveInfuse:()=>0,deriveHeal:()=>0,deriveArmor:()=>0,rarityOf:card=>card.rarity}};
  HTMLElement.prototype.scrollIntoView=()=>{};
  const page=before ? await import('frozen-library:game.cardslib.page.js') : await import('../../../../../game/src/hub/game.cardslib.page.js');
  const trace=[];
  const capture=label=>trace.push({label,html:body.innerHTML,focus:document.activeElement?.outerHTML,state:game.state,bodyClass:document.body.className});
  page.openCardLibrary();capture('open');
  const initialGrid=document.getElementById('libGrid');
  for(let i=0;i<frames.length&&i<10;i++)frames[i]();capture('shells-complete');
  if(windowed){const observer=observers.find(item=>[...item.targets].some(target=>target.classList.contains('lib-ph')));const shell=initialGrid.querySelector('.lib-ph');observer.callback([{target:shell,isIntersecting:true}]);capture('mount');observer.callback([{target:shell,isIntersecting:false}]);capture('unmount');}
  const search=document.getElementById('cardSearch');search.focus();search.value='照片1';UI._inputHandler({target:search});vi.advanceTimersByTime(120);capture('search');
  actions.libClearFilter();capture('reset');actions.libTab({t:'法术'});capture('tab');
  const sort=document.getElementById('libSort');sort.value='cost';UI._inputHandler({target:sort});capture('sort');
  actions.libNext();capture('step');actions.libInspect({card:document.querySelector('.studio-zoom').dataset.card});
  actions.libEditMode();capture('export-tools');
  const noops=['newCard','editCard','delCard','importCards'].map(name=>[name,actions[name]({id:cards[0].id})]);capture('frozen-writes');
  actions.exportCards();capture('export');actions.backLib();capture('return');
  const oldClose=actions.closeCardPage;oldClose();capture('close');page.openCardLibrary();capture('reopen');oldClose();capture('old-close-ignored');
  document.dispatchEvent(new CustomEvent('sdt-overlay-close'));vi.clearAllTimers();
  return {trace,shows,logs,zooms,noops};
}
it.each([false,true])('preserves raw HTML, DOM, input/selection/export and tile lifecycle (windowed=%s)',async windowed=>{
  expect(await scenario(false,windowed)).toEqual(await scenario(true,windowed));
});
