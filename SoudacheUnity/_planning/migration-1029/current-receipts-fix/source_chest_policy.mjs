import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url));
const project=path.resolve(here,'../../..');
const file=path.resolve(project,'../搜打撤/game/src/run/chests.js');
const source=fs.readFileSync(file,'utf8');
const predicates=source.slice(source.indexOf('  const boxResolved ='),source.indexOf('  const compactNotice ='));
const closePicker=source.slice(source.indexOf('  function closePicker()'),source.indexOf('  function overviewHTML()'));
const next=source.slice(source.indexOf('  function next()'),source.indexOf('  // Opening, resuming and advancing'));
const automatic=source.split('\n').find(line=>line.includes("persisted !== false && !saveContext?.battleSettlement && overviewMode"));
if(!predicates||!closePicker||!next||!automatic)throw new Error('Current source consumer extraction failed');
const automaticExpression=automatic.trim().slice(4,-3);
const box=(n=2,changes={})=>({n,kind:'small',claimMode:'all',coins:3,coinsTaken:true,taken:Array.from({length:n},(_,i)=>i),lost:[],completed:false,...changes});
const cases=[
 {name:'two-cards-last-bulk',boxes:[box()],receivedIndex:-1},
 {name:'two-cards-last-individual',boxes:[box()],receivedIndex:1},
 {name:'single-small-direct',boxes:[box(1)],receivedIndex:0},
 {name:'single-small-battle',boxes:[box(1)],receivedIndex:0,battle:true},
 {name:'single-small-bulk-not-source-claimRewardAt',boxes:[box(1)],receivedIndex:-1},
 {name:'single-choice',boxes:[box(1,{claimMode:'one'})],receivedIndex:0},
 {name:'single-medium',boxes:[box(1,{kind:'medium'})],receivedIndex:0},
 {name:'first-of-two-advance',boxes:[box(),box(1,{taken:[]})],receivedIndex:1},
 {name:'last-of-two-stays',boxes:[box(1,{completed:true}),box()],index:1,receivedIndex:1},
 {name:'forfeit-last-stays',boxes:[box(2,{taken:[],lost:[0,1]})],receivedIndex:-1},
 {name:'forfeit-first-advance',boxes:[box(2,{taken:[],lost:[0,1]}),box(1,{taken:[]})],receivedIndex:-1},
 {name:'choice-plus-independent-bonus',boxes:[box(4,{claimMode:'one',taken:[1,3],lost:[0,2]})],receivedIndex:3},
 {name:'choice-bonus-remains',boxes:[box(4,{claimMode:'one',taken:[1],lost:[0,2]})],receivedIndex:1,skipClose:true},
 {name:'coins-not-yet-collected',boxes:[box(2,{coinsTaken:false})],receivedIndex:1,skipClose:true},
 {name:'empty-reward-continue',boxes:[box(0,{coins:0,coinsTaken:false})],receivedIndex:-1},
 {name:'zero-coins-single-small',boxes:[box(1,{coins:0,coinsTaken:false})],receivedIndex:0},
 {name:'prior-unresolved-box',boxes:[box(1,{taken:[]}),box()],index:1,receivedIndex:1},
 {name:'all-prior-resolved',boxes:[box(1,{completed:true}),box(2,{completed:true}),box()],index:2,receivedIndex:1}
];
for(const c of cases){
 const context=vm.createContext({input:c});
 vm.runInContext(`let queue=input.boxes.map(b=>({completed:b.completed,reward:{kind:b.kind,claimMode:b.claimMode,cards:Array.from({length:b.n},(_,i)=>({id:String(i)})),taken:new Set(b.taken),lost:new Set(b.lost),coins:b.coins,coinsReceived:b.coinsTaken,rewardStage:'cards'}}));
 let idx=(input.index||0)+1,cur=queue[idx-1].reward,saveContext={battleSettlement:input.battle?{}:null},persisted=true,overviewMode=true,rewardScreen='cards',searchSeq=0,rendered=false,finished=false,advanced=-1;
 function rememberRewardPosition(){} function closeRewardZoom(){} function persistReward(){return true;} function render(){rendered=true;} function finishQueue(){finished=true;return true;} function presentRewardBox(i){advanced=i;idx=i+1;cur=queue[i].reward;return true;}
 ${predicates}\n${closePicker}\n${next}
 let resolved=boxResolved(cur),pending=nextPendingBoxIndex(),automatic=input.receivedIndex>=0&&(${automaticExpression});
 if(!input.skipClose)closePicker();let closeIndex=idx-1,closedToNext=advanced>=0;
 if(!input.skipClose)next();
 globalThis.answer={resolved,pending,automatic,closeIndex,closedToNext,finished};`,context);
 c.expected=context.answer;
}
fs.writeFileSync(path.join(here,'chest-source-vectors.json'),JSON.stringify({source:'game/src/run/chests.js',sha256:crypto.createHash('sha256').update(source).digest('hex'),cases},null,2));
console.log(JSON.stringify({cases:cases.length,sha256:crypto.createHash('sha256').update(source).digest('hex')}));
