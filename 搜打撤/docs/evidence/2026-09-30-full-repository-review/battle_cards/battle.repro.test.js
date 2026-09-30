import { describe, it, expect } from 'vitest';
window.SDT = { Icons: { img: () => '', TYPE_ART: {} }, Sound: { music() {}, sfx() {}, setDucked() {}, setBoss() {} },
 MAP: { rules: { battleEnergy: 99, battleHandMax: 20, bossDeckSize: 15, starterSha: 0, battleStartDraw: 0, battleTurnDraw: 0, diceSides: 6 }, items: {} } };
const S = '../snapshot/game/src/';
await import(`${S}cards/cards.js`);
const C = window.SDT.Cards;
C.ensureSha(); C.ensureStarters(); C.ensureTabletop(); C.ensureDmgTypes(); C.ensureEffectFields();
const { BattleSession, getPreviewContext } = await import(`${S}battle/core/battle.core.js`);
const { previewAction } = await import(`${S}battle/view/battle.preview.js`);
const E = await import(`${S}battle/core/battle.engine.js`);
const R = await import(`${S}battle/runtime/battle.runtime.js`);
const { validateCardRules } = await import(`${S}cards/card-rules.schema.js`);
const { inspectCardRuleCapability } = await import(`${S}cards/card-rules.capability.js`);
const waitIdle = async () => {
 for (let n=0;n<600;n++) { await new Promise(r=>setTimeout(r,5)); if (!R.busy) return; }
 throw Error('timeout');
};
let seq=0;
function game(cards) {
 return { ownedCards: cards.map(card=>({uid:`rev-${++seq}`,card:{...card},safe:false})),hp:100,maxHp:100,atk:5,spellPower:0,coins:0,myClass:'战士',characterId:null,state:'idle',battleActive:false,
 logs:[],log(message){this.logs.push(message);},heal(n){this.hp=Math.min(this.maxHp,this.hp+n);},addItem(){},onBattleEnd(){} };
}
function begin(cards,boss=false) {
 const g=game(cards); BattleSession.start(g,[{id:'dummy',name:'靶子',hp:1000,atk:1}],{isBoss:boss,name:'review'});
 if(boss){g.ownedCards.forEach(o=>BattleSession.commands.selectDeckCard(o.uid));BattleSession.commands.confirmDeck();}
 return g;
}
const basic=(id,type='武术')=>({id,name:id,cost:0,type,rarity:'古朴',dmg:1,dmgType:'fixed',desc:'造成1点固定伤害。'});
describe('frozen snapshot findings',()=>{
 it('effective seeded catalog structural contract audit (does not certify every effect)',()=>{
  const cards=C.all();const invalid=cards.map(c=>({id:c.id,...validateCardRules(c)})).filter(r=>!r.ok);
  const unsupported=cards.map(c=>({id:c.id,...inspectCardRuleCapability(c)})).filter(r=>!r.ok);
  console.log('CATALOG',JSON.stringify({total:cards.length,structured:cards.filter(c=>c.rules).length,invalid,unsupported}));
  expect(invalid).toEqual([]);expect(unsupported).toEqual([]);
 });
 it('swift rune endTurn returns to same player turn without an enemy phase',async()=>{
  const g=begin([basic('swift-card'),basic('spare')]); R.applyRuneFlag('swift');
  BattleSession.commands.endTurn(); await waitIdle();
  console.log('SWIFT',JSON.stringify({turn:R.turn,hp:g.hp,phase:R.battleState.phase,hand:R.hand,played:R.played}));
  expect(R.turn).toBe(1);expect(g.hp).toBe(100);expect(R.battleState.phase).toBe('player');expect(R.played).toHaveLength(1);
 });
 it('ash overflow cast removes its UID from every pile',()=>{
  const cards=Array.from({length:10},(_,i)=>basic(`ash-${i}`));const g=begin(cards,true);
  R.applyRuneFlag('ash'); R.set$hand(g.ownedCards.slice(0,9).map(o=>o.uid));const uid=g.ownedCards[9].uid;
  R.set$drawPile([uid]); R.set$discard([]); E.drawCards(1);
  const locations=['hand','drawPile','discard','grave','played','consumed'].filter(k=>R[k].includes(uid));
  console.log('ASH',JSON.stringify({uid,locations,foeHp:R.foes[0].hp}));
  expect(R.foes[0].hp).toBe(999); expect(locations).toEqual([]);
 });
 it('boss targeted draw generates unrelated random equipment when none is in deck',async()=>{
  const arm=C.all().find(c=>c.id==='tt7-armup');expect(arm.rules).toBeTruthy();
  const g=begin([arm,basic('plain')],true);R.set$hand([g.ownedCards[0].uid]);R.set$drawPile([g.ownedCards[1].uid]);
  BattleSession.commands.playCard(g.ownedCards[0].uid,'self');await waitIdle();
  const created=R.hand.map(uid=>E.findCard(uid)?.card).filter(c=>c?.type==='装备');
  console.log('ARMUP',JSON.stringify({created:created.map(c=>c.name),deck:R.drawPile}));
  expect(created).toHaveLength(2);expect(R.granted).toHaveLength(2);
 });
 it('treasure armor reads a previous drawn card rather than the discovered bottom card',async()=>{
  const dig=C.all().find(c=>c.id==='tt3-dig-treasure');const loot={...basic('loot'),cost:9,value:9};
  const g=begin([dig,loot],true);R.set$hand([g.ownedCards[0].uid]);R.set$drawPile([g.ownedCards[1].uid]);R.set$lastDrawnUids([]);
  BattleSession.commands.playCard(g.ownedCards[0].uid,'self');await waitIdle();
  const before=R.pdef.armor;const price=loot.cost;BattleSession.commands.pickDiscover(0);
  console.log('TREASURE',JSON.stringify({price,before,after:R.pdef.armor,discovered:R.hand.map(uid=>E.findCard(uid)?.card.name)}));
  expect(price).toBeGreaterThan(0);expect(R.pdef.armor).toBe(0);
 });
 it('deck-bottom chest queues two additional random discoveries after choosing one of three',async()=>{
  const chest=C.all().find(c=>c.id==='cmtn28jv33wx');expect(chest).toBeTruthy();
  const g=begin([chest,basic('bottom1'),basic('bottom2'),basic('bottom3')],true);R.set$hand([g.ownedCards[0].uid]);R.set$drawPile(g.ownedCards.slice(1).map(o=>o.uid));
  BattleSession.commands.playCard(g.ownedCards[0].uid,'self');await waitIdle();
  const first=R.discovering?.options.map(c=>c.name);expect(first).toEqual(['bottom1','bottom2','bottom3']);
  BattleSession.commands.pickDiscover(0);
  console.log('CHEST',JSON.stringify({first,remaining:R.discovering?.n,second:R.discovering?.options.map(c=>c.name),bottom:R.drawPile}));
  expect(R.discovering?.n).toBe(2);
 });
 it('noon duel next-turn synthetic loses required battle target and fails validation',async()=>{
  const duel=C.all().find(c=>c.id==='tt3-noon-duel');const g=begin([duel]);
  BattleSession.commands.playCard(g.ownedCards[0].uid,0);await waitIdle();
  const before=R.foes[0].hp;BattleSession.commands.endTurn();await waitIdle();
  console.log('NOON',JSON.stringify({before,after:R.foes[0].hp,turn:R.turn,delayed:R.delayed}));
  expect(R.turn).toBe(2);expect(R.foes[0].hp).toBe(before);expect(R.delayed).toHaveLength(1);expect(R.delayed[0].notBeforeTurn).toBe(2);
 });
 it('dark form raises discovery count instead of option count',async()=>{
  const dark=C.all().find(c=>c.id==='cmtn1r10xnl1');const discovery=C.all().find(c=>c.id==='tt2-jianghu');
  const g=begin([dark,discovery]);BattleSession.commands.playCard(g.ownedCards[0].uid,'self');await waitIdle();
  BattleSession.commands.playCard(g.ownedCards[1].uid,'self');await waitIdle();
  console.log('DARK',JSON.stringify({desc:dark.desc,options:R.discovering?.options.length,n:R.discovering?.n}));
  expect(R.discovering?.options).toHaveLength(3);expect(R.discovering?.n).toBe(2);
 });
 it('rapid fire preview claims exact single-hit damage although runtime uses played-move count',async()=>{
  const rapid=C.all().find(c=>c.id==='cc-rapid-fire');const g=begin([basic('p1'),basic('p2'),rapid]);
  for(const o of g.ownedCards.slice(0,2)){BattleSession.commands.playCard(o.uid,0);await waitIdle();}
  const uid=g.ownedCards[2].uid;const result=previewAction({snapshot:BattleSession.getSnapshot(),action:{uid,targetIndex:0},cardContext:getPreviewContext(uid,0)});
  const before=R.foes[0].hp;BattleSession.commands.playCard(uid,0);await waitIdle();
  console.log('PREVIEW',JSON.stringify({confidence:result.confidence,preview:result.damage?.total,actual:before-R.foes[0].hp,desc:rapid.desc}));
  expect(result.confidence).toBe('exact');expect(result.damage.total).toBe(2);expect(before-R.foes[0].hp).toBe(4);
 });
 it('battle employee token is consumed but its discovery queue is never opened or granted',async()=>{
  const token=C.all().find(c=>c.id==='tt-token-gold');const g=begin([token,basic('token-spare')]);
  const uid=g.ownedCards[0].uid;BattleSession.commands.useItem(uid);await waitIdle();
  console.log('TOKEN',JSON.stringify({remainingOwned:g.ownedCards.map(o=>o.card.name),hand:R.hand,discovering:R.discovering,queue:R.discoverQueue}));
  expect(g.ownedCards.some(o=>o.uid===uid)).toBe(false);expect(R.granted).toHaveLength(0);expect(R.discovering).toBeNull();expect(R.discoverQueue).toHaveLength(1);
 });
 it('blooddrinker structured kill trigger fires once for two kills and not at all for null-source kills',async()=>{
  const sword=C.all().find(c=>c.id==='tt3-blooddrinker');
  const aoe={...basic('aoe-kill'),rules:{version:1,battle:{target:{side:'enemy',area:true}},triggers:{onPlay:[{op:'damage',amountField:'dmg',target:'allEnemies'}]}}};
  const g=game([sword,aoe]);BattleSession.start(g,[1,1,3,1000].map((hp,i)=>({id:`multi-${i}`,name:`multi-${i}`,hp,atk:1})),{isBoss:false,name:'kill review'});
  BattleSession.commands.playCard(g.ownedCards[0].uid,'self');await waitIdle();
  BattleSession.commands.playCard(g.ownedCards[1].uid,0);await waitIdle();const first=R.pstat.status.atkUp;
  BattleSession.commands.bagSlam();BattleSession.commands.resolveSlam(2);await waitIdle();
  console.log('BLOODDRINKER',JSON.stringify({desc:sword.desc,dead:R.foes.map(f=>f.dead),afterTwo:first,afterNullKill:R.pstat.status.atkUp}));
  expect(first).toBe(1);expect(R.pstat.status.atkUp).toBe(1);
 });
});
