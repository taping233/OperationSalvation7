import { describe,it,expect,vi } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createCurrentLayeredMap } from '../game/src/run/layeredMap.js';
import { applyRouteOverlay } from '../game/src/ui/route-overlay.js';
import { applyGuardedRoute,validateGuardedRoute,routeBaseFingerprint,MAX_ROUTE_ASSIGNMENTS,MAX_ROUTE_WITNESSES } from '../game/src/run/map-route-v2.js';
import { createMapSnapshot,planMapRestore,validateMapSnapshot } from '../game/src/run/map-snapshot.js';
import { Random } from '../game/src/core/random.js';
import { V4_MAP_TYPE_BUDGETS } from '../game/src/run/map-generation-rules.js';
const base = seed => applyRouteOverlay({generatorVersion:6,layoutVersion:9,layerData:createCurrentLayeredMap(seed)}).value;
const apply = old => applyGuardedRoute({generatorVersion:6,layoutVersion:9,layerData:old.layerData,baseRoutePlan:old.routePlan});
const map = seed => apply(base(seed)).value;
const snapshot = (seed,value=map(seed)) => createMapSnapshot({mapSeed:seed,generatorVersion:6,layoutVersion:9,...value}).value;
const samples = Array.from({length:200},(_,i)=>`audit-map-20261017-${i}`);
const appliedSeed = samples.find(seed => { const value=map(seed); return value.status==='applied' && value.routePlan.swaps.length && value.routePlan.removedEdges.length; });
const fallbackSeed = samples.find(seed => map(seed).status==='fallback');
const same = layers => layers.map(layer => layer.logical.map(cell => [cell.id,cell.x,cell.row,cell.def,cell.next]));
function longest(layer) {
  const allowed=new Set(['chest','event','resource','fire','shop']);let best=0;
  function walk(i,path){best=Math.max(best,path.length);for(const[li,j]of layer.nodes[i].next)if(li===1&&!path.includes(j)&&allowed.has(layer.nodes[j].type))walk(j,[...path,j]);}
  layer.nodes.forEach((n,i)=>{if(allowed.has(n.type))walk(i,[i]);});return best;
}
function inverse(snapshot) {
  const layers=structuredClone(snapshot.layers),l=layers[1],idx=id=>l.nodes.findIndex(n=>n.id===id);
  for(const s of snapshot.routePlan.swaps||[]){l.nodes[idx(s.aNodeId)].def=s.beforeA;l.nodes[idx(s.bNodeId)].def=s.beforeB;}
  for(const e of snapshot.routePlan.removedEdges||[]){const a=idx(e.aNodeId),b=idx(e.bNodeId);l.nodes[a].next.push([1,b]);l.nodes[b].next.push([1,a]);}
  return layers;
}
function witness(before,value) {
  const plan=value.routePlan, l=value.layerData[1], n=l.nodes, lookup=id=>n.findIndex(node=>node.id===id);
  const edges=n.map(node=>node.next.filter(([li])=>li===1).map(([,i])=>i));
  function distance(start,blocked=new Set()){const d=n.map(()=>Infinity),q=[start];d[start]=0;for(let i=0;i<q.length;i++)for(const j of edges[q[i]])if(!blocked.has(j)&&d[j]===Infinity){d[j]=d[q[i]]+1;q.push(j);}return d;}
  function cost(layer){const d=layer.nodes.map(()=>Infinity),q=[layer.entrances[0]];d[q[0]]=0;while(q.length){q.sort((a,b)=>d[a]-d[b]);const i=q.shift();for(const[li,j]of layer.nodes[i].next){if(li!==1)continue;const next=d[i]+Number(layer.nodes[j].type==='battle');if(next<d[j]){d[j]=next;q.push(j);}}}return d[layer.exit];}
  const fork=lookup(plan.forkNodeId),guard=lookup(plan.guardNodeId),reward=lookup(plan.rewardNodeId),fire=lookup(plan.recoveryNodeId);
  expect(n[guard].type).toBe('battle');expect(n[fire].type).toBe('shop');expect(['resource','chest']).toContain(n[reward].type);
  expect(edges[reward]).toEqual([guard]);expect(edges[fork]).toContain(guard);expect(edges[fork]).toContain(fire);
  expect(distance(l.entrances[0],new Set([guard]))[reward]).toBe(Infinity);expect(distance(l.exit,new Set([guard]))[reward]).toBe(Infinity);
  expect(Number.isFinite(distance(l.entrances[0],new Set([guard,fire]))[fork])).toBe(true);
  expect(Number.isFinite(distance(l.entrances[0],new Set([guard]))[l.exit])).toBe(true);
  expect(cost(l)).toBe(cost(before.layerData[1]));
  expect(longest(l)).toBeLessThanOrEqual(longest(before.layerData[1]));
  expect(plan.swaps.length).toBeLessThanOrEqual(1);expect(plan.removedEdges.length).toBeLessThanOrEqual(2);
  expect(n.reduce((o,node)=>(o[node.type]=(o[node.type]||0)+1,o),{})).toEqual({entrance:1,door:1,battle:3,chest:2,event:2,resource:1,shop:1});
  for(const node of n){expect(l.logical[node.idx].def.type).toBe(node.type);expect(l.logical[node.idx].fire).toBe(node.type==='fire');for(const[li,j]of node.next)expect(value.layerData[li].nodes[j].next).toContainEqual([1,node.idx]);}
  expect(n.map(node=>[node.id,node.x,node.row])).toEqual(before.layerData[1].nodes.map(node=>[node.id,node.x,node.row]));
  for(const li of [0,2,3])expect(value.layerData[li]).toEqual(before.layerData[li]);
}

describe('L2有战斗门槛与休整时序的route-v2',()=>{
  it('500种子有界确定性，不改预算/双向/位置，回退逐字保原图',()=>{
    let count=0;
    for(let i=0;i<500;i++){
      const seed=`audit-map-20261017-${i}`,old=base(seed),before=JSON.stringify(old),result=apply(old);
      expect(result.ok).toBe(true);expect(result.value.routeVersion).toBe('r5-routes-v2');
      expect(result.diagnostics.assignments).toBeLessThanOrEqual(MAX_ROUTE_ASSIGNMENTS);expect(result.diagnostics.witnesses).toBeLessThanOrEqual(MAX_ROUTE_WITNESSES);
      expect(result.diagnostics.pacingChecks).toBeLessThanOrEqual(result.diagnostics.witnesses);
      expect(JSON.stringify(old)).toBe(before);
      if(result.value.status==='applied'){witness(old,result.value);count++;}
      else{expect(same(result.value.layerData)).toEqual(same(old.layerData));expect(['NO_VALID_FORK','DISTANCE_LIMIT','PACING_LIMIT']).toContain(result.value.routePlan.fallbackReason);}
      expect(validateGuardedRoute(result.value.layerData,result.value.routePlan).ok).toBe(true);
    }
    expect(count).toBeGreaterThan(100);expect(count).toBeLessThan(500);
  });
  it('相同输入逐字相同，不消费对局或环境随机',()=>{
    const old=base('audit-map-20261017-0');Random.reseed('route-rng');const before=Random.snapshot();
    const spy=vi.spyOn(Math,'random').mockImplementation(()=>{throw Error('不允许环境随机');});
    try{expect(apply(old)).toEqual(apply(old));expect(Random.snapshot()).toEqual(before);}finally{spy.mockRestore();}
  });
  it('新快照应用/回退均逐字往返，读档保位置与原对象',()=>{
    for(const seed of ['audit-map-20261017-0','audit-map-20261017-1','audit-map-20261017-2']){
      const made=snapshot(seed),run={mapSeed:seed,generatorVersion:6,layoutVersion:9,routeVersion:'r5-routes-v2',layerIdx:1,trackPos:3,mapSnapshot:made},before=JSON.stringify(run);
      const restored=planMapRestore(run);expect(restored.ok).toBe(true);expect(createMapSnapshot(restored.value).value).toEqual(made);expect(JSON.stringify(run)).toBe(before);
    }
  });
  it('严格拒绝坏计划、隐瞒删边、类型伪造、旧协议前态与未知路线身份',()=>{
    const good=snapshot(appliedSeed);expect(good.routePlan.swaps).toHaveLength(1);
    const cases=[
      s=>{s.routeVersion='r5-routes-v999';},s=>{s.generatorVersion=3;},s=>{s.routePlan.extra=true;},
      s=>{s.routePlan.baseFingerprint='v1:0000000000000000';},s=>{s.routePlan.guardNodeId=s.routePlan.rewardNodeId;},
      s=>{s.routePlan.swaps.push(s.routePlan.swaps[0]);},s=>{s.routePlan.swaps[0].beforeA.type='altar';},
      s=>{s.routePlan.swaps[0].beforeA.name='篡改前态';},s=>{s.routePlan.swaps=[];},
      s=>{s.routePlan.removedEdges=[];},s=>{s.routePlan.baseRoutePlan.extra=true;},
      s=>{s.routePlan.baseRoutePlan={layerIndex:1,status:'applied'};},
      s=>{const p=s.routePlan,l=s.layers[1],r=l.nodes.findIndex(n=>n.id===p.rewardNodeId),f=l.nodes.findIndex(n=>n.id===p.forkNodeId);l.nodes[r].next.push([1,f]);l.nodes[f].next.push([1,r]);},
    ];
    for(const alter of cases){const bad=structuredClone(good);alter(bad);const before=JSON.stringify(bad);expect(validateMapSnapshot(bad)).toMatchObject({ok:false,preserveRun:true});expect(JSON.stringify(bad)).toBe(before);}
    const fallback=snapshot(fallbackSeed);fallback.routePlan.fallbackReason='fabricated';expect(validateMapSnapshot(fallback).ok).toBe(false);
  });
  it('4/9已开始的v1快照身份与地图不变；生成器和兼容覆盖源逐字冻结',()=>{
    const previousMaps=JSON.parse(readFileSync('tests/fixtures/map-v4-before-resource-removal.json','utf8'));
    for(const made of previousMaps){
      const restored=planMapRestore({mapSeed:made.mapSeed,generatorVersion:4,layoutVersion:9,routeVersion:made.routeVersion,mapSnapshot:made,layerIdx:1,trackPos:0});
      expect(restored.ok).toBe(true);expect(restored.value.generatorVersion).toBe(4);expect(createMapSnapshot(restored.value).value).toEqual(made);
      const previous=validateGuardedRoute(made.layers,made.routePlan,false,V4_MAP_TYPE_BUDGETS,false);
      const v1={...made,layers:previous.baseLayers,routeVersion:'r5-routes-v1',routePlan:made.routePlan.baseRoutePlan};
      expect(validateMapSnapshot(v1).ok).toBe(true);
    }
    const protectedFiles={'game/src/run/layeredMap.js':'a9bd0bea6807d6402c811aedf658a66e38f0a0e545982ff3bf10459187a671ab','game/src/ui/route-overlay.js':'89e7c2a4b0c952e7de0327df85100f9fffb7bed2dd6eeb491ddd9c282b69eb21'};
    for(const[path,hash]of Object.entries(protectedFiles))expect(createHash('sha256').update(readFileSync(path,'utf8').replaceAll('\r\n','\n')).digest('hex')).toBe(hash);
  });
  it('指纹不受next数组顺序变化影响，但边或类型改变一定被本例拒绝',()=>{
    const old=base('audit-map-20261017-0'),copy=structuredClone(old.layerData);copy.forEach(l=>l.nodes.forEach(n=>n.next.reverse()));
    expect(routeBaseFingerprint(copy)).toBe(routeBaseFingerprint(old.layerData));copy[1].nodes[0].name+='改';expect(routeBaseFingerprint(copy)).not.toBe(routeBaseFingerprint(old.layerData));
  });
  it('逆前态全层与回退均拒未申报删边，即使重算指纹',()=>{
    for(const seed of [appliedSeed,fallbackSeed]) for(const li of [0,1,2,3]) {
      const bad=snapshot(seed),l=bad.layers[li];
      const a=l.nodes.findIndex(n=>n.next.some(([to])=>to===li));
      const b=l.nodes[a].next.find(([to])=>to===li)[1];
      l.nodes[a].next=l.nodes[a].next.filter(([x,y])=>x!==li||y!==b);
      l.nodes[b].next=l.nodes[b].next.filter(([x,y])=>x!==li||y!==a);
      bad.routePlan.baseFingerprint=routeBaseFingerprint(inverse(bad));const before=JSON.stringify(bad);
      expect(validateMapSnapshot(bad)).toMatchObject({ok:false,preserveRun:true});
      expect(JSON.stringify(bad)).toBe(before);
    }
  });
  it('拒额外跨层门直入奖励和被改接的门、入口出口语义、门元数据',()=>{
    const good=snapshot(appliedSeed);
    const cases=[
      s=>{const reward=s.layers[1].nodes.findIndex(n=>n.id===s.routePlan.rewardNodeId);s.layers[0].nodes[0].next.push([1,reward]);s.layers[1].nodes[reward].next.push([0,0]);s.layers[0].doors.push({pair:'extra-bypass',at:0,toLayer:1,arriveAt:reward,exit:false});},
      s=>{s.layers[0].doors[0].pair='fake';},s=>{s.layers[0].doors[0].exit=true;},
      s=>{s.layers[0].entrances=[1];},s=>{s.layers[0].entrances.push(1);s.layers[0].entranceNames.push('fake');},
      s=>{s.layers[3].exit=s.layers[3].nodes.findIndex(n=>n.def.type==='chest');},
      s=>{const a=s.layers[0],b=s.layers[1],at=a.exit,to=b.nodes.findIndex(n=>n.id===s.routePlan.rewardNodeId);a.nodes[at].next=a.nodes[at].next.filter(([li])=>li!==1);b.nodes[b.entrances[0]].next=b.nodes[b.entrances[0]].next.filter(([li])=>li!==0);a.nodes[at].next.push([1,to]);b.nodes[to].next.push([0,at]);a.doors[0].arriveAt=to;},
    ];
    for(const alter of cases){const bad=structuredClone(good);alter(bad);bad.routePlan.baseFingerprint=routeBaseFingerprint(inverse(bad));const before=JSON.stringify(bad);expect(validateMapSnapshot(bad)).toMatchObject({ok:false,preserveRun:true});expect(JSON.stringify(bad)).toBe(before);}
  });
  it('设施配额改变后仍拒绝增加非战最长路径的候选',()=>{
    const seed=samples.find(seed=>apply(base(seed)).diagnostics.pacingRejected>0);
    expect(seed).toBeDefined();
    const before=base(seed),result=apply(before);
    expect(result.diagnostics.pacingRejected).toBeGreaterThan(0);
    expect(longest(result.value.layerData[1])).toBeLessThanOrEqual(longest(before.layerData[1]));
    expect(validateGuardedRoute(result.value.layerData,result.value.routePlan).ok).toBe(true);
    expect(validateMapSnapshot(snapshot(seed,result.value)).ok).toBe(true);
  });
});
