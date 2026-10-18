import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createBaseDepartureCommands } from '../game/src/hub/base-departure.commands.js';
const ports = vi.hoisted(() => ({ choice: vi.fn(), start: vi.fn(), hub: vi.fn(), handoff: vi.fn(), transition: vi.fn() }));
vi.mock('../game/src/run/game.session.js', () => ({
  MAP: { rules: { starterSha: 5 } }, MODES: { standard: { id: 'standard', name: '标准' } },
  getActiveSlot:()=>1, exitToTitle:vi.fn(), saveGame:vi.fn(()=>true), game: { stackCapOf: card => card.name === '初始攻击' ? 5 : 3 }, newRun: ports.start, requestClassChoice: ports.choice,
}));
vi.mock('../game/src/hub/game.cardslib.js', () => ({ Sfx: { tick: vi.fn() }, _set_cardPageOpen: vi.fn() }));
vi.mock('../game/src/hub/game.hub.bridge.js', () => ({ slots: { renderHub: ports.hub } }));
vi.mock('../game/src/hub/base.commands.js', () => ({ readBase: vi.fn(), readBaseReceipt: vi.fn(), commitBase: vi.fn() }));
vi.mock('../game/src/run/game.run.scenes.js',()=>({preloadAllNodeShellBgs(){},showRunTransition:(...args)=>ports.transition(...args)}));

let actions, base, ui, departure;
const first = { id: 'first', name: '同名牌', rarity: '古朴', type: '道具', cost: 1 };
const second = { id: 'second', name: '同名牌', rarity: '稀有', type: '法术', cost: 2, variantKey: 'foil' };
beforeEach(async () => {
  vi.resetModules(); Object.values(ports).forEach(mock => mock.mockReset());
  ports.transition.mockImplementation(()=>Object.assign(Promise.resolve(true),{isCurrent:()=>true}));
  actions = {};
  base = { slot: 1, data: { selMode: 'standard', pocket: [], stash: [{ card: first, count: 2 }, { card: second, count: 2 }] },
    PETS: [], bagCap: () => 16, carriedPet: () => null, ownedPets: () => [], setPet: vi.fn(() => true), petById: () => ({ name: '宠物', desc: '效果' }) };
  const overlay = document.createElement('div'); overlay.id = 'overlay'; document.body.replaceChildren(overlay);
  ui = { hideOverlay(){overlay.hidden=true;},refresh(){}, el: { overlay }, _acts: actions, act: (id, handler) => { actions[id] = handler; },
    showOverlay: (_title, html) => { overlay.hidden=false;overlay.innerHTML = html; }, showCardZoom: vi.fn(), log: vi.fn() };
  window.SDT = { UI: ui, Base: base, Cards: { SHA: { id: 'starter-attack', name: '初始攻击' }, cardHTML: card => `<span data-card-id="${card.id}">${card.name}</span>`, RARITIES: [], TYPES: [], rarityOf: card => card.rarity },
    Icons: { rich: html => html }, Sound: { sfx: vi.fn() } };
  vi.stubGlobal('matchMedia', () => ({ matches: true }));
  window.SDT.Meta={classLv:()=>1,classXP:()=>0,LEVEL_MAX:10,xpForNext:()=>100,perkText:()=>''};
  window.SDT.Art={warmClassRoster(){},classFullArt:()=>'',classArt:()=>'',listSkins:()=>[],getSkin:()=>''};
  window.SDT.Cards.classPool=()=>[{id:'class',name:'职业卡'}];window.SDT.Cards.randomClassCard=()=>({id:'class',name:'职业卡'});
  const {game}=await import('../game/src/run/game.session.js'); window.SDT.game=game;
  Object.assign(game,{myClass:null,characterId:null,seed:'old-run',runActive:false,discoveredPairs:new Set(),layerIdx:3,trackPos:11,ownedCards:[],hp:30,maxHp:30});
  const {openClassChoice}=await import('../game/src/run/game.run.class-choice.page.js');ports.choice.mockImplementation(openClassChoice);
  departure = await import('../game/src/hub/game.hub.depart.js');
  ports.start.mockImplementation((_mode, picks) => {
    const commands = createBaseDepartureCommands({ read: () => base.data, mutate: prepare => { const draft = structuredClone(base.data); const result = prepare(draft); base.data = draft; return result; } });
    const ok=commands.prepareDeparture(picks).ok; if(ok)Object.assign(window.SDT.game,{seed:'new-run',runActive:true,discoveredPairs:new Set(),myClass:null,layerIdx:0,trackPos:0});return ok;
  });
});


afterEach(()=>{vi.useRealTimers();vi.unstubAllGlobals();document.body.replaceChildren();});
it('real selection and departure after a completed run',async()=>{
 vi.useFakeTimers();
 await departure.openDepartPrep(); actions.pickClass();
 expect(document.getElementById('depMain')).not.toBeNull();
 actions.confirmDeploy(); await vi.advanceTimersByTimeAsync(2000);
 expect(ports.start).toHaveBeenCalledTimes(1);
 expect(window.SDT.game.runActive).toBe(true);expect(ui.el.overlay.hidden).toBe(true);
 Object.assign(window.SDT.game,{runActive:false,layerIdx:3,trackPos:11});
 await departure.openDepartPrep();actions.pickClass();
 expect(document.getElementById('depMain')).not.toBeNull();
 actions.confirmDeploy();await vi.advanceTimersByTimeAsync(2000);
 expect(ports.start).toHaveBeenCalledTimes(2);expect(ui.el.overlay.hidden).toBe(true);
});

it.each(['context','false','throw'])('rejected %s restores current controls and preserves picks',async reason=>{
 vi.useFakeTimers();await departure.openDepartPrep();actions.pickClass();
 actions.pickAdd({name:first.name,stackKey:'card:first'});
 const before=structuredClone(base.data),picks={...departure.deployPick};
 const diagnostic=vi.spyOn(console,'error').mockImplementation(()=>{});
 if(reason==='context')window.SDT.game.discoveredPairs=new Set();
 if(reason==='false')ports.start.mockReturnValueOnce(false);
 if(reason==='throw')ports.start.mockImplementationOnce(()=>{throw new Error('departure failure');});
 actions.confirmDeploy();await vi.advanceTimersByTimeAsync(2000);
 expect(document.querySelector('#btnDeploy').disabled).toBe(false);
 expect(document.querySelector('#depStatus').textContent).toContain('出发未完成');
 expect(base.data).toEqual(before);expect(departure.deployPick).toEqual(picks);
 expect(window.SDT.game.runActive).toBe(false);
 expect(diagnostic).toHaveBeenCalledTimes(reason==='throw'?1:0);
 if(reason==='context')expect(ports.start).not.toHaveBeenCalled();
 diagnostic.mockRestore();
 // Visible recovery through character selection creates a fresh context.
 await actions.depBack();actions.pickClass();actions.confirmDeploy();await vi.advanceTimersByTimeAsync(2000);
 expect(window.SDT.game.runActive).toBe(true);expect(ui.el.overlay.hidden).toBe(true);
});
it('a committed run waiting on navigation cannot be submitted twice',async()=>{
 vi.useFakeTimers();let resolve;const transition=Object.assign(new Promise(r=>{resolve=r;}),{isCurrent:()=>true});ports.transition.mockReturnValueOnce(transition);
 await departure.openDepartPrep();actions.pickClass();actions.confirmDeploy();
 await vi.advanceTimersByTimeAsync(20);expect(ports.start).toHaveBeenCalledTimes(1);
 actions.confirmDeploy();expect(ports.start).toHaveBeenCalledTimes(1);
 expect(document.querySelector('.departure-handoff')).not.toBeNull();
 resolve(true);await vi.advanceTimersByTimeAsync(2000);
 expect(document.querySelector('.departure-handoff')).toBeNull();expect(window.SDT.game.state).toBe('idle');
});
it('old transition rejection never modifies a newly opened preparation page',async()=>{
 vi.useFakeTimers();let reject;const transition=Object.assign(new Promise((_,r)=>{reject=r;}),{isCurrent:()=>false});ports.transition.mockReturnValueOnce(transition);
 const diagnostic=vi.spyOn(console,'error').mockImplementation(()=>{});
 await departure.openDepartPrep();actions.pickClass();actions.confirmDeploy();await vi.advanceTimersByTimeAsync(20);
 Object.assign(window.SDT.game,{runActive:false});await departure.openDepartPrep();actions.pickClass();
 const stage=document.getElementById('depMain'),status=document.querySelector('#depStatus').textContent;
 reject(new Error('old navigation'));await vi.advanceTimersByTimeAsync(2000);
 expect(document.getElementById('depMain')).toBe(stage);expect(document.querySelector('#depStatus').textContent).toBe(status);expect(document.querySelector('#btnDeploy').disabled).toBe(false);expect(ports.start).toHaveBeenCalledTimes(1);
 diagnostic.mockRestore();
});
