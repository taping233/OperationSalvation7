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
  const allowed=new Set(['damage','heal','armor','curse','cleanse','draw','energy','energyCap','refillEnergy','blessing','status','noDrawNext','freezeFirstEnemies','stealAtk','adjustCurse','registerRule','schedule']);
  function inspect(c){let reason=null;function walk(v){if(!v||typeof v!=='object')return;if(v.op&&!allowed.has(v.op))reason='complex-op:'+v.op;if(v.pick||v.handOps)reason='needs-input:'+Object.keys(v).filter(k=>['pick','handOps'].includes(k)).join(',');for(const x of Object.values(v))walk(x)}walk(c.rules);if(!c.rules||!Array.isArray(c.rules.triggers?.onPlay)&&!c.rules.equip)reason='no-simple-entry';if(c.rules?.bag)reason='bag';if(c.infuse>0||c.rules?.battle?.requirements?.length)reason='requires-materials';if(c.rules?.equip?.battleStart?.length)reason='boss-setup';return reason;}
  const normalizeStatus=s=>Object.fromEntries(Object.entries(s||{}).filter(([k,v])=>typeof v==='number'&&v!==0).sort());
  const zone=(f,pile)=>pile.map(uid=>{const c=f.engine.findCard(uid)?.card;return c?{id:c.id,cost:f.engine.effCostOf(c),dmg:c.dmg||0}:null}).filter(Boolean).sort((a,b)=>a.id.localeCompare(b.id));
  function snap(f){return {hp:f.r.G.hp,energy:f.r.energy,maxEnergy:f.r.maxEnergy,armor:f.r.pdef.armor,shield:f.r.pdef.shield,guard:!!f.r.pdef.guard,status:normalizeStatus(f.r.pstat.status),foes:f.r.foes.map(e=>({hp:e.hp,atk:e.atk,dead:!!e.dead,status:normalizeStatus(e.status),armor:e.defense.armor,shield:e.defense.shield})),hand:zone(f,f.r.hand),deck:zone(f,f.r.drawPile),consumed:zone(f,f.r.consumed)};}
  const rows=[],skipped=[];
  for(const c of cards){const reason=inspect(c);if(reason){skipped.push({id:c.id,reason});continue;}console.log('scan '+c.id);const f=fixture([c]);f.r.set$maxEnergy(10);f.r.set$energy(10);const side=f.engine.targetSide(c)==='self'?'self':0;const submission=f.engine.submitCardPlay('o0',side,true);const idleResult=await Promise.race([f.engine.idle().then(()=>true),new Promise(resolve=>setTimeout(()=>resolve(false),2000))]);if(!idleResult){skipped.push({id:c.id,reason:'awaits-unprepared-input'});f.engine.finish(null);continue;}if(submission.status==='rejected'||f.r.infusing||f.r.handSelecting||f.r.discovering||f.r.choosing||f.r.interaction){skipped.push({id:c.id,reason:'unprepared-runtime:'+submission.status,detail:submission.reason});f.engine.finish(null);continue;}const after=snap(f);let turn=null;const timed=c.rules?.triggers?.onTurnStart?.length||JSON.stringify(c.rules).includes('schedule');if(timed&&f.r.G.battleActive){f.engine.endTurn();for(let n=0;n<2000&&(f.r.busy||f.r.turn===1);n++)await new Promise(r=>setTimeout(r,1));if(f.r.busy||f.r.turn===1)throw Error('unsettled '+c.id);turn=snap(f);}rows.push({id:c.id,input:f.owned,after,turn});f.engine.finish(null);}
  fs.writeFileSync(path.join(taskDir,'scan-source.json'),JSON.stringify({rows,skipped},null,2));console.log(JSON.stringify({tested:rows.length,skipped:skipped.length}));
}finally{await server.close();}


