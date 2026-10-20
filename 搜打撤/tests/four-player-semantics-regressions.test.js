import { describe, expect, it } from 'vitest';
window.SDT = { Icons:{ img:()=>'', TYPE_ART:{} }, Sound:{music(){},sfx(){},setDucked(){},setBoss(){}},
  MAP:{rules:{battleEnergy:9,battleHandMax:99,bossDeckSize:1,starterSha:5,battleStartDraw:99,battleTurnDraw:1},items:{rations:{name:'口粮'},wood:{name:'木材'}}} };
await import('../game/src/cards/cards.js');
const { BattleSession, findCard, effCostOf } = await import('../game/src/battle/core/battle.core.js');
const { set$hand } = await import('../game/src/battle/runtime/battle.runtime.js');
const { set$grave, set$consumed } = await import('../game/src/battle/runtime/battle.runtime.piles.js');
const { displayCardDescription } = await import('../game/src/cards/card-description-text.js');
const C = window.SDT.Cards;
C.ensureSha(); C.ensureStarters(); C.ensureTabletop(); C.ensureDmgTypes(); C.ensureEffectFields();
const byId = id => C.all().find(c=>c.id===id);
const byName = name => C.all().find(c=>c.name===name);
const gameFor = cards => ({ ownedCards:cards.map((card,i)=>({uid:'u'+i,card})),inventory:[],usedPocket:[],hp:50,maxHp:50,atk:7,spellPower:0,coins:0,state:'idle',battleActive:false,myClass:'战士',log(){},heal(){},onBattleEnd(){} });
async function drain(){for(let n=0;n<200;n++){await new Promise(r=>setTimeout(r,0));const s=BattleSession.getSnapshot();if(!s.busy&&s.actionQueueLength===0){await new Promise(r=>setTimeout(r,30));const f=BattleSession.getSnapshot();if(!f.busy&&f.actionQueueLength===0)return f;}}throw Error('动作未收口');}
describe('四线试玩 G05 原目标附加',()=>{
  it.each(['诅咒之刃','霜月斩','冰刺'])('%s击杀后不把诅咒转给旁人',async name=>{
    const g=gameFor([byName(name),byId('tt3-venom-arrow')]);
    BattleSession.start(g,[{id:'kill',name:'原目标',hp:1,atk:4},{id:'other',name:'旁人',hp:30,atk:4}],{isBoss:false});
    BattleSession.commands.playCard('u0',0);const s=await drain();
    expect(s.foes[0].dead).toBe(true);expect(s.foes[1].atk).toBe(4);
    for(const key of ['freeze','bleed','poison','healban','atkDown'])expect(s.foes[1].status[key]||0).toBe(0);
  });
  it('原目标存活时仍正常附加冰冻及禁疗',async()=>{
    const g=gameFor([byName('霜月斩')]);BattleSession.start(g,[{id:'live',name:'原目标',hp:100,atk:4},{id:'other',name:'旁人',hp:100,atk:4}],{isBoss:false});
    BattleSession.commands.playCard('u0',0);const s=await drain();
    expect(s.foes[0].status.freeze).toBeGreaterThan(0);expect(s.foes[0].status.healban).toBeGreaterThan(0);expect(s.foes[1].status.freeze||0).toBe(0);
  });
});
describe('四线试玩 G08 首脑固定补给',()=>{
  it('龙巢牌盒入口保留自身牌库，不附加首脑补给',async()=>{
    const g=gameFor([byId('tt3-longsword')]);
    BattleSession.start(g,[{id:'nest',name:'龙巢',hp:100,atk:1}],{isBoss:true,nest:true});
    const s=await drain();expect(s.hand).toHaveLength(1);expect(s.hand.map(uid=>findCard(uid).card).filter(c=>c.id===C.SHA.id)).toHaveLength(0);
  });
  it.each([0,2,5,7])('背包剩%s张初始攻击，首脑仍恰有5张且补给不入背包',async n=>{
    const g=gameFor([byId('tt3-longsword'),...Array.from({length:n},()=>C.SHA)]);
    BattleSession.start(g,[{id:'boss',name:'首脑',hp:100,atk:1}],{isBoss:true});
    expect(BattleSession.getSnapshot().deckSelection.starterCount).toBe(5);
    if (!BattleSession.getSnapshot().deckSelection.selected.includes('u0')) BattleSession.commands.selectDeckCard('u0');
    BattleSession.commands.confirmDeck();const s=await drain();
    expect(s.hand.map(uid=>findCard(uid).card).filter(c=>c.id===C.SHA.id)).toHaveLength(5);
    expect(g.ownedCards).toHaveLength(n+1);expect(g.usedPocket).toHaveLength(0);
  });
});
it('G06 长剑确认并释放气功波后目标提示已清除',async()=>{
  const g=gameFor([byId('tt3-longsword'),byId('tt3-qi-wave')]);
  BattleSession.start(g,[{id:'live',name:'靶子',hp:100,atk:1}],{isBoss:false});
  BattleSession.commands.playCard('u0');expect(BattleSession.getSnapshot().pendingTarget?.card.name).toBe('长剑');
  BattleSession.commands.playCard('u0','self');await drain();BattleSession.commands.playCard('u1',0);const s=await drain();
  expect(s.pendingHint).toBe('');expect(s.pendingTarget).toBeNull();
});
it('G12 后备能源可读描述明确限定本场消耗',()=>{
  const c=byId('tt12-backupcell');const text=displayCardDescription(c.desc,c.id);
  expect(text).toContain('消耗牌堆');expect(text).toContain('每有 1 张法术牌');
});
it('G12 之前口袋和单独墓地不降费；本场消耗法术降费，下一场清零',()=>{
  const c=byId('tt12-backupcell'),spell=byId('tt3-ice-spike'),g=gameFor([c,spell]);
  g.usedPocket=[{card:spell,count:17}];
  const begin=()=>BattleSession.start(g,[{id:'fee',name:'费用靶子',hp:100,atk:1}],{isBoss:false});
  begin();expect(effCostOf(c,'u0')).toBe(6);
  // 受控牌区构造；真实注能链由tt12-structured-battle覆盖。
  set$grave(['u1']);expect(effCostOf(c,'u0')).toBe(6);
  const { hand } = BattleSession.getSnapshot();
  expect(hand).toContain('u1');
  // A UID cannot be both in hand and in the consumed projection.
  set$hand(hand.filter(uid => uid !== 'u1'));
  set$consumed(['u1']);expect(effCostOf(c,'u0')).toBe(5);
  begin();expect(effCostOf(c,'u0')).toBe(6);
});
