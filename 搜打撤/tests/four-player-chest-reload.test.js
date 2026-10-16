import { continueChestRewards } from './helpers/chest-actions.js';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { serializeChestReward, restoreChestReward, nodeChestRewardAt } from '../game/src/run/chest-reward-save.js';
import { validateRunSave } from '../game/src/hub/run-save-validation.js';
afterEach(()=>{vi.useRealTimers();delete window.SDT;document.body.innerHTML='';});
describe('G03 揭晓宝箱持久化',()=>{
  it('异地保存的待领奖励按节点恢复；坐标、种子与领取索引坏档拒绝读取',()=>{
    const game={seed:17,layerIdx:1,trackPos:2};
    const current={kind:'small',cards:[{id:'a',name:'补给'}],coins:2,coinsReceived:true,taken:new Set([0]),lost:new Set()};
    const saved=serializeChestReward(game,[{kind:'small'},{kind:'small'}],1,current,{onCell:true,consumeNode:true});
    const away={...game,trackPos:8,nodeChestRewards:{'1,2':saved}};
    expect(validateRunSave(away).ok).toBe(true);
    expect(nodeChestRewardAt(away)).toBeNull();
    expect(nodeChestRewardAt({...away,trackPos:2})).toEqual(saved);
    const conflict={...game,chestReward:saved,nodeChestRewards:{'1,2':{...saved,current:{...saved.current,taken:[]}}}};
    expect(validateRunSave(conflict)).toMatchObject({ok:false,preserveRun:true});
    for(const broken of [{...saved,trackPos:'2'},{...saved,seed:18},{...saved,layerIdx:-1},
      {...saved,current:{...saved.current,taken:[1]}}]) {
      expect(validateRunSave({...away,nodeChestRewards:{'1,2':broken}})).toMatchObject({ok:false,preserveRun:true});
    }
  });
  it('揭晓未领、部分领取、收金币的快照可复原，进度不重置',()=>{
    const game={seed:17,layerIdx:1,trackPos:2};
    const cur={kind:'small',cards:[{id:'a',name:'法力药水'},{id:'b',name:'法杖'}],coins:2,coinsReceived:false,taken:new Set(),lost:new Set()};
    const pack=()=>serializeChestReward(game,[{kind:'small'}],1,cur,{onCell:true,consumeNode:true});
    let saved=pack();expect(restoreChestReward(game,saved).current.cards).toEqual(cur.cards);
    expect(validateRunSave({ ...game, chestReward:saved }).ok).toBe(true);
    cur.taken.add(0);cur.coinsReceived=true;saved=pack();
    const restored=restoreChestReward(game,saved);expect([...restored.current.taken]).toEqual([0]);expect(restored.current.coinsReceived).toBe(true);
    expect(restoreChestReward({...game,trackPos:3},saved)).toBeNull();
    saved.current.lost=[0];expect(restoreChestReward(game,saved)).toBeNull();
    expect(validateRunSave({ ...game, chestReward:saved })).toMatchObject({ok:false,preserveRun:true});
  });
  it('恢复真实开箱控制器沿用已展示奖励，不重抽或重复领取',async()=>{
    vi.resetModules();vi.useFakeTimers();
    document.body.innerHTML='<div id="overlay"><div class="card"><h2 id="ovTitle"></h2><div id="ovBody"></div></div></div>';
    const body=document.getElementById('ovBody'),overlay=document.getElementById('overlay'),acts={};
    const original={id:'a',name:'原奖励',type:'法术',rarity:'古朴',cost:0,desc:'原奖励规则'};
    const alternate={...original,id:'b',name:'重抽奖励'};
    const draw=vi.fn(()=>original);
    window.SDT={UI:{el:{overlay,ovBody:body,ovTitle:document.getElementById('ovTitle')},showOverlay(t,h){body.innerHTML=h;overlay.hidden=false;},hideOverlay(){overlay.hidden=true;},act(n,f){acts[n]=f;},refresh(){},log(){}},
      MAP:{chestKinds:{small:{name:'小宝箱',cards:1,coins:[2,2]}}},Cards:{RARITIES:['古朴','稀有','史诗','传说'],all:()=>[original],randomDropCard:draw,pickOfRarity:()=>original,classPool:()=>[],rarityOf:c=>c.rarity,sellPrice:()=>1,cardHTML:c=>'<div>'+c.name+'</div>'},
      Base:{data:{eggPity:0,eggBattles:0},save(){},petEggDropChance:()=>0,recordPetEggChestResult(){},bagCap:()=>16,isSha:()=>false},Sound:{sfx(){}},Icons:{rich:h=>h}};
    await import('../game/src/run/chests.js');
    const Chests=window.SDT.Chests;
    const game={seed:17,layerIdx:0,trackPos:1,state:'idle',ownedCards:[],myClass:'',usedSlots:()=>0,bagCap:()=>16,canReceiveCard:()=>true,
      grantCard:vi.fn(()=>true),gainCoins:vi.fn(),persistSave:vi.fn()};
    Chests.open(game,[{kind:'small'}],()=>{},{onCell:true,consumeNode:true});
    const saved=JSON.parse(JSON.stringify(Chests.serialize(game)));
    expect(saved.current.rewardStage).toBe('chest');
    expect(saved.current.cards[0].name).toBe('原奖励');expect(game.persistSave).toHaveBeenCalled();
    draw.mockImplementation(()=>alternate);const calls=draw.mock.calls.length;
    expect(Chests.restore(game,saved,()=>{})).toBe(true);expect(draw).toHaveBeenCalledTimes(calls);
    vi.advanceTimersByTime(5000);
    expect(body.querySelector('.cqo-overview')).not.toBeNull();
    expect(body.textContent).not.toContain('原奖励');
    acts.chestNext();
    const opening=JSON.parse(JSON.stringify(Chests.serialize(game)));
    expect(opening.current.rewardStage).toBe('opening');
    expect(Chests.restore(game,opening,()=>{})).toBe(true);
    expect(Chests.serialize(game).current.rewardStage).toBe('cards');
    expect(body.textContent).toContain('原奖励');expect(body.textContent).not.toContain('重抽奖励');
    acts.chestSelect({i:0});acts.chestTake1({i:0});expect(game.grantCard).toHaveBeenCalledTimes(1);
    const taken=JSON.parse(JSON.stringify(Chests.serialize(game)));
    acts.chestReturn();
    expect(game.state).toBe('idle');expect(Chests.isOpen()).toBe(false);expect(Chests.serialize(game)).toBeNull();
    expect(game.nodeChestRewards['0,1'].current.taken).toEqual([0]);
    const parked=JSON.parse(JSON.stringify(game.nodeChestRewards));
    game.trackPos=3;
    Chests.open(game,[{kind:'small'}],()=>{},{onCell:true});
    acts.chestReturn();
    expect(Object.keys(game.nodeChestRewards)).toEqual(['0,1','0,3']);
    expect(game.nodeChestRewards['0,1']).toEqual(parked['0,1']);
    game.trackPos=1;
    game.seed=18;expect(Chests.serialize(game)).toBeNull();game.seed=17;
    game.discoveredPairs=new Set();expect(Chests.serialize(game)).toBeNull();game.discoveredPairs=undefined;
    Chests.restore(game,taken,()=>{});acts.chestTake1({i:0});expect(game.grantCard).toHaveBeenCalledTimes(1);
    continueChestRewards(acts);expect(game.gainCoins).toHaveBeenCalledTimes(1);expect(Chests.serialize(game)).toBeNull();
    expect(game.nodeChestRewards['0,1']).toBeUndefined();expect(game.nodeChestRewards['0,3']).toBeTruthy();
  });
});
