// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createBattleEngineInstance } from '../game/src/battle/core/battle.engine.instance.js';
import { BUILTIN_EQUIPMENT_REVISIONS } from '../game/src/cards/builtin-equipment-execution.js';
import { previewAction } from '../game/src/battle/view/battle.preview.js';

const held = {id:'sweep2-held',name:'持有牌',type:'武术',cost:0,dmgType:'fixed',desc:''};
const rule = (ops, extra = {}) => ({...held,id:'sweep2-rule',name:'审查回归',...extra,
  rules:{version:1,battle:{target:{side:'enemy',area:false}},triggers:{onPlay:ops}}});
const engines = [];
function setup(enemies = [{id:'a',name:'甲',hp:100,atk:2},{id:'b',name:'乙',hp:100,atk:2}], options = {}) {
  const cards = {all:()=>[held],deriveDraw:()=>0,deriveInfuse:()=>0,isRandomObtainable:()=>true,
    sellPrice:()=>1,randomClassCard:()=>held,SHA:{...held,id:'starter-attack',name:'初始攻击'},
    TABLETOP10:[],DMG_TYPES:['武术','法术'],DMG_TYPE_META:{fixed:{},spell:{},attack:{},true:{}}};
  const engine = createBattleEngineInstance({cards,readRules:()=>({battleEnergy:8,battleHandMax:20,
    bossDeckSize:15,starterSha:0,battleStartDraw:0,battleTurnDraw:0,diceSides:6}),testMode:true,
    presentation:{demoMs:()=>0,waitMs:async()=>{}}});
  const game = {ownedCards:[{uid:'held',card:held}],hp:100,maxHp:100,atk:2,spellPower:0,coins:0,
    state:'idle',battleActive:false,log:vi.fn(),heal(n){this.hp=Math.min(this.maxHp,this.hp+n);},addItem(){},onBattleEnd(){}};
  engine.start(game,enemies,{isBoss:false,...options});engines.push(engine);return {engine,game,r:engine.runtime,cards};
}
async function turn(engine) {
  await engine.idle();for(let i=0;i<8;i++)await Promise.resolve();
  engine.endTurn();await vi.runAllTimersAsync();await engine.idle();
}
async function play(engine,r,uid,card,target = 'self') {
  r.granted.push({uid,card});r.hand.push(uid);engine.submitCardPlay(uid,target);await engine.idle();
  await engine.awaitTriggeredActions('player');
}
async function installKillListener(engine,r) {
  await play(engine,r,'listener',{...held,id:'sweep2-listener',rules:{version:1,
    battle:{target:{side:'self',area:false}},triggers:{onPlay:[],onKill:[{op:'blessing',key:'atkUp',stacks:1}]}}});
}
beforeEach(()=>vi.useFakeTimers());
afterEach(()=>{for(const engine of engines.splice(0))if(engine.runtime.G.battleActive)engine.finish(null);
  vi.clearAllTimers();vi.useRealTimers();});

describe('battle bug sweep round2 2026-10-24',()=>{
  it('scale armor retaliation during the enemy phase triggers registered onKill exactly once',async()=>{
    const {engine,r} = setup([{id:'a',name:'反击靶',hp:3,atk:2},{id:'b',name:'后续敌人',hp:100,atk:2}]);
    await installKillListener(engine,r);
    await play(engine,r,'scale',{...held,id:'tt13-scale-armor',name:'鳞甲',type:'装备',
      ...BUILTIN_EQUIPMENT_REVISIONS['tt13-scale-armor']});
    engine.random.random=()=>0;
    await turn(engine);
    expect(r.foes[0].dead).toBe(true);expect(r.pstat.status.atkUp).toBe(1);
    await turn(engine);expect(r.pstat.status.atkUp).toBe(1);
  });
  it('onDraw damage dispatches the same kill event without playing a source card',async()=>{
    const {engine,r} = setup([{id:'a',name:'抽到靶',hp:3,atk:2},{id:'b',name:'乙',hp:100,atk:2}]);
    await installKillListener(engine,r);
    r.granted.push({uid:'draw-kill',card:{...held,rules:{version:1,triggers:{onDraw:[{op:'damage',amount:3,target:'chosenEnemy'}]}}}});
    r.set$drawPile(['draw-kill']);engine.drawCards(1);
    expect(r.foes[0].dead).toBe(true);expect(r.pstat.status.atkUp).toBe(1);
  });
  it('echo kills and the source kill each dispatch once before the outer source completes',async()=>{
    const {engine,r} = setup([{id:'a',name:'回声源',hp:1,atk:2},{id:'b',name:'回声靶',hp:2,atk:2},{id:'c',name:'丙',hp:100,atk:2}]);
    await installKillListener(engine,r);r.foes[0].damageEcho={amount:2,dmgType:'true'};engine.random.random=()=>0;
    await play(engine,r,'damage',rule([{op:'damage',amount:1,target:'chosenEnemy'}]),0);
    expect(r.foes.slice(0,2).every(foe=>foe.dead)).toBe(true);expect(r.pstat.status.atkUp).toBe(2);
  });
  it('revival and recruitment do not grant a kill while the final death does',async()=>{
    const {engine,r} = setup([{id:'a',name:'复活者',hp:2,atk:2,revive:{hearts:8,atk:8}},
      {id:'b',name:'可控制者',hp:100,atk:2},{id:'c',name:'丙',hp:100,atk:2}]);
    await installKillListener(engine,r);engine.hitFoe(r.foes[0],held,2,'true');
    expect(r.pstat.status.atkUp).toBe(0);r.foes[1].hp--;
    engine.resolveCard(rule([{op:'recruitEnemy',target:'chosenEnemy',wounded:true,excludeBoss:true}]),r.foes[1],false,0);
    engine.hitFoe(r.foes[0],held,8,'true');
    expect(r.pstat.status.atkUp).toBe(1);
  });
  it('nested onDraw draws do not erase earlier martial draws from the release batch',async()=>{
    const {engine,r,game} = setup();await engine.idle();
    const martial = index => ({...held,id:`sweep2-martial-${index}`,name:`招式${index}`,dmg:1,
      rules:{version:1,battle:{target:{side:'enemy',area:false}},triggers:{onPlay:[{op:'damage',amount:1,target:'chosenEnemy'}]}}});
    const draws = Array.from({length:5},(_,index)=>({uid:`martial-${index}`,card:martial(index)}));
    const sword = {...held,id:'tt8-heavensword',name:'天启剑',type:'装备',draw:1,
      ...BUILTIN_EQUIPMENT_REVISIONS['tt8-heavensword']};
    r.granted.push(...draws,{uid:'heavensword',card:sword});
    r.set$drawPile(['martial-4','martial-3','martial-2','martial-1','heavensword','martial-0']);
    const release = rule([{op:'draw',amount:5},{op:'castDrawn',type:'武术'}]);release.rules.battle.target.side='self';
    await play(engine,r,'release',release);
    expect(r.hand,JSON.stringify(game.log.mock.calls)).not.toContain('martial-0');
    expect(r.foes[0].hp).toBe(95);
  });
  it.each([['attack',2],['poison',1],['selfDamage',1],['blocked',0]])('unyield draws once per actual %s damage event',async(source,draws)=>{
    const {engine,r} = setup();r.applyRuneFlag('unyield');const before = r.hand.length;
    if(source === 'selfDamage') {
      const self = rule([{op:'heal',selfDamage:2}]);self.rules.battle.target.side='self';
      engine.resolveCard(self,null,false,0);
    } else {
      if(source === 'poison') {r.pstat.status.poison=2;r.foes.forEach(foe=>{foe.status.freeze=1;});}
      if(source === 'blocked') r.pdef.armor=100;
      await turn(engine);
    }
    expect(r.hand.length).toBe(before+draws);
  });
  it('multi-segment kills issue one shared event and one card rider per enemy',async()=>{
    const {engine,r,game} = setup([{id:'a',name:'甲',hp:3,atk:2},{id:'b',name:'乙',hp:3,atk:2},{id:'c',name:'丙',hp:100,atk:2}]);
    await installKillListener(engine,r);
    const source=rule([{op:'damage',amount:1,target:'allEnemies',hits:{count:3},onKill:{coins:2}}]);
    source.rules.battle.target.area=true;await play(engine,r,'multi',source,0);
    expect(r.foes.slice(0,2).every(foe=>foe.dead)).toBe(true);expect(r.pstat.status.atkUp).toBe(2);expect(game.coins).toBe(4);
  });
  it('delayed damage issues a kill event and a loaded corpse cannot receive it twice',async()=>{
    const {engine,r,game} = setup([{id:'a',name:'定时靶',hp:3,atk:2},{id:'b',name:'乙',hp:3,atk:2},{id:'c',name:'丙',hp:100,atk:2}]);
    await installKillListener(engine,r);
    engine.resolveCard(rule([{op:'damage',amount:3,target:'chosenEnemy',schedule:'nextTurnStart'}]),r.foes[0],false,0);
    await turn(engine);expect(r.foes[0].dead).toBe(true);expect(r.pstat.status.atkUp).toBe(1);
    const saved=structuredClone(engine.getSnapshot());engine.restore(game,saved);
    await installKillListener(engine,r);
    await play(engine,r,'after-restore',rule([{op:'damage',amount:3,target:'chosenEnemy'}]),1);
    expect(r.foes[1].dead).toBe(true);expect(r.pstat.status.atkUp).toBe(2);
  });
  it('time rune preserves positive durations while negative curses still expire',async()=>{
    const {engine,r}=setup();r.applyRuneFlag('time');
    Object.assign(r.pstat.status,{freeze:1,silence:1,abreak:2,healban:2,stealth:1,immune:1});
    await turn(engine);
    expect(r.pstat.status).toMatchObject({freeze:0,silence:0,abreak:1,healban:1,stealth:1,immune:1});
    await turn(engine);expect(r.pstat.status).toMatchObject({abreak:0,healban:0,stealth:1,immune:1});
  });
  it('infinite rune discounts a newly acquired deck card while original cards keep their cost',()=>{
    const {engine,r,cards}=setup();r.applyRuneFlag('infinite');
    const template={...held,id:'sweep2-costly',name:'新增招式',cost:3};cards.all=()=>[template];
    const source=rule([{op:'acquire',n:1,pool:{kind:'moves'},dest:'deck'}]);source.rules.battle.target.side='self';
    engine.resolveCard(source,null,false,0);
    const uid=r.drawPile.find(value=>value.startsWith('btd'));
    expect(uid).toBeTruthy();r.set$drawPile([uid]);engine.drawCards(1);
    expect(r.hand).toContain(uid);expect(engine.effCostOf(template,uid)).toBe(2);
    expect(engine.effCostOf(template,'held')).toBe(3);expect(template.cost).toBe(3);
  });
  it('a new battle with the same enemy ids receives fresh kill rewards',async()=>{
    const enemies=[{id:'a',name:'甲',hp:2,atk:2},{id:'b',name:'乙',hp:100,atk:2}];
    const {engine,r,game}=setup(enemies);await installKillListener(engine,r);
    const old=r.foes[0];engine.hitFoe(old,held,2,'true');expect(r.pstat.status.atkUp).toBe(1);
    engine.finish(null);engine.start(game,enemies,{isBoss:false});await installKillListener(engine,r);
    expect(r.foes[0]).not.toBe(old);engine.hitFoe(r.foes[0],held,2,'true');expect(r.pstat.status.atkUp).toBe(1);
  });
  it('nested draw healing counts only the nested spells while the outer release batch keeps all arrivals',()=>{
    const {engine,r,game}=setup();game.hp=50;
    const spell={...held,id:'sweep2-spell',name:'普通法术',type:'法术'};
    const trigger={...held,id:'sweep2-healing-draw',name:'抽牌治疗',type:'装备',rules:{version:1,
      triggers:{onDraw:[{op:'draw',amount:1},{op:'heal',perSpellHeal:2}]}}};
    r.granted.push({uid:'outer-spell',card:spell},{uid:'trigger',card:trigger},{uid:'nested-spell',card:spell});
    r.set$drawPile(['nested-spell','trigger','outer-spell']);engine.drawCards(2);
    expect(game.hp).toBe(52);expect(r.lastDrawnUids).toEqual(['outer-spell','nested-spell']);
  });
  it.each([[0,0,4],[3,0,10],[3,3,7]])('stealth strike doubles attack plus its %s base before %s armor',async(base,armor,damage)=>{
    const {engine,r}=setup();r.set$stealthStrike(true);r.pstat.status.stealth=1;r.foes[0].defense.armor=armor;
    const source=rule([{op:'damage',amountField:'dmg',target:'chosenEnemy'}],{dmg:base,dmgType:'attack'});
    const prediction=previewAction({snapshot:engine.getSnapshot(),action:{kind:'play-card',uid:'stealth-attack',targetIndex:0},
      cardContext:{card:source,legal:true,effectiveCost:0,targetIndexes:[0],modifiers:{stealthStrike:true}}});
    expect(prediction.confidence).toBe('exact');expect(prediction.damage.total).toBe(damage);
    await play(engine,r,'stealth-attack',source,0);
    expect(r.foes[0].hp).toBe(100-damage);expect(r.pstat.status.stealth).toBe(0);
  });
  it('stealth strike scales before heart conversion and leaves independent echo damage unchanged',async()=>{
    const {engine,r,game}=setup([{id:'a',name:'心数靶',hp:8,atk:2,heartsMode:true},{id:'b',name:'回声靶',hp:100,atk:2}]);
    game.atk=4;r.set$stealthStrike(true);r.pstat.status.stealth=1;r.foes[0].damageEcho={amount:2,dmgType:'true'};
    engine.random.random=()=>0;
    const source=rule([{op:'damage',amountField:'dmg',target:'chosenEnemy'}],{dmg:0,dmgType:'attack'});
    const prediction=previewAction({snapshot:engine.getSnapshot(),action:{kind:'play-card',uid:'stealth-attack',targetIndex:0},
      cardContext:{card:source,legal:true,effectiveCost:0,targetIndexes:[0],modifiers:{stealthStrike:true}}});
    expect(prediction.damage.total).toBe(2);
    await play(engine,r,'stealth-heart',source,0);
    expect(r.foes[0].hp).toBe(6);expect(r.foes[1].hp).toBe(98);
  });
});
