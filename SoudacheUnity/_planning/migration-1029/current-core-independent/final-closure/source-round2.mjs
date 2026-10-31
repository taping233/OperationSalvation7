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
    engine.start(game,(multi?[{id:'foe',name:'目标',hp:100,atk:2},{id:'other',name:'另一个目标',hp:100,atk:2},...(multi===3?[{id:'third',name:'第三目标',hp:100,atk:6}]:[])]:[{id:'foe',name:'目标',hp:100,atk:2}]),{isBoss:boss});if(boss){for(const entry of owned)if(entry.card.id!=='starter-attack')engine.toggleDeckCard(entry.uid);engine.beginBoss();engine.runtime.set$hand(owned.map(o=>o.uid));engine.runtime.set$drawPile(engine.runtime.drawPile.filter(uid=>!owned.some(o=>o.uid===uid)));}return{engine,r:engine.runtime,owned};
  }
  async function play(f,uid,target,picks=[]){const submission=f.engine.submitCardPlay(uid,target);await f.engine.idle();const selection=f.r.handSelecting?{act:f.r.handSelecting.act,type:f.r.handSelecting.type,n:f.r.handSelecting.n}:null;for(const pick of picks){f.engine.pickHandSelect(pick);await f.engine.idle()}return{selection,hand:[...f.r.hand],consumed:[...f.r.consumed],armor:f.r.pdef.armor,foeHp:f.r.foes[0].hp,energy:f.r.energy};}
  const rows=[];
  for(const boss of [false,true]){const f=fixture(['tt7-goldencicada','tt3-sapper-bomb','starter-attack'],boss);const out=await play(f,'o0','self');rows.push({name:'cicada'+(boss?'-boss':''),input:f.owned,out});f.engine.finish(null);}
  const f=fixture(['tt13-scale-armor'],false,true,1);await play(f,'o0','self');f.engine.endTurn();for(let i=0;i<2000&&(f.r.busy||f.r.turn===1);i++)await new Promise(r=>setTimeout(r,1));if(f.r.busy||f.r.turn===1)throw Error('enemy phase did not settle');rows.push({name:'scale',input:f.owned,out:{foes:f.r.foes.map(e=>({id:e.id,hp:e.hp})),hp:f.r.G.hp,hand:f.r.hand.map(uid=>f.engine.findCard(uid)?.card.id),turn:f.r.turn}});f.engine.finish(null);
  const im=fixture(['cmtn233trmeg']);const first=await play(im,'o0',0);const second=await play(im,'o0',0);rows.push({name:'immortal',input:im.owned,out:{first,second}});im.engine.finish(null);
  const dart=fixture(['tt7-bloodpoison'],false,true);const dartFirst=await play(dart,'o0',0);const dartPending=!!dart.r.interaction;dart.engine.resolveDart(1);await dart.engine.idle();rows.push({name:'dart',input:dart.owned,out:{first:dartFirst,pending:dartPending,foes:dart.r.foes.map(e=>({hp:e.hp,bleed:e.status.bleed||0,poison:e.status.poison||0}))}});dart.engine.finish(null);
  const provoke=fixture(['tt7-provoke'],false,3);const firstSelect=provoke.engine.submitCardPlay('o0',1);const secondSelect=provoke.engine.submitCardPlay('o0',2);await provoke.engine.idle();rows.push({name:'provoke',input:provoke.owned,out:{firstStatus:firstSelect.status,foes:provoke.r.foes.map(e=>({hp:e.hp}))}});provoke.engine.finish(null);
  const fu=fixture(['tt3sp-silverthorn','cmtn233trmeg','starter-attack']);const submission=fu.engine.submitCardPlay('o0',0);fu.engine.toggleInfusePick('o1');rows.push({name:'fuel',input:fu.owned,out:{status:submission.status,picked:[...fu.r.infusing.picked],reason:fu.engine.infusionFuelReason('o1')}});fu.engine.finish(null);  fs.writeFileSync(path.join(taskDir,'source-round2-results.json'),JSON.stringify(rows,null,2));console.log(JSON.stringify(rows.map(r=>({name:r.name,out:r.out}))));
} finally { await server.close(); }




