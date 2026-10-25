// 7/9: retain every location, but author roads instead of connecting all touching cells.
import { generateCurrentLayeredMap } from './map-generator-v4.js';
import { hashSeed, nextRandom } from '../core/random-core.js';
import { EXPLORATION_GENERATOR_VERSION as CURRENT_GENERATOR_VERSION, CURRENT_LAYOUT_VERSION, MAP_TYPE_BUDGETS,
  layerNeighbors, graphDistances, validateCurrentGeneratedMap } from './map-generation-rules.js';
import { clone } from '../core/shared.js';

const structuralIssue=issue=>!issue.includes('探索')&&!issue.includes('回环过密')&&!issue.includes('尽头缺少');
const quality=layers=>validateCurrentGeneratedMap(layers,MAP_TYPE_BUDGETS,true,true);
function randomFor(seed){
  let state=hashSeed(seed)||0x9e3779b9;
  return ()=>{const step=nextRandom(state);state=step.state;return step.value;};
}
function shuffle(values,random){
  for(let i=values.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[values[i],values[j]]=[values[j],values[i]];}
  return values;
}

function carve(layers,random){
  for(let li=0;li<layers.length;li++){
    const layer=layers[li];
    const targetCycles=li>0&&random()<.4?1:0;
    const edges=shuffle(layer.nodes.flatMap(n=>n.next.filter(([to,idx])=>to===li&&idx>n.idx).map(([,idx])=>[n.idx,idx])),random);
    for(const [a,b] of edges){
      const current=layerNeighbors(layer);
      const ends=layer.nodes.filter(n=>n.idx!==layer.entry&&n.idx!==layer.exit&&current[n.idx].length===1).length;
      if(ends>=(li===0?1:2)&&current.reduce((sum,next)=>sum+next.length,0)/2-layer.nodes.length+1<=targetCycles)break;
      const beforeA=layer.nodes[a].next,beforeB=layer.nodes[b].next;
      layer.nodes[a].next=beforeA.filter(([to,idx])=>to!==li||idx!==b);
      layer.nodes[b].next=beforeB.filter(([to,idx])=>to!==li||idx!==a);
      const graph=layerNeighbors(layer),depth=graphDistances(graph,layer.entry);
      const forks=graph.filter(next=>next.length>=3).length;
      // Preserve all locations and decision points, fire access and the finale ordering.
      if(depth.some(d=>!Number.isFinite(d))||forks<(li===0?1:2)||quality(layers).issues.some(structuralIssue)){
        layer.nodes[a].next=beforeA;layer.nodes[b].next=beforeB;
      }
    }
    // Give at least one optional end an exploration payoff without changing the budget.
    const graph=layerNeighbors(layer);
    const leaves=layer.nodes.filter(n=>n.idx!==layer.entry&&n.idx!==layer.exit&&graph[n.idx].length===1);
    if(!leaves.some(n=>['chest','resource','event'].includes(n.type))){
      let assigned=false;
      for(const leaf of leaves){
        if(leaf.type!=='battle')continue;
        for(const donor of layer.nodes.filter(n=>['chest','resource','event'].includes(n.type))){
          const a={type:leaf.type,name:leaf.name},b={type:donor.type,name:donor.name};
          Object.assign(leaf,b);Object.assign(donor,a);
          if(!quality(layers).issues.some(structuralIssue)){assigned=true;break;}
          Object.assign(leaf,a);Object.assign(donor,b);
        }
        if(assigned)break;
      }
    }
  }
  return quality(layers).ok;
}

export function generateExplorationMap(seed=0,buildCandidate=generateCurrentLayeredMap){
  for(let attempt=0;attempt<64;attempt++){
    const candidateSeed=attempt?`${seed}:exploration:${attempt}`:seed;
    try{
      const layers=clone(buildCandidate(candidateSeed).layers);
      if(!Array.isArray(layers)||layers.length!==4)continue;
      if(carve(layers,randomFor(`${seed}:roads:${attempt}`))){
        return {seed,generatorVersion:CURRENT_GENERATOR_VERSION,layoutVersion:CURRENT_LAYOUT_VERSION,layers,
          generation:{attempts:attempt+1,fallback:false}};
      }
    }catch{ /* Bounded candidates; fallback below is checked by exactly the same rules. */ }
  }
  // A fixed independently carved geometry is validated by the same contract.
  const layers=clone(generateCurrentLayeredMap('exploration-fallback-1025').layers);
  if(!carve(layers,randomFor('exploration-fallback-1025')))throw new Error('7/9 探索地图未满足支路与安全约束');
  return {seed,generatorVersion:CURRENT_GENERATOR_VERSION,layoutVersion:CURRENT_LAYOUT_VERSION,layers,
    generation:{attempts:64,fallback:true}};
}
