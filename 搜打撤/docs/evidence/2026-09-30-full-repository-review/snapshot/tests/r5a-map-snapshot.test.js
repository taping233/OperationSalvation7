import { describe,expect,it } from 'vitest';
import { createLayeredMap } from '../game/src/run/layeredMap.js';
import { createMapSnapshot,hydrateMapSnapshot,planMapRestore,validateMapSnapshot } from '../game/src/run/map-snapshot.js';
import { applyRouteOverlay,ROUTE_VERSION } from '../game/src/ui/route-overlay.js';

const make = seed => createMapSnapshot({mapSeed:seed,generatorVersion:3,layoutVersion:9,layerData:createLayeredMap(seed)}).value;

describe('R5-a canonical map snapshot',()=>{
  it('真实3/9生成器往返保持节点、连边、门与坐标',()=>{
    const snapshot=make('r5-roundtrip');
    const restored=hydrateMapSnapshot(snapshot);
    expect(restored.ok).toBe(true);
    expect(createMapSnapshot(restored.value).value).toEqual(snapshot);
  });

  it('3/9旧图必须有真实mapSeed或seed；无版本、未知版本不伪造地图',()=>{
    expect(planMapRestore({generatorVersion:3,layoutVersion:9,layerIdx:0,trackPos:0}).code).toBe('UNSUPPORTED_LEGACY_MAP');
    expect(planMapRestore({seed:'known',layerIdx:0,trackPos:0}).code).toBe('UNSUPPORTED_LEGACY_MAP');
    expect(planMapRestore({seed:'known',generatorVersion:2,layoutVersion:9,layerIdx:0,trackPos:0}).code).toBe('UNSUPPORTED_LEGACY_MAP');
    expect(planMapRestore({seed:'known',generatorVersion:3,layoutVersion:9,layerIdx:0,trackPos:0}).value.source).toBe('legacy-3/9');
  });

  it('snapshot与外层seed/version冲突明确拒绝，nest不受普通图门槛阻挡',()=>{
    const snapshot=make('authoritative');
    expect(planMapRestore({mapSeed:'other',generatorVersion:3,layoutVersion:9,layerIdx:0,trackPos:0,mapSnapshot:snapshot}).code).toBe('MAP_METADATA_CONFLICT');
    expect(planMapRestore({nestActive:true,nestPos:2}).value.source).toBe('nest');
    expect(planMapRestore({nestActive:'true'}).ok).toBe(false);
    expect(planMapRestore({mapSnapshot:null,mapSeed:'authoritative',generatorVersion:3,layoutVersion:9,layerIdx:0,trackPos:0}).ok).toBe(false);
  });

  it('坏边、孤点、坏位置与未来快照均拒绝',()=>{
    const cases=[];
    {const s=make('edge');s.layers[0].nodes[0].next.pop();cases.push(s);}
    {const s=make('isolated');s.layers[0].nodes.at(-1).next=[];cases.push(s);}
    {const s=make('future');s.snapshotVersion=2;cases.push(s);}
    {const s=make('teleport');s.layers[0].nodes[0].next.push([2,0]);s.layers[2].nodes[0].next.push([0,0]);cases.push(s);}
    {const s=make('unknown');s.layers[0].nodes[0].extra=1;cases.push(s);}
    {const s=make('non-json');s.layers[0].name=undefined;cases.push(s);}
    for(const s of cases) expect(validateMapSnapshot(s).ok).toBe(false);
    expect(validateMapSnapshot(make('pos'),{layerIdx:9,trackPos:0}).code).toBe('INVALID_MAP_POSITION');
  });
});

describe('R5-b routed snapshot v2',()=>{
  it('strictly round-trips route metadata while v1 remains route-free',()=>{
    const seed='r5-route-a', routed=applyRouteOverlay({seed,generatorVersion:3,layoutVersion:9,layerData:createLayeredMap(seed),routeVersion:ROUTE_VERSION}).value;
    const made=createMapSnapshot({mapSeed:seed,generatorVersion:3,layoutVersion:9,layerData:routed.layerData,routeVersion:routed.routeVersion,routePlan:routed.routePlan});
    expect(made.ok).toBe(true); expect(made.value.snapshotVersion).toBe(2);
    const restored=planMapRestore({mapSeed:seed,generatorVersion:3,layoutVersion:9,routeVersion:ROUTE_VERSION,layerIdx:1,trackPos:2,mapSnapshot:made.value});
    expect(restored.ok).toBe(true); expect(restored.value.routePlan).toEqual(routed.routePlan);
    expect(make('old-v1').snapshotVersion).toBe(1); expect(planMapRestore({mapSeed:'old-v1',generatorVersion:3,layoutVersion:9,layerIdx:0,trackPos:0,mapSnapshot:make('old-v1')}).value.routePlan).toBeNull();
  });
  it('rejects route metadata that disagrees with snapshot nodes, edges, types, or outer run',()=>{
    const seed='r5-route-b', routed=applyRouteOverlay({seed,generatorVersion:3,layoutVersion:9,layerData:createLayeredMap(seed),routeVersion:ROUTE_VERSION}).value;
    const s=createMapSnapshot({mapSeed:seed,generatorVersion:3,layoutVersion:9,layerData:routed.layerData,routeVersion:routed.routeVersion,routePlan:routed.routePlan}).value;
    const bad=structuredClone(s); bad.routePlan.supplyNodeId=bad.routePlan.riskNodeId;
    expect(validateMapSnapshot(bad).code).toBe('INVALID_ROUTE_PLAN');
    const same=structuredClone(s); same.routePlan.rejoinNodeId=same.routePlan.startNodeId;
    expect(validateMapSnapshot(same).code).toBe('INVALID_ROUTE_PLAN');
    const swap=structuredClone(s); swap.routePlan.swaps[0].aNodeId=swap.routePlan.riskNodeId;
    expect(validateMapSnapshot(swap).code).toBe('INVALID_ROUTE_PLAN');
    const forged=structuredClone(s); forged.routePlan.swaps[0].beforeA='fire';
    expect(validateMapSnapshot(forged).code).toBe('INVALID_ROUTE_PLAN');
    expect(planMapRestore({mapSeed:seed,generatorVersion:3,layoutVersion:9,routeVersion:'wrong',layerIdx:1,trackPos:6,mapSnapshot:s}).code).toBe('MAP_METADATA_CONFLICT');
  });
});
