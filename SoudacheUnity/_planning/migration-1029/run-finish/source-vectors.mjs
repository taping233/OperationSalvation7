import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url)), root=path.resolve(here,'../../..'), source=path.resolve(root,'../搜打撤/game');
const {executeBagItemEffects}=await import(pathToFileURL(path.join(source,'src/hub/bag-item-effects.js')).href);
const {SeededRandomService}=await import(pathToFileURL(path.join(source,'src/core/random-service.js')).href);
const {parse}=await import(pathToFileURL(path.join(root,'../搜打撤/node_modules/acorn/dist/acorn.mjs')).href);
const catalog=JSON.parse(fs.readFileSync(path.join(here,'../battle/current-catalog.json'),'utf8')).cards;
const mapOp=o=>['heal','restoreConsumed'].includes(o.op)||['acquire','discover'].includes(o.op)&&['legendary','classAbility'].includes(o.pool?.kind);
const native=catalog.filter(c=>c.rules?.bag?.use), cases=[];
for(const card of native){
 const operations=card.rules.bag.use.filter(mapOp);if(operations.some(o=>['acquire','discover'].includes(o.op)))continue;
 for(const hp of [4,30]){
  const sourceEntry={uid:'item',card}, game={hp,maxHp:30,coins:0,ownedCards:[sourceEntry],usedPocket:[{card:catalog.find(c=>c.id==='tt3-fireball'),count:4}]};
  let consumed=false;const rng=new SeededRandomService(1029), tx={get consumed(){return consumed;},report(){},notifyLegend(){},consume(){if(!consumed){consumed=true;game.ownedCards.splice(game.ownedCards.indexOf(sourceEntry),1);}},heal(n){game.hp=Math.min(game.maxHp,game.hp+n);},restore(entry){game.ownedCards.push({uid:'restored',card:entry.card});entry.count--;if(entry.count<=0)game.usedPocket.splice(game.usedPocket.indexOf(entry),1);}};
  executeBagItemEffects(card,operations,{game,SDT:{},Random:rng,usedSlots:()=>0,bagCap:()=>10,canReplace:()=>true,canReceive:()=>true,items:{}},tx);
  cases.push({id:card.id,hp,consumed,afterHp:game.hp,ownedIds:game.ownedCards.map(o=>o.card.id),pocket:game.usedPocket.map(p=>({id:p.card.id,count:p.count}))});
 }
}
const base=fs.readFileSync(path.join(source,'src/hub/base.js'),'utf8'),ast=parse(base,{ecmaVersion:'latest',sourceType:'module'});
function declaration(name){const n=ast.body.find(n=>n.type==='FunctionDeclaration'&&n.id.name===name);if(!n)throw Error(name);return base.slice(n.start,n.end);}
const pets=JSON.parse(fs.readFileSync(path.join(source,'data/pets.json'),'utf8'));
const hatches=[];for(const seed of [0,1,4,1029]){
 const data={pets:{dog:{lv:1}},petSel:'dog',stash:[{card:{id:pets.eggId},count:6}],coins:300},Random=new SeededRandomService(seed);
 const hatch=new Function('data','Random','PETS','PET_EGG_ID','HATCH_COST','mutate','playBaseSound','return ('+declaration('hatchPet')+')')
 (data,Random,pets.list,pets.eggId,pets.hatchCost,fn=>fn(data),()=>{});
 let sequence=[];for(let i=0;i<6;i++){const result=hatch();sequence.push(result.ok?result.pet.id:result.why);}
 hatches.push({seed,sequence,coins:data.coins,eggCount:data.stash[0]?.count??0});
}
const meta=fs.readFileSync(path.join(source,'src/hub/meta.js'),'utf8'),metaAst=parse(meta,{ecmaVersion:'latest',sourceType:'module'});
const doneNode=metaAst.body.flatMap(n=>n.type==='VariableDeclaration'?n.declarations:[]).find(n=>n.id.name==='ACH_DONE').init;
const {createBaseState}=await import(pathToFileURL(path.join(source,'src/hub/base-state.js')).href);
const {firstExploreMoves,extractionXp}=await import(pathToFileURL(path.join(source,'src/hub/extraction.commands.js')).href);
const {addXpToProgress}=await import(pathToFileURL(path.join(source,'src/hub/meta-progression.js')).href);
const ruleConfig=JSON.parse(fs.readFileSync(path.join(here,'../battle/current-catalog.json'),'utf8')).config;
const rules={...ruleConfig.backpack,...ruleConfig.base,bagSize:ruleConfig.backpack.start,bagMax:ruleConfig.backpack.max};
const done=new Function('SDT','B','classList','classLv','petHatchedN','return ('+meta.slice(doneNode.start,doneNode.end)+')')({MAP:{rules},Base:{PETS:pets.list,PET_LEVEL_MAX:pets.levelMax}},()=>null,()=>[],()=>1,d=>Math.max(0,Object.keys(d.pets||{}).length-1));
const achievements=[];
const mutations=[()=>{},d=>{d.stats.extracts=3;d.stats.kills=10;d.stats.bossKills=['a','b','c'];d.stats.bestRunCoins=30;d.stats.stashTotal=20;},d=>{d.pets.dog.lv=5;},d=>{d.pets.penguin={lv:3};d.petSel='penguin';},d=>{d.pets=Object.fromEntries(pets.list.map(p=>[p.id,{lv:1}]));},d=>{d.stats.turnMovesMax=10;d.stats.battleEquipsMax=5;d.stats.reviveKills=1;},d=>{d.stats.labTotalScore=4000;d.stats.nestBossKills=['one','two'];d.runes=[{kind:'rainbow',attrs:['a','b','c','d','e']}];},d=>{d.collection={'tt-gold':{rarity:'传说'},a:{},b:{},c:{},d:{}};d.characters={wu:{lv:3,xp:0}};d.bagUp=20;}];
for(const mutate of mutations){const d=createBaseState();d.pets={dog:{lv:1}};d.petSel='dog';mutate(d);achievements.push({data:d,expected:Object.fromEntries(Object.entries(done).map(([id,test])=>[id,test(d.stats,d)]))});}
const extraction=[];for(const explored of [0,1,4,15])for(const multiplier of [1,1.25,1.5]){const game={explored:Object.fromEntries(Array.from({length:explored},(_,i)=>[String(i),1])),turn:90};const moves=firstExploreMoves(game),xp=extractionXp(moves,multiplier);extraction.push({explored,multiplier,moves,xp,after:addXpToProgress({lv:1,xp:0},xp).after});}
const sceneSource=fs.readFileSync(path.join(source,'src/run/game.run.scenes.js'),'utf8'),sceneAst=parse(sceneSource,{ecmaVersion:'latest',sourceType:'module'});
const encounterNode=sceneAst.body.find(n=>n.type==='ExportNamedDeclaration'&&n.declaration?.id?.name==='buildEncounter').declaration;
const {selectEncounterSpec}=await import(pathToFileURL(path.join(source,'src/run/encounter-selector.js')).href);
const {generateExplorationMap}=await import(pathToFileURL(path.join(source,'src/run/map-generator-v7.js')).href);
const {hashSeed}=await import(pathToFileURL(path.join(source,'src/core/random-core.js')).href);
const {scaleEnemyForMode}=await import(pathToFileURL(path.join(source,'src/core/enemy-mode-scaling.js')).href);
const MAP=JSON.parse(fs.readFileSync(path.join(source,'data/map.json'),'utf8')),encounters=[];
for(const seed of [0,1,9,42,1029])for(const mode of ['standard','elite']){
 const map=generateExplorationMap(String(seed));
 for(let li=0;li<4;li++)for(const node of map.layers[li].nodes.filter(n=>n.type==='battle')){
  const Random=new SeededRandomService(seed),game={encounterRotationVersion:1,mapSeed:String(seed),seed,trackPos:node.idx,layerData:map.layers.map(l=>({logical:l.nodes.map(n=>({def:{type:n.type}}))}))};
  const build=new Function('MAP','selectEncounterSpec','Random','game','hashSeed','scaledEnemy','return ('+sceneSource.slice(encounterNode.start,encounterNode.end)+')')(MAP,selectEncounterSpec,Random,game,hashSeed,e=>scaleEnemyForMode(e,mode));
  const list=build(li);encounters.push({seed,mode,li,index:node.idx,enemies:list.map(e=>({id:e.id,hp:e.hp,atk:e.atk,elite:!!e.elite})),next:[Random.random('enemy','enemy'),Random.random('enemy','enemy'),Random.random('enemy','enemy')]});
 }
}
fs.writeFileSync(path.join(here,'source-vectors.json'),JSON.stringify({nativeBagCards:native.length,cases,hatches,pets,achievements,extraction,encounters},null,2));
console.log(JSON.stringify({nativeBagCards:native.length,bagVectors:cases.length,hatchSeeds:hatches.length}));
