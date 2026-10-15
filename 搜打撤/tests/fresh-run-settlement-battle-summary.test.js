import { expect, it } from 'vitest';

window.SDT = { Icons:{img:() => '',TYPE_ART:{}}, Sound:{music(){},sfx(){},setDucked(){},setBoss(){}},
  MAP:{rules:{battleEnergy:2,battleHandMax:8,bossDeckSize:15,starterSha:5,battleStartDraw:5,battleTurnDraw:1},items:{}} };
await import('../game/src/cards/cards.js');
const { BattleSession } = await import('../game/src/battle/core/battle.core.js');
const runtime = await import('../game/src/battle/runtime/battle.runtime.js');

it('records actual enemy attacks, poison and burn in the final battle callback', async () => {
  let ended;
  const game = {ownedCards:[],inventory:[],usedPocket:[],hp:6,maxHp:6,atk:4,spellPower:0,coins:0,
    state:'idle',battleActive:false,myClass:null,log(){},heal(){},addItem(){},onBattleEnd(opts){ended=opts;} };
  BattleSession.start(game,[{id:'summary-foe',name:'复盘敌人',hp:30,atk:3}],{isBoss:true,directBossStart:true});
  runtime.pstat.status.poison=2;runtime.pstat.status.burn=1;
  BattleSession.commands.endTurn();
  for (let i=0;i<200 && !ended;i++) await new Promise(resolve => setTimeout(resolve,10));
  expect(game.battleActive).toBe(false);
  expect(ended.battleSummary.round).toBe(1);
  expect(ended.battleSummary.remainingFoes).toEqual([{name:'复盘敌人',hp:30,maxHp:30}]);
  expect(ended.battleSummary.damageTaken).toEqual([
    {source:'中毒',damage:2,round:1},{source:'灼烧',damage:1,round:1},{source:'复盘敌人',damage:3,round:1},
  ]);
});
