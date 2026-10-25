import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { createBattleEngineInstance } from '../../../../game/src/battle/core/battle.engine.instance.js';
import { createCombatRuntime } from '../../../../game/src/battle/core/combat.factory.js';
import { createDrawDomain } from '../../../../game/src/battle/core/battle.draw.domain.js';
import { inspectCardRuleCapability } from '../../../../game/src/cards/card-rules.capability.js';

const results = [];
const sourceFiles=['core/battle.draw.domain.js','core/battle.resolution.domain.js','core/combat.factory.js',
  'effects/effect-steps.m2.domain.js','core/battle.foe-lifecycle.domain.js','core/battle.enemy-phase.domain.js'];
const hashes=()=>Object.fromEntries(sourceFiles.map(path=>[path,createHash('sha256').update(
  readFileSync(new URL('../../../../game/src/battle/'+path,import.meta.url))).digest('hex')]));
const sourceHashes=hashes();
const basic = { id:'audit-held', name:'持有牌', type:'武术', cost:0, dmgType:'fixed', desc:'' };
const ruleCard = (id, ops, target={side:'enemy',area:false}) => ({ ...basic, id, name:id,
  rules:{version:1,battle:{target},triggers:{onPlay:ops}} });
function setup(enemies=[{id:'a',name:'甲',hp:30,atk:0},{id:'b',name:'乙',hp:30,atk:0}]) {
  const cards = { all:()=>[basic], deriveDraw:()=>0, deriveInfuse:()=>0, isRandomObtainable:()=>true,
    sellPrice:()=>1, randomClassCard:()=>basic, SHA:{...basic,id:'starter-attack',name:'初始攻击'},
    TABLETOP10:[],DMG_TYPES:['武术','法术'],DMG_TYPE_META:{fixed:{},spell:{},attack:{},true:{}} };
  const engine=createBattleEngineInstance({cards,readRules:()=>({battleEnergy:8,battleHandMax:20,bossDeckSize:15,
    starterSha:0,battleStartDraw:0,battleTurnDraw:0,diceSides:6}),testMode:true,
    presentation:{demoMs:()=>0,waitMs:async()=>{},waitForFeedback:async()=>{}}});
  const game={ownedCards:[{uid:'held',card:basic}],hp:100,maxHp:100,atk:2,spellPower:0,coins:0,
    state:'idle',battleActive:false,logs:[],log(value){this.logs.push(value);},heal(n){this.hp=Math.min(this.maxHp,this.hp+n);},
    addItem(){},onBattleEnd(){}};
  engine.start(game,enemies,{isBoss:false});
  return {engine,game,r:engine.runtime};
}
async function nextTurn(engine,r) {
  await engine.idle();
  engine.endTurn();
  for(let i=0;i<100 && r.G.battleActive && r.turn===1;i++) await new Promise(resolve=>setTimeout(resolve,5));
  await engine.idle();
}

// Same physical deck card, only the draw operation differs.
{
  const target={id:'draw-trigger',name:'抽到装备',type:'装备',cost:0,desc:'',
    rules:{version:1,triggers:{onDraw:[{op:'energy',n:2}]}}};
  function drawFixture(directed) {
    const state={G:{battleActive:true,log(){}},battleState:{token:1},mode:'normal',drawPile:['drawn'],hand:[],
      discard:[],lastDrawnUids:[],cardAnims:[],effectiveHandMax:n=>n,set$lastDrawnUids(a){this.lastDrawnUids=a;}};
    let triggers=0;
    const draw=createDrawDomain({runtime:state,audio:{sfx(){}},cards:{SHA:{id:'starter'}}}).createBattleDraw({
      R:()=>({battleHandMax:20}),alive:()=>[{hp:30}],findCard:()=>({uid:'drawn',card:target}),
      sweepDead(){},fireDrawn(){triggers++;},checkSealTransformation(){},queueCardExecution(){return true;}});
    const count=directed?draw.deckDraw({n:1,type:'装备'}):draw.drawCards(1);
    return {count,triggers,hand:state.hand,discard:state.discard};
  }
  const ordinary=drawFixture(false),directed=drawFixture(true);
  assert.equal(ordinary.triggers,1);assert.equal(directed.triggers,0);assert.deepEqual(directed.hand,['drawn']);
  results.push({id:'B-NEW-01',description:'定向抽牌绕过抽到触发',actual:directed,expected:ordinary});
}
{
  // cards.data.js imports JSON through Vite; read the current single-line literal for this node-only probe.
  const source=readFileSync(new URL('../../../../game/src/cards/cards.data.js',import.meta.url),'utf8');
  const swordLine=source.split(/\r?\n/).filter(line=>line.includes("id: 'tt8-heavensword'")).at(-1).trim();
  const sword=Function('return ('+swordLine.replace(/,\s*$/,'')+')')();
  assert.ok(sword);
  function nativeDraw(directed) {
    const {engine,r}=setup();
    r.granted.push({uid:'sword',card:structuredClone(sword)},{uid:'filler',card:basic});
    r.set$hand([]);r.set$drawPile(['filler','sword']);
    if(directed)engine.resolveCard(ruleCard('draw-equipment',[{op:'draw',amount:1,filter:{type:'装备'}}],{side:'self',area:false}),r.foes[0],false,0);
    else engine.drawCards(1);
    const actual={hand:[...r.hand],drawPile:[...r.drawPile],discard:[...r.discard]};
    engine.finish(null);return actual;
  }
  const ordinary=nativeDraw(false),directed=nativeDraw(true);
  assert.deepEqual(ordinary.hand,['filler']);assert.deepEqual(directed.hand,['sword']);
  results.push({id:'B-NEW-01-NATIVE',description:'实际天启剑被武装同型过滤抽到时漏额外抽牌',actual:directed,expected:ordinary});
}
// No state changes between windup and hit: the same segment nevertheless rerolls.
{
  const {engine,r}=setup();let rolls=0;
  const original=engine.random.random.bind(engine.random);
  engine.random.random=(stream,purpose)=>stream==='battle'&&purpose==='target'?(rolls++%2===0?0:0.99):original(stream,purpose);
  const card=ruleCard('random-hit',[{op:'damage',amount:4,target:'randomEnemy'}]);
  assert.equal(inspectCardRuleCapability(card).ok,true);
  const iterator=engine.resolveCard.steps(card,r.foes[0],false,0,'held');
  const cue=iterator.next().value;const windup=cue.targets.map(f=>f.id);
  while(!iterator.next().done){}
  const actual={windup,damaged:r.foes.filter(f=>f.hp<30).map(f=>f.id),rolls};
  assert.notDeepEqual(actual.windup,actual.damaged);assert.equal(rolls,2);
  results.push({id:'B-NEW-02',description:'随机伤害在同段演出与命中两次选靶',actual,expected:{windup:['a'],damaged:['a'],rolls:1}});
  engine.finish(null);
}
// Consumed timed dodge records must not later subtract a different grant.
{
  const combat=createCombatRuntime();const unit={hp:30};
  for(const duration of [1,2])assert.equal(inspectCardRuleCapability(ruleCard('dodge-'+duration,
    [{op:'blessing',key:'dodge',stacks:1,duration}],{side:'self',area:false})).ok,true);
  combat.addBlessing(unit,'dodge',1,1);combat.dealDamage({},unit,4,'fixed');
  assert.equal(unit.status.dodge,0);
  combat.addBlessing(unit,'dodge',1,2);combat.tickDurations(unit);
  const actual={dodge:unit.status.dodge,timed:unit.__timedBuffs};
  assert.equal(actual.dodge,0);assert.equal(actual.timed[0].turns,1);
  results.push({id:'B-NEW-03',description:'已消耗闪避的过期记录扣除后加闪避',actual,expected:{dodge:1,remainingTurns:1}});
}
// Revive sets a new attack value, but retains bookkeeping from the old form.
{
  const {engine,r}=setup([{id:'nest-elem-lord',name:'完全形态·元素领主',hp:32,heartsMode:true,atk:8,
    revive:{hearts:8,atk:8},affix:'aegis',boss:true},{id:'other',name:'存活目标',hp:30,atk:0}]);
  const steal={...ruleCard('tt3sp-shadowbug',[{op:'stealAtk',capTo:1,target:'chosenEnemy'}]),name:'影噬'};
  assert.equal(inspectCardRuleCapability(steal).ok,true);
  engine.resolveCard(steal,r.foes[0],false,0);
  engine.hitFoe(r.foes[0],basic,99,'true');
  assert.equal(r.foes[0].revived,true);assert.equal(r.foes[0].atk,8);
  await nextTurn(engine,r);
  const actual={turn:r.turn,atk:r.foes[0].atk,revived:r.foes[0].revived};
  assert.equal(actual.turn,2);assert.equal(actual.atk,15);
  results.push({id:'B-NEW-04',description:'复活形态继续归还旧形态被偷攻击',actual,expected:{turn:2,atk:8,revived:true}});
  engine.finish(null);
}
// The player buff expires independently, but enemy attack reductions are merged.
{
  const {engine,r}=setup([{id:'victim',name:'目标',hp:100,atk:10},{id:'other',name:'存活目标',hp:30,atk:0}]);
  for(const duration of [1,3]) {
    const card=ruleCard('steal-'+duration,[{op:'stealAtk',amount:2,duration,target:'chosenEnemy'}]);
    assert.equal(inspectCardRuleCapability(card).ok,true);engine.resolveCard(card,r.foes[0],false,0);
  }
  await nextTurn(engine,r);
  const actual={turn:r.turn,foeAttack:r.foes[0].atk,playerAttackBonus:r.pstat.status.atkUp};
  assert.equal(actual.foeAttack,6);assert.equal(actual.playerAttackBonus,2);
  results.push({id:'B-NEW-05',description:'多次偷取的归还日期互相覆盖',actual,expected:{turn:2,foeAttack:8,playerAttackBonus:2}});
  engine.finish(null);
}
// A damage-segment reward attached to the killing segment should settle on bosses too.
{
  const card=ruleCard('reward-hit',[{op:'damage',amount:5,target:'chosenEnemy',onKill:{coins:2}}]);
  assert.equal(inspectCardRuleCapability(card).ok,true);
  const {engine,game,r}=setup([{id:'boss',name:'首脑',hp:4,atk:0,boss:true},{id:'other',name:'存活目标',hp:30,atk:0}]);
  let error=null;try{engine.resolveCard(card,r.foes[0],false,0);}catch(e){error=e.name;}
  const actual={battleActive:game.battleActive,bossDead:r.foes[0].dead,coins:game.coins,error};
  assert.equal(actual.coins,2);
  results.push({id:'B-CONTROL-06',description:'排除候选：同步首脑击杀可以获得伤害段奖励',actual,expected:{coins:2}});
  if(game.battleActive)engine.finish(null);
}
// Deduplicate and revalidate the two earlier backend-audit findings.
{
  const {engine,r}=setup();
  const equip={id:'consumed-equipment',name:'消耗装备',type:'装备',cost:0,desc:'',
    rules:{version:1,triggers:{onConsume:[{op:'energy',n:2}]}}};
  r.granted.push({uid:'equip',card:equip});r.set$hand(['equip']);
  engine.resolveCard(ruleCard('armor-consume',[{op:'armor',amount:10,consumeEquip:true}],{side:'self',area:false}),r.foes[0],false,0);
  const actual={energy:r.energy,armor:r.pdef.armor,consumed:[...r.consumed]};
  assert.equal(actual.energy,8);assert.equal(actual.armor,10);assert.ok(actual.consumed.includes('equip'));
  results.push({id:'B-KNOWN-01',description:'既有：铸甲消耗装备漏掉onConsume',actual,expected:{energy:10,armor:10}});
  engine.finish(null);
}
{
  const {engine,r,game}=setup();r.foes[0].status.immune=1;
  const card=ruleCard('untargeted-execute',[{op:'execute',cap:{atk:4},count:1}],{side:null,area:false});
  assert.equal(inspectCardRuleCapability(card).ok,true);engine.resolveCard(card,null,false,0);
  const actual={dead:r.foes.map(f=>f.dead),claimedKill:game.logs.some(line=>line.includes('消灭了 1 个'))};
  assert.deepEqual(actual.dead,[false,false]);assert.equal(actual.claimedKill,true);
  results.push({id:'B-KNOWN-02',description:'既有：execute按尝试计击杀，免疫者占用count',actual,expected:{dead:[false,true],claimedKill:true}});
  engine.finish(null);
}

assert.deepEqual(hashes(),sourceHashes,'source bytes changed while reproductions were running');
writeFileSync(new URL('./reproduction-results.json',import.meta.url),JSON.stringify({date:'2026-10-23',sources:sourceHashes,results},null,2)+'\n');
console.log(JSON.stringify(results,null,2));
