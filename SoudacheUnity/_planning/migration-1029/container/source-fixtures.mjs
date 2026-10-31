import fs from 'node:fs';import path from 'node:path';import {pathToFileURL} from 'node:url';
const src=path.resolve(import.meta.dirname,'../../../../搜打撤/game/src');
const {deriveBagRenderState}=await import(pathToFileURL(path.join(src,'core/bag-render-derivation.js')));
const {stackCapOf}=await import(pathToFileURL(path.join(src,'core/card-capacity.js')));
const {transferContainerStack,discardInventoryCard}=await import(pathToFileURL(path.join(src,'hub/bag-inventory-commands.js')));
const {collectRescueCards}=await import(pathToFileURL(path.join(src,'hub/run-rescue-cards.js')));
const pearl={id:'tt2-pearlbox',name:'珍珠盒',type:'装备',rules:{equip:{container:{slots:9,accepts:'资源'}}}};
const pouch={id:'tt7-stratagem',name:'法师锦囊',type:'法术',rules:{equip:{container:{slots:3,accepts:'法术'}}}};
const spell={id:'s',name:'法术',type:'法术'},resource={id:'r',name:'资源',type:'资源'},sword={id:'e',name:'装备',type:'装备'};
const entry=(uid,card,extra={})=>({uid,card,...extra});
const cases=[];
function add(name,baseCap,ownedCards,request=null){const state={ownedCards,inventory:[],battleActive:false};const before=structuredClone(state);let result=null;
 if(request){const view=()=>deriveBagRenderState(state,baseCap);result=transferContainerStack(state,request,{stackCapOf,usedSlots:()=>view().used,bagCap:()=>view().cap,baseCap:()=>baseCap});}
 const view=deriveBagRenderState(state,baseCap);
 cases.push({name,baseCap,before,request,result:result&&{ok:result.ok,code:result.code||null},after:state.ownedCards.map(o=>({uid:o.uid,stored:!!o.stored,pouchOf:o.pouchOf||null})),usage:{used:view.used,ordinarySlots:view.ordinarySlots,resourceBonus:view.resourceBonus,cap:view.cap,safeUsed:view.safeStacks.length}});
}
add('equipment-one-other-three',20,[...Array.from({length:6},(_,i)=>entry('e'+i,sword)),...Array.from({length:7},(_,i)=>entry('s'+i,spell))]);
add('pouch-first-capacity-only',10,[entry('p1',pouch),entry('p2',pouch),...Array.from({length:4},(_,i)=>entry('s'+i,spell))],{kind:'pouch',take:false,name:'法术'});
add('pouch-full-stack-rejected',10,[entry('p1',pouch),...Array.from({length:2},(_,i)=>entry('stored'+i,spell,{stored:1,pouchOf:'tt7-stratagem'})),...Array.from({length:3},(_,i)=>entry('s'+i,spell))],{kind:'pouch',take:false,name:'法术'});
add('pearl-two-boxes',10,[entry('b1',pearl),entry('b2',pearl),...Array.from({length:6},(_,i)=>entry('r'+i,resource))],{kind:'pearl',take:false,name:'资源'});
add('pouch-retrieve-ordinary-full',3,[entry('b1',pearl),entry('p1',pouch),entry('e',sword),...Array.from({length:3},(_,i)=>entry('s'+i,spell,{stored:1,pouchOf:'tt7-stratagem'}))],{kind:'pouch',take:true,name:'法术'});
add('pearl-retrieve-resources-in-extension',1,[entry('b1',pearl),...Array.from({length:9},(_,i)=>entry('r'+i,resource,{stored:1}))],{kind:'pearl',take:true,name:'资源'});
const rescue=collectRescueCards([entry('safe-box',pearl,{safe:true}),entry('safe-card',spell,{safe:true}),entry('resource',resource,{stored:1}),entry('pouch-spell',spell,{stored:1,pouchOf:'tt7-stratagem'}),entry('ordinary',sword)]).map(e=>e.card.id);
fs.writeFileSync(path.join(import.meta.dirname,'source-fixtures.json'),JSON.stringify({cases,rescue},null,2));console.log(JSON.stringify({cases:cases.length,rescue}));
