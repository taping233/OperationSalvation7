import { describe,it,expect } from 'vitest';
import { generateExplorationMap } from '../game/src/run/map-generator-v7.js';
import { createCurrentLayeredMap } from '../game/src/run/layeredMap.js';
import { createExplorationLayeredMap } from '../game/src/run/map-exploration-adapter.js';
import { createMapSnapshot,planMapRestore,validateMapSnapshot } from '../game/src/run/map-snapshot.js';
import { Random } from '../game/src/core/random.js';
import { validateCurrentGeneratedMap,MAP_TYPE_BUDGETS } from '../game/src/run/map-generation-rules.js';

describe('7/9探索支路与旧图兼容',()=>{
  it('候选源故障时有界回退，保底仍通过同一探索与安全门',()=>{
    let calls=0;
    const map=generateExplorationMap('forced-fallback',()=>{calls++;throw new Error('candidate unavailable');});
    expect(calls).toBe(64);expect(map.generation).toEqual({attempts:64,fallback:true});
    expect(validateCurrentGeneratedMap(map.layers,MAP_TYPE_BUDGETS,true,true)).toEqual({ok:true,issues:[]});
  });
  it('128种子独立检查全图可返回、各层真尽头、有限回环、奖励与关键路径',()=>{
    for(let seed=0;seed<128;seed++){
      const map=generateExplorationMap(`exploration-contract-${seed}`);
      expect(map.generatorVersion).toBe(7);
      expect(map.layers.map(l=>l.nodes.length)).toEqual([7,11,16,16]);
      map.layers.forEach((l,li)=>{
        const graph=l.nodes.map(n=>n.next.filter(([to])=>to===li).map(([,idx])=>idx));
        const seen=new Set([l.entry]),queue=[l.entry],depth=l.nodes.map(()=>Infinity);depth[l.entry]=0;
        for(let i=0;i<queue.length;i++)for(const next of graph[queue[i]]){
          expect(graph[next]).toContain(queue[i]);
          if(!seen.has(next)){seen.add(next);depth[next]=depth[queue[i]]+1;queue.push(next);}
        }
        expect(seen.size).toBe(l.nodes.length);
        const leaves=l.nodes.filter(n=>n.idx!==l.entry&&n.idx!==l.exit&&graph[n.idx].length===1);
        expect(leaves.length).toBeGreaterThanOrEqual(li===0?1:2);
        expect(leaves.some(n=>['chest','event','resource'].includes(n.type))).toBe(true);
        expect(graph.filter(next=>next.length>=3).length).toBeGreaterThanOrEqual(li===0?1:2);
        expect(graph.reduce((sum,next)=>sum+next.length,0)/2-l.nodes.length+1).toBeLessThanOrEqual(1);
        const costs=l.nodes.map(()=>Infinity);costs[l.entry]=0;
        for(let pass=0;pass<l.nodes.length;pass++)for(const n of l.nodes)for(const next of graph[n.idx]){
          costs[next]=Math.min(costs[next],costs[n.idx]+Number(l.nodes[next].type==='battle'));
        }
        const fire=l.nodes.find(n=>n.type==='fire');
        if(fire){expect(costs[fire.idx]).toBeLessThanOrEqual(2);if(li===0)expect(costs[fire.idx]).toBeGreaterThanOrEqual(1);}
        if(li===3){
          expect(depth[l.nodes.find(n=>n.type==='altar').idx]).toBeLessThan(depth[l.nodes.find(n=>n.type==='boss').idx]);
          expect(depth[l.nodes.find(n=>n.type==='boss').idx]).toBeLessThan(depth[l.exit]);
        }
      });
    }
  });
  it('新旧快照分别逐字恢复，旧6未升级，新7不按seed重画',()=>{
    for(const version of [6,7]){
      const layerData=version===6?createCurrentLayeredMap('snapshot-exploration'):createExplorationLayeredMap('snapshot-exploration');
      const made=createMapSnapshot({mapSeed:'snapshot-exploration',generatorVersion:version,layoutVersion:9,layerData});
      expect(made.ok).toBe(true);
      const bytes=JSON.stringify(made.value),restored=planMapRestore({mapSnapshot:made.value,layerIdx:2,trackPos:4});
      expect(restored.ok).toBe(true);expect(restored.value.generatorVersion).toBe(version);
      expect(JSON.stringify(createMapSnapshot(restored.value).value)).toBe(bytes);
    }
  });
  it('生成可复现且不推进对局随机流，不能用7身份接收旧密集图',()=>{
    Random.reseed(4321);const before=Random.snapshot();
    expect(generateExplorationMap('repeat')).toEqual(generateExplorationMap('repeat'));
    expect(Random.snapshot()).toEqual(before);
    const old=createMapSnapshot({mapSeed:0,generatorVersion:6,layoutVersion:9,layerData:createCurrentLayeredMap(0)});
    expect(validateMapSnapshot({...old.value,generatorVersion:7})).toMatchObject({ok:false,preserveRun:true});
  });
});
