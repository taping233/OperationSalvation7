// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createBattleEngineInstance } from '../game/src/battle/core/battle.engine.instance.js';
import { createCombatRuntime } from '../game/src/battle/core/combat.factory.js';

const base={id:'round2-base',name:'持有牌',type:'武术',cost:0,dmgType:'fixed',desc:''};
const rules=(ops,side='enemy',extra={})=>({...base,id:'round2-rule',name:'组合规则',
  rules:{version:1,battle:{target:{side,area:false}},triggers:{onPlay:ops,...extra}}});
const engines=[];
function setup(enemies=[{id:'a',name:'甲',hp:100,atk:8},{id:'b',name:'乙',hp:100,atk:2}]){
  const cards={all:()=>[base],deriveDraw:()=>0,deriveInfuse:()=>0,isRandomObtainable:()=>true,sellPrice:()=>1,
    randomClassCard:()=>base,SHA:{...base,id:'starter-attack',name:'初始攻击'},TABLETOP10:[],DMG_TYPES:['武术','法术'],
    DMG_TYPE_META:{fixed:{},spell:{},attack:{},true:{}}};
  const engine=createBattleEngineInstance({cards,readRules:()=>({battleEnergy:8,battleHandMax:20,bossDeckSize:15,
    starterSha:0,battleStartDraw:0,battleTurnDraw:0,diceSides:6}),testMode:true,presentation:{demoMs:()=>0,waitMs:async()=>{}}});
  const game={ownedCards:[{uid:'held',card:base}],hp:100,maxHp:100,atk:2,spellPower:0,coins:0,state:'idle',battleActive:false,
    log:vi.fn(),heal(n){this.hp=Math.min(this.maxHp,this.hp+n);},addItem(){},onBattleEnd(){}};
  engine.start(game,enemies,{isBoss:false});engines.push(engine);return{engine,game,r:engine.runtime};
}
async function turn(engine){await engine.idle();for(let i=0;i<8;i++)await Promise.resolve();engine.endTurn();await vi.runAllTimersAsync();await engine.idle();}
beforeEach(()=>vi.useFakeTimers());
afterEach(()=>{for(const engine of engines.splice(0))if(engine.runtime.G.battleActive)engine.finish(null);vi.clearAllTimers();vi.useRealTimers();});

describe('round2 battle combinations and interruption',()=>{
  it('lifesteal includes damage dealt by the same operation recasts',()=>{
    const {engine,r,game}=setup();game.hp=50;
    engine.resolveCard(rules([{op:'damage',amount:3,target:'chosenEnemy',lifesteal:true,recast:{on:'lastHand',times:2}}]),r.foes[0],false,0,'held');
    expect(r.foes[0].hp).toBe(91);expect(game.hp).toBe(59);
  });
  it.each(['infusion','consumeHand'])('all %s costs are committed before an early consumption trigger ends the battle',async mode=>{
    const {engine,r,game}=setup([{id:'boss',name:'末敌',hp:1,atk:2,boss:true}]);game.onBattleEnd=vi.fn();
    const source=mode==='infusion'?{...rules([{op:'damage',amount:1,target:'chosenEnemy',when:{infused:true}}]),infuse:2}
      :rules([{op:'draw',amount:3,handOps:[{op:'consumeHand'}]}],'self');
    const fuel={...base,id:'lethal-fuel',rules:{version:1,triggers:{onConsume:[{op:'damage',amount:1,target:'chosenEnemy'}]}}};
    r.granted.push({uid:'source',card:source},{uid:'first',card:fuel},{uid:'second',card:base});r.set$hand(['source','first','second']);
    if(mode==='infusion')expect(engine.queueCardExecution('source',source,['first','second'],r.foes[0],false),JSON.stringify(game.log.mock.calls)).not.toBe(false);
    else engine.submitCardPlay('source','self');
    await vi.runAllTimersAsync();await engine.idle();expect(game.onBattleEnd).toHaveBeenCalledOnce();
    expect(game.onBattleEnd.mock.calls[0][3]).toEqual(['first','second']);
  });
  it.each([0,5])('infusion-price healing uses fuel cost %s rather than its sale value',async cost=>{
    const {engine,r,game}=setup();game.hp=50;
    const heal={...rules([{op:'heal',perFuelCost:2,when:{infused:true}}],'self'),id:'holy-heal',infuse:1};
    r.granted.push({uid:'heal',card:heal},{uid:'fuel',card:{...base,id:'fuel',cost,value:9}});r.set$hand(['heal','fuel']);
    expect(engine.queueCardExecution('heal',heal,['fuel'],null,false)).not.toBe(false);
    await vi.runAllTimersAsync();await engine.idle();expect(game.hp).toBe(50+2*cost);
  });
  it('zero damage does not spend dodge while zero base attack with a real bonus does',()=>{
    const combat=createCombatRuntime(),unit={hp:30};combat.addBlessing(unit,'dodge',1,1);
    expect(combat.dealDamage({atk:0},unit,0,'attack').dealt).toBe(0);expect(unit.status.dodge).toBe(1);
    expect(combat.dealDamage({atk:2},unit,0,'attack').dodged).toBe(true);expect(unit.status.dodge).toBe(0);
  });
  it('positive damage still checks dodge before guard, reduction and defense absorption',()=>{
    const combat=createCombatRuntime(),unit={hp:30,defense:{shield:5,armor:5,guard:true}};
    combat.addBlessing(unit,'dodge',1,1);combat.addBlessing(unit,'reduce',1);
    expect(combat.dealDamage({atk:2},unit,0,'attack').dodged).toBe(true);
    expect(unit.status.dodge).toBe(0);expect(unit.hp).toBe(30);expect(unit.defense).toEqual({shield:5,armor:5,guard:true});
  });
  it('a double poison tick stops after death instead of emitting a second damage echo from the corpse',async()=>{
    const {engine,r}=setup();r.applyRuneFlag('time');r.foes[0].hp=3;r.foes[0].status.poison=3;
    r.foes[0].damageEcho={amount:2,dmgType:'true'};await turn(engine);
    expect(r.foes[0].dead).toBe(true);expect(r.foes[1].hp).toBe(98);
  });
  it('a lethal poison burst resolves defeat before the next damage operation chooses its target',()=>{
    const {engine,r}=setup();r.foes[0].hp=3;r.foes[0].status.poison=3;
    engine.resolveCard(rules([{op:'adjustCurse',curse:'poison',burst:2,target:'chosenEnemy'},
      {op:'damage',amount:4,target:'chosenEnemy'}]),r.foes[0],false,0);
    expect(r.foes[0].dead).toBe(true);expect(r.foes[1].hp).toBe(96);
  });
  it('native semantic poison bursts use the same damage hooks as status poison bursts',()=>{
    const {engine,r}=setup();r.foes[0].status.poison=3;r.foes[0].damageEcho={amount:2,dmgType:'true'};
    engine.resolveCard(rules([{op:'adjustCurse',curse:'poison',burst:1,target:'chosenEnemy'}]),r.foes[0],false,0);
    expect(r.foes[1].hp).toBe(98);
    expect(r.pstat.requestedCards.damageTurn).toBe(1);
  });
  it.each(['atkDown','stealAtk'])('a recruited enemy still restores temporary %s after its duration expires',async kind=>{
    const {engine,r}=setup();
    const op=kind==='atkDown'?{op:'curse',curse:'atkDown',amount:3,duration:1,target:'chosenEnemy'}
      :{op:'stealAtk',amount:3,duration:1,target:'chosenEnemy'};
    engine.resolveCard(rules([op]),r.foes[0],false,0);r.foes[0].hp--;
    engine.resolveCard(rules([{op:'recruitEnemy',target:'chosenEnemy',wounded:true,excludeBoss:true}]),r.foes[0],false,0);
    expect(r.allies[0].atk).toBe(5);await turn(engine);
    expect(r.allies[0].atk).toBe(8);
  });
  it('reactive freeze after the first frenzy hit interrupts the remaining enemy hits',async()=>{
    const {engine,r,game}=setup([{id:'a',name:'双击者',hp:100,atk:4,affix:'frenzy'}]);
    const passive=rules([],'self',{onDamaged:[{op:'curse',curse:'freeze',duration:1,target:'chosenEnemy'}]});
    r.granted.push({uid:'passive',card:passive});r.hand.push('passive');
    engine.submitCardPlay('passive','self');await engine.idle();r.set$playerCurseImmune(true);
    await turn(engine);expect(game.hp).toBe(96);
  });
});
