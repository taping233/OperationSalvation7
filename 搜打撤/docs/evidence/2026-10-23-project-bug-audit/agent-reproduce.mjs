import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { strategicPolicy } from '../../../game/src/agent/agent.policy.js';
import { aggregate } from '../../../game/src/agent/agent.stats.js';

const out = { takenAt: new Date().toISOString(), knownFindings: [] };
const pick = uid => ({ type: 'battle', name: 'selectDeckCard', args: [uid], id: `deck:${uid}` });
const actualDeck = strategicPolicy()({ phase:'battle', actions:[pick('ancient'),pick('rare')], battle:{turn:1, foes:[], player:{hp:30},
  deckSelection:{need:1,selected:[],cards:[{uid:'ancient',card:{rarity:'古朴'}},{uid:'rare',card:{rarity:'稀有'}}]} } });
assert.equal(actualDeck.args[0], 'ancient');
out.knownFindings.push({id:'A1-rarity',actual:actualDeck.args[0],expected:'rare',cause:'古朴与稀有被赋同分，沿输入序选牌'});

const discard = name => ({type:'sys',name:'discardCard',args:[name],id:`discard:${name}`});
const closeBag = {type:'ui',name:'closeBag',params:{},label:'关闭背包',id:'ui:closeBag'};
const actualDiscard = strategicPolicy()({phase:'overlay',actions:[discard('武术牌'),discard('资源'),closeBag],run:{used:2,bagCap:2,hp:30,maxHp:30,
  ownedCards:[{name:'武术牌',type:'武术',rarity:'稀有'},{name:'资源',type:'资源',rarity:'稀有'}]} });
assert.equal(actualDiscard.args[0], '武术牌');
out.knownFindings.push({id:'A1-types',actual:actualDiscard.args[0],expected:'资源',cause:'现行武术类型没有获得卡组保留分'});

const sell = uid => ({type:'ui',name:'sellCard',params:{uid},label:'出售卡牌',id:`sell:${uid}`});
const actualSell = strategicPolicy()({phase:'overlay',actions:[sell('legendary'),sell('rare')],run:{used:2,bagCap:2,hp:30,maxHp:30,coins:0,
  ownedCards:[{uid:'legendary',rarity:'传说',sellable:true},{uid:'rare',rarity:'稀有',sellable:true}]} });
assert.equal(actualSell.params.uid, 'legendary');
out.knownFindings.push({id:'A2',actual:actualSell.params.uid,expected:'rare',cause:'observe扁平rarity与策略读取card.rarity不一致'});

// A flee followed by an event death has fought > won even though no battle is active.
const actualStats = aggregate([{outcome:'death',maxLayer:2,node:4,battles:{fought:2,won:1},carried:[]}]);
assert.deepEqual(actualStats.deathBucket, {'L2N4/战斗中':1});
out.knownFindings.push({id:'A3',actual:actualStats.deathBucket,expected:'非战斗死亡不得仅由累计fought>won归为战斗中',cause:'flee也增加fought、不增加won'});
writeFileSync(new URL('./agent-reproduction-results.json',import.meta.url),JSON.stringify(out,null,2)+'\n');
console.log(JSON.stringify(out,null,2));
