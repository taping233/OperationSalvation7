import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
const here=path.dirname(fileURLToPath(import.meta.url)),root=path.resolve(here,'../../..'),source=path.resolve(root,'../搜打撤/game');
const load=relative=>import(pathToFileURL(path.join(source,relative)).href);
const {findMapTravelPath}=await load('src/run/map-travel-path.js');
const {generateExplorationMap}=await load('src/run/map-generator-v7.js');
const {createBaseDepartureCommands}=await load('src/hub/base-departure.commands.js');
const {settleEventCommand}=await load('src/run/event-commands.js');
const layersOf=snapshot=>snapshot.layers.map(layer=>({doors:layer.doors,logical:layer.nodes.map(node=>({def:{type:node.type},next:node.next}))}));
const keysOf=snapshot=>snapshot.layers.flatMap((l,li)=>l.nodes.map((_,idx)=>`${li},${idx}`));
const mapCases=[];
for(const seed of ['0','1','42','1029']){
 const snapshot=generateExplorationMap(seed),keys=keysOf(snapshot),cases=[];
 for(let li=0;li<4;li++)for(const idx of new Set([snapshot.layers[li].entry,snapshot.layers[li].exit]))for(const mode of ['visible','closed','noFog']){
  const seen=mode==='noFog'?{}:Object.fromEntries(keys.map(k=>[k,1])),visited=mode==='closed'?Object.fromEntries(keys.map(k=>[k,1])):{};
  const nodeRewards=mode==='closed'?Object.fromEntries(keys.map(k=>[k,{version:1,type:'closed'}])):{};
  const game={layerIdx:li,trackPos:idx,layerData:layersOf(snapshot),seen,visited,nodeRewards};
  const expected=keys.filter(id=>id!==`${li},${idx}`).map(id=>{const [targetLi,targetIdx]=id.split(',').map(Number),path=findMapTravelPath(game,{li:targetLi,idx:targetIdx});return{id,path:path?.map(n=>`${n.li},${n.idx}`)??null};});
  cases.push({name:`${seed}:${li},${idx}:${mode}`,layerIdx:li,trackPos:idx,revealed:Object.keys(seen),settled:Object.keys(visited),closed:Object.keys(nodeRewards),expected});
 }
 const normalized=structuredClone(snapshot);for(const layer of normalized.layers)for(const node of layer.nodes)node.next=node.next.map(([li,idx])=>({li,idx}));
 mapCases.push({seed,snapshot:normalized,cases});
}
// Small boundary graphs invoke the current function directly; these cover rules
// which are intentionally absent from the new-map node budgets (e.g. blank).
const boundaries=[];
for(const transit of ['blank','entrance','battle','shop','fire','chest','event','resource','door','altar','boss'])for(const status of ['fresh','visited','closed','pending']){
 const logical=['entrance',transit,'resource'].map((type,idx)=>({def:{type},next:idx===0?[[0,1]]:idx===1?[[0,0],[0,2]]:[[0,1]]}));
 const game={layerIdx:0,trackPos:0,layerData:[{logical,doors:[]}],seen:{'0,0':1,'0,1':1,'0,2':1},visited:status==='fresh'?{}:{'0,1':1},nodeRewards:{}};
 if(status==='closed')game.nodeRewards['0,1']={version:1,type:'closed'};
 if(status==='pending'){
  if(transit==='fire')game.nodeRewards['0,1']={version:1,type:'fire',healUsed:false,restoreUsed:true};
  if(transit==='chest')game.nodeChestRewards={'0,1':{queue:[]}};
  if(transit==='event')game.nodeRewards['0,1']={type:'event-choice',taken:null};
 }
 boundaries.push({transit,status,path:findMapTravelPath(game,{li:0,idx:2})?.map(n=>`${n.li},${n.idx}`)??null});
}
const fogCases=[];
for(const mode of ['direct-unseen','unknown-target','visited-target','pending-entry']){
 const game={layerIdx:0,trackPos:0,layerData:[{logical:[{def:{type:'entrance'},next:[[0,1]]},{def:{type:'blank'},next:[[0,0],[0,2]]},{def:{type:'resource'},next:[[0,1]]}],doors:[]}],seen:{'0,0':1,'0,1':1},visited:{},nodeRewards:{}};
 let target={li:0,idx:2};if(mode==='direct-unseen'){delete game.seen['0,1'];target.idx=1;}
 if(mode==='visited-target')game.visited['0,2']=1;
 if(mode==='pending-entry')game.entrySupply={version:1,layerIdx:0,trackPos:0,cardIds:['one'],taken:[]};
 fogCases.push({mode,path:findMapTravelPath(game,target)?.map(n=>`${n.li},${n.idx}`)??null});
}
const catalog=JSON.parse(fs.readFileSync(path.join(here,'../battle/current-catalog.json'),'utf8')).cards;
const card=catalog.find(c=>c.id==='tt-wood')??catalog.find(c=>c.type==='资源'),pocketCard=catalog.find(c=>c.id==='tt3-fireball');
const departures=[];
for(const fixture of [{name:'no-picks',picks:{},pocket:3},{name:'carry-and-clear',picks:{[card.name]:2},pocket:3},{name:'already-empty',picks:{},pocket:0},{name:'failed-commit',picks:{[card.name]:2},pocket:3,fail:true}]){
 let state={stash:[{card,count:3}],pocket:fixture.pocket?[{card:pocketCard,count:fixture.pocket}]:[]},writes=0;
 const before=structuredClone(state);
 const command=createBaseDepartureCommands({read:()=>state,mutate:(prepare,failure)=>{writes++;const draft=structuredClone(state),value=prepare(draft);if(fixture.fail)return failure;state=draft;return value;}});
 const result=command.prepareDeparture(fixture.picks);
 departures.push({...fixture,before,after:state,result,writes});
}
const eventState={layerIdx:0,trackPos:0,ownedCards:[],visited:{}},eventRecord={settled:false},settling=new WeakSet();let eventRuns=0;
const settle=()=>settleEventCommand({state:eventState,record:eventRecord,settling,run:()=>{eventRuns++;return true;},consumeCell:()=>{eventState.visited['0,0']=1;}});
const eventSettlement={first:settle(),repeated:settle(),runs:eventRuns,settled:eventRecord.settled};
const files=['src/run/map-travel-path.js','src/core/map-node-state.js','src/run/game.run.flow.js','src/hub/base-departure.commands.js','src/run/game-session-departure.js','src/run/game.run.events.js','src/run/event-commands.js'];
const evidence=files.map(file=>({file,sha256:createHash('sha256').update(fs.readFileSync(path.join(source,file))).digest('hex')}));
const result={mapCases,boundaries,fogCases,departures,eventSettlement,evidence};fs.writeFileSync(path.join(here,'source-vectors.json'),JSON.stringify(result));
console.log(JSON.stringify({mapSeeds:mapCases.length,pathVectors:mapCases.reduce((sum,m)=>sum+m.cases.reduce((n,c)=>n+c.expected.length,0),0),boundaries:boundaries.length,fogCases:fogCases.length,departureVectors:departures.length}));
