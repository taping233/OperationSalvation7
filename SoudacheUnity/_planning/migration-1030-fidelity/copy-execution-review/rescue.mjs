import { collectRescueCards } from '../../../../搜打撤/game/src/hub/run-rescue-cards.js';
import assert from 'node:assert/strict';
const owned = [
  { card:{id:'brought-safe',name:'带入安全格牌'},safe:true,brought:1 },
  { card:{id:'new-safe',name:'新获安全格牌'},safe:true },
  { card:{id:'tt2-pearlbox',name:'安全格珍珠盒'},safe:true,brought:1 },
  { card:{id:'brought-boxed',name:'带入盒内资源'},stored:true,brought:1 },
  { card:{id:'new-boxed',name:'新获盒内资源'},stored:true },
  { card:{id:'loose',name:'普通背包牌'} },
];
const ids = cards => cards.map(entry=>entry.card.id);
const death = ids(collectRescueCards(owned));
const abandon = ids(collectRescueCards(owned,{includeBrought:false}));
assert.deepEqual(death,['brought-safe','new-safe','tt2-pearlbox','brought-boxed','new-boxed']);
assert.deepEqual(abandon,['new-safe','new-boxed']);
console.log(JSON.stringify({passed:true,source:'actual collectRescueCards',death,abandon,scope:'Source pure rescue selection, not terminal persistence or native UI'}));
