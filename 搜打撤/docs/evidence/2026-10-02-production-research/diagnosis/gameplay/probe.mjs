import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {createLayeredMap} from '../../../../../game/src/run/layeredMap.js';
import {createExtractionCommands} from '../../../../../game/src/hub/extraction.commands.js';
import {createBaseMetaCommands} from '../../../../../game/src/hub/base-meta.commands.js';
import {applyXpGain} from '../../../../../game/src/hub/meta-progression.js';
import {characterFor} from '../../../../../game/src/core/characters.js';
const out=path.dirname(fileURLToPath(import.meta.url)),root=path.resolve(out,'../../../../..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const ranges=[];
function section(p,start,end){const s=read(p);const a=s.indexOf(start),b=s.indexOf(end,a);assert(a>=0&&b>a);ranges.push({path:p,startLine:s.slice(0,a).split('\n').length,endLine:s.slice(0,b).split('\n').length});return s.slice(a,b).replaceAll('export function','function');}
const moveCode=section('game/src/run/game.run.flow.js','let moveSeq = 0;','// 物资格（');
const finishCode=section('game/src/run/game.run.scenes.js','export function finishInstant()','// 拾取页：');
const layers=createLayeredMap('production-research-cleared-loop');
const consumable=new Set(['battle','chest','fire','event','resource']);
let pair;
for(let li=0;li<layers.length&&!pair;li++)for(let a=0;a<layers[li].logical.length&&!pair;a++){
 const n=layers[li].logical[a];if(!consumable.has(n.def.type))continue;
 for(const [lj,b] of n.next)if(lj===li&&consumable.has(layers[li].logical[b].def.type)&&layers[li].logical[b].next.some(([lk,c])=>lk===li&&c===a)){pair={li,a,b,types:[n.def.type,layers[li].logical[b].def.type]};break;}
}
assert(pair,'generated current map must contain a reversible consumable edge');
async function sample(moves){
 const {li,a,b}=pair;
 const game={layerData:structuredClone(layers),layerIdx:li,trackPos:a,state:'idle',turn:1,visited:{[`${li},${a}`]:true,[`${li},${b}`]:true},hp:25,maxHp:30,coins:7,inventory:[{name:'口粮',count:2,value:1}],ownedCards:[],usedPocket:[],myClass:'战士',elapsed:0,elapsedSynced:0,chainMove:0,runActive:true};
 const data={wood:0,rations:0,pocket:[],classes:{},characters:{},stats:{actions:0,extracts:0,bestRunCoins:0,playSeconds:0}};
 const meta=createBaseMetaCommands({persistProgress:prepare=>({value:prepare(data),persisted:false})});
 const counters={saveCalls:0,refreshCalls:0,logs:[],actionCalls:0};
 const UI={refresh(){counters.refreshCalls++},log(t){counters.logs.push(t)}};
 const context=vm.createContext({game,UI,SDT:{Meta:{track(type){counters.actionCalls++;return meta.recordMetaEvent(type)}}},localStorage:{getItem(){return '1'}},window:{},performance:{now:()=>0},setTimeout:()=>1,clearTimeout:()=>{},isTurbo:()=>false,preloadCellScene:()=>{},renderScheduler:{invalidate(){}},curLayer:()=>game.layerData[game.layerIdx],cellCenter:(l,i)=>({x:layers[l].logical[i].x,y:layers[l].logical[i].row}),markSeen:()=>{},saveGame:()=>{counters.saveCalls++}});
 vm.runInContext(finishCode+'\n'+moveCode,context);
 const before=structuredClone(game);
 for(let i=0;i<moves;i++)assert(vm.runInContext(`moveTo(${li},${i%2===0?b:a})`,context));
 const afterMovement=structuredClone(game);
 let settledXp=0;
 const commands=createExtractionCommands({getActiveSlot:()=>null,game,baseApi:{data,isSha:()=>false},random:()=>0.5,characterFor,addXpToProgress:(p,n)=>{settledXp=n;return applyXpGain(p,n)}});
 const settlement=await commands.begin();assert(settlement.ok);
 return {moves,settledXp,before:{turn:before.turn,hp:before.hp,coins:before.coins,inventory:before.inventory},afterMovement:{turn:game.turn,state:game.state,hp:game.hp,coins:game.coins,inventory:game.inventory,ownedCards:game.ownedCards,usedPocket:game.usedPocket},baseAfterSettlement:data,settlement,counters};
}
const A=await sample(0),B=await sample(20);
assert.equal(B.afterMovement.turn-A.afterMovement.turn,20);
assert.equal(B.afterMovement.hp,A.afterMovement.hp);assert.deepEqual(B.afterMovement.inventory,A.afterMovement.inventory);
const actor=characterFor('战士').id;
assert.equal(B.settledXp-A.settledXp,40);
const sources=[...new Set([...ranges.map(r=>r.path),'game/src/run/layeredMap.js','game/src/run/map-generator.js','game/src/run/map-graph.js','game/src/core/random-core.js','game/src/hub/extraction.commands.js','game/src/hub/base-meta.commands.js','game/src/hub/meta-progression.js','game/src/core/characters.js','game/src/core/rule-config.js'])].map(p=>({path:p,sha256:createHash('sha256').update(fs.readFileSync(path.join(root,p))).digest('hex')}));
const result={at:new Date().toISOString(),method:'Actual current moveTo/resolveCell/finishInstant source slices in Node VM; current createLayeredMap/createBaseMetaCommands/createExtractionCommands/applyXpGain imports. Reduced motion synchronous completion; generated adjacent nodes pre-marked consumed. All persistence/UI/render/geometry presentation ports stubbed; no browser, live profile, disk save, battle or full-run simulation.',limits:['Generated edge is real; reaching/clearing both nodes and subsequent legal extraction are preconditions, not played in this probe.','Settlement call does not validate a legal exit; this prerequisite is isolated by the probe. No claim that layer one allows extraction or realized XP gain.','No active slot: extraction uses actual ephemeral begin branch; persisted transaction branch untested.','20 inputs do not establish exploit uptake, UI click rate, or full-run economy balance.','markSeen/preload/render/save are stubs; frame clock not run. Global clock/meta/markSeen/save cost paths reviewed separately as source facts.'],pair,ranges,A,B,observed:{extraMoves:20,extraSettledXp:40,resourceCostObserved:0},sources};
fs.writeFileSync(path.join(out,'probe.json'),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({pair,observed:result.observed,A:A.baseAfterSettlement.characters,B:B.baseAfterSettlement.characters},null,2));
