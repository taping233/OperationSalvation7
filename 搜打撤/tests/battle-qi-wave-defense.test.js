import { afterEach, expect, it, vi } from 'vitest';
window.SDT={Icons:{img:()=>'',TYPE_ART:{}},Sound:{music(){},sfx(){},setDucked(){},setBoss(){}},MAP:{rules:{battleEnergy:9,battleHandMax:99,bossDeckSize:1,starterSha:0,battleStartDraw:1,battleTurnDraw:1},items:{}}};
await import('../game/src/cards/cards.js');
const C=window.SDT.Cards; C.ensureSha();C.ensureStarters();C.ensureTabletop();C.ensureDmgTypes();C.ensureEffectFields();
const {BattleSession}=await import('../game/src/battle/core/battle.core.js');
const R=await import('../game/src/battle/runtime/battle.runtime.js');
afterEach(()=>{vi.clearAllTimers();vi.useRealTimers();});
const foe=(extra={})=>({id:'target',name:'靶',hp:40,maxHp:48,atk:8,dead:false,status:{},defense:{shield:0,armor:0,guard:false},...extra});
async function cast(foes,{stealth=0, amplify=false, price=1}={}){
 vi.useFakeTimers();
 const card=C.all().find(c=>c.id==='tt3-qi-wave');
 const game={ownedCards:[{uid:'wave',card:{...card}},{uid:'drawn',card:{id:'price',name:'价格牌',type:'法术',cost:price,desc:''}}],hp:100,maxHp:100,atk:9,spellPower:9,coins:0,myClass:'战士',state:'idle',battleActive:false,logs:[],log(s){this.logs.push(s);},heal(){},addItem(){},onBattleEnd:vi.fn()};
 if(foes.some(f=>f.protected||f.protects||f.heartsMode)){
  // Fresh entry preserves nest protection flags; the ordinary restore projection omits them.
  BattleSession.start(game,foes,{isBoss:false});R.set$turn(2);
  if(foes.some(f=>f.heartsMode)){R.foes.forEach((f,i)=>Object.assign(f.status,foes[i].status));R.set$mode('boss');R.set$hand(['wave']);R.set$drawPile(['drawn']);}
 } else BattleSession.restore(game,{opts:{isBoss:true},mode:'boss',turn:2,maxEnergy:9,energy:9,hand:['wave'],drawPile:['drawn'],discard:[],grave:[],played:[],consumed:[],granted:[],pdef:{shield:0,armor:0,guard:false},pstat:{status:{stealth}},foes,delayed:[],growth:{},growthNames:[],zeroFeeUntil:[],cardOverrides:[]});
 if(amplify){R.set$stealthStrike(true);R.pstat.status.bleedAmp=1;R.set$nestSyn({dark3:true});R.set$equipped([{uid:'boost',card:{name:'寒冰剑',rules:{equip:{passive:{cond:{vsFreeze:3}}}}}}]);}
 BattleSession.commands.playCard('wave',0); await vi.advanceTimersByTimeAsync(1000);
 expect(R.busy).toBe(false);expect(R.energy).toBe(8);if(game.battleActive)expect(R.hand).toContain('drawn');
 return game;
}
it('气功波固定伤仍受偶数回合庇幕拦截，不破潜行',async()=>{
 await cast([foe({affix:'aegis'})],{stealth:1});expect(R.foes[0].hp).toBe(40);expect(R.pstat.status.stealth).toBe(1);
});
it('受庇护者不受伤，未受庇护的守卫仍受正常1伤',async()=>{
 await cast([foe({protected:true}),foe({id:'guard',protects:true})]);expect(R.foes.map(f=>f.hp)).toEqual([40,39]);
});
it.each([{}, {affix:'aegis',status:{abreak:1}}])('普通或破甲解除庇幕保持1固定伤且只破潜行一次 %j',async extra=>{
 const game=await cast([foe(extra)],{stealth:1});expect(R.foes[0].hp).toBe(39);expect(R.pstat.status.stealth||0).toBe(0);expect(game.logs.filter(s=>s.includes('潜行</b>被破除'))).toHaveLength(1);
 expect(R.floats.filter(f=>f.text==='-1')).toHaveLength(1);
});
it('击杀仅结算一次，同次全体其余目标仍正常受伤',async()=>{
 const game=await cast([foe({hp:1}),foe({id:'other'})]);expect(R.foes[0].dead).toBe(true);expect(R.foes[1].hp).toBe(39);expect(game.onBattleEnd).not.toHaveBeenCalled();expect(game.logs.filter(s=>s.includes('被击倒'))).toHaveLength(1);expect(R.floats.filter(f=>f.unit===0&&f.text==='-1')).toHaveLength(1);
});

it('固定价格不新增破隐/冰冻装备/流血/暗羁绊放大，但实际命中仍消耗潜行',async()=>{
 const game=await cast([foe({status:{freeze:1,bleed:4}})],{stealth:1,amplify:true});
 expect(R.foes[0].hp).toBe(39);expect(R.pstat.status.stealth||0).toBe(0);
 expect(game.logs.filter(s=>s.includes('潜行</b>被破除'))).toHaveLength(1);
});

it('全体先伤害后清尸，先命中的护卫倒下不提前解除本轮庇护',async()=>{
 const game=await cast([foe({id:'guard',protects:true,hp:1}),foe({id:'lord',protected:true})]);
 expect(R.foes[0].dead).toBe(true);expect(R.foes[1].hp).toBe(40);
 expect(game.logs.filter(s=>s.includes('被击倒'))).toHaveLength(1);
});

it('末敌死亡只结束战斗一次',async()=>{
 const game=await cast([foe({hp:1})]);expect(game.battleActive).toBe(false);expect(game.onBattleEnd).toHaveBeenCalledTimes(1);
 expect(game.logs.filter(s=>s.includes('被击倒'))).toHaveLength(1);
});

it('心数目标遵既有固定伤折算：8点价格伤害减2心，破甲后减8心',async()=>{
 await cast([foe({hp:12,heartsMode:true,hearts:12}),foe({id:'broken',hp:12,heartsMode:true,hearts:12,status:{abreak:1}})],{price:8});
 expect(R.foes.map(f=>f.hp)).toEqual([10,4]);
});
