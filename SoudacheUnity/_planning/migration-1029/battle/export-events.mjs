import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath,pathToFileURL } from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url)),root=path.resolve(here,'../../..'),source=path.resolve(root,'../搜打撤');
const packet=JSON.parse(fs.readFileSync(path.join(here,'current-catalog.json'),'utf8'));
const map=JSON.parse(fs.readFileSync(path.join(source,'game/data/map.json'),'utf8'));
const {parse}=await import(pathToFileURL(path.join(source,'node_modules/acorn/dist/acorn.mjs')).href);
const {Story}=await import(pathToFileURL(path.join(source,'node_modules/inkjs/dist/ink.mjs')).href);
const ink=(await import(pathToFileURL(path.join(source,'game/src/generated/narrative-events.js')).href)).default;
const {isRandomObtainableCard}=await import(pathToFileURL(path.join(source,'game/src/cards/card-obtainability.js')).href);
const code=fs.readFileSync(path.join(source,'game/src/run/game.run.events.js'),'utf8');
const ast=parse(code,{ecmaVersion:'latest',sourceType:'module'});
function declaration(name,node=ast){if(node.type==='FunctionDeclaration'&&node.id.name===name)return code.slice(node.start,node.end);for(const value of Object.values(node))for(const child of Array.isArray(value)?value:[value])if(child&&typeof child==='object'&&child.type){const found=declaration(name,child);if(found)return found;}return null;}
const catalogs={all:()=>packet.cards,isRandomObtainable:isRandomObtainableCard,SHA:packet.cards.find(card=>card.id==='starter-attack')};
function narrative(card){try{const story=new Story(ink);story.ChoosePathString(card.id.replaceAll('-','_'));while(story.canContinue)story.Continue();return{choices:story.currentChoices.map(choice=>{const [label,...tags]=choice.text.split('@@');const meta=Object.fromEntries(tags.map(tag=>{const at=tag.indexOf('=');return[tag.slice(0,at),tag.slice(at+1)];}));return{label,...meta,choose:()=>''};})};}catch{return null;}}
function recorder(layer){
  let operations=[];const push=operation=>operations.push(operation),record={};
  const game={hp:30,maxHp:30,coins:100,fragments:0,layerIdx:layer,ownedCards:[{uid:'wood-source',card:packet.cards.find(c=>c.id==='tt-wood')}],canReceiveCard:()=>true};
  const save=run=>{const before=operations;operations=[];run();const output=operations;operations=before;return output;};
  const commands={gainCoins:n=>push({op:'coins',n}),heal:n=>push({op:'heal',n}),damage:(n,reason)=>push({op:'damage',n,reason}),
    gainFragment:()=>{game.fragments++;push({op:'fragment',n:1});},reinforceLife:n=>push({op:'maxHp',n}),sacrificeLife:n=>push({op:'sacrifice',n})};
  const scope={game,UI:{log(){}},getCards:()=>catalogs,eventCommands:commands,MAP:map,esc:value=>value,
    nodeEventAt:()=>record,branchChoices:{open:kind=>push({op:'route',kind})},
    discardInventoryCard:()=>{push({op:'consumeCard',id:'tt-wood'});return{ok:true};},
    openFixedRewardsOnCell:cards=>push({op:'rewards',ids:cards.filter(Boolean).map(card=>card.id)}),
    openChestsOnCell:boxes=>push({op:'chests',kinds:boxes.map(box=>(box.isClass?'class:':'')+box.kind)}),
    openEventRecode:()=>push({op:'route',kind:'recodeTwo'}),openEventPotions:()=>push({op:'route',kind:'potions'}),
    openEventQuartermaster:()=>push({op:'route',kind:'quartermaster'}),openEventGamble:()=>push({op:'route',kind:'gamble'}),
    grantEventCard:card=>push({op:'rewards',ids:card?[card.id]:[]}),scaledEnemy:enemy=>enemy,
    startBattle:async(_game,enemies)=>push({op:'battle',enemies}),
    finishEventRoll:run=>run(),eventPool:types=>packet.cards.filter(card=>(Array.isArray(types)?types:[types]).includes(card.type)&&isRandomObtainableCard(card)),
    openPocketRestore:n=>push({op:'restore',n}),closeEventFlow(){} };
  scope.claimEventCard=card=>{push({op:'rewards',ids:[card.id]});return true;};
  scope.eventDice=(_title,key,outcomes,done,sides)=>{
    const branches=outcomes.map(outcome=>({label:outcome.label,value:outcome.value,operations:save(()=>done(outcome.value))}));
    push({op:'dice',key,sides:sides??6,branches});
  };
  scope.drawEventCards=(title,key,pools,done,unique=true)=>{
    const candidates=pools.map(pool=>typeof pool==='function'?pool():pool);
    const placeholders=candidates.map((pool,index)=>({...pool[0],id:'$draw:'+index}));
    push({op:'drawCards',title,key,unique,pools:candidates.map(pool=>pool.map(card=>card.id)),after:save(()=>done(placeholders))});
  };
  scope.applyEventEffect=new Function(...Object.keys(scope),'return ('+declaration('applyEventEffect')+')')(...Object.values(scope));
  const spec=new Function(...Object.keys(scope),'return ('+declaration('eventChoiceSpec')+')')(...Object.values(scope));
  return{spec,game,record,take:()=>{const result=operations;operations=[];return result;}};
}
const events=[];
for(const card of packet.cards.filter(card=>card.type==='事件')){
  const layers=[];
  for(let layer=0;layer<4;layer++){
    const context=recorder(layer),choices=context.spec(card,narrative(card))??[];const compiled=[];
    for(let index=0;index<choices.length;index++){
      const choice=choices[index];context.take();context.game.fragments=0;delete context.record.commission;
      if(choice.claim&&choice.claim()===false)throw new Error('Cannot compile claim '+card.id);
      await choice.run();const operations=context.take();if(context.record.commission)operations.push({op:'commission'});
      compiled.push({key:card.id+':'+index,label:choice.label,detail:choice.detail??'',tone:choice.tone??'',coinCost:choice.coinCost??0,
        healthCost:choice.healthCost??0,capacityCard:choice.capacityCard?.id??null,rolls:!!choice.rolls,operations});
    }
    layers.push(compiled);
  }
  if(!layers[0].length)throw new Error('Event has no current choices: '+card.id);
  events.push({id:card.id,name:card.name,layers});
}
fs.writeFileSync(path.join(here,'current-events.json'),JSON.stringify(events,null,2)+'\n');
console.log(JSON.stringify({events:events.length,choices:events.reduce((n,event)=>n+event.layers[0].length,0),ids:events.map(event=>event.id)}));
