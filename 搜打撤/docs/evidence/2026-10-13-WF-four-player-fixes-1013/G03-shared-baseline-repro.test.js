import { expect, it, vi } from 'vitest';
it('当前共享源码：揭晓后重新开同节点会再次抽奖，未持久化奖励',async()=>{
  vi.resetModules();vi.useFakeTimers();
  document.body.innerHTML='<div id="overlay"><div class="card"><h2 id="ovTitle"></h2><div id="ovBody"></div></div></div>';
  const body=document.getElementById('ovBody'),overlay=document.getElementById('overlay'),acts={};
  const a={id:'a',name:'法力药水',type:'法术',rarity:'古朴',cost:0,desc:'原奖励'},b={...a,id:'b',name:'法杖'};
  const draw=vi.fn().mockReturnValueOnce(a).mockReturnValue(b);
  window.SDT={UI:{el:{overlay,ovBody:body,ovTitle:document.getElementById('ovTitle')},showOverlay(t,h){body.innerHTML=h;overlay.hidden=false;},hideOverlay(){overlay.hidden=true;},act(n,f){acts[n]=f;},refresh(){},log(){}},
    MAP:{chestKinds:{small:{name:'小宝箱',cards:1,coins:[0,0]}}},Cards:{RARITIES:['古朴','稀有','史诗','传说'],all:()=>[a,b],randomDropCard:draw,pickOfRarity:()=>a,classPool:()=>[],rarityOf:c=>c.rarity,sellPrice:()=>1,cardHTML:c=>'<div>'+c.name+'</div>'},
    Base:{data:{eggPity:0,eggBattles:0},save(){},petEggDropChance:()=>0,recordPetEggChestResult(){},bagCap:()=>16,isSha:()=>false},Sound:{sfx(){}},Icons:{rich:h=>h}};
  // 直接读取并执行当前共享源码；仅jsdom受控环境，不改共享文件或任何玩家档。
  await import('../../../../game/src/run/chests.js');
  const c=window.SDT.Chests,game={state:'idle',ownedCards:[],myClass:'',usedSlots:()=>0,bagCap:()=>16,canReceiveCard:()=>true,grantCard:vi.fn(),gainCoins:vi.fn(),persistSave:vi.fn()};
  c.open(game,[{kind:'small'}],()=>{},{onCell:true});
  expect(c.serialize).toBeUndefined();expect(game.persistSave).not.toHaveBeenCalled();
  // 模型化刷新：未领奖的稳定节点再次调用同一开箱入口，抽牌结果由受控桩确定。
  c.open(game,[{kind:'small'}],()=>{},{onCell:true});
  expect(draw.mock.results[0].value.name).toBe('法力药水');expect(draw.mock.results[1].value.name).toBe('法杖');
  expect(draw).toHaveBeenCalledTimes(2);expect(game.grantCard).not.toHaveBeenCalled();
  vi.clearAllTimers();vi.useRealTimers();
});
