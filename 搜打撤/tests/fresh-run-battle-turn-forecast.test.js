import { afterEach, expect, it } from 'vitest';

window.SDT={Icons:{img:() => '',TYPE_ART:{}},Sound:{music(){},sfx(){},setDucked(){},setBoss(){}},
  MAP:{rules:{battleEnergy:2,battleHandMax:8,bossDeckSize:15,starterSha:5,battleStartDraw:5,battleTurnDraw:1},items:{}}};
await import('../game/src/cards/cards.js');
const {BattleSession}=await import('../game/src/battle/core/battle.core.js');
const runtime=await import('../game/src/battle/runtime/battle.runtime.js');
const {forecastEnemyTurn}=await import('../game/src/battle/view/battle.turn-forecast.js');
let game;
function start(hp=5,foe={atk:8,affix:'frenzy'}) {
  game={ownedCards:[],inventory:[],usedPocket:[],hp,maxHp:30,atk:4,spellPower:0,coins:0,state:'idle',battleActive:false,myClass:null,
    log(){},heal(){},addItem(){},onBattleEnd(){}};
  BattleSession.start(game,[{id:'forecast-foe',name:'预测靶子',hp:50,...foe}],{isBoss:false});
}
async function endActualTurn() {
  BattleSession.commands.endTurn();
  for(let i=0;i<200;i++) {
    await new Promise(resolve => setTimeout(resolve,5));
    const snapshot=BattleSession.getSnapshot();
    if(!game.battleActive || (!snapshot.busy && snapshot.turn===2)) return;
  }
  throw new Error('actual enemy phase did not finish');
}
afterEach(() => { if(game?.battleActive) BattleSession.commands.flee(); });

it('REV-B01 skips poison, burn and enemies on the real extra-turn branch',async () => {
  start(3);runtime.pstat.status.poison=4;runtime.pstat.status.burn=2;runtime.set$extraTurn(true);
  const before=BattleSession.getSnapshot(), serialized=JSON.stringify(before);
  expect(forecastEnemyTurn(before)).toMatchObject({damage:0,hpAfter:3,lethal:false});
  expect(JSON.stringify(before)).toBe(serialized);
  await endActualTurn();
  expect(game.hp).toBe(3);expect(BattleSession.getSnapshot().turn).toBe(2);
  expect(runtime.pstat.status.poison).toBe(4);
});

it('REV-B02 restores HP for a saved fatal hit and ignores later hits during its immunity',async () => {
  start(5);runtime.set$deathSave(1);
  const before=BattleSession.getSnapshot();
  expect(forecastEnemyTurn(before)).toMatchObject({damage:0,hpAfter:5,lethal:false});
  await endActualTurn();
  expect(game.hp).toBe(5);expect(runtime.deathSave).toBe(0);
});

it('keeps prior poison damage but saves the following fatal attack and double hit',async () => {
  start(5);runtime.pstat.status.poison=1;runtime.set$deathSave(1);
  expect(forecastEnemyTurn(BattleSession.getSnapshot())).toMatchObject({damage:1,hpAfter:4,lethal:false});
  await endActualTurn();expect(game.hp).toBe(4);expect(runtime.deathSave).toBe(0);
});

it('does not let death insurance suppress poison lethality',async () => {
  start(3);runtime.pstat.status.poison=4;runtime.set$deathSave(1);
  expect(forecastEnemyTurn(BattleSession.getSnapshot())).toMatchObject({damage:4,hpAfter:0,lethal:true});
  await endActualTurn();expect(game.battleActive).toBe(false);expect(Math.max(0,game.hp)).toBe(0);
});
