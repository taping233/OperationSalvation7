import { beforeEach, expect, it, vi } from 'vitest';
const fixture=vi.hoisted(()=>({game:{}}));
vi.mock('../game/src/run/game.session.js',()=>({game:fixture.game,getActiveSlot:()=>1,startNewGame:vi.fn(),curLayer:()=>null,bagCap:()=>2,usedSlots:()=>2}));
vi.mock('../game/src/run/game.run.flow.js',()=>({moveTo:()=>false,reenterCell:()=>false}));
import { observe } from '../game/src/agent/agent.state.js';
import { act } from '../game/src/agent/agent.action-router.js';
import { strategicPolicy } from '../game/src/agent/agent.policy.js';
import { discardInventoryCard } from '../game/src/hub/bag-inventory-commands.js';
beforeEach(()=>{
  document.body.innerHTML='<section id="overlay"><div id="ovBody"><button data-act="closeBag">返回</button></div></section>';
  Object.assign(fixture.game,{state:'modal',runActive:true,battleActive:false,nestActive:false,hp:30,maxHp:30,inventory:[],discoveredPairs:new Set(),
    ownedCards:[{uid:'stored',stored:1,card:{id:'keep',name:'同名牌',type:'资源',rarity:'古朴'}},
      {uid:'legend',card:{id:'expensive',name:'同名牌',type:'武术',rarity:'传说'}},
      {uid:'ancient',card:{id:'cheap',name:'同名牌',type:'资源',rarity:'古朴'}}]});
  fixture.game.discardCard=vi.fn((name,fromSafe,uid)=>discardInventoryCard(fixture.game,{name,fromSafe,uid},{id:'starter',name:'初始攻击'}).ok);
  window.SDT ||= {};Object.assign(window.SDT,{game:fixture.game,UI:{_acts:{}},Battle:{commands:{}}});
});
it('观察、排序、执行整链丢掉指定UID，保留容器内同名卡和传说卡',()=>{
  const observation=observe();
  const discards=observation.actions.filter(action=>action.name==='discardCard');
  expect(discards.map(action=>action.args[1])).toEqual(['legend','ancient']);
  const selected=strategicPolicy()(observation);expect(selected.args).toEqual(['同名牌','ancient']);
  expect(act(selected).ok).toBe(true);
  expect(fixture.game.ownedCards.map(entry=>entry.uid)).toEqual(['stored','legend']);
});
it('UID在观察后失效时不回退丢另一张同名牌',()=>{
  const action=observe().actions.find(value=>value.name==='discardCard'&&value.args[1]==='ancient');
  fixture.game.ownedCards=fixture.game.ownedCards.filter(entry=>entry.uid!=='ancient');
  expect(act(action)).toMatchObject({ok:false,code:'DISCARD_REJECTED'});
  expect(fixture.game.ownedCards.map(entry=>entry.uid)).toEqual(['stored','legend']);
});
