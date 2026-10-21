import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
const root = process.argv[2] || '/workspace/scratch/b7a53a06c872/performance-e817a3aa-integration/搜打撤';
const require = createRequire(root + '/package.json');
const { JSDOM } = require('jsdom');
const acorn = require('acorn');
const input = ['battle.layers.js','battle.effect-feedback.js'].map(name => ({name, source:fs.readFileSync(`${root}/game/src/battle/view/${name}`,'utf8')}));
const hashes = input.map(({name,source})=>({name,sha256:createHash('sha256').update(source).digest('hex')}));
const operations = {};
let counting = false;
const bump = key => { if (counting) operations[key] = (operations[key] || 0) + 1; };
const site = () => new Error().stack.split('\n').find(line => /battle\.(layers|effect-feedback)\.js:\d/.test(line))?.trim();
class CountedMap extends Map { constructor(...args) { super(...args); bump('Map ' + site()); } }
class CountedSet extends Set { constructor(...args) { super(...args); bump('Set ' + site()); } }
const dom = new JSDOM('<div id="overlay"><div id="body"><div class="battle-stage sts"><div class="sts-hud"><div class="sts-hand"></div></div><button class="bt-hand-page" aria-label="当前第 1 栏，共 2 栏">第1/2栏</button></div></div></div>');
const {window} = dom;
const UI = {el:{overlay:window.document.querySelector('#overlay'),ovBody:window.document.querySelector('#body')},hideTooltip(){}};
const timers = [];
window.SDT = { UI, Icons:{rich:s=>s}, Cards:{cardHTML:c=>`<div class="hs-card"><p class="hsc-desc">${c.desc}</p></div>`}, Motion:{reduceMotion:()=>false} };
const context = vm.createContext({ window, document:window.document, MutationObserver:window.MutationObserver,
  Map:CountedMap, Set:CountedSet, console,
  __array:(label,value)=>{bump('Array '+label);return value;},
  getSnapshot:()=>context.snapshot, commands:{},
  createHandHitController:()=>({sync(){},reset(){}}),
  uiRect:()=>({left:0,top:0,width:1920,height:1080}), uiScale:()=>1,
  referenceHandLayout:(i,n)=>({x:i*100,y:0,rot:0,scale:1,index:i}),
  effCostOf:c=>c.cost, unplayableReason:()=>'', infusionFuelReason:()=>'',
  targetSide:()=>null, infuseOf:()=>0, cardRuleHint:()=>'', isAreaEffect:()=>false, requiresInfusion:()=>false,
  handCurseSpecs:()=>[], Combat:{}, aim:null, clickSelectedUid:null, clickSelectedTarget(){},
  syncSubmittedCardPoses(){}, animateSafe(){},
  schedulePresentationMs:(f,ms)=>{timers.push({f,ms});return ()=>{};},
  createAcquisitionIcon:()=>window.document.createElement('i'),
  isHandArrivalEvent:event=>event?.kind==='draw'&&!['pouch','discover-cast','effect-cast'].includes(event.source),
});
function instrument(source,name) {
  const ast=acorn.parse(source,{ecmaVersion:'latest',sourceType:'module',locations:true});
  const edits=[];
  function walk(node) {
    if (!node || typeof node !== 'object') return;
    if (node.type==='ArrayExpression' || (node.type==='CallExpression'&&node.callee.type==='MemberExpression'&&!node.callee.computed&&['filter','map','flatMap','slice','concat'].includes(node.callee.property.name))) {
      const kind=node.type==='ArrayExpression'?'literal':node.callee.property.name;
      edits.push({pos:node.start,text:`__array(${JSON.stringify(name+':'+node.loc.start.line+':'+kind)},`},{pos:node.end,text:')'});
    }
    for (const key of Object.keys(node)) {
      if (['start','end','loc'].includes(key)) continue;
      if(Array.isArray(node[key])) node[key].forEach(walk);else walk(node[key]);
    }
  }
  walk(ast);
  for(const edit of edits.sort((a,b)=>b.pos-a.pos)) source=source.slice(0,edit.pos)+edit.text+source.slice(edit.pos);
  return source.replace(/^import [^\n]*;[ \t]*$/gm,'').replace(/import\.meta\.hot/g,'false').replace(/^export \{[^\n]*\};[ \t]*$/gm,'').replace(/export function /g,'function ');
}
const effect = input.find(x=>x.name==='battle.effect-feedback.js');
vm.runInContext(instrument(effect.source,effect.name)+'\nglobalThis.updateHandAcquisitionFeedback=updateHandAcquisitionFeedback;',context,{filename:effect.name});
const layers = input.find(x=>x.name==='battle.layers.js');
vm.runInContext('{\n'+instrument(layers.source,layers.name)+'\nglobalThis.mountHandLayer=mountHandLayer;globalThis.updateHand=updateHand;\n}',context,{filename:layers.name,lineOffset:-1});
vm.runInContext(`
  globalThis.snapshot={battleToken:1,hand:[],energy:9,drawPile:[],discard:[],busy:false};
  globalThis.groups=Array.from({length:9},(_,i)=>({key:'group-'+i,card:{id:'card-'+i,name:'测试'+i,type:'法术',cost:0,desc:''},uids:['uid-'+i]}));
  snapshot.hand=groups.flatMap(g=>g.uids);
  mountHandLayer(document.querySelector('#body'),'',1);
  updateHand(snapshot,null,groups,[],{mode:'normal'});
`,context);
const before=UI.el.ovBody.innerHTML;
counting=true;
vm.runInContext('for(let i=0;i<20;i++) updateHand(snapshot,null,groups,[],{mode:"normal"});',context);
counting=false;
const unchanged=before===UI.el.ovBody.innerHTML;
const ranges = Object.fromEntries(input.map(({name,source}) => {
  const first = source.indexOf(name === 'battle.layers.js' ? 'const previousUids' : 'const held = new Set');
  const last = name === 'battle.layers.js' ? source.indexOf(';', first) : source.indexOf('\n  const button = stage.querySelector', first);
  return [name, [source.slice(0, first).split('\n').length, source.slice(0, last).split('\n').length]];
}));
const target = Object.fromEntries(Object.entries(operations).filter(([key])=> {
  const m=key.match(/battle\.(layers|effect-feedback)\.js:(\d+)/);
  if (!m) return false;
  const [first,last] = ranges['battle.' + m[1] + '.js'];
  return Number(m[2]) >= first && Number(m[2]) <= last;
}));
console.log(JSON.stringify({description:'Executed current production mountHandLayer/updateHand and full production acquisition feedback in jsdom. Dependencies limited to rendering/core/animation test doubles; target function bodies and lifecycle execute without behavior changes, only allocation observers. Array literals and array-returning calls are AST wrapped; Map and Set construction observed by subclasses. No browser/FPS claim.',hashes,repeats:20,groups:9,domUnchanged:unchanged,target,totalTarget:Object.entries(target).reduce((a,[k,v])=>{a[k.split(' ')[0]]=(a[k.split(' ')[0]]||0)+v;return a;},{Array:0,Set:0,Map:0}),allObserved:operations},null,2));
window.close();
