// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createBattleEngineInstance } from '../game/src/battle/core/battle.engine.instance.js';
import { createM2Domain } from '../game/src/battle/effects/effect-steps.m2.domain.js';

const held = { id:'audit-held', name:'持有牌', type:'武术', cost:0, dmgType:'fixed', desc:'' };
const card = (ops, target={side:'enemy',area:false}) => ({ ...held, id:'audit-rule', name:'审查回归',
  rules:{version:1,battle:{target},triggers:{onPlay:ops}} });
const engines=[];
function setup(enemies=[{id:'a',name:'甲',hp:30,atk:2},{id:'b',name:'乙',hp:30,atk:2}]) {
  const cards={all:()=>[held],deriveDraw:()=>0,deriveInfuse:()=>0,isRandomObtainable:()=>true,
    sellPrice:()=>1,randomClassCard:()=>held,SHA:{...held,id:'starter-attack',name:'初始攻击'},
    TABLETOP10:[],DMG_TYPES:['武术','法术'],DMG_TYPE_META:{fixed:{},spell:{},attack:{},true:{}}};
  const engine=createBattleEngineInstance({cards,readRules:()=>({battleEnergy:8,battleHandMax:20,bossDeckSize:15,
    starterSha:0,battleStartDraw:0,battleTurnDraw:0,diceSides:6}),testMode:true,
    presentation:{demoMs:()=>0,waitMs:async()=>{}}});
  const game={ownedCards:[{uid:'held',card:held}],hp:200,maxHp:200,atk:2,spellPower:0,coins:0,
    state:'idle',battleActive:false,log:vi.fn(),heal(n){this.hp=Math.min(this.maxHp,this.hp+n);},addItem(){},onBattleEnd(){}};
  engine.start(game,enemies,{isBoss:false});engines.push(engine);
  return {engine,game,r:engine.runtime};
}
const drain=iterator=>{let step=iterator.next();while(!step.done)step=iterator.next();return step.value;};
async function turn(engine){await engine.idle();for(let i=0;i<8;i++)await Promise.resolve();engine.endTurn();await vi.runAllTimersAsync();await engine.idle();}
beforeEach(()=>vi.useFakeTimers());
afterEach(()=>{for(const engine of engines.splice(0))if(engine.runtime.G.battleActive)engine.finish(null);vi.clearAllTimers();vi.useRealTimers();});
const drawEquipment=card([{op:'draw',amount:1,filter:{type:'装备'}}],{side:'self',area:false});

describe('project bugfix 1023 battle boundaries',()=>{
  it('filtered draws execute structured onDraw without putting the triggered card in hand',()=>{
    const {engine,r}=setup();
    r.granted.push({uid:'equip',card:{id:'draw-equip',name:'抽到装备',type:'装备',cost:0,desc:'',
      rules:{version:1,triggers:{onDraw:[{op:'energy',n:2}]}}}});
    r.set$drawPile(['equip']);engine.resolveCard(drawEquipment,r.foes[0],false,0);
    expect(r.energy).toBe(10);expect(r.hand).not.toContain('equip');expect(r.discard).toContain('equip');
  });
  it('an onDraw extra draw sees the unchanged top card skipped by the equipment filter',()=>{
    const {engine,r}=setup();
    // This case owns a synthetic onDraw trigger, not a built-in sword's retained combination identity.
    r.granted.push({uid:'sword',card:{id:'audit-filter-draw-equipment',name:'抽牌装备夹具',type:'装备',cost:0,draw:1,
      desc:'抽到该牌时额外抽 1 张牌。',rules:{version:1,triggers:{onDraw:[{op:'draw',amountField:'draw'}]}}}},
      {uid:'top',card:held},{uid:'below',card:held});
    r.set$hand([]);r.set$drawPile(['below','sword','top']);engine.resolveCard(drawEquipment,r.foes[0],false,0);
    expect(r.hand).toEqual(['top']);expect(r.drawPile).toEqual(['below']);expect(r.discard).toEqual(['sword']);
  });
  it('a full boss hand leaves the filtered card and every skipped card in its original position',()=>{
    const {engine,r}=setup();r.set$mode('boss');r.set$hand(Array.from({length:20},(_,i)=>'full'+i));
    r.granted.push({uid:'equip',card:{...held,type:'装备'}},{uid:'top',card:held},{uid:'below',card:held});
    r.set$drawPile(['below','equip','top']);engine.resolveCard(drawEquipment,r.foes[0],false,0);
    expect(r.drawPile).toEqual(['below','equip','top']);expect(r.hand).toHaveLength(20);
  });
  it('a missing transformed card stops the filtered draw without moving its original deck position',()=>{
    const {engine,r}=setup();
    r.granted.push({uid:'bad',card:{...held,type:'装备',_battleTransformMissing:'missing'}},{uid:'top',card:held});
    r.set$drawPile(['bad','top']);engine.resolveCard(drawEquipment,r.foes[0],false,0);
    expect(r.drawPile).toEqual(['bad','top']);expect(r.hand).not.toContain('bad');
  });
  it.each([[1,3],[3,1]])('each stolen attack grant expires separately: durations %s then %s',async(first,second)=>{
    const {engine,r}=setup([{id:'a',name:'甲',hp:100,atk:10},{id:'b',name:'乙',hp:30,atk:2}]);
    for(const duration of [first,second])engine.resolveCard(card([{op:'stealAtk',amount:2,duration,target:'chosenEnemy'}]),r.foes[0],false,0);
    await turn(engine);expect(r.foes[0].atk).toBe(8);expect(r.pstat.status.atkUp).toBe(2);
    await turn(engine);expect(r.foes[0].atk).toBe(8);
    await turn(engine);expect(r.foes[0].atk).toBe(10);expect(r.pstat.status.atkUp).toBe(0);
  });
  it('adopts the aggregate deadline from an old snapshot before registering another theft',async()=>{
    const {engine,r}=setup([{id:'a',name:'甲',hp:100,atk:8},{id:'b',name:'乙',hp:30,atk:2}]);
    r.foes[0]._stealRestore=2;r.foes[0]._stealRestoreTurn=0;
    engine.resolveCard(card([{op:'stealAtk',amount:2,duration:3,target:'chosenEnemy'}]),r.foes[0],false,0);
    await turn(engine);expect(r.foes[0].atk).toBe(8);expect(r.foes[0]._stealRestore).toBe(2);
    expect(r.foes[0]._stealRestorations).toEqual([{amount:2,returnTurn:3}]);
  });
  it('restores a legacy aggregate record without any new theft',()=>{
    const {restoreStolenAttack}=createM2Domain({runtime:{}});
    const foe={atk:5,_stealRestore:3,_stealRestoreTurn:1};
    expect(restoreStolenAttack(foe,1)).toBe(0);expect(foe.atk).toBe(5);
    expect(restoreStolenAttack(foe,2)).toBe(3);expect(foe.atk).toBe(8);
    expect(foe._stealRestore).toBeUndefined();
  });
  it('revival removes restoration records from the replaced form',async()=>{
    const {engine,r}=setup([{id:'lord',name:'元素领主',hp:32,atk:8,heartsMode:true,revive:{hearts:8,atk:8},affix:'aegis',boss:true},
      {id:'b',name:'乙',hp:30,atk:2}]);
    engine.resolveCard(card([{op:'stealAtk',capTo:1,target:'chosenEnemy'}]),r.foes[0],false,0);
    r.foes[0]._atkDownAmount=2;r.foes[0]._atkDownPending=2;
    engine.hitFoe(r.foes[0],held,99,'true');await turn(engine);
    expect(r.foes[0]).toMatchObject({revived:true,atk:8});
    expect(r.foes[0]._stealRestore).toBeUndefined();expect(r.foes[0]._atkDownPending).toBeUndefined();
  });
  it.each(['damage','curse'])('random %s keeps the still-live windup target without another roll',kind=>{
    const {engine,r}=setup();let rolls=0;const original=engine.random.random.bind(engine.random);
    engine.random.random=(stream,purpose)=>stream==='battle'&&purpose==='target'?(rolls++?0.99:0):original(stream,purpose);
    const op=kind==='damage'?{op:'damage',amount:4,target:'randomEnemy'}:{op:'curse',curse:'poison',stacks:1,target:'randomEnemy'};
    const steps=engine.resolveCard.steps(card([op]),r.foes[0],false,0);
    expect(steps.next().value.targets).toEqual([r.foes[0]]);drain(steps);expect(rolls).toBe(1);
    if(kind==='damage'){expect(r.foes[0].hp).toBe(26);expect(r.foes[1].hp).toBe(30);}
    else{expect(r.foes[0].status.poison).toBe(1);expect(r.foes[1].status.poison).toBe(0);}
  });
  it('a random damage target lost during windup is replaced by a live enemy',()=>{
    const {engine,r}=setup();let rolls=0;engine.random.random=(stream,purpose)=>stream==='battle'&&purpose==='target'?(rolls++,0):0;
    const steps=engine.resolveCard.steps(card([{op:'damage',amount:4,target:'randomEnemy'}]),r.foes[0],false,0);
    steps.next();r.foes[0].hp=0;r.foes[0].dead=true;drain(steps);
    expect(r.foes[1].hp).toBe(26);expect(rolls).toBe(2);
  });
  it('armor consumes equipment through the normal hooks before granting armor',()=>{
    const {engine,r}=setup();
    r.granted.push({uid:'equip',card:{id:'consumed-equip',name:'消耗装备',type:'装备',cost:0,desc:'',
      rules:{version:1,triggers:{onConsume:[{op:'energy',n:2}]}}}});
    r.hand.push('equip');engine.resolveCard(card([{op:'registerRule',rule:'consumeFireball'}],{side:'self',area:false}),r.foes[0],false,0);
    const steps=engine.resolveCard.steps(card([{op:'armor',amount:10,consumeEquip:true}],{side:'self',area:false}),r.foes[0],false,0);
    expect(steps.next().value.kind).toBe('windup');expect(r.consumed).toContain('equip');expect(r.energy).toBe(10);expect(r.pdef.armor).toBe(0);
    drain(steps);expect(r.foes[0].hp).toBe(26);expect(r.pdef.armor).toBe(10);
  });
  it('armor without equipment cannot grant armor or consume another hand card',()=>{
    const {engine,r}=setup();engine.resolveCard(card([{op:'armor',amount:10,consumeEquip:true}],{side:'self',area:false}),r.foes[0],false,0);
    expect(r.pdef.armor).toBe(0);expect(r.hand).toContain('held');expect(r.consumed).toEqual([]);
  });
  it('blocked execute attempts do not consume the kill count or receive rewards',()=>{
    const {engine,r,game}=setup();r.foes[0].status.immune=1;
    engine.resolveCard(card([{op:'execute',cap:{atk:4},count:1,onKill:{coins:2}}],{side:null,area:false}),null,false,0);
    expect(r.foes[0].dead).toBe(false);expect(r.foes[1].dead).toBe(true);expect(game.coins).toBe(2);
  });
  it('a single-target blocked execute does not execute a different enemy or report a kill',()=>{
    const {engine,r,game}=setup();r.foes[0].status.immune=1;
    engine.resolveCard(card([{op:'execute',cap:{atk:4},count:1,onKill:{coins:2}}]),r.foes[0],false,0);
    expect(r.foes.every(foe=>!foe.dead)).toBe(true);expect(game.coins).toBe(0);
    expect(game.log.mock.calls.some(([line])=>line.includes('消灭了 1 个'))).toBe(false);
  });
  it('revival replacing death does not consume an execute kill or grant an extra reward',()=>{
    const {engine,r,game}=setup([{id:'a',name:'复活者',hp:3,atk:2,revive:{hearts:8,atk:8}},{id:'b',name:'乙',hp:30,atk:2}]);
    engine.resolveCard(card([{op:'execute',cap:{atk:4},count:1,onKill:{coins:2}}],{side:null,area:false}),null,false,0);
    expect(r.foes[0]).toMatchObject({revived:true,dead:false,hp:8});expect(r.foes[1].dead).toBe(true);expect(game.coins).toBe(2);
  });
});
