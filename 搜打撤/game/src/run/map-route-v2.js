/* 新局 L2 局部路线：最多一对换位、两对双向删边。基础 4/9 与旧路线协议均不改。 */
import { clone } from '../core/shared.js';
import { hashSeed } from '../core/random-core.js';
import { CURRENT_GENERATOR_VERSION, validateCurrentGeneratedMap, MAP_TYPE_BUDGETS, PREVIOUS_MAP_TYPE_BUDGETS, graphDistances as distances } from './map-generation-rules.js';

export const GUARDED_ROUTE_VERSION = 'r5-routes-v2';
export const MAX_ROUTE_ASSIGNMENTS = 46; // 10 个非出入口节点：原图 + C(10,2)
export const MAX_ROUTE_WITNESSES = 2208; // 46 × 3 个奖励 × 4 个邻居 × 4 个叉口候选
const REASONS = new Set(['NO_VALID_FORK', 'DISTANCE_LIMIT', 'PACING_LIMIT', 'FINAL_QUALITY_REJECTED']);
const MUTABLE = new Set(['battle', 'chest', 'event', 'resource', 'fire', 'shop']);
const NONCOMBAT = new Set(['chest', 'event', 'resource', 'fire', 'shop']);
const exact = (o, keys) => o && typeof o === 'object' && !Array.isArray(o)
  && Object.keys(o).length === keys.length && keys.every(k => Object.hasOwn(o, k));
const definition = n => n.def || { type:n.type, name:n.name, extraction:!!n.extraction };
const sameDefinition = (a,b) => ['type','name','extraction'].every(k => a[k] === b[k]);
const raw = layers => layers.map((l, li) => ({ ...l, entry:l.entry ?? l.entrances?.[0],
  nodes:l.nodes.map((n, idx) => ({ ...n, li, idx, ...definition(n) })) }));
const adjacent = layer => layer.nodes.map(n => n.next.filter(([li]) => li === 1).map(([, idx]) => idx));

// 只用于新 v2 的逆前态：四层均须是冻结基础图，且仅有三对标准层间边。
function baseTopologyOk(layers) {
  if (layers.length !== 4 || layers.some((l,li) => !Array.isArray(l.entrances) || l.entrances.length !== 1
    || l.entry !== l.entrances[0] || l.nodes[l.entry]?.type !== 'entrance'
    || l.nodes[l.exit]?.type !== (li === 3 ? 'extraction' : 'door'))) return false;
  return layers.every((l,li) => {
    const doors = li === 3 ? [] : [{ pair:`p${li+1}`,at:l.exit,toLayer:li+1,arriveAt:layers[li+1].entry,exit:false }];
    if (!Array.isArray(l.doors) || l.doors.length !== doors.length || doors.some((d,i) => !exact(l.doors[i],Object.keys(d))
      || Object.keys(d).some(k => l.doors[i][k] !== d[k]))) return false;
    return l.nodes.every((n,idx) => {
      const expected = new Set(l.nodes.flatMap((other,j) => Math.abs(n.x-other.x)+Math.abs(n.row-other.row) === 1 ? [`${li},${j}`] : []));
      if (li > 0 && idx === l.entry) expected.add(`${li-1},${layers[li-1].exit}`);
      if (li < 3 && idx === l.exit) expected.add(`${li+1},${layers[li+1].entry}`);
      return n.next.length === expected.size && n.next.every(([to,j]) => expected.delete(`${to},${j}`));
    });
  });
}

// L2 固定七个非战类型节点，记忆化状态最多 7×2^6=448；事件仍可能另触发战斗。
function longestNoncombat(graph, types) {
  const ids = types.flatMap((type,i) => NONCOMBAT.has(type) ? [i] : []), n = ids.length;
  const next = ids.map(i => graph[i].flatMap(j => { const at = ids.indexOf(j); return at < 0 ? [] : [at]; }));
  const memo = new Uint8Array(n * (1 << n));
  function walk(at, seen) {
    const key = seen*n+at; if (memo[key]) return memo[key];
    let best = 1;
    for (const j of next[at]) if (!(seen & (1 << j))) best = Math.max(best,1+walk(j,seen | (1 << j)));
    memo[key] = best; return best;
  }
  return ids.reduce((best,_,i) => Math.max(best,walk(i,1 << i)),0);
}

function battleCost(types, graph, start, end) {
  const d = graph.map(() => Infinity), queue = [start]; d[start] = 0;
  while (queue.length) {
    queue.sort((a,b) => d[a]-d[b]); const at = queue.shift();
    for (const next of graph[at]) {
      const value = d[at] + Number(types[next] === 'battle');
      if (value < d[next]) { d[next] = value; queue.push(next); }
    }
  }
  return d[end];
}
function metrics(layer, graph, types) {
  const d = distances(graph, layer.entry);
  return { fire:d[types.indexOf('fire')] ?? 0, shop:d[types.indexOf('shop')] ?? 0, exit:d[layer.exit],
    battles:battleCost(types, graph, layer.entry, layer.exit) };
}
function setDefinition(layer, idx, def) {
  const node = layer.nodes[idx];
  if (node.def) node.def = clone(def);
  else Object.assign(node, clone(def));
  if (layer.logical) { layer.logical[idx].def = clone(def); layer.logical[idx].fire = def.type === 'fire'; }
}
function changeEdge(layer, a, b, add) {
  for (const [from, to] of [[a,b],[b,a]]) {
    const edges = layer.nodes[from].next.filter(([li,idx]) => li !== 1 || idx !== to);
    if (add) edges.push([1,to]);
    layer.nodes[from].next = edges;
    if (layer.logical) layer.logical[from].next = clone(edges);
  }
}
// 数据一致性指纹，不是认证签名。实际接受仍依赖边、配额、逆变换与旧协议的逐项校验。
export function routeBaseFingerprint(layers) {
  const text = JSON.stringify(raw(layers).map(l => ({ entry:l.entry, exit:l.exit, bounds:l.gridBounds, doors:l.doors,
    nodes:l.nodes.map(n => [n.id,n.x,n.row,n.type,n.name,!!n.extraction,[...n.next].sort(([al,ai],[bl,bi]) => al-bl || ai-bi)]) })));
  return `v1:${hashSeed(text).toString(16).padStart(8,'0')}${hashSeed(`route-base:${text}`).toString(16).padStart(8,'0')}`;
}
function compare(a,b) {
  return a.swaps.length-b.swaps.length || a.cuts.length-b.cuts.length
    || Math.max(a.delta.fire,a.delta.shop,a.delta.exit)-Math.max(b.delta.fire,b.delta.shop,b.delta.exit)
    || a.fork-b.fork || a.reward-b.reward;
}
function candidates(layer, graph, types, baseline, swaps, diagnostics) {
  const fire = types.includes('fire') ? types.indexOf('fire') : types.indexOf('shop');
  const result = [];
  if (fire < 0 || layer.nodes[fire].x < 2) return result;
  const cycle = graph.reduce((sum,edges) => sum+edges.length,0)/2-graph.length+1;
  for (let reward = 0; reward < types.length; reward++) if (['chest','resource'].includes(types[reward])) {
    for (const guard of graph[reward]) if (types[guard] === 'battle') {
      const cuts = graph[reward].filter(i => i !== guard).map(i => [reward,i]);
      if (cuts.length > 2 || cycle-cuts.length < 1) continue;
      const next = graph.map(edges => [...edges]);
      for (const [a,b] of cuts) { next[a] = next[a].filter(i => i !== b); next[b] = next[b].filter(i => i !== a); }
      if (next.filter(edges => edges.length >= 3).length < 2 || types.some((type,i) => type === 'battle'
        && next[i].filter(j => types[j] === 'battle').length > 1)) continue;
      const all = distances(next,layer.entry), noGuard = distances(next,layer.entry,new Set([guard]));
      if (all.some(d => !Number.isFinite(d)) || !Number.isFinite(noGuard[layer.exit]) || !Number.isFinite(noGuard[fire])) continue;
      if (battleCost(types,next,layer.entry,layer.exit) !== baseline.battles) continue;
      const beforeFire = distances(next,layer.entry,new Set([guard,fire]));
      for (const fork of next[guard]) {
        diagnostics.witnesses++;
        if (fork === reward || fork === fire || fork === layer.exit || types[fork] === 'battle'
          || !Number.isFinite(beforeFire[fork]) || next[fork].length < 3 || !next[fork].includes(fire)) continue;
        const fromFork = distances(next,fork,new Set([guard]));
        if (noGuard[fork]+fromFork[layer.exit] > noGuard[layer.exit]+2) continue;
        const after = metrics(layer, next, types);
        const delta = { fire:after.fire-baseline.fire, shop:after.shop-baseline.shop, exit:after.exit-baseline.exit };
        if (Object.values(delta).some(d => d > 2)) { diagnostics.distanceRejected++; continue; }
        result.push({ fork,guard,reward,fire,cuts,swaps,delta });
      }
    }
  }
  return result;
}

export function applyGuardedRoute({ generatorVersion, layoutVersion, layerData, baseRoutePlan }) {
  const original = clone(layerData), layers = raw(original), diagnostics = { assignments:0, witnesses:0, distanceRejected:0, pacingChecks:0, pacingRejected:0 };
  if (generatorVersion !== CURRENT_GENERATOR_VERSION || layoutVersion !== 9 || !validateCurrentGeneratedMap(layers).ok || !baseTopologyOk(layers)) return { ok:false, code:'INVALID_GUARDED_ROUTE_INPUT' };
  const baseFingerprint = routeBaseFingerprint(original), layer = layers[1], graph = adjacent(layer), types = layer.nodes.map(n => n.type);
  const baseline = metrics(layer,graph,types), pool = candidates(layer,graph,types,baseline,[],diagnostics); diagnostics.assignments++;
  for (let a = 0; a < types.length; a++) for (let b = a+1; b < types.length; b++) {
    if (!MUTABLE.has(types[a]) || !MUTABLE.has(types[b]) || types[a] === types[b]) continue;
    const next = [...types]; [next[a],next[b]] = [next[b],next[a]];
    diagnostics.assignments++; pool.push(...candidates(layer,graph,next,baseline,[[a,b]],diagnostics));
  }
  const fallback = reason => ({ ok:true, value:{ layerData:original, routeVersion:GUARDED_ROUTE_VERSION, status:'fallback',
    routePlan:{ layerIndex:1,status:'fallback',fallbackReason:reason,baseFingerprint,baseRoutePlan:clone(baseRoutePlan) } }, diagnostics });
  if (!pool.length) return fallback(diagnostics.distanceRejected ? 'DISTANCE_LIMIT' : 'NO_VALID_FORK');
  const beforePacing = longestNoncombat(graph,types);
  const pick = pool.sort(compare).find(candidate => {
    const next = graph.map(edges => [...edges]), changed = [...types]; diagnostics.pacingChecks++;
    for (const [a,b] of candidate.swaps) [changed[a],changed[b]] = [changed[b],changed[a]];
    for (const [a,b] of candidate.cuts) { next[a] = next[a].filter(i => i !== b); next[b] = next[b].filter(i => i !== a); }
    if (longestNoncombat(next,changed) <= beforePacing) return true;
    diagnostics.pacingRejected++; return false;
  });
  if (!pick) return fallback('PACING_LIMIT');
  const work = clone(original), target = work[1];
  const swaps = pick.swaps.map(([a,b]) => ({ aNodeId:target.nodes[a].id,bNodeId:target.nodes[b].id,
    beforeA:clone(definition(target.nodes[a])),beforeB:clone(definition(target.nodes[b])) }));
  for (const [a,b] of pick.swaps) { const first = definition(target.nodes[a]), second = definition(target.nodes[b]); setDefinition(target,a,second); setDefinition(target,b,first); }
  for (const [a,b] of pick.cuts) changeEdge(target,a,b,false);
  const plan = { layerIndex:1,status:'applied',forkNodeId:target.nodes[pick.fork].id,guardNodeId:target.nodes[pick.guard].id,
    rewardNodeId:target.nodes[pick.reward].id,recoveryNodeId:target.nodes[pick.fire].id,swaps,
    removedEdges:pick.cuts.map(([a,b]) => ({ aNodeId:target.nodes[a].id,bNodeId:target.nodes[b].id })),
    baseFingerprint,baseRoutePlan:clone(baseRoutePlan),fallbackReason:null };
  if (!validateGuardedRoute(work,plan).ok) return fallback('FINAL_QUALITY_REJECTED');
  return { ok:true,value:{ layerData:work,routeVersion:GUARDED_ROUTE_VERSION,status:'applied',routePlan:plan },diagnostics };
}

/** 只校验与逆还原。返回的 baseLayers 仍须由快照层按冻结 route-v1 协议校验 baseRoutePlan。 */
export function validateGuardedRoute(input, plan, previousFacilities = false, budgets = previousFacilities ? PREVIOUS_MAP_TYPE_BUDGETS : MAP_TYPE_BUDGETS, enforceFirePacing = true) {
  const bad = () => ({ ok:false });
  if (!plan || plan.layerIndex !== 1 || !/^v1:[\da-f]{16}$/.test(plan.baseFingerprint || '')) return bad();
  const layers = raw(input); if (!validateCurrentGeneratedMap(layers, budgets, enforceFirePacing).ok) return bad();
  if (plan.status === 'fallback') {
    if (!exact(plan,['layerIndex','status','fallbackReason','baseFingerprint','baseRoutePlan'])
      || !REASONS.has(plan.fallbackReason) || !baseTopologyOk(layers) || routeBaseFingerprint(input) !== plan.baseFingerprint) return bad();
    return { ok:true,baseLayers:clone(input) };
  }
  if (!exact(plan,['layerIndex','status','forkNodeId','guardNodeId','rewardNodeId','recoveryNodeId','swaps','removedEdges','baseFingerprint','baseRoutePlan','fallbackReason'])
    || plan.status !== 'applied' || plan.fallbackReason !== null || !Array.isArray(plan.swaps) || plan.swaps.length > 1
    || !Array.isArray(plan.removedEdges) || plan.removedEdges.length > 2) return bad();
  const base = clone(input), layer = layers[1], target = base[1], byId = new Map(layer.nodes.map((n,i) => [n.id,i]));
  const ids = [plan.forkNodeId,plan.guardNodeId,plan.rewardNodeId,plan.recoveryNodeId];
  if (new Set(ids).size !== 4 || ids.some(id => !byId.has(id))) return bad();
  const [fork,guard,reward,fire] = ids.map(id => byId.get(id)), graph = adjacent(layer), types = layer.nodes.map(n => n.type);
  if (types[guard] !== 'battle' || !['fire', 'shop'].includes(types[fire]) || !['chest','resource'].includes(types[reward])
    || graph[reward].length !== 1 || graph[reward][0] !== guard || !graph[fork].includes(guard)
    || !graph[fork].includes(fire) || graph[fork].length < 3 || types[fork] === 'battle' || fork === layer.exit) return bad();
  const noGuard = distances(graph,layer.entry,new Set([guard]));
  if (!Number.isFinite(noGuard[layer.exit]) || !Number.isFinite(noGuard[fire])
    || !Number.isFinite(distances(graph,layer.entry,new Set([guard,fire]))[fork])
    || noGuard[fork]+distances(graph,fork,new Set([guard]))[layer.exit] > noGuard[layer.exit]+2) return bad();
  for (const swap of plan.swaps) {
    if (!exact(swap,['aNodeId','bNodeId','beforeA','beforeB'])) return bad();
    const a = byId.get(swap.aNodeId), b = byId.get(swap.bNodeId);
    if (a === undefined || b === undefined || a === b || ![swap.beforeA,swap.beforeB].every(d => exact(d,['type','name','extraction'])
      && MUTABLE.has(d.type) && typeof d.name === 'string' && typeof d.extraction === 'boolean')
      || swap.beforeA.type === swap.beforeB.type || !sameDefinition(definition(target.nodes[a]),swap.beforeB)
      || !sameDefinition(definition(target.nodes[b]),swap.beforeA)) return bad();
    setDefinition(target,a,swap.beforeA); setDefinition(target,b,swap.beforeB);
  }
  const removed = new Set();
  for (const edge of plan.removedEdges) {
    if (!exact(edge,['aNodeId','bNodeId'])) return bad();
    const a = byId.get(edge.aNodeId), b = byId.get(edge.bNodeId), key = [a,b].sort((x,y) => x-y).join(',');
    if (a === undefined || b === undefined || a === b || removed.has(key) || (a !== reward && b !== reward)
      || graph[a].includes(b) || graph[b].includes(a) || Math.abs(layer.nodes[a].x-layer.nodes[b].x)+Math.abs(layer.nodes[a].row-layer.nodes[b].row) !== 1) return bad();
    removed.add(key); changeEdge(target,a,b,true);
  }
  const before = raw(base), old = before[1], oldGraph = adjacent(old);
  if (!baseTopologyOk(before) || routeBaseFingerprint(base) !== plan.baseFingerprint || !validateCurrentGeneratedMap(before, budgets, enforceFirePacing).ok) return bad();
  const oldMetrics = metrics(old,oldGraph,old.nodes.map(n => n.type)), next = metrics(layer,graph,types);
  if (next.battles !== oldMetrics.battles || ['fire','shop','exit'].some(k => next[k]-oldMetrics[k] > 2)
    || longestNoncombat(graph,types) > longestNoncombat(oldGraph,old.nodes.map(n => n.type))) return bad();
  return { ok:true,baseLayers:base };
}
