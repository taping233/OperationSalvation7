import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const taskDir = path.dirname(fileURLToPath(import.meta.url));
const unityRoot = path.resolve(taskDir, '../../../..');
const sourceRoot = path.resolve(unityRoot, '../搜打撤');
const { createServer } = await import(pathToFileURL(path.join(sourceRoot, 'node_modules/vite/dist/node/index.js')).href);
const mem = new Map();
globalThis.window = globalThis;
globalThis.SDT = { Icons: { img: () => '' } };
globalThis.localStorage = {
  getItem: key => mem.get(key) ?? null,
  setItem: (key, value) => mem.set(key, String(value)),
  removeItem: key => mem.delete(key), clear: () => mem.clear(),
  key: index => [...mem.keys()][index] ?? null,
  get length() { return mem.size; },
};
globalThis.document = { body: null, head: { appendChild() {} }, addEventListener() {}, removeEventListener() {},
  getElementById: () => null, querySelector: () => null, querySelectorAll: () => [],
  createElement: () => ({ style: {}, setAttribute() {}, appendChild() {}, addEventListener() {} }) };
globalThis.addEventListener = () => {};
globalThis.requestAnimationFrame = () => 0;
globalThis.Image = class { addEventListener() {} };
globalThis.MutationObserver = class { observe() {} disconnect() {} };
const server = await createServer({ root: path.join(sourceRoot, 'game'), configFile: false,
  cacheDir: path.join(taskDir, '.vite'), optimizeDeps: { noDiscovery: true, include: [] },
  plugins: [{ name: 'catalog-without-view', enforce: 'pre',
    transform(code, id) { if (id.replaceAll('\\', '/').endsWith('/cards/cards.view.js')) return 'export const cardHTML = () => ""; export const cardBackHTML = () => "";'; } }],
  server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
try {
  const load = rel => server.ssrLoadModule('/src/' + rel);
  const randomModule = await load('core/random.js');
  const { Cards } = await load('cards/cards.js');
  Cards.STARTERS.forEach((card, index) => { if (!card.id) card.id = `starter-${index + 1}`; });
  Cards.ensureStarters(); Cards.ensureSha(); Cards.ensureTabletop(); Cards.ensureDmgTypes(); Cards.ensureEffectFields();
  const cards = Cards.all();
  fs.writeFileSync(path.join(taskDir,'fresh-catalog.json'),JSON.stringify(cards,null,2));
  const {createBattleEngineInstance}=await load('battle/core/battle.engine.instance.js');
  function fixture(ids,boss=false,multi=false,seed=123){
    const engine=createBattleEngineInstance({cards:Cards,seed,readRules:()=>({battleEnergy:2,battleHandMax:8,bossDeckSize:15,starterSha:5,normalStarterDeckSize:5,battleStartDraw:5,battleTurnDraw:1,diceSides:6}),presentation:{demoMs:()=>0,waitMs:async()=>{},waitForFeedback:async()=>{}},testMode:true});
    const owned=ids.map((id,i)=>({uid:'o'+i,card:structuredClone(typeof id==='string'?cards.find(c=>c.id===id):id)}));
    const game={ownedCards:owned,inventory:[],usedPocket:[],hp:30,maxHp:60,atk:4,spellPower:2,coins:0,state:'idle',battleActive:false,myClass:null,log(){},heal(n){this.hp=Math.min(this.maxHp,this.hp+n)},addItem(){},onBattleEnd(){}};
    engine.start(game,(multi?[{id:'foe',name:'目标',hp:1000,atk:2},{id:'other',name:'另一个目标',hp:1000,atk:2},...(multi===3?[{id:'third',name:'第三目标',hp:100,atk:6}]:[])]:[{id:'foe',name:'目标',hp:1000,atk:2}]),{isBoss:boss});if(boss){for(const entry of owned)if(entry.card.id!=='starter-attack')engine.toggleDeckCard(entry.uid);engine.beginBoss();engine.runtime.set$hand(owned.map(o=>o.uid));engine.runtime.set$drawPile(engine.runtime.drawPile.filter(uid=>!owned.some(o=>o.uid===uid)));}return{engine,r:engine.runtime,owned};
  }
  async function play(f,uid,target,picks=[]){const submission=f.engine.submitCardPlay(uid,target);await f.engine.idle();const selection=f.r.handSelecting?{act:f.r.handSelecting.act,type:f.r.handSelecting.type,n:f.r.handSelecting.n}:null;for(const pick of picks){f.engine.pickHandSelect(pick);await f.engine.idle()}return{selection,hand:[...f.r.hand],consumed:[...f.r.consumed],armor:f.r.pdef.armor,foeHp:f.r.foes[0].hp,energy:f.r.energy};}
  const normalize=s=>Object.fromEntries(Object.entries(s||{}).filter(([k,v])=>typeof v==='number'&&v!==0).sort());
  const unit=u=>({hp:u.hp,atk:u.atk||0,dead:!!u.dead,status:normalize(u.status),armor:u.defense?.armor||0,shield:u.defense?.shield||0,guard:!!u.defense?.guard});
  const snap=f=>({player:{...unit(f.r.pstat),hp:f.r.G.hp,armor:f.r.pdef.armor,shield:f.r.pdef.shield,guard:!!f.r.pdef.guard},allies:f.r.allies.filter(a=>!a.dead).map(unit),foes:f.r.foes.map(unit),energy:f.r.energy,turn:f.r.turn});
  async function runPlay(f,uid,target=null){const result=f.engine.submitCardPlay(uid,target,true);await Promise.race([f.engine.idle(),new Promise(resolve=>setTimeout(resolve,100))]);if(result.status==='rejected')throw Error(uid+':'+JSON.stringify(result.reason));return result;}
  async function nextTurn(f){const before=f.r.turn;f.engine.endTurn();for(let n=0;n<4000&&(f.r.busy||f.r.turn===before);n++)await new Promise(r=>setTimeout(r,1));if(f.r.busy||f.r.turn===before)throw Error('unsettled turn');await f.engine.idle();}
  const rows=[];
  for(let seed=1;seed<=8;seed++)for(const scenario of ['gate-empty','gate-prefer','gate-purify','gate-other-door']){
    const f=fixture(['tt7-recruit','tt8-hero-summoner'],false,false,seed);f.r.foes[0].atk=0;f.r.set$maxEnergy(10);f.r.set$energy(10);
    await runPlay(f,'o0','self');
    if(['gate-prefer','gate-purify'].includes(scenario))for(const u of [f.r.pstat,...f.r.allies]){Object.assign(u.status,{stealth:2,atkUp:1,spellUp:1,reduce:1});if(scenario==='gate-purify'){u.defense.armor=3;u.status.poison=1;}}
    if(['gate-prefer','gate-purify'].includes(scenario))Object.assign(f.r.pdef,f.r.pstat.defense);
    await runPlay(f,'o1');f.engine.pickChoice(1);await Promise.race([f.engine.idle(),new Promise(r=>setTimeout(r,100))]);await nextTurn(f);
    const after=snap(f);let second,third;if(scenario==='gate-other-door'){await nextTurn(f);second=snap(f);await nextTurn(f);third=snap(f);}
    rows.push({name:scenario,seed,input:f.owned,after,second,third,rng:f.engine.random.snapshot()});f.engine.finish(null);
  }
  for(const scenario of ['recruit-status','recruit-poison-death','recruit-stealth-expiry']){
    const f=fixture(['tt13-mind-control'],false,true,123);f.r.set$maxEnergy(10);f.r.set$energy(10);
    const foe=f.r.foes[0];foe.hp=scenario==='recruit-poison-death'?3:40;foe.maxHp=100;foe.atk=4;foe.defense={armor:5,shield:2,guard:false};Object.assign(foe.status,{poison:2,reduce:1,spellUp:3,freeze:scenario==='recruit-stealth-expiry'?0:1,stealth:scenario==='recruit-stealth-expiry'?1:0});f.r.foes[1].atk=3;
    // A stealthed target is unreachable: apply stealth after the real card's target gate.
    if(scenario==='recruit-stealth-expiry')foe.status.stealth=0;
    await runPlay(f,'o0',0);if(scenario==='recruit-stealth-expiry')f.r.allies[0].status.stealth=1;
    const immediate=snap(f);await nextTurn(f);const after=snap(f);await nextTurn(f);
    rows.push({name:scenario,seed:123,input:f.owned,immediate,after,second:snap(f)});f.engine.finish(null);
  }
  for(let seed=1;seed<=30;seed++){
    const f=fixture(['cmtn1epgt20j'],false,false,seed);f.r.set$maxEnergy(10);f.r.set$energy(10);await runPlay(f,'o0','self');
    const index=f.r.discovering?.options.findIndex(c=>c.id==='tt12-raydragon')??-1;
    if(index<0){f.engine.finish(null);continue;}
    const candidates=f.r.discovering.options.map(c=>c.id);const chosen=f.r.discovering.options[index];f.engine.pickDiscover(index);await f.engine.idle();const entry=f.r.hand.map(uid=>f.engine.findCard(uid)).find(e=>e.card.id===chosen.id);const before=f.r.foes[0].hp;
    for(let i=0;i<1000&&f.r.busy;i++)await new Promise(resolve=>setTimeout(resolve,1));
    if(f.r.busy)throw Error('discovery did not settle '+JSON.stringify(f.r.battleState));
    f.r.set$energy(10);await runPlay(f,entry.uid,0);rows.push({name:'noInfuse-discover',seed,input:f.owned,index,candidates,rng:f.engine.random.snapshot(),chosen:chosen.id,waiver:!!entry.card._noInfuse,damage:before-f.r.foes[0].hp,infusing:!!f.r.infusing,after:snap(f)});f.engine.finish(null);break;
  }
  if(!rows.some(r=>r.name==='noInfuse-discover'))throw Error('need dragon discovery seed');
  fs.writeFileSync(path.join(taskDir,'source-complex.json'),JSON.stringify(rows,null,2));console.log(JSON.stringify({vectors:rows.length,names:rows.map(r=>r.name),last:rows.at(-1)}));
}finally{await server.close();}


