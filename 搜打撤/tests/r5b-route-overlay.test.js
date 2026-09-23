import { describe,expect,it } from 'vitest';
import { createLayeredMap } from '../game/src/run/layeredMap.js';
import { applyRouteOverlay, ROUTE_VERSION } from '../game/src/ui/route-overlay.js';
import { validateGeneratedMap } from '../game/src/run/map-generator.js';

const apply=seed=>applyRouteOverlay({seed,generatorVersion:3,layoutVersion:9,layerData:createLayeredMap(seed),routeVersion:ROUTE_VERSION});
const types=layers=>layers[1].logical.map(n=>n.def.type);
const raw=layers=>layers.map((l,li)=>({nodes:l.nodes.map((n,idx)=>({...n,idx,li,type:l.logical[idx].def.type})),entry:l.entrances[0],exit:l.exit,doors:l.doors,gridBounds:l.gridBounds}));

describe('R5-b deterministic route overlay',()=>{
  it.each([
    ['r5-route-a',{startNodeId:'L2_N3',rejoinNodeId:'L2_N5',supplyNodeId:'L2_N6',riskNodeId:'L2_N4',swap:'L2_N9'}],
    ['r5-route-b',{startNodeId:'L2_N7',rejoinNodeId:'L2_N9',supplyNodeId:'L2_N8',riskNodeId:'L2_N10',swap:'L2_N3'}],
  ])('%s matches the reviewed node/type matrix',(seed,want)=>{
    const result=apply(seed); expect(result.ok).toBe(true); expect(result.value.status).toBe('applied');
    const {swap,...plan}=want; expect(result.value.routePlan).toMatchObject(plan);
    expect(result.value.routePlan.swaps[0].bNodeId).toBe(want.swap);
    const l=result.value.layerData[1], byId=new Map(l.logical.map(n=>[n.id,n]));
    expect(byId.get(want.supplyNodeId).def.type).toBe('chest');
    expect(byId.get(want.riskNodeId).def.type).toBe('battle');
    expect(validateGeneratedMap(raw(result.value.layerData)).ok).toBe(true);
  });

  it('100 seeds are deterministic, finite, and every applied graph passes quality plus battle adjacency',()=>{
    let applied=0, fallback=0;
    for(let i=0;i<100;i++){
      const seed=`r5-check-${i}`, base=createLayeredMap(seed), a=apply(seed), b=apply(seed);
      expect(a).toEqual(b); expect(a.ok).toBe(true);
      if(a.value.status==='fallback'){
        fallback++; expect(a.value.layerData).toEqual(base); expect(a.value.routePlan.fallbackReason).toMatch(/^(NO_MUTABLE_BRANCH_PAIR|QUALITY_GATE_REJECTED)$/);
      } else {
        applied++; const rl=raw(a.value.layerData); expect(validateGeneratedMap(rl).ok).toBe(true);
        expect(rl.every((l,li)=>l.nodes.every(n=>n.type!=='battle'||n.next.filter(([tl,ti])=>tl===li&&l.nodes[ti]?.type==='battle').length<=1))).toBe(true);
        expect(types(a.value.layerData).sort()).toEqual(types(base).sort());
      }
    }
    expect({applied,fallback}).toEqual({applied:63,fallback:37});
  });
});
