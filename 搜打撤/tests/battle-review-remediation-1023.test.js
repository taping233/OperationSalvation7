import { damageRuleFields } from './helpers/environment-fixtures.js';
// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createBattleEngineInstance } from '../game/src/battle/core/battle.engine.instance.js';
import { previewAction } from '../game/src/battle/view/battle.preview.js';

const hit = { id:'review-hit', name:'审阅攻击', type:'武术', cost:1, dmg:4, dmgType:'fixed', desc:'',
  rules:{ ...damageRuleFields(false, 'chosenEnemy') } };
const fireball = { ...hit, id:'review-fireball', name:'小火球', type:'法术', dmgType:'spell' };
const engines = [];
function setup({ enemies=[{ id:'a', name:'甲', hp:30, atk:0 }, { id:'b', name:'乙', hp:30, atk:0 }], presentation={}, ended=()=>{}, emitEvent=()=>0 }={}) {
  const cards={ all:()=>[hit,fireball], deriveDraw:()=>0, deriveInfuse:()=>0, isRandomObtainable:()=>true, sellPrice:()=>1, randomClassCard:()=>hit,
    SHA:{ ...hit, id:'starter-attack', name:'初始攻击', cost:0 }, TABLETOP10:[], DMG_TYPES:['武术','法术'], DMG_TYPE_META:{ fixed:{}, spell:{} } };
  const engine=createBattleEngineInstance({ cards, readRules:()=>({ battleEnergy:8, battleHandMax:20, bossDeckSize:15, starterSha:0, battleStartDraw:0, battleTurnDraw:0, diceSides:6 }),
    presentation:{ demoMs:()=>0, waitMs:async()=>{}, ...presentation }, emitEvent, testMode:true });
  const game={ ownedCards:[{ uid:'held', card:hit }], hp:50, maxHp:50, atk:2, spellPower:0, coins:0, state:'idle', battleActive:false,
    log:vi.fn(), heal(n){this.hp=Math.min(this.maxHp,this.hp+n);}, addItem(){}, onBattleEnd:ended };
  engine.start(game,enemies,{ isBoss:false }); engines.push(engine);
  return { engine, game, r:engine.runtime };
}
async function turn(engine) { await engine.idle(); for(let i=0;i<8;i++) await Promise.resolve(); engine.endTurn(); await vi.runAllTimersAsync(); await engine.idle(); }
beforeEach(()=>vi.useFakeTimers());
afterEach(()=>{ for(const engine of engines.splice(0)) if(engine.runtime.G.battleActive) engine.finish(null); vi.clearAllTimers(); vi.useRealTimers(); });
const ally=(hp=20)=>({ name:'步兵', atk:4, hp, maxHp:hp, status:{}, defense:{shield:0,armor:0,guard:false} });

describe('第三方源码意见的战斗行为回归',()=>{
  it.each(['hearts','aegis','protected'])('B01 随从遵守 %s 保护',async kind=>{
    const {engine,r}=setup(); const target=r.foes[0];
    if(kind==='hearts') target.heartsMode=true;
    if(kind==='aegis'){ target.affix='aegis';r.set$turn(2); }
    if(kind==='protected'){target.protected=true;r.foes[1].protects=true;}
    r.allies.push(ally()); await turn(engine);
    expect(target.hp).toBe(kind==='hearts'?29:30);
  });
  it('B02 每个随从击杀立即清尸并改选目标',async()=>{
    const {engine,r}=setup();r.foes[0].hp=3;r.allies.push(ally(),ally());await turn(engine);
    expect(r.foes[0].dead).toBe(true);expect(r.foes[1].hp).toBe(26);
  });
  it('B04 冰冻禁止随从攻击，中毒结算并及时死亡',async()=>{
    const {engine,r}=setup();const soldier=ally(3);soldier.status={freeze:1,poison:3};r.allies.push(soldier);await turn(engine);
    expect(r.foes[0].hp).toBe(30);expect(soldier.dead).toBe(true);
  });
  it.each([false,true])('B03/B05 火球消耗触发完整钩子，额外回合=%s',async extra=>{
    const {engine,r}=setup();
    const consumed={...hit,id:'review-scroll',name:'残卷',rules:{version:1,triggers:{onConsume:[{op:'energy',n:2}]}}};
    r.granted.push({uid:'scroll',card:consumed});r.set$drawPile(['scroll']);r.applyRuneFlag('fireball');r.set$extraTurn(extra);
    await turn(engine);expect(r.consumed).toContain('scroll');expect(r.grave).toContain('scroll');expect(r.energy).toBe(10);expect(r.foes[0].hp).toBe(26);
  });
  it('B06 完全防御不生成红色零伤害',()=>{
    const {engine,r}=setup();r.pdef.shield=20;engine.playerTakeHit({name:'甲',atk:3});
    expect(r.floats.some(float=>float.text==='-0'&&float.cls==='hurt')).toBe(false);
    expect(r.floats.some(float=>float.text==='防御'&&float.cls==='block')).toBe(true);
  });
  it('B09 心数防御逐次消耗，真伤遵守免疫和闪避',()=>{
    const {engine,r}=setup();const target=r.foes[0];target.heartsMode=true;target.defense.shield=4;
    expect(engine.hitFoe(target,hit,4,'fixed')).toBe(0);expect(target.defense.shield).toBe(0);
    expect(engine.hitFoe(target,hit,4,'fixed')).toBe(1);
    target.status.dodge=1;expect(engine.hitFoe(target,hit,4,'true')).toBe(0);expect(target.status.dodge).toBe(0);
    target.status.immune=1;expect(engine.hitFoe(target,hit,4,'true')).toBe(0);expect(target.hp).toBe(29);
  });
  it('B07 心数、成长、已选注能与固定重放共享伤害公式',()=>{
    const {engine,r}=setup();r.foes[0].heartsMode=true;
    const card={...hit,rules:{version:1,triggers:{onPlay:[{op:'damage',amountField:'dmg',infuseBonus:3,target:'chosenEnemy'}]}}};
    const result=previewAction({snapshot:engine.getSnapshot(),action:{uid:'held',targetIndex:0},cardContext:{card,targetIndexes:[0],legal:true,wholeCardRepeats:2,damageGrowth:1,selectedFuelUids:['fuel']}});
    expect(result.confidence).toBe('exact');expect(result.damage.hits).toEqual([2,2]);expect(r.foes[0].hp).toBe(30);
  });
  it('B08 历史增长不再进入视图签名或深拷贝热路径',()=>{
    const {engine,r}=setup();r.pstat.requestedCards={damageTurn:-1,history:{version:1,events:[]}};
    const first=engine.getSnapshot();Object.defineProperty(r.pstat.requestedCards.history,'events',{get(){throw new Error('view traversed full history');}});
    expect(engine.getSnapshot()).toBe(first);expect(first.pstat.requestedCards.history).toBeUndefined();
  });
  it('C08 被动登记快照包含次数、执行声明且不可修改',async()=>{
    const {engine,r}=setup();const card={id:'passive-rule',name:'被动规则',type:'法术',cost:0,desc:'',rules:{version:1,battle:{target:{side:'self',area:false}},triggers:{onPlay:[],onTurnStart:[{op:'energy',n:2}],duration:2}}};
    r.granted.push({uid:'passive',card});r.hand.push('passive');engine.submitCardPlay('passive','self');await engine.idle();
    const snapshot=engine.getTriggerSnapshot();expect(snapshot[0]).toMatchObject({uid:'passive',remaining:2});expect(Object.isFrozen(snapshot[0].points)).toBe(true);
    await turn(engine);expect(engine.getTriggerSnapshot()[0].remaining).toBe(1);expect(snapshot[0].remaining).toBe(2);
  });
  it('B10 支付后异常可见失败并恢复开战检查点',async()=>{
    let fail=true;const {engine,r,game}=setup({presentation:{waitMs:async()=>{if(fail){fail=false;throw new Error('injected after payment');}}}});
    const warning=vi.spyOn(console,'error').mockImplementation(()=>{});
    try{const submission=engine.submitCardPlay('held',0);await engine.idle();
      expect((await submission.settled).status).toBe('rejected');expect(r.energy).toBe(8);expect(r.hand).toContain('held');expect(r.foes[0].hp).toBe(30);
      expect(game.battleActionFailure.recovery).toBe('battle-start');expect(game.log.mock.calls.some(([line])=>line.includes('已恢复到本场战斗开始处'))).toBe(true);
    }finally{warning.mockRestore();}
  });
  it('C09 普通观察者仅在必要结算成功后收到结果',async()=>{
    let release;const done=new Promise(resolve=>{release=resolve;});const observer=vi.fn(()=>1),settle=vi.fn(()=>done);
    const {engine}=setup({ended:settle,emitEvent:observer});engine.finish(true);
    expect(settle).toHaveBeenCalledOnce();expect(observer.mock.calls.some(([name])=>name==='battle:end')).toBe(false);
    release(true);await Promise.resolve();await Promise.resolve();expect(observer.mock.calls.some(([name])=>name==='battle:end')).toBe(true);
  });
});
