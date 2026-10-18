// Real Session, generated UID and settlement routing; storage/reward shells are isolated.
// pocketAdd mirrors the existing name/count aggregator without loading the full bag UI.
import {expect,it,vi} from 'vitest';
const s=vi.hoisted(()=>({game:{}}));
vi.mock('../game/src/run/game.session.js',()=>({game:s.game,getActiveSlot:()=>null,saveGame:()=>true,createRunSavePayload:()=>({}),setBattleSettlementPending(){},clearBattleSettlementPending(){},doDeath(){}}));
vi.mock('../game/src/run/game.run.js',()=>({showRunTransition:async()=>{}}));
window.SDT={Icons:{img:()=>'',TYPE_ART:{}},Sound:{music(){},sfx(){},setDucked(){},setBoss(){}},UI:{log(){},hideOverlay(){},refresh(){},act(){},showOverlay(){}},MAP:{rules:{battleEnergy:99,battleHandMax:20,bossDeckSize:15,starterSha:0,battleStartDraw:20,battleTurnDraw:0,diceSides:6},items:{}},Meta:{track(){}},Base:{data:{ammoTaught:true},recordEggBattle(){},save(){}},Chests:{rollDrops:()=>[],dropText:()=>'',open(){}},Battle:{presentVictory:async()=>{}}};

await import('../game/src/cards/cards.js');const C=window.SDT.Cards; C.ensureSha();C.ensureStarters();C.ensureTabletop();C.ensureDmgTypes();C.ensureEffectFields();
const {BattleSession}=await import('../game/src/battle/core/battle.core.js');const R=await import('../game/src/battle/runtime/battle.runtime.js');
const {bagSlots}=await import('../game/src/hub/game.bag.bridge.js');
bagSlots.pocketAdd=card=>{const p=s.game.usedPocket.find(p=>p.card.name===card.name);if(p)p.count++;else s.game.usedPocket.push({card:{...card},count:1});};
const {bindBagMixins}=await import('../game/src/hub/game.bag.settle.js');
bindBagMixins();
it.each([true,false])('normal magicfind shadowbug used=%s',async used=>{
vi.useFakeTimers();
const find=C.all().find(c=>c.id==='tt12-magicfind'),shadow=C.all().find(c=>c.id==='tt3sp-shadowbug');
Object.assign(s.game,{ownedCards:[{uid:'find',card:{...find}},{uid:'kill',card:{id:'kill',name:'终结',type:'武术',cost:0,dmg:999,dmgType:'fixed',desc:'造成999点固定伤害。'}}],usedPocket:[],hp:100,maxHp:100,atk:5,coins:0,spellPower:0,myClass:'战士',state:'idle',battleActive:false,seed:'probe',discoveredPairs:new Set(),visited:{},layerIdx:0,trackPos:1,logs:[],log(message){this.logs.push(message);},heal(){},addItem(){}});
BattleSession.start(s.game,[{id:'target',name:'靶',hp:20,atk:5}],{isBoss:false});
const spy=vi.spyOn(C,'all').mockReturnValue([shadow]);
BattleSession.commands.playCard('find','self');await vi.advanceTimersByTimeAsync(1000);
expect(R.discovering.options[0].id).toBe(shadow.id);BattleSession.commands.pickDiscover(0);await vi.advanceTimersByTimeAsync(1000);
expect(s.game.logs.some(message=>message.includes('本场生成：使用或消耗后进入消耗区，未用则战后消散'))).toBe(true);
const generated=R.granted.find(x=>x.card.id===shadow.id);expect(generated).toBeTruthy();expect(s.game.ownedCards.some(x=>x.uid===generated.uid)).toBe(false);
if(used){BattleSession.commands.playCard(generated.uid,0);await vi.advanceTimersByTimeAsync(1000);expect(R.played).toContain(generated.uid);}
BattleSession.commands.playCard('kill',0);await vi.advanceTimersByTimeAsync(3000);
expect(s.game.battleActive).toBe(false);expect(s.game.usedPocket.some(p=>p.card.id===shadow.id)).toBe(used);
if (used) expect(s.game.usedPocket.find(p=>p.card.id===shadow.id)).toMatchObject({count:1,card:{cost:shadow.cost}});
spy.mockRestore();vi.clearAllTimers();vi.useRealTimers();
});
