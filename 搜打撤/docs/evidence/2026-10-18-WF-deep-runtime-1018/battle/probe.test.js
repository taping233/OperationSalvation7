import { expect, it, vi } from 'vitest';
import { Session } from 'node:inspector';
import { mkdirSync, writeFileSync } from 'node:fs';
import { performance as nodePerf } from 'node:perf_hooks';
import { cpus, platform } from 'node:os';

vi.mock('../../../../game/src/battle/view/battle.presentation-ready.js',()=>({
  createBattleEntryGate:()=>({begin(){},wait(){},cancel(){},dispose(){},pending:()=>false,ready:()=>true}),
  waitForBattleImages:()=>({promise:Promise.resolve(true),cancel(){}}),
}));
vi.mock('../../../../game/src/battle/view/battle.frames.js',()=>({
  attach:()=>Promise.resolve(false),hide(){},cacheStats:()=>({}),play(){},setPaused(){},presentDeath(){},isLiveBattleFigure:()=>false,
}));
const actions=new Map();
const rich=value=>String(value||'').replace(/\[\[icon:[^\]]+\]\]/g,'');
const UI={el:{},_lastMode:null,hideTooltip(){},showTooltip(){},refresh(){},
  act:(name,fn)=>actions.set(name,fn),
  showOverlay(title,html,mode){this.el.ovBody.innerHTML=rich(html);this.el.overlay.hidden=false;this._lastMode=mode;},
  hideOverlay(){this.el.overlay.hidden=true;document.dispatchEvent(new Event('sdt-overlay-close'));},
};
window.SDT={UI,Icons:{img:()=>'',rich,TYPE_ART:{}},Sound:{music(){},sfx(){},setDucked(){},setBoss(){}},
  Art:{has:()=>false,monsterArt:()=>'',classArt:()=>'',cutoutFigures(){},decodeIn(){},warm(){},collectCardAssets:()=>[]},
  Meta:{track(){}},Motion:{reduceMotion:()=>process.env.BATTLE_PROBE_FULL_MOTION!=='1'},
  MAP:{rules:{battleEnergy:9,battleHandMax:99,bossDeckSize:15,starterSha:5,battleStartDraw:5,battleTurnDraw:1},items:{}},
};
const {hudMethods}=await import('../../../../game/src/ui/hud.js');
UI.log=hudMethods.log;
await import('../../../../game/src/cards/cards.js');
const Core=await import('../../../../game/src/battle/core/battle.core.js');
const Engine=await import('../../../../game/src/battle/core/battle.engine.js');
const Runtime=await import('../../../../game/src/battle/runtime/battle.runtime.js');
const {render}=await import('../../../../game/src/battle/view/battle.view.js');
const {previewAction}=await import('../../../../game/src/battle/view/battle.preview.js');
const {forecastEnemyTurn}=await import('../../../../game/src/battle/view/battle.turn-forecast.js');
const {clearFeedback}=await import('../../../../game/src/battle/view/battle.feedback.js');
const {Random}=await import('../../../../game/src/core/random.js');
const C=window.SDT.Cards;
C.ensureSha();C.ensureStarters();C.ensureTabletop();C.ensureDmgTypes();C.ensureEffectFields();
const catalog=C.all();
const baseIds=['tt3-arrow-rain','tt3-blood-arrow','tt3-fatal-pierce','tt3-bandage','tt3-double-shot','tt3-chain-lightning',
  'tt3-armor-rush','tt3-purify-arrow','tt3-wave-slash','tt3-qi-wave','tt3-hold-fast','tt3-venom-arrow','tt3-toxin',
  'tt3-reshot','tt3-frost-slash','tt3-holy-water','tt3-skewer','tt3-holy-shield','tt3-nature-form','tt3-ice-spike',
  'tt3-thornfield','tt3-grope','tt3sp-silverthorn','tt3sp-shadowshot','tt3sp-bloodstorm','tt3-treasure-hunt',
  'tt3-firm-barrier','tt3-execute'];
const outDir=`${process.cwd()}/.tmp/deep-perf-1018/battle`;
const evidenceDir=`${process.cwd()}/docs/evidence/2026-10-18-WF-deep-runtime-1018/battle`;
mkdirSync(outDir,{recursive:true});mkdirSync(evidenceDir,{recursive:true});
let game,frames=[],frameId=0;
function flush(){const batch=frames;frames=[];for(const [,cb] of batch)cb(nodePerf.now());}
async function settle(){
  if(!game?.battleActive)return;
  for(let i=0;i<100;i++){
    flush();await new Promise(resolve=>setTimeout(resolve,0));
    if(!Runtime.busy&&!Core.getSnapshot().actionQueueLength&&!frames.length)return;
  }
  throw new Error('Real action did not settle');
}
function entry(id,index){const card=catalog.find(card=>card.id===id);if(!card)throw new Error(`Missing ${id}`);return{uid:`${id}-${index}`,card:structuredClone(card)};}
async function start(handCount,foeCount){
  clearFeedback();if(game?.battleActive)Core.BattleSession.commands.flee();await settle();frames=[];actions.clear();
  document.body.innerHTML='<section id="logPanel"><div id="log"></div></section><div id="overlay"><div class="card"><h2 id="ovTitle"></h2><div id="ovBody"></div></div></div>';
  UI.el={overlay:document.getElementById('overlay'),ovBody:document.getElementById('ovBody'),ovTitle:document.getElementById('ovTitle'),log:document.getElementById('log'),logPanel:document.getElementById('logPanel')};
  const ids=baseIds.slice(0,handCount);
  const cards=ids.map(entry);cards.push(entry('tt3-longsword',90),entry('tt3-staff',91));
  cards.push(entry('tt4-woodify',100),entry('tt3-mind-potion',101),entry('tt3-mixed-potion',102));
  game={ownedCards:cards,inventory:[],usedPocket:[],hp:80,maxHp:100,atk:4,spellPower:1,coins:0,myClass:'战士',state:'idle',battleActive:false,
    log(...args){UI.log(...args)},heal(n){this.hp=Math.min(this.maxHp,this.hp+n)},addItem(){},onBattleEnd(){}};
  window.SDT.game=game;Random.reseed('deep-battle-perf-1018');
  Core.BattleSession.start(game,Array.from({length:foeCount},(_,i)=>({id:`probe-${i}`,name:`训练靶${i}`,hp:120,maxHp:120,atk:3+i,affix:i===1?'frenzy':null})),{isBoss:false,name:'深测构造场景',devSample:true});
  await settle();
  for(const id of ['tt3-longsword','tt3-staff']){
    Runtime.set$energy(9);const target=game.ownedCards.find(entry=>entry.card.id===id);
    const submitted=Core.commands.submitCardPlay(target.uid,'self',true);expect(submitted.status,JSON.stringify({id,submitted})).not.toBe('rejected');await settle();
  }
  Runtime.set$energy(9);game.hp=80;Runtime.pstat.status.poison=1;Runtime.pdef.armor=3;
  Runtime.foes.forEach((foe,i)=>{foe.status.bleed=i%2;foe.defense.armor=i;});
  render();await settle();
  expect(Core.getSnapshot().hand.length).toBe(handCount);
  expect(Core.getSnapshot().equipped.length).toBe(2);
}
const metrics=new Map();
globalThis.__battleProbe={enter(){return nodePerf.now()},leave(name,start){const r=metrics.get(name)||{calls:0,ms:0};r.calls++;r.ms+=nodePerf.now()-start;metrics.set(name,r)}};
function quantiles(values){const sorted=[...values].sort((a,b)=>a-b);return {n:values.length,meanMs:values.reduce((a,b)=>a+b,0)/values.length,medianMs:sorted[Math.floor(sorted.length/2)],p95Ms:sorted[Math.min(sorted.length-1,Math.ceil(sorted.length*.95)-1)],minMs:sorted[0],maxMs:sorted.at(-1)};}
async function measure(name,operation,{warmup=3,n=15}={}){
  for(let i=0;i<warmup;i++){await operation(i);}
  metrics.clear();const values=[],cpuValues=[];
  for(let i=0;i<n;i++){const cpuBefore=process.cpuUsage();const t=nodePerf.now();await operation(i);values.push(nodePerf.now()-t);const cpu=process.cpuUsage(cpuBefore);cpuValues.push((cpu.user+cpu.system)/1000);}
  const segments=[...metrics].map(([name,v])=>({name,...v,msPerOperation:v.ms/n,callsPerOperation:v.calls/n})).sort((a,b)=>b.ms-a.ms);
  return {name,...quantiles(values),cpu:quantiles(cpuValues),segments};
}
const post=(session,method,params={})=>new Promise((resolve,reject)=>session.post(method,params,(error,result)=>error?reject(error):resolve(result)));
function summarizeProfile(profile){
  const byId=new Map(profile.nodes.map(node=>[node.id,node])),parents=new Map();for(const node of profile.nodes)for(const child of node.children||[])parents.set(child,node.id);
  const self=new Map(),inclusive=new Map();let total=0;
  for(let i=0;i<(profile.samples||[]).length;i++){
    const dt=profile.timeDeltas?.[i]||0;total+=dt;const sample=profile.samples[i];self.set(sample,(self.get(sample)||0)+dt);
    let id=sample;while(id){inclusive.set(id,(inclusive.get(id)||0)+dt);id=parents.get(id);}
  }
  return {sampledMs:total/1000,samples:profile.samples?.length||0,topSelf:[...self].map(([id,us])=>({function:byId.get(id)?.callFrame.functionName||'(anonymous)',url:byId.get(id)?.callFrame.url,line:(byId.get(id)?.callFrame.lineNumber||0)+1,ms:us/1000,percent:us/total*100})).sort((a,b)=>b.ms-a.ms).slice(0,30),topBattleInclusive:[...inclusive].filter(([id])=>byId.get(id)?.callFrame.url.includes('/game/src/battle/')).map(([id,us])=>({function:byId.get(id)?.callFrame.functionName||'(anonymous)',url:byId.get(id)?.callFrame.url,line:(byId.get(id)?.callFrame.lineNumber||0)+1,ms:us/1000,percent:us/total*100})).sort((a,b)=>b.ms-a.ms).slice(0,25)};
}
function summarizeHeap(profile){
  const rows=[];function visit(node){let bytes=node.selfSize||0;for(const child of node.children||[])bytes+=visit(child);if(node.callFrame.url.replaceAll('\\','/').includes('/game/src/'))rows.push({function:node.callFrame.functionName||'(anonymous)',url:node.callFrame.url,line:node.callFrame.lineNumber+1,selfBytes:node.selfSize||0,inclusiveBytes:bytes});return bytes;}
  const sampledAllocatedBytes=visit(profile.head);return{samplingInterval:32768,sampledAllocatedBytes,topGameInclusive:rows.sort((a,b)=>b.inclusiveBytes-a.inclusiveBytes).slice(0,25)};
}
it('profiles bounded real battle operations without a browser',async()=>{
  vi.spyOn(window,'requestAnimationFrame').mockImplementation(cb=>{frames.push([++frameId,cb]);return frameId});
  vi.spyOn(window,'cancelAnimationFrame').mockImplementation(id=>{frames=frames.filter(([key])=>key!==id)});
  Element.prototype.animate=()=>({finished:Promise.resolve(),cancel(){},onfinish:null});
  if(process.env.BATTLE_PROBE_AB==='1'){
    const handCount=+(process.env.BATTLE_PROBE_HAND||28);
    const records=[],warmups=[];let capture=null;const rendered=[];let previousFaces=new Map();
    const faces=()=>new Map([...UI.el.ovBody.querySelectorAll('.bt-card[data-uid]')].map(node=>[node.dataset.uid,node.querySelector('.hs-card')]));
    Core.configureBattleRenderer(snapshot=>{const t=nodePerf.now();render(snapshot);if(capture){capture.renderMs+=nodePerf.now()-t;capture.renderCount++;const current=faces();for(const [uid,node] of current){if(previousFaces.has(uid)){capture.survivingFaces++;if(node===previousFaces.get(uid))capture.retainedFaces++;}}previousFaces=current;rendered.push(UI.el.ovBody.querySelector('.battle-stage')?.outerHTML);}});
    const inner=Object.getOwnPropertyDescriptor(Element.prototype,'innerHTML');
    Object.defineProperty(Element.prototype,'innerHTML',{...inner,set(value){if(capture&&this.classList?.contains('bt-card'))capture.cardInnerHTMLWrites++;return inner.set.call(this,value)}});
    const run=async(variant,id,round)=>{
      globalThis.__battleCandidate=variant==='candidate';await start(handCount,4);
      // Each pair starts on the first existing hand page before the timed input.
      for(let i=0;i<4&&!UI.el.ovBody.querySelector('[data-act="btHandPage"]')?.getAttribute('aria-label')?.includes('第 1 栏');i++)actions.get('btHandPage')?.({});
      const uid=Runtime.hand.find(uid=>Engine.findEffectiveCard(uid)?.card.id===id);
      const side=Engine.targetSide(Engine.findEffectiveCard(uid).card)==='self'?'self':0;
      capture={variant,id,round,renderMs:0,renderCount:0,cardInnerHTMLWrites:0,survivingFaces:0,retainedFaces:0};rendered.length=0;previousFaces=faces();
      const cpuBefore=process.cpuUsage();const t=nodePerf.now();const submission=Core.commands.submitCardPlay(uid,side,true);await settle();capture.wallMs=nodePerf.now()-t;const cpu=process.cpuUsage(cpuBefore);capture.cpuMs=(cpu.user+cpu.system)/1000;
      expect(submission.status).toBe('queued');expect(Runtime.hand.includes(uid)).toBe(false);
      const row={...capture,snap:structuredClone({energy:Runtime.energy,foes:Runtime.foes.map(f=>({hp:f.hp,dead:f.dead,status:f.status,defense:f.defense})),pdef:Runtime.pdef,hand:Runtime.hand}),html:[...rendered]};capture=null;return row;
    };
    const ids=['tt3-blood-arrow','tt3-arrow-rain','tt3-bandage','tt3-chain-lightning'];
    for(const variant of ['baseline','candidate'])for(const id of ids)warmups.push(await run(variant,id,-1));
    for(let round=0;round<5;round++)for(const id of ids){
      const pair=[];for(const variant of round%2?['candidate','baseline']:['baseline','candidate'])pair.push(await run(variant,id,round));
      const a=pair.find(row=>row.variant==='baseline'),b=pair.find(row=>row.variant==='candidate');
      expect(b.snap).toEqual(a.snap);expect(b.html).toEqual(a.html);records.push(...pair.map(({html,snap,...row})=>row));
    }
    const summary=['baseline','candidate'].map(variant=>{const rows=records.filter(row=>row.variant===variant);return{variant,operations:rows.length,wall:quantiles(rows.map(row=>row.wallMs)),cpu:quantiles(rows.map(row=>row.cpuMs)),render:quantiles(rows.map(row=>row.renderMs)),renderCounts:[...new Set(rows.map(row=>row.renderCount))],cardInnerHTMLWritesPerPlay:[...new Set(rows.map(row=>row.cardInnerHTMLWrites))],retainedFaces:rows.reduce((n,row)=>n+row.retainedFaces,0),survivingFaces:rows.reduce((n,row)=>n+row.survivingFaces,0)}});
    writeFileSync(`${evidenceDir}/hand-hint-ab-${handCount}.json`,`${JSON.stringify({date:'2026-10-18',load:{hand:handCount,foes:4,equips:2,potions:3,reduceMotion:window.SDT.Motion.reduceMotion()},warmups:warmups.length,sameSnapshotAndFullStageHTML:true,alternatingOrder:true,summary,records},null,2)}\n`);console.log(JSON.stringify({summary}));
    clearFeedback();if(game?.battleActive)Core.commands.flee();await settle();Object.defineProperty(Element.prototype,'innerHTML',inner);vi.restoreAllMocks();delete globalThis.__battleCandidate;delete globalThis.__battleProbe;return;
  }
  const reports=[];
  for(const spec of [{name:'typical',hand:12,foes:2},{name:'high',hand:28,foes:4}]){
    await start(spec.hand,spec.foes);
    const areaUid=Runtime.hand.find(uid=>Engine.findEffectiveCard(uid)?.card.id==='tt3-arrow-rain');
    const singleUid=Runtime.hand.find(uid=>Engine.findEffectiveCard(uid)?.card.id==='tt3-blood-arrow');
    const operations=[];
    operations.push(await measure('snapshot.cache-hit',()=>{Core.getSnapshot()}));
    operations.push(await measure('snapshot.changed',i=>{game.hp=80-i%2;Core.getSnapshot()}));
    operations.push(await measure('availability.whole-hand',()=>{for(const uid of Runtime.hand)Core.commands.getCardPlayAvailability(uid,0,true)}));
    operations.push(await measure('preview.single',()=>{const snapshot=Core.getSnapshot();const cardContext=Core.viewApi.getPreviewContext(singleUid,0);Core.commands.getCardPlayAvailability(singleUid,0,true);previewAction({snapshot,action:{uid:singleUid,targetIndex:0},cardContext})}));
    operations.push(await measure('preview.all-targets',()=>{const snapshot=Core.getSnapshot();for(let targetIndex=0;targetIndex<spec.foes;targetIndex++){const cardContext=Core.viewApi.getPreviewContext(areaUid,targetIndex);Core.commands.getCardPlayAvailability(areaUid,targetIndex,true);previewAction({snapshot,action:{uid:areaUid,targetIndex},cardContext})}}));
    operations.push(await measure('forecast.enemy-turn',()=>{forecastEnemyTurn(Core.getSnapshot())}));
    operations.push(await measure('render.no-change',()=>{render()}));
    operations.push(await measure('render.hp-change',i=>{game.hp=78-i%2;render()}));
    operations.push(await measure('render.hand-page',()=>{actions.get('btHandPage')?.({})}));
    operations.push(await measure('log.single-line',i=>{game.log(`[[icon:swords]] 【<b>血箭</b>】对训练靶${i%spec.foes}造成 <b>5</b> 点伤害`,'ok')}));
    const session=new Session();session.connect();await post(session,'Profiler.enable');await post(session,'Profiler.setSamplingInterval',{interval:250});await post(session,'Profiler.start');
    for(let i=0;i<12;i++){game.hp=75-i%2;render();const snapshot=Core.getSnapshot();for(let targetIndex=0;targetIndex<spec.foes;targetIndex++)previewAction({snapshot,action:{uid:areaUid,targetIndex},cardContext:Core.viewApi.getPreviewContext(areaUid,targetIndex)});actions.get('btHandPage')?.({});}
    const {profile}=await post(session,'Profiler.stop');writeFileSync(`${outDir}/${spec.name}.cpuprofile`,JSON.stringify(profile));
    await post(session,'HeapProfiler.startSampling',{samplingInterval:32768,includeObjectsCollectedByMajorGC:true,includeObjectsCollectedByMinorGC:true});
    for(let i=0;i<12;i++){game.hp=75-i%2;render();const snapshot=Core.getSnapshot();for(let targetIndex=0;targetIndex<spec.foes;targetIndex++)previewAction({snapshot,action:{uid:areaUid,targetIndex},cardContext:Core.viewApi.getPreviewContext(areaUid,targetIndex)});actions.get('btHandPage')?.({});}
    const {profile:heap}=await post(session,'HeapProfiler.stopSampling');session.disconnect();writeFileSync(`${outDir}/${spec.name}.heapprofile`,JSON.stringify(heap));
    const p=Core.getSnapshot();reports.push({...spec,handIds:Runtime.hand.map(uid=>Engine.findEffectiveCard(uid).card.id),equipped:p.equipped.map(e=>e.name),potions:p.potionBar.length,operations,profile:summarizeProfile(profile),allocation:summarizeHeap(heap)});
    console.log(JSON.stringify({scenario:spec.name,operations:operations.map(({name,medianMs,p95Ms})=>({name,medianMs,p95Ms}))}));
  }
  // Real submission and all synchronous/microtask settlement, including rendering;
  // presentation waits are intentionally disabled by the production VITEST clock branch.
  const plays=[];
  for(const id of ['tt3-blood-arrow','tt3-arrow-rain','tt3-bandage','tt3-chain-lightning']){
    await start(28,4);const uid=Runtime.hand.find(uid=>Engine.findEffectiveCard(uid)?.card.id===id);const side=Engine.targetSide(Engine.findEffectiveCard(uid).card)==='self'?'self':0;
    metrics.clear();const cpuBefore=process.cpuUsage();const t=nodePerf.now();const result=Core.commands.submitCardPlay(uid,side,true);await settle();const wallMs=nodePerf.now()-t,cpu=process.cpuUsage(cpuBefore);expect(result.status).not.toBe('rejected');
    plays.push({id,status:result.status,wallMs,cpuMs:(cpu.user+cpu.system)/1000,handRemoved:!Runtime.hand.includes(uid),segments:[...metrics].map(([name,v])=>({name,...v})).sort((a,b)=>b.ms-a.ms)});
  }
  clearFeedback();if(game?.battleActive)Core.commands.flee();await settle();
  const report={date:'2026-10-18',instrumented:process.env.BATTLE_PROBE_INSTRUMENT==='1',environment:{node:process.version,platform:platform(),cpu:cpus()[0]?.model,cpus:cpus().length},boundaries:{core:'actual BattleSession/Combat/cards/availability/snapshot/preview/render modules',graphics:'frame renderer, image entry gate, audio, artwork URLs stubbed; jsdom has no layout/paint/GPU',ui:'actual battle layers; host overlay/HUD refresh stubbed; actual hudMethods.log with bounded60lines',presentation:'production VITEST branch resolves presentation waits immediately; no user-visible pace conclusion',load:'2foes/12hand and4foes/28hand;2equips applied via real commands,3potions,9energy; bounded15samples per operation'},reports,plays};
  const name=report.instrumented?'segments':'baseline';writeFileSync(`${evidenceDir}/${name}.json`,`${JSON.stringify(report,null,2)}\n`);
  vi.restoreAllMocks();delete globalThis.__battleProbe;
});
