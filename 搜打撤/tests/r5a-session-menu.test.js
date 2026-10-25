import { quietUiMocks } from './helpers/environment-fixtures.js';
import { beforeAll,beforeEach,describe,expect,it,vi } from 'vitest';
import { createLayeredMap } from '../game/src/run/layeredMap.js';
import { createMapSnapshot } from '../game/src/run/map-snapshot.js';
import { installImmediateWebLocks } from './helpers/web-locks.js';

installImmediateWebLocks();

const ctx=new Proxy({}, {get:()=>()=>ctx,set:()=>true});
window.HTMLCanvasElement.prototype.getContext=()=>ctx;
document.body.innerHTML='<canvas id="game"></canvas><div id="title"></div><div id="exitScr"></div>';
window.SDT={Icons:{img:()=>'',TYPE_ART:{}},Sound:{music(){},sfx(){},setDucked(){}},FX:{feedback(){}},
  MAP:{rules:{playerMaxHp:50,playerAtk:4,fireHeal:5,battleEnergy:2,battleHandMax:10,bossDeckSize:10,starterSha:0,battleStartDraw:5,battleTurnDraw:1,diceSides:6},items:{rations:{name:'口粮'},wood:{name:'木材'}}}};
await import('../game/src/cards/cards.js');
await import('../game/src/ui/ui.js');
await import('../game/src/hub/base.js');
const session=await import('../game/src/run/game.session.js');
const { Random }=await import('../game/src/core/random.js');
const { RunStorage }=await import('../game/src/hub/game.storage.js');
const { createGameMenuController }=await import('./helpers/menu-controller.js');

beforeAll(()=>{
  Object.assign(window.SDT.UI,{log(){},refresh(){},...quietUiMocks()});
  window.SDT.Meta={setXpMul(){},track(){}};
  window.SDT.Nest={renderNestMap(){}};
});
beforeEach(async()=>{ await Promise.all([RunStorage.flushWrites(),window.SDT.Base.flushWrites()]); localStorage.clear(); });

describe('R5-a real session persistence',()=>{
  it('正式newRun保存当前探索图快照，恢复不重算布局',async()=>{
    const slot=2; window.SDT.Base.use(slot); session._set_active_slot(slot);
    await session.newRun('standard',{},{skipClassChoice:true});
    expect(session.game.generatorVersion).toBe(7); expect(session.game.routePlan).toBeNull();
    expect(await session.saveGame()).toBe(true);
    const stored=JSON.parse(localStorage.getItem(RunStorage.key(slot)));
    expect(stored.mapSnapshot.snapshotVersion).toBe(1); expect(stored.routeVersion).toBeNull();
    const plan=structuredClone(stored.mapSnapshot);
    expect(session.loadGame(slot).ok).toBe(true); expect(session.game.routePlan).toBeNull();
    expect(createMapSnapshot(session.game).value).toEqual(plan);
  });

  it('正式newRun把仓库带入与口袋清理合并为一次Base写入', async () => {
    const slot = 3; window.SDT.Base.use(slot); session._set_active_slot(slot);
    const base = window.SDT.Base;
    const selected = { id: 'deploy-card', name: '攻击卡', rarity: '稀有' };
    const secondSelected = { id: 'deploy-guard', name: '防御卡', rarity: '古朴' };
    base.data.stash = [
      { card: selected, count: 2 },
      { card: secondSelected, count: 3 },
    ];
    base.data.pocket = [{ card: { id: 'spent', name: '消耗卡' }, count: 1 }];
    const originalSetItem = Storage.prototype.setItem;
    let baseWrites = 0;
    Storage.prototype.setItem = function(key, value) {
      if (key === base.SLOT_KEY(slot)) baseWrites++;
      return originalSetItem.call(this, key, value);
    };

    try {
      expect(await session.newRun('standard', { 攻击卡: 1, 防御卡: 2 }, { skipClassChoice: true })).toBeUndefined();
      expect(baseWrites).toBe(1);
      expect(base.data.stash).toEqual([
        { card: selected, count: 1 },
        { card: secondSelected, count: 1 },
      ]);
      expect(base.data.pocket).toEqual([]);
      expect(session.game.ownedCards.filter(card => card.card.id?.startsWith('deploy-')).map(card => card.card.name))
        .toEqual(['攻击卡', '防御卡', '防御卡']);
    } finally {
      Storage.prototype.setItem = originalSetItem;
    }
  });

  it('Base真实写盘失败时出征不初始化run、不消费随机流且不丢库存', async () => {
    const slot = 4; window.SDT.Base.use(slot); session._set_active_slot(slot);
    const base = window.SDT.Base;
    base.data.stash = [{ card: { id: 'deploy-card', name: '攻击卡', rarity: '稀有' }, count: 2 }];
    const cardStack = base.data.stash[0];
    base.data.pocket = [{ card: { id: 'spent', name: '消耗卡' }, count: 1 }];
    const beforeBase = structuredClone(base.data);
    const beforeBaseRaw = localStorage.getItem(base.SLOT_KEY(slot));
    const beforeRandom = Random.snapshot();
    const before = {
      seed: session.game.seed,
      mapSeed: session.game.mapSeed,
      layerData: session.game.layerData,
      ownedCards: session.game.ownedCards,
      runActive: session.game.runActive,
    };
    const originalSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function(key, value) {
      if (key === base.SLOT_KEY(slot)) throw new Error('test storage failure');
      return originalSetItem.call(this, key, value);
    };

    try {
      expect(await session.newRun('standard', { [cardStack.card.name]: 1 }, { skipClassChoice: true })).toBe(false);
      expect(Random.snapshot()).toEqual(beforeRandom);
      expect(session.game).toMatchObject(before);
      expect(base.data).toEqual(beforeBase);
      expect(localStorage.getItem(base.SLOT_KEY(slot))).toBe(beforeBaseRaw);
      expect(localStorage.getItem(RunStorage.key(slot))).toBeNull();
    } finally {
      Storage.prototype.setItem = originalSetItem;
    }
  });

  it('saveGame写canonical snapshot，loadGame恢复原拓扑与位置',async ()=>{
    const slot=5, seed='session-route';
    window.SDT.Base.use(slot); session._set_active_slot(slot);
    session.buildDerived(seed); session.game.runActive=true; session.game.nestActive=false; session.game.state='idle';
    session.game.layerIdx=1; session.game.trackPos=session.game.layerData[1].entrances[0];
    const expected=session.game.layerData.map(l=>l.logical.map(n=>({id:n.id,type:n.def.type,x:n.x,row:n.row,next:n.next})));
    expect(await session.saveGame()).toBe(true);
    const stored=JSON.parse(localStorage.getItem(RunStorage.key(slot)));
    expect(stored.mapSnapshot.snapshotVersion).toBe(1);
    session.game.layerData[0].logical[0].def.type='event'; session.game.layerIdx=0; session.game.trackPos=0;
    const loaded=session.loadGame(slot);
    expect(loaded.ok).toBe(true);
    expect(await loaded.pendingPersistence).toEqual({ok:true});
    expect(session.game.layerIdx).toBe(1);
    expect(session.game.layerData.map(l=>l.logical.map(n=>({id:n.id,type:n.def.type,x:n.x,row:n.row,next:n.next})))).toEqual(expected);
    expect(session.game.nestActive).toBe(false);
    session.game.trackPos=999;
    const oldRaw=localStorage.getItem(RunStorage.key(slot));
    expect(await session.saveGame()).toBe(false); expect(localStorage.getItem(RunStorage.key(slot))).toBe(oldRaw);
  });

  it('跨标签存档冲突提示重新载入，而不是提示存储空间不足',async()=>{
    const slot=1; window.SDT.Base.use(slot); session._set_active_slot(slot);
    await session.newRun('standard',[],{skipClassChoice:true});
    expect(await session.saveGame()).toBe(true);
    const loaded=session.loadGame(slot);
    expect(loaded.ok).toBe(true);
    expect(await loaded.pendingPersistence).toEqual({ok:true});
    const latest=JSON.parse(localStorage.getItem(RunStorage.key(slot)));
    latest.hp=Math.max(1,latest.hp-1); latest._r2.revision++;
    localStorage.setItem(RunStorage.key(slot),JSON.stringify(latest));
    const log=vi.fn(); window.SDT.UI.log=log;
    expect(await session.saveGame()).toBe(false);
    expect(RunStorage.lastWriteIssue(slot)).toBe('STALE_SLOT');
    expect(log.mock.calls.flat().join(' ')).toContain('重新载入档位后继续');
    expect(log.mock.calls.flat().join(' ')).not.toContain('存储空间可能已满');
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
    const controller=createGameMenuController({SDT,UI,game:{state:'title'},runtime:{resize(){},openBaseHub,showRunTransition:()=>Object.assign(Promise.resolve(true),{isCurrent:()=>true})},SLOT_COUNT:1,esc:String,
      readSlot:()=>({bad:true}),loadGame:vi.fn(),clearSlot(){},saveGame(){},syncPlayTime(){},clearSave(){},clearAllSlots(){},getActiveSlot:()=>null,setActiveSlot:vi.fn(),
      preflightRunMap:()=>({ok:false,code:'INVALID_MAP_SNAPSHOT',message:'路线损坏',preserveRun:true}),hasRun:()=>true,RunStorage:{has:()=>true,issue:()=>null},ensureBattleReady:async()=>{}});
    controller.startNewGame();
    await handlers.enterSlot({slot:1});
    expect(base.use).not.toHaveBeenCalled(); expect(base.save).not.toHaveBeenCalled(); expect(openBaseHub).not.toHaveBeenCalled();
    expect(logs.join('')).toContain('原档已保留');
    const error=document.getElementById('slotRestoreError'); expect(error.hidden).toBe(false); expect(error.textContent).toContain('原档已保留');
  });
});

