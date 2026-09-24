import { validateGeneratedMap } from '../run/map-generator.js';

export const ROUTE_VERSION = 'r5-routes-v1';
const BLOCKED = new Set(['entrance','door','fire','shop','extraction','altar','boss','emergencyExit']);
const clone = value => JSON.parse(JSON.stringify(value));
const fail = (layerData, reason) => ({ ok:true, value:{ layerData:clone(layerData), routeVersion:ROUTE_VERSION,
  routePlan:{ layerIndex:1, status:'fallback', fallbackReason:reason }, status:'fallback' } });

function rawLayers(layers) {
  return layers.map((layer,li)=>({
    nodes:layer.nodes.map((n,idx)=>({ ...n, idx, li, type:n.type ?? layer.logical[idx]?.def?.type,
      name:n.name ?? layer.logical[idx]?.def?.name, next:clone(n.next) })),
    entry:layer.entrances[0], exit:layer.exit, doors:clone(layer.doors || []),
    altarEntrances:clone(layer.altarEntrances || []), gridBounds:clone(layer.gridBounds),
  }));
}

function battleAdjacencyOk(layers) {
  return layers.every((layer,li)=>layer.nodes.every(node=>node.type!=='battle' ||
    node.next.filter(([tl,ti])=>tl===li && layer.nodes[ti]?.type==='battle').length<=1));
}

function setDef(layer, idx, def) {
  layer.logical[idx].def=clone(def);
  layer.nodes[idx].type=def.type;
  layer.nodes[idx].name=def.name;
  layer.nodes[idx].extraction=!!def.extraction;
}

function candidates(layer) {
  const nodes=layer.logical;
  const adjacent=(a,b)=>nodes[a].next.some(([li,idx])=>li===1&&idx===b);
  const out=[];
  for(let a=0;a<nodes.length;a++) for(let b=a+1;b<nodes.length;b++) {
    if(adjacent(a,b)) continue;
    const common=nodes[a].next.filter(([li])=>li===1).map(([,i])=>i)
      .filter(i=>nodes[b].next.some(([li,j])=>li===1&&j===i));
    for(let i=0;i<common.length;i++) for(let j=i+1;j<common.length;j++) {
      const mids=[common[i],common[j]];
      if(mids.some(k=>BLOCKED.has(nodes[k].def.type))) continue;
      const battle=mids.find(k=>nodes[k].def.type==='battle');
      const supply=mids.find(k=>k!==battle);
      if(battle!==undefined && supply!==undefined) out.push({start:a,rejoin:b,supply,risk:battle});
    }
  }
  return out.sort((x,y)=>[x.start,x.rejoin,x.supply,x.risk].join(',').localeCompare([y.start,y.rejoin,y.supply,y.risk].join(','),undefined,{numeric:true}));
}

export function applyRouteOverlay({ generatorVersion, layoutVersion, layerData, routeVersion=ROUTE_VERSION }) {
  let original=null;
  try {
    if(generatorVersion!==3 || layoutVersion!==9 || routeVersion!==ROUTE_VERSION || !Array.isArray(layerData) || layerData.length!==4)
      return {ok:false,code:'INVALID_ROUTE_INPUT',message:'路线覆盖输入无效'};
    original=clone(layerData); const work=clone(layerData), layer=work[1];
    const choices=candidates(layer);
    for(const choice of choices) {
      const validCycle=[choice.start,choice.rejoin,choice.supply,choice.risk].every(i=>layer.logical[i]) &&
        layer.logical[choice.supply].def.type!=='battle' && layer.logical[choice.risk].def.type==='battle';
      if(!validCycle) continue;
      if(layer.logical[choice.supply].def.type==='chest') continue;
      const donors=layer.logical.map((n,i)=>({n,i})).filter(({n,i})=>n.def.type==='chest' && !Object.values(choice).includes(i)).map(x=>x.i);
      for(const donor of donors) {
        if(!layer.logical[donor] || layer.logical[donor].def.type!=='chest') continue;
        const draft=clone(work), dl=draft[1], beforeSupply=clone(dl.logical[choice.supply].def), beforeDonor=clone(dl.logical[donor].def);
        setDef(dl,choice.supply,beforeDonor); setDef(dl,donor,beforeSupply);
        const raw=rawLayers(draft), quality=validateGeneratedMap(raw);
        if(!quality.ok || !battleAdjacencyOk(raw)) continue;
        return {ok:true,value:{layerData:draft,routeVersion:ROUTE_VERSION,status:'applied',routePlan:{
          layerIndex:1,status:'applied',startNodeId:dl.logical[choice.start].id,rejoinNodeId:dl.logical[choice.rejoin].id,
          supplyNodeId:dl.logical[choice.supply].id,riskNodeId:dl.logical[choice.risk].id,
          swaps:[{aNodeId:dl.logical[choice.supply].id,bNodeId:dl.logical[donor].id,beforeA:beforeSupply.type,beforeB:beforeDonor.type}],fallbackReason:null,
        }}};
      }
    }
    return fail(original, choices.length?'QUALITY_GATE_REJECTED':'NO_MUTABLE_BRANCH_PAIR');
  } catch { return original ? fail(original,'OVERLAY_EXCEPTION') : {ok:false,code:'INVALID_ROUTE_INPUT',message:'路线覆盖输入无效'}; }
}
