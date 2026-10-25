import { beforeEach, expect, it } from 'vitest';
import { strategicPolicy } from '../game/src/agent/agent.policy.js';
import { aggregate } from '../game/src/agent/agent.stats.js';
import { recordRun, resetRunCounters } from '../game/src/agent/agent.recorder.js';
import { parseActionReply } from '../game/src/agent/agent.llm-parser.js';
beforeEach(()=>{localStorage.clear();resetRunCounters();});
it('编组时稀有牌排在古朴前面',()=>{
  const pick=uid=>({type:'battle',name:'selectDeckCard',args:[uid],id:uid});
  const result=strategicPolicy()({phase:'battle',actions:[pick('ancient'),pick('rare')],battle:{turn:1,foes:[],player:{hp:30},
    deckSelection:{need:1,selected:[],cards:[{uid:'ancient',card:{rarity:'古朴'}},{uid:'rare',card:{rarity:'稀有'}}]}}});
  expect(result.args[0]).toBe('rare');
});
it.each(['武术','法术','能力卡'])('同稀有度腾格时保留现行%s卡',type=>{
  const discard=name=>({type:'sys',name:'discardCard',args:[name],id:name});
  const result=strategicPolicy()({phase:'overlay',actions:[discard('保留牌'),discard('资源'),{type:'ui',name:'closeBag',id:'close',params:{}}],
    run:{used:2,bagCap:2,hp:30,maxHp:30,ownedCards:[{name:'保留牌',type,rarity:'稀有'},{name:'资源',type:'资源',rarity:'稀有'}]}});
  expect(result.args[0]).toBe('资源');
});
it('按扁平观察字段出售较低稀有度，保留传说',()=>{
  const sell=uid=>({type:'ui',name:'sellCard',params:{uid},label:'出售',id:uid});
  const result=strategicPolicy()({phase:'overlay',actions:[sell('legend'),sell('rare')],run:{used:2,bagCap:2,hp:30,maxHp:30,coins:0,
    ownedCards:[{uid:'legend',rarity:'传说',sellable:true},{uid:'rare',rarity:'稀有',sellable:true}]}});
  expect(result.params.uid).toBe('rare');
});
it.each([['battle','战斗中'],['nonBattle','战后'],['unknown','未知']])('死亡按明确来源%s统计，累计撤退不改变死因', (deathCause,label)=>{
  const run={outcome:'death',maxLayer:2,node:4,deathCause,battles:{fought:2,won:1},carried:[]};
  expect(aggregate([run]).deathBucket).toEqual({['L2N4/'+label]:1});
});
it('缺少来源的旧档不从战斗输赢数猜死因',()=>{
  expect(aggregate([{outcome:'death',maxLayer:2,battles:{fought:3,won:1},carried:[]}]).deathBucket).toEqual({'L2/未知':1});
});
it('记录器保留死亡入口提供的来源',()=>{
  expect(recordRun('death',{deathCause:'nonBattle'}).deathCause).toBe('nonBattle');
});
it('动作回复附有多个JSON块时提取首个完整对象',()=>{
  expect(parseActionReply('执行 {"type":"sys","name":"noop"} 说明 {"reason":"later"}').raw).toEqual({type:'sys',name:'noop'});
});
it('动作JSON中的引号转义和花括号不打断提取',()=>{
  const value={type:'sys',name:'noop',note:'花括号 } { 与 "引号" 和 \\'};
  expect(parseActionReply('建议 '+JSON.stringify(value)+' 另附 {}').raw).toEqual(value);
});
it('前一个完整块无效时继续寻找可解析对象',()=>{
  expect(parseActionReply('说明 {not JSON} 动作 {"type":"sys","name":"noop"}').raw.name).toBe('noop');
});
