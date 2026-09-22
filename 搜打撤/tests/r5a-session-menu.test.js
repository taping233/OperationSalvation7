import { beforeAll,beforeEach,describe,expect,it,vi } from 'vitest';
import { createLayeredMap } from '../game/src/layeredMap.js';
import { createMapSnapshot } from '../game/src/map-snapshot.js';

const ctx=new Proxy({}, {get:()=>()=>ctx,set:()=>true});
window.HTMLCanvasElement.prototype.getContext=()=>ctx;
document.body.innerHTML='<canvas id="game"></canvas><div id="title"></div><div id="exitScr"></div>';
window.SDT={Icons:{img:()=>'',TYPE_ART:{}},Sound:{music(){},sfx(){},setDucked(){}},FX:{feedback(){}},
  MAP:{rules:{playerMaxHp:50,playerAtk:4,fireHeal:5,battleEnergy:2,battleHandMax:10,bossDeckSize:10,starterSha:0,battleStartDraw:5,battleTurnDraw:1,diceSides:6},items:{rations:{name:'口粮'},wood:{name:'木材'}}}};
await import('../game/src/cards.js');
await import('../game/src/ui.js');
await import('../game/src/base.js');
const session=await import('../game/src/game.session.js');
const { Random }=await import('../game/src/random.js');
const { RunStorage }=await import('../game/src/game.storage.js');
const { createGameMenuController }=await import('../game/src/game.menu.js');

beforeAll(()=>{
  Object.assign(window.SDT.UI,{log(){},refresh(){},clearLog(){},hideOverlay(){},hideScreen(){},showScreen(){},showOverlay(){},act(){},registerHelp(){},helpBtn(){return'';}});
  window.SDT.Meta={setXpMul(){},track(){}};
  window.SDT.Nest={renderNestMap(){}};
});
beforeEach(()=>localStorage.clear());

describe('R5-a real session persistence',()=>{
  it('正式newRun走通用覆盖并保存严格v2，恢复routePlan不重算',()=>{
    const slot=2; window.SDT.Base.use(slot); session._set_active_slot(slot);
    session.newRun('standard',[],{skipClassChoice:true});
    expect(['applied','fallback']).toContain(session.game.routePlan.status);
    expect(session.saveGame()).toBe(true);
    const stored=JSON.parse(localStorage.getItem(RunStorage.key(slot)));
    expect(stored.mapSnapshot.snapshotVersion).toBe(2); expect(stored.routeVersion).toBe('r5-routes-v1');
    const plan=structuredClone(stored.mapSnapshot.routePlan);
    expect(session.loadGame(slot).ok).toBe(true); expect(session.game.routePlan).toEqual(plan);
  });

  it('saveGame写canonical snapshot，loadGame恢复原拓扑与位置',()=>{
    const slot=5, seed='session-route';
    window.SDT.Base.use(slot); session._set_active_slot(slot);
    session.buildDerived(seed); session.game.runActive=true; session.game.nestActive=false; session.game.state='idle';
    session.game.layerIdx=1; session.game.trackPos=session.game.layerData[1].entrances[0];
    const expected=session.game.layerData.map(l=>l.logical.map(n=>({id:n.id,type:n.def.type,x:n.x,row:n.row,next:n.next})));
    expect(session.saveGame()).toBe(true);
    const stored=JSON.parse(localStorage.getItem(RunStorage.key(slot)));
    expect(stored.mapSnapshot.snapshotVersion).toBe(1);
    session.game.layerData[0].logical[0].def.type='event'; session.game.layerIdx=0; session.game.trackPos=0;
    const loaded=session.loadGame(slot);
    expect(loaded.ok).toBe(true);
    expect(session.game.layerIdx).toBe(1);
    expect(session.game.layerData.map(l=>l.logical.map(n=>({id:n.id,type:n.def.type,x:n.x,row:n.row,next:n.next})))).toEqual(expected);
    expect(session.game.nestActive).toBe(false);
    session.game.trackPos=999;
    const oldRaw=localStorage.getItem(RunStorage.key(slot));
    expect(session.saveGame()).toBe(false); expect(localStorage.getItem(RunStorage.key(slot))).toBe(oldRaw);
  });

  it('坏地图不改变Random/game且原run串不被覆盖；nest无需普通layerData',()=>{
    const beforeRandom=Random.snapshot(), beforeLayers=session.game.layerData;
    const bad=JSON.stringify({version:2,seed:'bad',mapSeed:'bad',generatorVersion:99,layoutVersion:99,layerIdx:0,trackPos:0});
    localStorage.setItem(RunStorage.key(4),bad);
    const failed=session.loadGame(4);
    expect(failed.ok).toBe(false); expect(session.game.layerData).toBe(beforeLayers); expect(Random.snapshot()).toEqual(beforeRandom);
    expect(localStorage.getItem(RunStorage.key(4))).toBe(bad);
    localStorage.setItem(RunStorage.key(3),JSON.stringify({version:2,seed:'nest',nestActive:true,nestPos:2,hp:20,maxHp:20,ownedCards:[],inventory:[]}));
    expect(session.loadGame(3).ok).toBe(true); expect(session.game.nestActive).toBe(true); expect(session.game.nestPos).toBe(2);
    localStorage.setItem(RunStorage.key(5),JSON.stringify({version:2,seed:'normal',mapSeed:'normal',generatorVersion:3,layoutVersion:9,layerIdx:0,trackPos:0,hp:20,maxHp:20,ownedCards:[],inventory:[]}));
    expect(session.loadGame(5).ok).toBe(true); expect(session.game.nestActive).toBe(false);
    const mapSeed='ordinary-nonbool-nest', mapSnapshot=createMapSnapshot({mapSeed,generatorVersion:3,layoutVersion:9,layerData:createLayeredMap(mapSeed)}).value;
    const ordinary={version:2,seed:mapSeed,mapSeed,generatorVersion:3,layoutVersion:9,mapSnapshot,layerIdx:0,trackPos:0,hp:20,maxHp:20,ownedCards:[],inventory:[],nestActive:'false'};
    localStorage.setItem(RunStorage.key(2),JSON.stringify(ordinary));
    window.SDT.Nest.renderNestMap=vi.fn();
    expect(session.loadGame(2).ok).toBe(true); expect(session.game.nestActive).toBe(false); expect(window.SDT.Nest.renderNestMap).not.toHaveBeenCalled();
  });
});

describe('R5-a real menu preflight gate',()=>{
  it('坏图在launch前停止，不调用Base.use/save且不进deploy',async()=>{
    const handlers={}, base={peek:()=>({}),use:vi.fn(),save:vi.fn(),data:{stash:[],pocket:[]},issue:()=>null,reset:vi.fn()};
    const openBaseHub=vi.fn(), logs=[];
    const UI={showOverlay(_title,html){document.body.innerHTML=html;},registerHelp(){},helpBtn(){return'';},act(name,fn){handlers[name]=fn;},log(m){logs.push(m);},hideOverlay(){},clearLog(){},hideScreen(){},showScreen(){},refresh(){}};
    const SDT={Base:base,Cards:{applyAbilityRename:()=>false,applyDuplicateRenames:()=>false},Sound:{music(){}},Meta:{ACHIEVEMENTS:[],isUnlocked:()=>false},Icons:{img:()=>''}};
    const controller=createGameMenuController({SDT,UI,game:{state:'title'},runtime:{resize(){},openBaseHub,showRunTransition:async()=>{}},SLOT_COUNT:1,esc:String,
      readSlot:()=>({bad:true}),loadGame:vi.fn(),clearSlot(){},saveGame(){},syncPlayTime(){},clearSave(){},clearAllSlots(){},getActiveSlot:()=>null,setActiveSlot:vi.fn(),
      preflightRunMap:()=>({ok:false,code:'INVALID_MAP_SNAPSHOT',message:'路线损坏',preserveRun:true}),hasRun:()=>true,RunStorage:{has:()=>true,issue:()=>null},ensureBattleReady:async()=>{}});
    controller.startNewGame();
    await handlers.enterSlot({slot:1});
    expect(base.use).not.toHaveBeenCalled(); expect(base.save).not.toHaveBeenCalled(); expect(openBaseHub).not.toHaveBeenCalled();
    expect(logs.join('')).toContain('原档已保留');
    const error=document.getElementById('slotRestoreError'); expect(error.hidden).toBe(false); expect(error.textContent).toContain('原档已保留');
  });
});

