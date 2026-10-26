// @ts-check
import { validateGeneratedMap } from '../run/map-generator.js';
import { CURRENT_GENERATOR_VERSION, MAP_TYPE_BUDGETS, validateCurrentGeneratedMap } from '../run/map-generation-rules.js';
import { clone } from '../core/shared.js';

/** 覆盖层数据形状（与 run/layeredMap.js createLayeredMap 输出对齐，仅声明本文件触达的成员）。
 * @typedef {{ minX: number, maxX: number, minRow: number, maxRow: number }} GridBounds
 * @typedef {[number, number]} RouteEdge  [目标层下标, 目标格下标]
 * @typedef {{ type: string, name: string, extraction?: boolean }} NodeDef
 * @typedef {{ id: string, li: number, idx: number, x: number, row: number, type: string, name: string, next: RouteEdge[], extraction: boolean }} MapNode
 * @typedef {{ grid: unknown[], fire: boolean, oldIdx: number, def: NodeDef, id: string, row: number, x: number, next: RouteEdge[] }} LogicalNode
 * @typedef {{ pair: string, at: number, toLayer: number, arriveAt: number, exit: boolean }} LayerDoor
 * @typedef {{ id: string, name: string, nameEn: string, color: string, generatorVersion: number, layoutVersion: number, gridBounds: GridBounds, nodes: MapNode[], entrances: number[], entranceNames: string[], doors: LayerDoor[], altarEntrances: number[], exit: number, logical: LogicalNode[] }} MapLayer
 * @typedef {{ nodes: MapNode[], entry: number, exit: number, doors: LayerDoor[], altarEntrances: number[], gridBounds: GridBounds }} RawLayer
 * @typedef {{ start: number, rejoin: number, supply: number, risk: number }} BranchChoice
 * @typedef {{ layerIndex: 1, status: 'fallback', fallbackReason: string }} FallbackPlan
 * @typedef {{ layerIndex: 1, status: 'applied', startNodeId: string, rejoinNodeId: string, supplyNodeId: string, riskNodeId: string, swaps: Array<{aNodeId: string, bNodeId: string, beforeA: string, beforeB: string}>, fallbackReason: null }} AppliedPlan
 * @typedef {FallbackPlan|AppliedPlan} RoutePlan
 * @typedef {{ ok: false, code: 'INVALID_ROUTE_INPUT', message: string }} OverlayReject
 * @typedef {{ ok: true, value: { layerData: MapLayer[], routeVersion: string, status: ('applied'|'fallback'), routePlan: RoutePlan } }} OverlayAccepted
 * @typedef {OverlayReject|OverlayAccepted} OverlayResult
 */
export const ROUTE_VERSION = 'r5-routes-v1';
const BLOCKED = new Set(['entrance','door','fire','shop','extraction','altar','boss','emergencyExit']);
/** 质量门不收时的降级回执：原样归还 layerData 快照，路线走 fallback。
 * @param {MapLayer[]} layerData
 * @param {string} reason
 * @returns {OverlayAccepted}
 */
const fail = (layerData, reason) => ({ ok:true, value:{ layerData:clone(layerData), routeVersion:ROUTE_VERSION,
  routePlan:{ layerIndex:1, status:'fallback', fallbackReason:reason }, status:'fallback' } });

/** 把会话层拷贝成质量门（validateGeneratedMap）消费的生成器原始层形状。
 * @param {MapLayer[]} layers
 * @returns {RawLayer[]}
 */
function rawLayers(layers) {
  return layers.map((layer,li)=>({
    nodes:layer.nodes.map((n,idx)=>({ ...n, idx, li, type:n.type ?? layer.logical[idx]?.def?.type,
      name:n.name ?? layer.logical[idx]?.def?.name, next:clone(n.next) })),
    entry:layer.entrances[0], exit:layer.exit, doors:clone(layer.doors || []),
    altarEntrances:clone(layer.altarEntrances || []), gridBounds:clone(layer.gridBounds),
  }));
}

/** 连续战斗上限复核：任一战斗格的同层战斗邻居 ≤1（不制造三连战）。
 * @param {RawLayer[]} layers
 * @returns {boolean}
 */
function battleAdjacencyOk(layers) {
  return layers.every((layer,li)=>layer.nodes.every(node=>node.type!=='battle' ||
    node.next.filter(([tl,ti])=>tl===li && layer.nodes[ti]?.type==='battle').length<=1));
}

/** 同步改写一个逻辑格的 def 与显示层（type/name/extraction 三处落盘）。
 * @param {MapLayer} layer
 * @param {number} idx
 * @param {NodeDef} def
 * @returns {void}
 */
function setDef(layer, idx, def) {
  layer.logical[idx].def=clone(def);
  layer.nodes[idx].type=def.type;
  layer.nodes[idx].name=def.name;
  layer.nodes[idx].extraction=!!def.extraction;
}

/** 枚举第 2 层全部「双格支线换位」候选对（supply=非战斗支线格，risk=战斗支线格），按字典序稳定排序。
 * @param {MapLayer} layer
 * @returns {BranchChoice[]}
 */
function candidates(layer) {
  const nodes=layer.logical;
  /** @param {number} a @param {number} b */
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

/** 路线覆盖层入口：对第 2 层做「支线格 ↔ 搜刮点格」换位制造支线环，失败则原样降级（fallback）。
 * @param {object} p
 * @param {number} p.generatorVersion  生成器版本（旧 3/5 或新局 6，各走对应版本的最终质量门）
 * @param {number} p.layoutVersion  布局版本（须为 9，否则拒绝输入）
 * @param {MapLayer[]} p.layerData  四层地图数据（createLayeredMap 产物）
 * @param {string | number} [p.seed] 兼容会话的种子元数据，覆盖层不消费
 * @param {string} [p.routeVersion]  路线协议版本，缺省取 ROUTE_VERSION
 * @returns {OverlayResult}
 */
export function applyRouteOverlay({ generatorVersion, layoutVersion, layerData, routeVersion=ROUTE_VERSION }) {
  let original=null;
  try {
    if(![3,5,CURRENT_GENERATOR_VERSION].includes(generatorVersion) || layoutVersion!==9 || routeVersion!==ROUTE_VERSION || !Array.isArray(layerData) || layerData.length!==4)
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
        const raw=rawLayers(draft), quality=generatorVersion===3 ? validateGeneratedMap(raw) : validateCurrentGeneratedMap(raw, MAP_TYPE_BUDGETS, generatorVersion===CURRENT_GENERATOR_VERSION);
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
