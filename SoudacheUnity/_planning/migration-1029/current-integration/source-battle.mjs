import fs from 'node:fs';import path from 'node:path';import {fileURLToPath,pathToFileURL} from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url)),source=path.resolve(here,'../../../../搜打撤');
const {createServer}=await import(pathToFileURL(path.join(source,'node_modules/vite/dist/node/index.js')));
globalThis.window=globalThis;globalThis.SDT={Icons:{img:()=>'',TYPE_ART:{}}};
const server=await createServer({root:path.join(source,'game'),configFile:false,cacheDir:path.join(here,'.vite-oracle'),optimizeDeps:{noDiscovery:true,include:[]},server:{middlewareMode:true},appType:'custom',logLevel:'error'});
try{
 const {createBattleEngineInstance}=await server.ssrLoadModule('/src/battle/core/battle.engine.instance.js');
 const targets=await server.ssrLoadModule('/src/battle/effects/battle.target-rules.js');
 const {ownsBuiltinExecutionDomain}=await server.ssrLoadModule('/src/cards/builtin-card-execution.js');
 const catalog=JSON.parse(fs.readFileSync(path.resolve(here,'../card-semantics-fix/current-catalog.json'),'utf8')).cards;
 const sha=catalog.find(c=>c.id==='starter-attack');const cards={all:()=>catalog,deriveDraw:()=>0,deriveInfuse:()=>0,isRandomObtainable:()=>true,sellPrice:()=>1,randomClassCard:()=>sha,SHA:sha,TABLETOP10:[],DMG_TYPES:['武术','法术'],DMG_TYPE_META:{attack:{name:'attack'},spell:{name:'spell'},fixed:{name:'fixed'},true:{name:'true'}}};
 const extra=[{id:'legacy-draw',type:'法术',desc:'抽 2 张牌。'},{id:'legacy-area',type:'法术',dmg:4,desc:'对所有敌人造成 4 点法术伤害。'},{id:'legacy-area-buff',type:'法术',desc:'所有敌人附加 1 层流血。'},{id:'custom-equip',type:'装备',desc:''},{id:'legacy-deck',type:'法术',desc:'将一张牌洗入牌库。'},{id:'legacy-random',type:'法术',desc:'对随机一名敌人造成 3 点法术伤害。'},{id:'tt7-imitate',type:'武术',desc:'旧无结构仿制'},{id:'custom-mimic',type:'武术',rules:{battle:{handTransform:{afterType:'武术',cost:1}},triggers:{onPlay:[]}}}];
 fs.writeFileSync(path.join(here,'source-targets.json'),JSON.stringify([...catalog,...extra].map(card=>({card,owner:ownsBuiltinExecutionDomain(card),area:targets.isAreaEffect(card),random:targets.isRandomEnemyEffect(card),side:targets.targetSideFor(card,cards.DMG_TYPES),normal:targets.unplayableReasonFor(card,'normal')??null,boss:targets.unplayableReasonFor(card,'boss')??null})),null,2)+'\n');
 function create(owned=[],atk=0,affix=null){let ended;
  const engine=createBattleEngineInstance({cards,seed:123,readRules:()=>({battleEnergy:2,battleHandMax:8,bossDeckSize:15,starterSha:5,normalStarterDeckSize:5,battleStartDraw:5,battleTurnDraw:1,diceSides:6}),presentation:{demoMs:()=>0,waitMs:async()=>{},waitForFeedback:async()=>{}},testMode:true});
  const game={ownedCards:owned,inventory:[],usedPocket:[],hp:30,maxHp:60,atk:4,spellPower:2,coins:0,state:'idle',battleActive:false,myClass:null,log(){},heal(n){this.hp=Math.min(this.maxHp,this.hp+n);},addItem(){},onBattleEnd(opts){ended=opts;}};
  engine.start(game,[{id:'foe',name:'目标',hp:50,atk,affix}],{isBoss:false});return{engine,r:engine.runtime,game,end:()=>ended};
 }
 const card={id:'legacy-draw',name:'旧文本抽牌夹具',type:'法术',cost:0,desc:'抽 2 张牌。'};
 const a=create([0,1,2].map(n=>({uid:'draw'+n,card:{...card}})));const draws=[];
 for(let n=0;n<3;n++){const result=a.engine.submitCardPlay('draw'+n);if(!result.settled)throw Error(JSON.stringify(result));await a.engine.idle();await result.settled;draws.push({hand:a.r.hand.length,deck:a.r.drawPile.length,starters:a.r.hand.filter(uid=>a.engine.findCard(uid)?.card.id===sha.id).length});}a.engine.finish(null);
 async function enemyTurn(fixture){fixture.engine.endTurn();for(let n=0;n<1000&&fixture.game.battleActive&&(fixture.r.busy||fixture.r.turn===1);n++)await new Promise(resolve=>setTimeout(resolve,1));if(fixture.game.battleActive&&(fixture.r.busy||fixture.r.turn===1))throw Error('source enemy phase did not settle');}
 const b=create();b.r.pstat.status.swordForm=1;await enemyTurn(b);const sword={hand:b.r.hand.length,deck:b.r.drawPile.length};b.engine.finish(null);
 const c=create([],3,'frenzy');await enemyTurn(c);const frenzy={hp:c.game.hp,status:{bleed:c.r.pstat.status.bleed||0,poison:c.r.pstat.status.poison||0}};c.engine.finish(false);const summary=c.end()?.battleSummary;
 if(!summary)throw Error('actual source did not deliver battleSummary');
 const rawMimic=structuredClone(catalog.find(card=>card.id==='tt7-imitate'));
 const m=create([{uid:'martial',card:structuredClone(sha)},{uid:'mimic',card:rawMimic}]);
 const play=m.engine.submitCardPlay('martial',0);if(!play.settled)throw Error('source mimic martial rejected');await m.engine.idle();await play.settled;
 const face=m.engine.findCard('mimic').card;const mimic={id:face.id,cost:face.cost,originalId:rawMimic.id,blocked:targets.unplayableReasonFor(face,'normal')??null};m.engine.finish(null);
 const output={draws,sword,frenzy,summary,mimic};fs.writeFileSync(path.join(here,'source-battle.json'),JSON.stringify(output,null,2)+'\n');console.log(JSON.stringify(output));
}finally{await server.close();}
