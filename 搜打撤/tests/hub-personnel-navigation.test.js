// @vitest-environment jsdom
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
vi.mock('../game/src/run/game.session.js', () => ({ MAP:{rules:{safeStart:2,safeMax:6}} }));
vi.mock('../game/src/hub/collection.commands.js', () => ({ getCharacter:() => ({selectedSkinId:'default',availableSkinIds:['default']}) }));
import { personnelHTML, bindPersonnel, personnelBackTarget, setPersonnelGroup, setPersonnelSection } from '../game/src/hub/hub.personnel.js';

let base, actions, refresh;
beforeEach(() => {
  const dog={id:'dog',name:'汪汪',desc:'携带效果：保护卡牌'};
  base={slot:Math.random(),data:{stash:[],coins:0,rations:0},PETS:[dog],ownedPets:()=>['dog'],carriedPet:()=>dog,petLevel:()=>1,petUpCost:()=>2,PET_LEVEL_MAX:5,PET_EGG_ID:'egg',HATCH_COST:50};
  window.SDT={Base:base,Meta:{classSummary:()=>[{cls:'侠客',lv:1,xp:0,need:50,pool:1,maxed:false}],perkText:level=>`生命 +${level}`,isCollectible:()=>true},Art:{listSkins:()=>[],skinUrl:()=>'/wu.webp',classAvatarArt:()=>'<img alt="无" src="/wu.webp">'},Cards:{all:()=>[],classPool:()=>[],cardHTML:()=>''}};
  setPersonnelGroup('people');setPersonnelSection('profile');
  actions=new Map();refresh=vi.fn(()=>render());
  vi.stubGlobal('matchMedia',()=>({matches:true}));
});
afterEach(()=>{document.body.replaceChildren();vi.unstubAllGlobals();});
function render(){document.body.innerHTML=personnelHTML('wu');bindPersonnel({ui:{act:(key,handler)=>actions.set(key,handler)},sound:{tick:vi.fn()},refresh});return document.body;}

it('孵化保存期间连点不重复扣币，成就检查在后台完成', async () => {
 let finishHatch,finish;let eggs=2;base.data.coins=100;
 base.hatchPet=vi.fn(()=>new Promise(resolve=>{finishHatch=()=>{base.data.coins-=50;eggs--;resolve({ok:true,pet:base.PETS[0]});};}));
 window.SDT.Meta.checkUnlocks=vi.fn(()=>new Promise(resolve=>{finish=resolve;}));
 const ui={act:(name,handler)=>actions.set(name,handler),log:vi.fn(),isCurrent:()=>true};
 bindPersonnel({ui,sound:{tick:vi.fn(),ding:vi.fn()},refresh});const pending=actions.get('personHatch')();
 expect(await actions.get('personHatch')()).toBe(false);expect(base.hatchPet).toHaveBeenCalledOnce();expect(refresh).not.toHaveBeenCalled();
 finishHatch();await pending;expect(base.data.coins).toBe(50);expect(eggs).toBe(1);expect(refresh).toHaveBeenCalledOnce();
 await vi.waitFor(()=>expect(finish).toBeTypeOf('function'));finish([]);
});

it('integrated personnel tabs keep one growth action and return from appearance without changing the save',()=>{
  const before=JSON.stringify(base.data),root=render();
  expect(root.querySelectorAll('.pv12-sections button')).toHaveLength(4);
  expect(root.querySelector('[data-act="hubTab"][data-character="wu"]')).not.toBeNull();
  expect(root.querySelector('.person-sections')).toBeNull();
  expect(personnelBackTarget()).toBeNull();
  actions.get('personSection')({section:'appearance'});
  expect(document.querySelector('.personnel-v12[data-section="appearance"]')).not.toBeNull();
  expect(personnelBackTarget()).toEqual({action:'personnelHome',label:'返回角色'});
  actions.get('personnelHome')();
  expect(personnelBackTarget()).toBeNull();
  expect(JSON.stringify(base.data)).toBe(before);
});

it('hatching is a dedicated child page with conditions and returns one level at a time without consuming resources',()=>{
  const before=JSON.stringify(base.data);render();
  actions.get('personGroup')({group:'pets'});
  expect(personnelBackTarget().label).toBe('返回角色');
  actions.get('personHatchView')();
  expect(document.querySelector('.companion-hatch-scene')).not.toBeNull();
  expect(document.querySelector('.partner-stage')).toBeNull();
  expect(document.querySelector('[data-act="personHatch"]').disabled).toBe(true);
  expect(personnelBackTarget()).toEqual({action:'personHatchView',label:'返回伙伴'});
  actions.get(personnelBackTarget().action)();
  expect(document.querySelector('.partner-stage')).not.toBeNull();
  expect(personnelBackTarget().label).toBe('返回角色');
  expect(JSON.stringify(base.data)).toBe(before);
});

it('partner growth previews the selected non-carried partner and its own safe-slot bonus',()=>{
  const penguin={id:'penguin',name:'咕嘎',desc:'携带效果：安全格增加',effect:{safeBonus:2}};
  base.PETS.push(penguin);base.ownedPets=()=>['dog','penguin'];
  base.petLevel=id=>id==='penguin'?2:1;base.petUpCost=()=>3;base.data.rations=3;
  render();actions.get('personGroup')({group:'pets'});actions.get('personPet')({id:'penguin'});
  const growth=document.querySelector('.companion-growth').textContent;
  expect(growth).toContain('Lv.2→Lv.3');expect(growth).toContain('安全格 5→6');
  expect(document.querySelector('[data-act="upPet"]').disabled).toBe(false);
  expect(base.carriedPet().id).toBe('dog');
});
