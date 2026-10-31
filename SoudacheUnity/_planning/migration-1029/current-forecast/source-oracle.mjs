import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath,pathToFileURL} from 'node:url';
const dir=path.dirname(fileURLToPath(import.meta.url));
const source=path.resolve(dir,'../../../../搜打撤');
const {createServer}=await import(pathToFileURL(path.join(source,'node_modules/vite/dist/node/index.js')));
globalThis.window=globalThis; globalThis.SDT={Icons:{img:()=>'',TYPE_ART:{}}};
const server=await createServer({root:path.join(source,'game'),configFile:false,cacheDir:path.join(dir,'.vite-oracle'),optimizeDeps:{noDiscovery:true,include:[]},server:{middlewareMode:true},appType:'custom',logLevel:'error'});
const unit=(patch={})=>({name:'靶子',hp:30,maxHp:30,atk:8,status:{},defense:{armor:0,shield:0,guard:false},...patch});
const snapshot=(patch={})=>({turn:1,player:{hp:30},pstat:{status:{}},pdef:{armor:0,shield:0,guard:false},allies:[],foes:[unit()],endTurnContext:{},...patch});
try {
 const load=rel=>server.ssrLoadModule('/src/'+rel);
 const {forecastEnemyTurn}=await load('battle/view/battle.turn-forecast.js');
 const {buildEnemyActionPlan}=await load('battle/core/battle.enemy-plan.js');
 const {calculateEnemyIntent}=await load('battle/core/battle.enemy-intent.js');
 const {readConsumedPile}=await load('battle/bag/battle.consumed-pile.js');
 const {createBattleEngineInstance}=await load('battle/core/battle.engine.instance.js');
 const forecast=[];
 const add=(name,patch)=>{const input=snapshot(patch),before=JSON.stringify(input),expected=forecastEnemyTurn(input);forecast.push({name,input,expected,immutable:before===JSON.stringify(input),frozen:Object.isFrozen(expected)});};
 add('plain',{});add('poison',{pstat:{status:{poison:3}}});add('poison-lethal-insurance-does-not-save',{player:{hp:3},pstat:{status:{poison:4}},endTurnContext:{deathSave:1}});
 for(const [name,pdef] of Object.entries({shield:{shield:9},armor:{armor:5},guard:{guard:true},'shield-armor-guard':{shield:4,armor:2,guard:true}}))add(name,{pdef});
 add('freeze',{foes:[unit({status:{freeze:1}})]});add('dead',{foes:[unit({dead:true})]});add('even-odd',{foes:[unit({evenAttack:true})]});add('even-even',{turn:2,foes:[unit({evenAttack:true})]});
 add('stunned',{foes:[unit({stunned:true})]});add('first-round',{foes:[unit({noFirstAttack:true})]});add('after-first-round',{turn:2,foes:[unit({noFirstAttack:true})]});add('frenzy',{foes:[unit({affix:'frenzy'})]});
 add('player-stealth-with-guard',{pstat:{status:{stealth:1}},allies:[unit({hp:3})]});add('player-immune',{pstat:{status:{immune:1,poison:5}}});add('dodge-double-hit',{pstat:{status:{dodge:1}},foes:[unit({affix:'frenzy'})]});
 add('statless-does-not-guard',{allies:[unit({statless:true})]});add('dead-does-not-guard',{allies:[unit({dead:true})]});add('stealthed-does-not-guard',{allies:[unit({status:{stealth:1}})]});
 add('two-guards-two-foes',{allies:[unit({hp:4}),unit({hp:5})],foes:[unit(),unit(),unit()]});add('dead-first-guard',{allies:[unit({hp:0}),unit({hp:4})],foes:[unit(),unit()]});
 add('guard-defense-double-hit',{allies:[unit({hp:3,defense:{shield:5,armor:2,guard:true}})],foes:[unit({affix:'frenzy'}),unit()]});
 add('insurance',{player:{hp:5},foes:[unit({affix:'frenzy'}),unit()],endTurnContext:{deathSave:1}});
 add('poison-before-insurance',{player:{hp:5},pstat:{status:{poison:1}},foes:[unit({affix:'frenzy'}),unit()],endTurnContext:{deathSave:1}});
 add('insurance-consumes-defense',{player:{hp:5},pdef:{shield:1,armor:1,guard:true},foes:[unit({atk:20,affix:'frenzy'})],endTurnContext:{deathSave:2}});
 add('extra-turn-skips-poison',{player:{hp:3},pstat:{status:{poison:4,burn:2}},endTurnContext:{extraTurn:true,deathSave:1}});
 add('time-rune-pure-only',{pstat:{status:{poison:3}},endTurnContext:{timeRune:true}});add('time-rune-lethal',{player:{hp:5},pstat:{status:{poison:3}},endTurnContext:{timeRune:true,deathSave:1}});
 add('bleed-defense',{pstat:{status:{bleed:3}},pdef:{shield:2,armor:1,guard:true},foes:[unit({affix:'frenzy'})]});
 add('ally-bleed',{allies:[unit({hp:4,status:{bleed:3}})],foes:[unit(),unit()]});add('poison-necrotic-abreak',{pstat:{status:{poison:3,necroticExposure:2,abreak:1}},pdef:{shield:5,armor:5,guard:true}});
 add('empty',{foes:[]});add('zero-hp',{player:{hp:0}});add('negative-hp',{player:{hp:-3}});add('zero-turn-default-one',{turn:0,foes:[unit({evenAttack:true,noFirstAttack:true})]});
 const plans=[];for(const turn of [0,1,2,3])for(const patch of [{},{dead:true},{stunned:true},{evenAttack:true},{noFirstAttack:true},{status:{freeze:1}},{stunned:true,evenAttack:true,noFirstAttack:true,status:{freeze:1}},{affix:'frenzy'},{affix:'grow'},{affix:'aegis'},{behavior:'necromancer'}]){const input=unit(patch);plans.push({turn,input,expected:buildEnemyActionPlan(input,turn)});}
 const intents=plans.flatMap(p=>[0,3].map(bleed=>({turn:p.turn,input:p.input,bleed,expected:calculateEnemyIntent(p.input,p.turn,{bleed})})));
 for(const behavior of ['strike','volley','charge','guard','curse','dragon','general','orc_boss','element_boss','witness_pope','mutation_mother','mysterious_blocker','necromancer','unknown'])for(const bleed of [0,3]){const input=unit({behavior});intents.push({turn:2,input,bleed,expected:calculateEnemyIntent(input,2,{bleed})});}
 const hit={id:'test-hit',name:'初始攻击',type:'武术',cost:0,dmg:0,desc:''};
 const cards={all:()=>[hit],deriveDraw:()=>0,deriveInfuse:()=>0,isRandomObtainable:()=>true,sellPrice:()=>1,randomClassCard:()=>hit,SHA:hit,TABLETOP10:[],DMG_TYPES:['武术','法术'],DMG_TYPE_META:{}};
 function setup(input){const engine=createBattleEngineInstance({cards,seed:123,readRules:()=>({battleEnergy:2,battleHandMax:8,bossDeckSize:15,starterSha:0,normalStarterDeckSize:0,battleStartDraw:0,battleTurnDraw:0,diceSides:6}),presentation:{demoMs:()=>0,waitMs:async()=>{},waitForFeedback:async()=>{}},testMode:true});
 const game={ownedCards:[],inventory:[],usedPocket:[],hp:input.player.hp,maxHp:60,atk:4,spellPower:0,coins:0,state:'idle',battleActive:false,myClass:null,log(){},heal(n){this.hp=Math.min(this.maxHp,this.hp+n);},addItem(){},onBattleEnd(){}};
 engine.start(game,input.foes.map((f,i)=>({id:'foe'+i,name:'靶子',hp:100,...f})),{isBoss:false});const r=engine.runtime;
 r.set$turn(input.turn||1);r.set$pdef({...input.pdef});Object.assign(r.pstat.status,input.pstat.status);r.set$deathSave(input.endTurnContext.deathSave||0);r.set$extraTurn(!!input.endTurnContext.extraTurn);r.set$allies(input.allies.map(a=>structuredClone(a)));r.foes.forEach((f,i)=>Object.assign(f,structuredClone(input.foes[i])));
 return{engine,r,game};}
 const actual=[];
 for(const name of ['plain','poison','poison-lethal-insurance-does-not-save','shield-armor-guard','freeze','even-odd','even-even','stunned','first-round','after-first-round','player-stealth-with-guard','statless-does-not-guard','stealthed-does-not-guard','two-guards-two-foes','insurance','poison-before-insurance','insurance-consumes-defense','extra-turn-skips-poison']){
  const input=forecast.find(f=>f.name===name).input;const {engine,r,game}=setup(input);engine.endTurn();for(let i=0;i<300;i++){await new Promise(resolve=>setTimeout(resolve,1));if(!game.battleActive||(!r.busy&&r.turn>(input.turn||1)))break;}
  if(game.battleActive&&r.busy)throw new Error('Turn stuck: '+name);
  actual.push({name,input,expected:{hp:game.hp,deathSave:r.deathSave,poison:r.pstat.status.poison||0,allies:r.allies.map(a=>({hp:a.hp,dead:!!a.dead})),stunned:r.foes.map(f=>!!f.stunned),over:!game.battleActive,turn:r.turn}});if(game.battleActive)engine.finish(null);
 }
 const hits=[];
 for(const patch of [{},{player:{hp:5},endTurnContext:{deathSave:1}},{player:{hp:5},pdef:{shield:1,armor:1,guard:true},endTurnContext:{deathSave:1}},{player:{hp:5},pstat:{status:{dodge:1}},endTurnContext:{deathSave:1}},{player:{hp:5},pstat:{status:{immune:1}}},{player:{hp:3}}]){
  const input=snapshot(patch),{engine,r,game}=setup(input);let dealt=engine.playerTakeHit({name:'击',atk:20});hits.push({input,atk:20,expected:{dealt,hp:game.hp,deathSave:r.deathSave,immune:r.pstat.status.immune||0,dodge:r.pstat.status.dodge||0,defense:r.pdef}});if(game.battleActive)engine.finish(null);
 }
 const phases={};
 {const {engine,r,game}=setup(snapshot());phases.player=engine.getSnapshot().phase;
  const card={...hit,id:'phase-target',name:'相位攻击',dmg:1,dmgType:'fixed',rules:{version:1,battle:{target:{side:'enemy',area:false}},triggers:{onPlay:[{op:'damage',amountField:'dmg',target:'chosenEnemy'}]}}};r.granted.push({uid:'phase-target',card});r.hand.push('phase-target');const pending=engine.submitCardPlay('phase-target');if(pending.status!=='needs-input')throw new Error('Target fixture rejected: '+JSON.stringify(pending));phases.targeting=engine.getSnapshot().phase;engine.cancelInteraction();phases.cancelTarget=engine.getSnapshot().phase;
  const result=engine.submitCardPlay('phase-target',0);if(!result.settled)throw new Error('Resolving fixture rejected: '+JSON.stringify(result));phases.resolving=engine.getSnapshot().phase;await engine.idle();await result.settled;phases.afterResolve=engine.getSnapshot().phase;engine.finish(null);phases.retract=engine.getSnapshot().phase;
 }
 for(const [name,win] of [['victory',true],['defeat',false]]){const {engine}=setup(snapshot());engine.finish(win);phases[name]=engine.getSnapshot().phase;}
 {const {engine,game}=setup(snapshot());engine.finish(null);engine.start(game,[{id:'boss',name:'首脑',hp:30,atk:1}],{isBoss:true});phases.deck=engine.getSnapshot().phase;engine.cancelDeckSelection();phases.cancelDeck=engine.getSnapshot().phase;}
 const selfDamage=[];
 for(const [hp,n,saves] of [[5,8,1],[5,8,0],[10,2,1]]){
  const input=snapshot({player:{hp},endTurnContext:{deathSave:saves}}),{engine,r,game}=setup(input);
  const card={id:'self',name:'自伤',type:'法术',cost:0,desc:'',rules:{version:1,battle:{target:{side:'self',area:false}},triggers:{onPlay:[{op:'heal',selfDamage:n}]}}};r.granted.push({uid:'self',card});r.hand.push('self');
  const result=engine.submitCardPlay('self','self');await engine.idle();await result.settled;
  selfDamage.push({hp,n,saves,expected:{hp:game.hp,deathSave:r.deathSave,immune:r.pstat.status.immune||0,over:!game.battleActive}});if(game.battleActive)engine.finish(null);
 }
 let repeatedInsurance;
 {const {engine,r,game}=setup(snapshot());const card={id:'insurance',name:'保险',type:'法术',cost:0,desc:'',rules:{version:1,triggers:{onPlay:[{op:'registerRule',rule:'deathSave',n:3},{op:'registerRule',rule:'deathSave',n:2}]}}};r.granted.push({uid:'insurance',card});r.hand.push('insurance');const result=engine.submitCardPlay('insurance');await engine.idle();await result.settled;repeatedInsurance=r.deathSave;if(game.battleActive)engine.finish(null);}
 const pileInput={hand:['held'],drawPile:['draw'],played:['a','held','dup'],consumed:['b','dup','draw'],discard:['c','a'],grave:['d','excluded','b']};
 const files=['battle/view/battle.turn-forecast.js','battle/core/battle.enemy-plan.js','battle/core/battle.engine.factory.domain.js','battle/core/battle.enemy-phase.domain.js','battle/core/battle.enemy-intent.js','battle/core/battle.lifecycle.domain.js','battle/runtime/battle.snapshot.js','battle/bag/battle.consumed-pile.js','battle/core/combat.factory.js','battle/runtime/battle.state.js','battle/runtime/battle.action-runner.js','battle/effects/card-semantic-operations.js'];
 const sourceSHA=files.map(file=>({file:'game/src/'+file,sha256:crypto.createHash('sha256').update(fs.readFileSync(path.join(source,'game/src',file))).digest('hex')}));
 fs.writeFileSync(path.join(dir,'source-vectors.json'),JSON.stringify({sourceSHA,forecast,plans,intents,actual,hits,selfDamage,phases,repeatedInsurance,pile:{input:pileInput,excluded:['excluded'],expected:readConsumedPile(pileInput,['excluded'])}},null,2)+'\n');
 console.log(JSON.stringify({forecast:forecast.length,plans:plans.length,intents:intents.length,actual:actual.length,hits:hits.length,selfDamage:selfDamage.length,sourceImmutable:forecast.every(f=>f.immutable&&f.frozen)},null,2));
}finally{await server.close();}
