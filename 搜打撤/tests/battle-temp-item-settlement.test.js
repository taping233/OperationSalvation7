// Real Session, generated UID and settlement routing; storage/reward shells are isolated.
// pocketAdd mirrors the existing name/count aggregator without loading the full bag UI.
import {expect,it,vi} from 'vitest';
const s=vi.hoisted(()=>({game:{}}));
vi.mock('../game/src/run/game.session.js',()=>({game:s.game,getActiveSlot:()=>null,saveGame:()=>true,createRunSavePayload:()=>({}),setBattleSettlementPending(){},clearBattleSettlementPending(){},doDeath(){}}));
vi.mock('../game/src/run/game.run.js',()=>({showRunTransition:async()=>{}}));
window.SDT={Icons:{img:()=>'',TYPE_ART:{}},Sound:{music(){},sfx(){},setDucked(){},setBoss(){}},UI:{log(){},hideOverlay(){},refresh(){},act(){},showOverlay(){}},MAP:{rules:{battleEnergy:99,battleHandMax:20,bossDeckSize:15,starterSha:0,battleStartDraw:20,battleTurnDraw:0,diceSides:6},items:{}},Meta:{track(){}},Base:{data:{ammoTaught:true},recordEggBattle(){},save(){}},Chests:{rollDrops:()=>[],dropText:()=>'',open(){}},Battle:{presentVictory:async()=>{}}};

await import('../game/src/cards/cards.js');const C=window.SDT.Cards; C.ensureSha();C.ensureStarters();C.ensureTabletop();C.ensureDmgTypes();C.ensureEffectFields();
const {BattleSession}=await import('../game/src/battle/core/battle.core.js');
const {bagSlots}=await import('../game/src/hub/game.bag.bridge.js');
bagSlots.pocketAdd=card=>{const p=s.game.usedPocket.find(p=>p.card.name===card.name);if(p)p.count++;else s.game.usedPocket.push({card:{...card},count:1});};
const {bindBagMixins}=await import('../game/src/hub/game.bag.settle.js');
bindBagMixins();

const { addTempCard, queueCardExecution } = await import('../game/src/battle/core/battle.engine.js');
it.each(['direct', 'bar', 'unused'])('临时道具%s路径：用过进消耗区，未用消散', async route => {
  vi.useFakeTimers();
  try {
    const item = { id:'temp-potion', name:'临时治疗药水', type:'道具', cost:0, desc:'回复3点生命' };
    Object.assign(s.game, {
      ownedCards:[{uid:'owned-potion',card:{...item,id:'owned-potion',name:'持久药水'}},
        {uid:'kill',card:{id:'kill',name:'终结',type:'武术',cost:0,dmg:999,dmgType:'fixed',desc:'造成999点固定伤害。'}}],
      usedPocket:[],hp:30,maxHp:100,atk:5,coins:0,spellPower:0,myClass:'战士',state:'idle',battleActive:false,
      seed:'item',discoveredPairs:new Set(),visited:{},layerIdx:0,trackPos:1,log(){},heal(){},addItem(){},
    });
    BattleSession.start(s.game,[{id:'target',name:'靶',hp:20,atk:5}],{isBoss:false});
    const uid = addTempCard(item, route === 'direct' ? {source:'discover-cast'} : null);
    if (route === 'direct') queueCardExecution(uid,item,[],null,true);
    if (route === 'bar') BattleSession.commands.usePotion(uid);
    await vi.advanceTimersByTimeAsync(1000);
    // 持久实例沿原施放结算进入消耗区，不受临时道具过滤影响。
    const owned = s.game.ownedCards.find(o => o.uid === 'owned-potion');
    queueCardExecution(owned.uid,owned.card,[],null,true);
    await vi.advanceTimersByTimeAsync(1000);
    BattleSession.commands.playCard('kill',0);
    await vi.advanceTimersByTimeAsync(3000);
    expect(s.game.battleActive).toBe(false);
    expect(s.game.usedPocket.some(p=>p.card.id===item.id)).toBe(route !== 'unused');
    if (route !== 'unused') expect(s.game.usedPocket.find(p=>p.card.id===item.id)).toMatchObject({count:1});
    expect(s.game.ownedCards.some(o=>o.uid===uid)).toBe(false);
    expect(s.game.usedPocket.find(p=>p.card.id==='owned-potion')).toMatchObject({count:1});
    expect(s.game.usedPocket.find(p=>p.card.id==='kill')).toMatchObject({count:1});
  } finally { vi.clearAllTimers(); vi.useRealTimers(); }
});
