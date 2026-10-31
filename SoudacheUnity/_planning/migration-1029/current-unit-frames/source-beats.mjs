// Real current source engine command -> staged windup/hit feedback, no browser or Unity.
import fs from 'node:fs'; import path from 'node:path'; import {fileURLToPath,pathToFileURL} from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url)),source=path.resolve(here,'../../../../搜打撤');
const {createServer}=await import(pathToFileURL(path.join(source,'node_modules/vite/dist/node/index.js')));
globalThis.window=globalThis;globalThis.SDT={Icons:{img:()=>'',TYPE_ART:{}}};
const server=await createServer({root:path.join(source,'game'),configFile:false,cacheDir:path.join(here,'.vite-oracle'),optimizeDeps:{noDiscovery:true,include:[]},server:{middlewareMode:true},appType:'custom',logLevel:'error'});
const scenarios=[];
try{
 const {createBattleEngineInstance}=await server.ssrLoadModule('/src/battle/core/battle.engine.instance.js');
 const {createStagedPlayback}=await server.ssrLoadModule('/src/battle/runtime/battle.playback.js');
 const catalog=JSON.parse(fs.readFileSync(path.resolve(here,'../card-semantics-fix/current-catalog.json'),'utf8')).cards;
 const sha=catalog.find(c=>c.id==='starter-attack');
 const cards={all:()=>catalog,deriveDraw:()=>0,deriveInfuse:()=>0,isRandomObtainable:()=>true,sellPrice:()=>1,randomClassCard:()=>sha,SHA:sha,TABLETOP10:[],DMG_TYPES:['武术','法术'],DMG_TYPE_META:{attack:{name:'attack'},spell:{name:'spell'},fixed:{name:'fixed'},true:{name:'true'}}};
 const definitions=[
  {name:'combo',type:'武术',amount:5,count:3,targets:1,hp:50},
  {name:'area-combo',type:'法术',amount:5,count:2,targets:2,hp:50},
  {name:'victory',type:'武术',amount:60,count:1,targets:1,hp:50},
  {name:'neutral-cast',type:'法术',amount:2,count:1,targets:1,hp:50},
  {name:'children',type:'法术',amount:0,count:0,targets:1,hp:50},
  {name:'enemy-double',enemy:true,affix:'frenzy',playerCurseImmune:true,playerHp:30,enemyAtk:3,targets:1,hp:50},
  {name:'death',enemy:true,playerHp:2,enemyAtk:3,targets:1,hp:50},
  {name:'surrender',surrender:true,playerHp:30,targets:1,hp:50},
  {name:'smoke',smoke:true,playerHp:30,targets:1,hp:50},
 ];
 for(const fixture of definitions){
  const records=[];let engine;
  engine=createBattleEngineInstance({cards,seed:123,readRules:()=>({battleEnergy:3,battleHandMax:8,bossDeckSize:15,starterSha:0,normalStarterDeckSize:0,battleStartDraw:0,battleTurnDraw:0,diceSides:6}),presentation:{demoMs:()=>0,waitMs:async()=>{},waitForFeedback:async()=>{}},testMode:true});
  const game={ownedCards:[],inventory:[],usedPocket:[],hp:fixture.playerHp??30,maxHp:60,atk:4,spellPower:2,coins:0,state:'idle',battleActive:false,myClass:null,log(){},heal(n){this.hp=Math.min(this.maxHp,this.hp+n);},addItem(){},onBattleEnd(){if(this.hp<=0)records.push({kind:'death'});}};
  engine.start(game,Array.from({length:fixture.targets},(_,i)=>({id:'foe'+i,name:'目标',hp:fixture.hp,atk:fixture.enemyAtk??3,affix:fixture.affix})),{isBoss:false});
  const r=engine.runtime;
  if(fixture.playerCurseImmune)r.set$playerCurseImmune(true);
  let lastHp=game.hp;
  r.bindBattleRenderer(()=>{for(const f of r.takeBattleFloats()){
   if(f.cls?.includes('windupfx')&&f.cue?.attacker)records.push({kind:'windup',action:f.cue.attacker==='player-spell'?'cast':'atk',replay:!!f.cue.replayAttacker,windup:f.cue.windupMs});
   else if(f.cls?.includes('lungefx'))records.push({kind:'enemy-windup',actor:f.unit});
   else if(f.unit==='self'&&(f.cls==='hurt'||f.cls==='block')){records.push({kind:'hit',unit:'self',before:lastHp,after:game.hp,max:game.maxHp});lastHp=game.hp;}
   else if(f.hpBefore!=null)records.push({kind:'hit',unit:f.unit,before:f.hpBefore,after:f.hpAfter,max:f.maxHp});
  }});
  if(fixture.enemy){engine.endTurn();for(let i=0;i<1000&&game.battleActive&&(r.busy||r.turn===1);i++)await new Promise(resolve=>setTimeout(resolve,1));}
  else if(fixture.surrender)engine.surrender();
  else if(fixture.smoke)engine.finish(null);
  else {
  const operation={op:'damage',amountField:'dmg',hitCount:fixture.count,target:fixture.targets>1?'allEnemies':'chosenEnemy'};
  const card={id:'fixture',name:'测试',type:fixture.type,cost:0,desc:'',dmg:fixture.amount,dmgType:fixture.type==='法术'?'spell':'fixed',rules:{version:1,battle:{target:{side:'enemy',area:fixture.targets>1}},triggers:{onPlay:fixture.name==='children'?[{op:'release',source:'generated',key:'初始攻击',max:1},{op:'release',source:'generated',key:'初始攻击',max:1}]:[operation]}}};
  r.granted.push({uid:'fixture',card});r.hand.push('fixture');
  const result=engine.submitCardPlay('fixture',0);if(!result.settled)throw new Error(fixture.name+JSON.stringify(result));await engine.idle();await result.settled;
  }
  scenarios.push({fixture,records,hp:r.foes.map(f=>f.hp),over:!game.battleActive});
  if(game.battleActive)engine.finish(null);
 }
 fs.writeFileSync(path.join(here,'source-beats.json'),JSON.stringify({scenarios},null,2)+'\n');
 console.log(JSON.stringify(scenarios.map(s=>({name:s.fixture.name,records:s.records.length,hp:s.hp,over:s.over}))));
}finally{await server.close();}
