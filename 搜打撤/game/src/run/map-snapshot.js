// @ts-check
/**
 * 校验结果的失败分支（判别联合的 ok:false 侧，ok 字面量 false 保证 if(!x.ok) 能收窄）。
 * @typedef {{ok:false, code:string, message:string, preserveRun:true, details?:Record<string, any>}} SnapshotFail
 */
import { createLayeredMap } from './layeredMap.js';

const SNAPSHOT_VERSION = 1;
const ROUTE_SNAPSHOT_VERSION = 2;
const LEGACY_GENERATOR_VERSION = 3;
const LEGACY_LAYOUT_VERSION = 9;
const TYPES = new Set(['entrance','door','extraction','battle','event','fire','chest','shop','emergencyExit','altar','boss','resource']);
/**
 * @param {string} code
 * @param {string} message
 * @param {Record<string, any>} [details]
 * @returns {SnapshotFail}
 */
const fail = (code, message, details) => ({ ok:false, code, message, preserveRun:true, ...(details ? { details } : {}) });
const plainObject = value => !!value && typeof value === 'object' && !Array.isArray(value) && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
const int = value => Number.isInteger(value);
const scalarSeed = value => typeof value === 'string' || (typeof value === 'number' && Number.isFinite(value));
const clone = value => JSON.parse(JSON.stringify(value));
const exactKeys = (value, keys) => plainObject(value) && Object.keys(value).length===keys.length && keys.every(k=>Object.hasOwn(value,k));
const pureJson = value => value===null || typeof value==='string' || typeof value==='boolean' || (typeof value==='number'&&Number.isFinite(value)) ||
  (Array.isArray(value)&&value.every(pureJson)) || (plainObject(value)&&Object.entries(value).every(([k,v])=>!['__proto__','prototype','constructor'].includes(k)&&pureJson(v)));

function normalizeLayer(layer) {
  return {
    id:layer.id, name:layer.name, nameEn:layer.nameEn, color:layer.color,
    gridBounds:clone(layer.gridBounds), entrances:[...(layer.entrances || [])], entranceNames:[...(layer.entranceNames || [])],
    exit:layer.exit, doors:clone(layer.doors || []), altarEntrances:clone(layer.altarEntrances || []),
    nodes:(layer.logical || []).map(cell => ({ id:cell.id, x:cell.x, row:cell.row,
      def:{ type:cell.def?.type, name:cell.def?.name, extraction:!!cell.def?.extraction },
      next:clone(cell.next || []) })),
  };
}

/**
 * 由层图数据生成地图快照并自校验；routeVersion/routePlan 缺省时产出无路线外壳。
 * @param {{mapSeed:(string|number), generatorVersion:number, layoutVersion:number, layerData:any[], routeVersion?:any, routePlan?:any}} params
 * @returns {SnapshotFail|{ok:true, value:any}}
 */
export function createMapSnapshot({ mapSeed, generatorVersion, layoutVersion, layerData, routeVersion, routePlan }) {
  try {
    const value = { kind:'normal-map', snapshotVersion:routeVersion ? ROUTE_SNAPSHOT_VERSION : SNAPSHOT_VERSION, mapSeed, generatorVersion, layoutVersion,
      layers:(layerData || []).map(normalizeLayer) };
    if(routeVersion){ value.routeVersion=routeVersion; value.routePlan=clone(routePlan); }
    return validateMapSnapshot(value);
  } catch { return fail('INVALID_MAP_SNAPSHOT','地图快照无法序列化'); }
}

/**
 * @param {any} snapshot
 * @param {{layerIdx?:number, trackPos?:number}|null} [position]
 * @returns {SnapshotFail|{ok:true, value:any}}
 */
function validateMapSnapshotInner(snapshot, position = null) {
  let encoded;
  try { encoded=JSON.stringify(snapshot); } catch { return fail('INVALID_MAP_SNAPSHOT','地图快照不是 JSON 纯数据'); }
  const routed=snapshot?.snapshotVersion===ROUTE_SNAPSHOT_VERSION;
  const keys=routed?['kind','snapshotVersion','mapSeed','generatorVersion','layoutVersion','layers','routeVersion','routePlan']:['kind','snapshotVersion','mapSeed','generatorVersion','layoutVersion','layers'];
  if (!pureJson(snapshot) || !encoded || encoded.length > 300_000 || !exactKeys(snapshot,keys) || snapshot.kind !== 'normal-map' || ![SNAPSHOT_VERSION,ROUTE_SNAPSHOT_VERSION].includes(snapshot.snapshotVersion) ||
      !scalarSeed(snapshot.mapSeed) || snapshot.generatorVersion !== LEGACY_GENERATOR_VERSION || snapshot.layoutVersion !== LEGACY_LAYOUT_VERSION ||
      !Array.isArray(snapshot.layers) || snapshot.layers.length !== 4) return fail('UNSUPPORTED_MAP_SNAPSHOT','地图快照版本或外壳无效');
  if (/(?:"__proto__"|"prototype"|"constructor")\s*:/.test(encoded)) return fail('INVALID_MAP_SNAPSHOT','地图快照含禁止键');
  const ids=new Set(), layerIds=new Set(), expectedCounts=[7,12,17,17];
  for (let li=0;li<4;li++) {
    const layer=snapshot.layers[li];
    if (!exactKeys(layer,['id','name','nameEn','color','gridBounds','entrances','entranceNames','exit','doors','altarEntrances','nodes']) ||
        ![layer.id,layer.name,layer.nameEn,layer.color].every(v=>typeof v==='string'&&v.length>0) || layerIds.has(layer.id) || !Array.isArray(layer.nodes) || layer.nodes.length!==expectedCounts[li] ||
        !Array.isArray(layer.entrances) || !layer.entrances.length || !Array.isArray(layer.entranceNames) ||
        !Array.isArray(layer.doors) || !Array.isArray(layer.altarEntrances) || !plainObject(layer.gridBounds) || !int(layer.exit)) return fail('INVALID_MAP_SNAPSHOT','地图层结构无效',{layer:li});
    layerIds.add(layer.id);
    const b=layer.gridBounds;
    if (!exactKeys(b,['minX','maxX','minRow','maxRow']) || ![b.minX,b.maxX,b.minRow,b.maxRow].every(int) || b.minX>b.maxX || b.minRow>b.maxRow) return fail('INVALID_MAP_SNAPSHOT','地图边界无效',{layer:li});
    if (!layer.entrances.every(i=>int(i)&&i>=0&&i<layer.nodes.length) || layer.exit<0 || layer.exit>=layer.nodes.length || layer.entranceNames.length!==layer.entrances.length || !layer.entranceNames.every(v=>typeof v==='string')) return fail('INVALID_MAP_SNAPSHOT','入口或出口无效',{layer:li});
    const coords=new Set();
    for (let ni=0;ni<layer.nodes.length;ni++) {
      const n=layer.nodes[ni];
      if (!exactKeys(n,['id','x','row','def','next']) || typeof n.id!=='string' || !n.id || ids.has(n.id) || !int(n.x) || !int(n.row) || n.x<b.minX || n.x>b.maxX || n.row<b.minRow || n.row>b.maxRow ||
          !exactKeys(n.def,['type','name','extraction']) || !TYPES.has(n.def.type) || typeof n.def.name!=='string' || typeof n.def.extraction!=='boolean' || !Array.isArray(n.next)) return fail('INVALID_MAP_SNAPSHOT','地图节点结构无效',{layer:li,node:ni});
      const coord=`${n.x},${n.row}`; if(coords.has(coord))return fail('INVALID_MAP_SNAPSHOT','同层节点坐标重复',{layer:li,node:ni}); coords.add(coord);
      ids.add(n.id);
      const edgeKeys=new Set();
      for (const edge of n.next) {
        if (!Array.isArray(edge)||edge.length!==2||!int(edge[0])||!int(edge[1])||edge[0]<0||edge[0]>=4||edge[1]<0||edge[1]>=snapshot.layers[edge[0]]?.nodes?.length) return fail('INVALID_MAP_SNAPSHOT','地图边越界',{layer:li,node:ni});
        const key=edge.join(','); if(edgeKeys.has(key)||(edge[0]===li&&edge[1]===ni)) return fail('INVALID_MAP_SNAPSHOT','地图边重复或自环',{layer:li,node:ni}); edgeKeys.add(key);
      }
    }
  }
  for (let li=0;li<4;li++) {
    const layer=snapshot.layers[li];
    for (let ni=0;ni<layer.nodes.length;ni++) for (const [tl,ti] of layer.nodes[ni].next) {
      const target=snapshot.layers[tl].nodes[ti];
      if (!target.next.some(([rl,ri])=>rl===li&&ri===ni)) return fail('INVALID_MAP_SNAPSHOT','地图边缺少反向连接',{layer:li,node:ni});
      if (tl===li && Math.abs(target.x-layer.nodes[ni].x)+Math.abs(target.row-layer.nodes[ni].row)!==1) return fail('INVALID_MAP_SNAPSHOT','同层边不是四向相邻',{layer:li,node:ni});
    }
    for (const door of layer.doors) {
      if (!exactKeys(door,['pair','at','toLayer','arriveAt','exit'])||typeof door.pair!=='string'||!door.pair||!int(door.at)||!int(door.toLayer)||!int(door.arriveAt)||typeof door.exit!=='boolean'||door.at<0||door.at>=layer.nodes.length||door.toLayer<0||door.toLayer>=4||door.arriveAt<0||door.arriveAt>=snapshot.layers[door.toLayer].nodes.length||!layer.nodes[door.at].next.some(([l,i])=>l===door.toLayer&&i===door.arriveAt)) return fail('INVALID_MAP_SNAPSHOT','层间门描述无效',{layer:li});
    }
    if(layer.altarEntrances.length) return fail('INVALID_MAP_SNAPSHOT','3/9 地图不应含旧中央祭坛入口',{layer:li});
  }
  const allDoors=snapshot.layers.flatMap((layer,li)=>layer.doors.map(door=>({li,...door}))), pairs=new Set();
  for(const door of allDoors){if(pairs.has(door.pair))return fail('INVALID_MAP_SNAPSHOT','层间门 pair 重复');pairs.add(door.pair);}
  for(let li=0;li<4;li++)for(let ni=0;ni<snapshot.layers[li].nodes.length;ni++)for(const [tl,ti] of snapshot.layers[li].nodes[ni].next)if(tl!==li){
    const matches=allDoors.filter(d=>(d.li===li&&d.at===ni&&d.toLayer===tl&&d.arriveAt===ti)||(d.li===tl&&d.at===ti&&d.toLayer===li&&d.arriveAt===ni));
    if(matches.length!==1)return fail('INVALID_MAP_SNAPSHOT','跨层边缺少唯一 door/pair 描述',{layer:li,node:ni});
  }
  const start=snapshot.layers[0].entrances[0], seen=new Set([`0,${start}`]), queue=[[0,start]];
  while(queue.length){const [li,ni]=queue.shift();for(const [tl,ti] of snapshot.layers[li].nodes[ni].next){const k=`${tl},${ti}`;if(!seen.has(k)){seen.add(k);queue.push([tl,ti]);}}}
  const total=snapshot.layers.reduce((n,l)=>n+l.nodes.length,0);
  if(seen.size!==total) return fail('INVALID_MAP_SNAPSHOT','地图存在不可达节点');
  if(routed){
    const p=snapshot.routePlan;
    if(snapshot.routeVersion!=='r5-routes-v1' || !plainObject(p) || !['applied','fallback'].includes(p.status) || p.layerIndex!==1) return fail('INVALID_ROUTE_PLAN','路线计划无效');
    if(p.status==='fallback'){
      if(!exactKeys(p,['layerIndex','status','fallbackReason']) || typeof p.fallbackReason!=='string' || !p.fallbackReason) return fail('INVALID_ROUTE_PLAN','回退路线计划无效');
    } else {
      if(!exactKeys(p,['layerIndex','status','startNodeId','rejoinNodeId','supplyNodeId','riskNodeId','swaps','fallbackReason']) || p.fallbackReason!==null || !Array.isArray(p.swaps) || !p.swaps.length) return fail('INVALID_ROUTE_PLAN','双路线计划结构无效');
      const layer=snapshot.layers[p.layerIndex], byId=new Map(layer.nodes.map(n=>[n.id,n])), start=byId.get(p.startNodeId), rejoin=byId.get(p.rejoinNodeId), supply=byId.get(p.supplyNodeId), risk=byId.get(p.riskNodeId);
      const edge=(a,b)=>a?.next.some(([li,idx])=>li===p.layerIndex&&layer.nodes[idx]?.id===b?.id);
      if(new Set([p.startNodeId,p.rejoinNodeId,p.supplyNodeId,p.riskNodeId]).size!==4 || !start||!rejoin||supply?.def.type!=='chest'||risk?.def.type!=='battle'||!edge(start,supply)||!edge(supply,rejoin)||!edge(start,risk)||!edge(risk,rejoin)) return fail('INVALID_ROUTE_PLAN','路线计划与节点边或类型不符');
      const mutable=new Set(['battle','chest','event','resource']);
      if(!p.swaps.every(s=>{const a=byId.get(s.aNodeId),b=byId.get(s.bNodeId);return exactKeys(s,['aNodeId','bNodeId','beforeA','beforeB'])&&s.aNodeId===p.supplyNodeId&&s.aNodeId!==s.bNodeId&&a&&b&&mutable.has(s.beforeA)&&mutable.has(s.beforeB)&&s.beforeA!==s.beforeB&&a.def.type===s.beforeB&&b.def.type===s.beforeA;})) return fail('INVALID_ROUTE_PLAN','路线交换记录无效');
    }
  }
  if(position && (!int(position.layerIdx)||!int(position.trackPos)||!snapshot.layers[position.layerIdx]?.nodes?.[position.trackPos])) return fail('INVALID_MAP_POSITION','地图当前位置无效');
  return {ok:true,value:clone(snapshot)};
}

/**
 * 校验地图快照外壳、四层结构、节点/边、层间门 pair 与连通性（可附当前位置校验）。
 * @param {any} snapshot
 * @param {{layerIdx?:number, trackPos?:number}|null} [position]
 * @returns {SnapshotFail|{ok:true, value:any}}
 */
export function validateMapSnapshot(snapshot, position = null) {
  try { return validateMapSnapshotInner(snapshot,position); }
  catch { return fail('INVALID_MAP_SNAPSHOT','地图快照校验异常'); }
}

/**
 * 校验并把纯数据快照还原成运行时层图数据（layerData + logical）。
 * @param {any} snapshot
 * @returns {SnapshotFail|{ok:true, value:any}}
 */
export function hydrateMapSnapshot(snapshot) {
  const checked=validateMapSnapshot(snapshot); if(!checked.ok)return checked;
  const value=checked.value;
  const layerData=value.layers.map(layer=>({id:layer.id,name:layer.name,nameEn:layer.nameEn,color:layer.color,gridBounds:clone(layer.gridBounds),
    nodes:layer.nodes.map((n,idx)=>({id:n.id,li:0,idx,x:n.x,row:n.row,type:n.def.type,name:n.def.name,next:clone(n.next),extraction:n.def.extraction})),
    entrances:[...layer.entrances],entranceNames:[...layer.entranceNames],doors:clone(layer.doors),altarEntrances:clone(layer.altarEntrances),exit:layer.exit,
    logical:layer.nodes.map((n,idx)=>({grid:[],fire:n.def.type==='fire',oldIdx:idx,def:clone(n.def),id:n.id,row:n.row,x:n.x,next:clone(n.next)}))}));
  layerData.forEach((layer,li)=>layer.nodes.forEach(n=>{n.li=li;}));
  return {ok:true,value:{layerData,mapSeed:value.mapSeed,generatorVersion:value.generatorVersion,layoutVersion:value.layoutVersion,snapshot:value,
    routeVersion:value.routeVersion??null,routePlan:value.routePlan??null}};
}

export function planMapRestore(run) {
  if (!plainObject(run)) return fail('INVALID_RUN','对局存档结构无效');
  if (run.nestActive === true) return {ok:true,value:{source:'nest'}};
  if (Object.hasOwn(run,'mapSnapshot')) {
    const checked=validateMapSnapshot(run.mapSnapshot,{layerIdx:run.layerIdx,trackPos:run.trackPos}); if(!checked.ok)return checked;
    const s=checked.value;
    if ((run.mapSeed!==undefined&&run.mapSeed!==s.mapSeed)||(run.generatorVersion!==undefined&&run.generatorVersion!==s.generatorVersion)||(run.layoutVersion!==undefined&&run.layoutVersion!==s.layoutVersion)||(run.routeVersion!==undefined&&run.routeVersion!==(s.routeVersion??null))) return fail('MAP_METADATA_CONFLICT','地图快照与外层元数据冲突');
    const hydrated=hydrateMapSnapshot(s); return hydrated.ok?{ok:true,value:{source:'snapshot',...hydrated.value}}:hydrated;
  }
  const seed=run.mapSeed??run.seed;
  if (!scalarSeed(seed) || run.generatorVersion!==LEGACY_GENERATOR_VERSION || run.layoutVersion!==LEGACY_LAYOUT_VERSION) return fail('UNSUPPORTED_LEGACY_MAP','旧对局缺少可证明的 3/9 地图身份');
  let layerData;
  try { layerData=createLayeredMap(seed); }
  catch { return fail('MAP_GENERATION_FAILED','3/9 旧地图无法确定性重建'); }
  const made=createMapSnapshot({mapSeed:seed,generatorVersion:LEGACY_GENERATOR_VERSION,layoutVersion:LEGACY_LAYOUT_VERSION,layerData}); if(!made.ok)return made;
  const positioned=validateMapSnapshot(made.value,{layerIdx:run.layerIdx,trackPos:run.trackPos}); if(!positioned.ok)return positioned;
  const hydrated=hydrateMapSnapshot(made.value); return hydrated.ok?{ok:true,value:{source:'legacy-3/9',...hydrated.value}}:hydrated;
}

export { SNAPSHOT_VERSION, ROUTE_SNAPSHOT_VERSION };
