// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createBattleEngineInstance } from '../game/src/battle/core/battle.engine.instance.js';

const held = { id:'sweep-held', name:'持有牌', type:'武术', cost:0, dmgType:'fixed', desc:'' };
const rule = ops => ({ ...held, id:'sweep-rule', name:'审查回归', rules:{ version:1,
  battle:{ target:{ side:'enemy', area:false } }, triggers:{ onPlay:ops } } });
const engines = [];
function setup(enemies = [{id:'a',name:'复活者',hp:2,atk:2,revive:{hearts:8,atk:8}},
  {id:'b',name:'旁观者',hp:100,atk:2}], options = {}) {
  const cards = { all:()=>[held], deriveDraw:()=>0, deriveInfuse:()=>0, isRandomObtainable:()=>true,
    sellPrice:()=>1, randomClassCard:()=>held, SHA:{...held,id:'starter-attack',name:'初始攻击'},
    TABLETOP10:[], DMG_TYPES:['武术','法术'], DMG_TYPE_META:{fixed:{},spell:{},attack:{},true:{}} };
  const engine = createBattleEngineInstance({ cards, readRules:()=>({battleEnergy:8,battleHandMax:20,
    bossDeckSize:15,starterSha:0,battleStartDraw:0,battleTurnDraw:0,diceSides:6}),testMode:true,
    presentation:{demoMs:()=>0,waitMs:async()=>{}} });
  const game = {ownedCards:[{uid:'held',card:held}],hp:100,maxHp:100,atk:2,spellPower:0,coins:0,
    state:'idle',battleActive:false,log:vi.fn(),heal(n){this.hp=Math.min(this.maxHp,this.hp+n);},addItem(){},onBattleEnd(){}};
  engine.start(game,enemies,{isBoss:false,...options});engines.push(engine);return {engine,game,r:engine.runtime};
}
beforeEach(()=>vi.useFakeTimers());
afterEach(()=>{for(const engine of engines.splice(0))if(engine.runtime.G.battleActive)engine.finish(null);
  vi.clearAllTimers();vi.useRealTimers();});
async function turn(engine) {
  await engine.idle();for(let i=0;i<8;i++)await Promise.resolve();
  engine.endTurn();await vi.runAllTimersAsync();await engine.idle();
}

describe('battle bug sweep 2026-10-24',()=>{
  it('revival removes the current rot seed marker before its new form receives poison',()=>{
    const {engine,r} = setup(), foe = r.foes[0];
    engine.resolveCard(rule([{op:'curse',curse:'poison',stacks:2,target:'chosenEnemy'},
      {op:'markEnemy',event:'death',status:'poison',multiplier:1,dmgType:'true',target:'chosenEnemy',dest:'allEnemies'}]),foe,false,0);
    expect(foe.deathBurst).toBeDefined();
    engine.hitFoe(foe,held,2,'true');
    expect(foe.revived).toBe(true);expect(foe.deathBurst).toBeUndefined();
    engine.resolveCard(rule([{op:'curse',curse:'poison',stacks:3,target:'chosenEnemy'}]),foe,false,0);
    engine.hitFoe(foe,held,8,'true');
    expect(foe.dead).toBe(true);expect(r.foes[1].hp).toBe(100);
  });
  it.each(['structured','text'])('%s non-boss execution excludes the current nest boss without an affix',kind=>{
    const {engine,r} = setup([{id:'nest-ancient-dragon',name:'远古龙尊',hp:99,atk:9,boss:true},
      {id:'b',name:'普通敌人',hp:30,atk:2}]);
    r.foes.forEach(foe=>foe.hp--);
    const source = kind === 'structured' ? rule([{op:'execute',cap:{wounded:true},count:1}])
      : {...held,desc:'消灭1名受伤敌人（非BOSS）'};
    expect(()=>engine.resolveCard(source,r.foes[0],false,0)).not.toThrow();
    expect(r.foes[0].dead).toBe(false);
    if(kind === 'text') expect(r.foes[1].dead).toBe(true);
  });
  it('execution excludes boss-mode targets marked through the shared controlBoss field',()=>{
    const {engine,r} = setup([{id:'a',name:'首脑',hp:99,atk:2}],{isBoss:true,directBossStart:true});
    expect(r.foes[0].controlBoss).toBe(true);
    engine.resolveCard(rule([{op:'execute',cap:{atk:4},count:1}]),r.foes[0],false,0);
    expect(r.foes[0].dead).toBe(false);
  });
  it('ordinary enemies remain executable and generated fireballs can still hit bosses',()=>{
    const {engine,r} = setup([{id:'a',name:'普通敌人',hp:99,atk:2},{id:'b',name:'首脑',hp:99,atk:9,boss:true}]);
    engine.resolveCard(rule([{op:'execute',cap:{atk:4},count:1}]),r.foes[0],false,0);
    expect(r.foes[0].dead).toBe(true);
    engine.resolveCard(rule([{op:'execute',what:'fireball',count:3}]),r.foes[1],false,0);
    expect(r.foes[1].hp).toBe(87);
  });
  it.each([[8,3],[2,5]])('heaven gate purification restores actual attack reduction (%s attack, %s reduction) exactly once',async(atk,amount)=>{
    const {engine,r} = setup([{id:'a',name:'被控制者',hp:100,atk},{id:'b',name:'靶子',hp:100,atk:2}]);
    engine.resolveCard(rule([{op:'curse',curse:'atkDown',amount,duration:3,target:'chosenEnemy'}]),r.foes[0],false,0);
    r.foes[0].hp--;
    engine.resolveCard(rule([{op:'recruitEnemy',target:'chosenEnemy',wounded:true,excludeBoss:true}]),r.foes[0],false,0);
    const ally = r.allies[0];expect(ally.atk).toBe(Math.max(0,atk-amount));
    const source = rule([{op:'randomBlessing',target:'allAllies',choices:['purify'],preferMissing:true}]);
    engine.resolveCard(source,r.foes[1],false,0);
    expect(ally.status.atkDown).toBe(0);expect(ally.atk).toBe(atk);
    expect(ally._atkDownPending).toBeUndefined();expect(ally._atkDownAmount).toBeUndefined();
    await turn(engine);expect(r.foes[1].hp).toBe(100-atk);expect(ally.atk).toBe(atk);
  });
  it.each([[4,1],[8,2]])('a recruited heart-mode ally converts %s incoming damage to %s hearts',async(atk,hearts)=>{
    const {engine,r,game} = setup([{id:'nest-sand-elem',name:'沙暴元素',hp:8,atk:8,heartsMode:true},
      {id:'b',name:'攻击者',hp:100,atk}]);
    r.foes[0].hp--;
    engine.resolveCard(rule([{op:'recruitEnemy',target:'chosenEnemy',wounded:true,excludeBoss:true}]),r.foes[0],false,0);
    const ally = r.allies[0];expect(ally.heartsMode).toBe(true);expect(ally.hp).toBe(7);
    await turn(engine);
    expect(ally.hp).toBe(7-hearts);expect(ally.dead).toBe(false);expect(game.hp).toBe(100);
  });
  it('heaven gate stealth makes a frozen ally ineligible to guard a visible player',async()=>{
    const {engine,r,game} = setup([{id:'a',name:'被控制者',hp:100,atk:8},{id:'b',name:'攻击者',hp:100,atk:4}]);
    engine.resolveCard(rule([{op:'curse',curse:'freeze',duration:1,target:'chosenEnemy'}]),r.foes[0],false,0);
    r.foes[0].hp--;
    engine.resolveCard(rule([{op:'recruitEnemy',target:'chosenEnemy',wounded:true,excludeBoss:true}]),r.foes[0],false,0);
    const rolls = [0,0.99], original = engine.random.random.bind(engine.random);
    engine.random.random = (stream,purpose)=>stream === 'battle' && purpose === 'generation'
      ? (rolls.shift() ?? 0) : original(stream,purpose);
    engine.resolveCard(rule([{op:'randomBlessing',target:'allAllies',choices:['atkUp','stealth'],preferMissing:true}]),r.foes[1],false,0);
    expect(r.pstat.status.stealth).toBe(0);expect(r.allies[0].status.stealth).toBe(1);
    await turn(engine);
    expect(r.allies[0].hp).toBe(99);expect(game.hp).toBe(96);
  });
});
