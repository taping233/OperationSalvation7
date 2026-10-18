import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const root=process.cwd();
const evidence=`${root}/docs/evidence/2026-10-18-WF-deep-runtime-1018/battle`;
const temp=`${root}/.tmp/deep-perf-1018/battle`;
const read=path=>JSON.parse(readFileSync(path,'utf8'));
const source=url=>decodeURIComponent(url.replaceAll('\\','/')).replace(/^file:\/\//,'').split('/game/src/')[1];
const segments=read(`${evidence}/segments.json`);
const output=[];
for(const scene of ['typical','high']){
  const cpu=read(`${temp}/${scene}.cpuprofile`),heap=read(`${temp}/${scene}.heapprofile`);
  const nodes=new Map(cpu.nodes.map(node=>[node.id,node])),parents=new Map();
  for(const node of cpu.nodes)for(const child of node.children||[])parents.set(child,node.id);
  const groups=new Map();let total=0,inspector=0;
  for(let i=0;i<cpu.samples.length;i++){
    const delta=cpu.timeDeltas[i],self=nodes.get(cpu.samples[i]);total+=delta;
    if(self.callFrame.url==='node:inspector'){inspector+=delta;continue;}
    const seen=new Set();let id=self.id;
    while(id){const node=nodes.get(id);const path=source(node.callFrame.url);if(path){const key=`${path}:${node.callFrame.functionName||'(anonymous)'}`;if(!seen.has(key)){groups.set(key,(groups.get(key)||0)+delta);seen.add(key);}}id=parents.get(id);}
  }
  const allocations=new Map();
  function visit(node){let bytes=node.selfSize||0;for(const child of node.children||[])bytes+=visit(child);const path=source(node.callFrame.url);if(path){const key=`${path}:${node.callFrame.functionName||'(anonymous)'}`;if(/:(render|updateHand|showBattleStage|mountUnitLayer|getSnapshot|createBattleSnapshotSignature|previewAction)$/.test(key))allocations.set(key,(allocations.get(key)||0)+bytes);}return bytes;}
  const totalAllocated=visit(heap.head);
  const timings=segments.reports.find(item=>item.name===scene);
  output.push({scene,operations:timings.operations.map(op=>({name:op.name,medianMs:op.medianMs,p95Ms:op.p95Ms,meanCpuMs:op.cpu?.meanMs,segments:op.segments.slice(0,7).map(v=>({name:v.name,msPerOperation:v.msPerOperation,callsPerOperation:v.callsPerOperation}))})),cpu:{totalSampledMs:total/1000,inspectorSelfMs:inspector/1000,gameInclusive:[...groups].map(([source,us])=>({source,ms:us/1000,percentOfNonInspectorSample:us/(total-inspector)*100})).sort((a,b)=>b.ms-a.ms).slice(0,12)},allocation:{samplingInterval:32768,totalSampledAllocatedBytes:totalAllocated,sourceInclusive:[...allocations].map(([source,bytes])=>({source,bytes})).sort((a,b)=>b.bytes-a.bytes)},raw:['cpuprofile','heapprofile'].map(ext=>{const file=`${temp}/${scene}.${ext}`,bytes=readFileSync(file);return{path:`.tmp/deep-perf-1018/battle/${scene}.${ext}`,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')};})});
}
writeFileSync(`${evidence}/profile-summary.json`,`${JSON.stringify({date:'2026-10-18',scope:'24 real renders plus 12 read-only AOE preview sets per scenario; CPU and heap collected separately after warmup',boundaries:'jsdom engine+DOM CPU/allocated objects; no browser layout/paint/GPU. Sampling allocations are estimates including collected objects, not retained bytes/RSS. Inclusive rows overlap and must not be summed.',scenarios:output},null,2)}\n`);
for(const row of output)console.log(JSON.stringify({scene:row.scene,hotspots:row.cpu.gameInclusive.slice(0,5),allocations:row.allocation.sourceInclusive.slice(0,5),renderSegments:row.operations.find(op=>op.name==='render.hp-change').segments}));
