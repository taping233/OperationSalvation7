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
  function fixture(ids,boss=false){
    const engine=createBattleEngineInstance({cards:Cards,seed:123,readRules:()=>({battleEnergy:2,battleHandMax:8,bossDeckSize:15,starterSha:5,normalStarterDeckSize:5,battleStartDraw:5,battleTurnDraw:1,diceSides:6}),presentation:{demoMs:()=>0,waitMs:async()=>{},waitForFeedback:async()=>{}},testMode:true});
    const owned=ids.map((id,i)=>({uid:'o'+i,card:structuredClone(typeof id==='string'?cards.find(c=>c.id===id):id)}));
    const game={ownedCards:owned,inventory:[],usedPocket:[],hp:30,maxHp:60,atk:4,spellPower:2,coins:0,state:'idle',battleActive:false,myClass:null,log(){},heal(n){this.hp=Math.min(this.maxHp,this.hp+n)},addItem(){},onBattleEnd(){}};
    engine.start(game,[{id:'foe',name:'目标',hp:100,atk:2}],{isBoss:boss});if(boss){for(const entry of owned)if(entry.card.id!=='starter-attack')engine.toggleDeckCard(entry.uid);engine.beginBoss();engine.runtime.set$hand(owned.map(o=>o.uid));engine.runtime.set$drawPile(engine.runtime.drawPile.filter(uid=>!owned.some(o=>o.uid===uid)));}return{engine,r:engine.runtime,owned};
  }
  async function play(f,uid,target,picks=[]){const submission=f.engine.submitCardPlay(uid,target);await f.engine.idle();const selection=f.r.handSelecting?{act:f.r.handSelecting.act,type:f.r.handSelecting.type,n:f.r.handSelecting.n}:null;for(const pick of picks){f.engine.pickHandSelect(pick);await f.engine.idle()}return{selection,hand:[...f.r.hand],consumed:[...f.r.consumed],armor:f.r.pdef.armor,foeHp:f.r.foes[0].hp,energy:f.r.energy};}
  const rows=[];
  const a=fixture(['tt7-thundergrudge','starter-attack','starter-attack']);const starters=a.r.hand.filter(uid=>a.engine.findCard(uid)?.card.id==='starter-attack');rows.push({name:'grudge',input:a.owned,initialHand:[...a.r.hand],out:await play(a,'o0',0,starters.slice(0,2))});a.engine.finish(null);
  const eq=cards.find(c=>c.type==='装备'&&!c.rules?.equip?.battleStart);const b=fixture(['tt2-turtlearmor',eq]);rows.push({name:'armor',input:b.owned,initialHand:[...b.r.hand],out:await play(b,'o0','self',['o1'])});b.engine.finish(null);
  const c=fixture(['tt3-fly-arrowhawk']);c.r.foes[0].status.bleed=3;rows.push({name:'fly',input:c.owned,bleed:3,out:await play(c,'o0',0)});c.engine.finish(null);
  for(const rule of ['bleedAmp','spellCost1','meleeCost1']){
    const custom={id:'custom-'+rule,name:'规则夹具',type:'法术',cost:0,desc:'',rules:{version:1,battle:{target:{side:'self',area:false}},triggers:{onPlay:[{op:'registerRule',rule}]}}};
    const f=fixture([custom,rule==='bleedAmp'?'starter-attack':'tt3-fly-arrowhawk','tt3-nuke-ray']);f.r.foes[0].status.bleed=3;await play(f,'o0','self');const costs=f.owned.slice(1).map(o=>f.engine.effCostOf(o.card));rows.push({name:rule,input:f.owned,costs,out:rule==='bleedAmp'?await play(f,'o1',0):{}});f.engine.finish(null);
  }
  for(const [name,ids,target,picks] of [['grudge-boss',['tt7-thundergrudge','starter-attack','starter-attack'],0,['o1','o2']],['armor-boss',['tt2-turtlearmor',eq],'self',['o1']]]){const f=fixture(ids,true);rows.push({name,input:f.owned,conditionedHand:f.owned.map(o=>o.uid),out:await play(f,'o0',target,picks)});f.engine.finish(null);}
  fs.writeFileSync(path.join(taskDir,'source-results.json'),JSON.stringify(rows,null,2));console.log(JSON.stringify(rows.map(r=>({name:r.name,costs:r.costs,out:r.out}))));
} finally { await server.close(); }



