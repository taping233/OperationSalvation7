import fs from 'node:fs';import path from 'node:path';import {fileURLToPath,pathToFileURL}from'node:url';
const here=path.dirname(fileURLToPath(import.meta.url)),source=path.resolve(here,'../../../../搜打撤/game/src'),load=rel=>import(pathToFileURL(path.join(source,rel)).href);
const cards=JSON.parse(fs.readFileSync(path.join(here,'current-catalog.json'),'utf8')).cards;
const {parsePoolNoun}=await load('battle/effects/effect-steps.ctx.js'),{buildDiscoverPool}=await load('battle/effects/battle.discover-candidates.js'),{isRandomObtainableCard}=await load('cards/card-obtainability.js');
const pools=new Map();function visit(value){if(!value||typeof value!=='object')return;if(value.pool&&value.pool.kind!=='牌库底'&&value.pool.kind!=='classAbility')pools.set(JSON.stringify({pool:value.pool,filter:value.filter??null,named:['hand','deck'].includes(value.dest)}),value);for(const v of Object.values(value))visit(v);}cards.forEach(c=>visit(c.rules));
const vectors=[];
for(const operation of pools.values())for(const myClass of ['法师','降临者']){
 const pool=operation.pool,filter=operation.filter,named=['hand','deck'].includes(operation.dest);let result;
 if(pool.kind==='ids')result=cards.filter(c=>pool.ids.includes(c.id));
 else if(pool.kind==='types')result=cards.filter(c=>pool.types.includes(c.type)&&(!pool.randomEligible||isRandomObtainableCard(c)));
 else{
   const exact=named?cards.find(c=>c.name===pool.kind):null;
   if(exact)result=[exact];else{
     const basePred=pool.kind==='moves'?(c=>['武术','法术'].includes(c.type)&&(pool.cost==null||c.cost===pool.cost)):pool.kind==='legendary'?(c=>c.rarity==='传说')
       :parsePoolNoun(pool.kind,myClass)|| (cards.some(c=>c.name===pool.kind)?c=>c.name===pool.kind:null);
     const pred=filter?(c=>(!basePred||basePred(c))&&(filter.type==null||c.type===filter.type)&&(filter.cost==null||c.cost===filter.cost)&&(filter.costMax==null||c.cost<=filter.costMax)&&!filter.exceptIds?.includes(c.id)):basePred;
     if(pred&&basePred?.allowClassCards)pred.allowClassCards=true;
     result=buildDiscoverPool(cards,{myClass,pred,isRandomObtainable:isRandomObtainableCard});
   }
 }
 vectors.push({pool,filter:filter??null,named,myClass,ids:result.map(c=>c.id)});
}
fs.writeFileSync(path.join(here,'pool-source-vectors.json'),JSON.stringify(vectors,null,2)+'\n');console.log(JSON.stringify({poolVectors:vectors.length}));
