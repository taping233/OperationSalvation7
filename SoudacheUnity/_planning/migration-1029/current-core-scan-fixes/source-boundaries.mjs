import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const taskDir = path.dirname(fileURLToPath(import.meta.url));
const unityRoot = path.resolve(taskDir, '../../..');
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

  const scenarios=[];
  function add(name,id,cfg={}) {scenarios.push({name,id,...cfg});}
  for(const hp of [0,1,11,12,13,30,59,60])add('heal-'+hp,'tt7-holyglow',{hp});
  for(const healban of [0,1,3])add('healban-'+healban,'tt7-holyglow',{hp:5,healban});
  add('heal-max-cap','tt7-holyglow',{hp:3,maxHp:8});
  for(const id of ['tt3-nature-form','tt8-hero-guardian'])for(const energy of [2,10])add(id+'-'+energy,id,{energy});
  for(const freeze of [-2,0,1,4])add('extend-'+freeze,'tt3-firm-barrier',{freeze});
  for(const seed of [0,1,2,123,999,2147483647])for(const id of ['tt3-nuke-ray','tt12-infectray'])add(id+'-'+seed,id,{seed});
  add('replay-draw','tt7-marchrush',{draw:4});
  add('replay-empty','tt7-marchrush',{draw:0});
  add('replay-other','tt7-marchrush',{other:'starter-attack',draw:0});
  add('replay-retained','tt7-marchrush',{other:'cmtn233trmeg',draw:0});
  add('replay-after-empty','tt7-marchrush',{draw:4,other:'starter-attack',consume:true});
  add('replay-async-draw','tt7-marchrush',{draw:4,asyncChoice:true,other:'starter-attack'});
  add('replay-async-empty','tt7-marchrush',{draw:0,asyncChoice:true,other:'starter-attack'});
  const norm=s=>Object.fromEntries(Object.entries(s||{}).filter(([k,v])=>typeof v==='number'&&v!==0).sort());
  const output=[];
  for(const q of scenarios){
    const card=structuredClone(cards.find(c=>c.id===q.id));
    if(q.consume)card.rules.triggers.onPlay.push({op:'consumeHand',all:true,trigger:false});
    if(q.asyncChoice)card.rules.triggers.onPlay.unshift({op:'handSelect',n:1,type:'武术',act:'play'});
    const f=fixture([card,...(q.other?[q.other]:[]),...Array.from({length:q.draw??0},()=> 'starter-attack')],false,false,q.seed??123);
    f.r.set$hand(['o0',...(q.other?['o1']:[])]);
    f.r.set$drawPile(Array.from({length:q.draw??0},(_,i)=>'o'+(i+(q.other?2:1))));f.r.set$discard([]);
    f.r.G.hp=q.hp??30;f.r.G.maxHp=q.maxHp??60;f.r.pstat.status.healban=q.healban??0;
    f.r.foes[0].status.freeze=q.freeze??0;f.r.set$maxEnergy(10);f.r.set$energy(q.energy??10);
    const submission=f.engine.submitCardPlay('o0',f.engine.targetSide(card)==='self'?'self':0,true);await f.engine.idle();
    if(q.asyncChoice){f.engine.pickHandSelect('o1');await f.engine.idle();}
    if(submission.status==='rejected')throw Error(JSON.stringify({q,submission}));output.push({q,input:f.owned,after:{hp:f.r.G.hp,energy:f.r.energy,maxEnergy:f.r.maxEnergy,armor:f.r.pdef.armor,hand:f.r.hand.length,draw:f.r.drawPile.length,status:norm(f.r.foes[0].status)},rng:f.engine.random.snapshot()});
    f.engine.finish(null);
  }
  fs.writeFileSync(path.join(taskDir,'boundary-source.json'),JSON.stringify(output,null,2));console.log(output.length);
}finally{await server.close();}
