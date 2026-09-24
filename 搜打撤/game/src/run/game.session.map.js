/* game.session.map.js —— 地图派生几何（自 game.session.js 拆出，2026-09-25）。
 * 由种子地图安装运行时派生数据：逻辑格世界坐标（nodePos）、层包围盒（layerBounds）、
 * 扁平结点表与格子定义表；含路线叠层版本的新局派生。依赖内核（game）与 run 地图库，
 * 被开局流程（buildNewRunDerived）、读档恢复（installDerived）与 game.boot 消费。 */
import { Random } from '../core/random.js';
import { checkConnectivity } from './map-graph.js';
import { createLayeredMap } from './layeredMap.js';
import { GENERATOR_VERSION, LAYOUT_VERSION } from './map-generator.js';
import { applyRouteOverlay, ROUTE_VERSION } from '../ui/route-overlay.js';
import { game } from './game.session.kernel.js';

// ---------- 初始化派生数据 ----------
// 逻辑格：轨道上可站立的最小单位。相连火堆（上下左右连通）合并为 1 个逻辑格，
// 掷骰移动时整片火堆只算 1 步，不存在"从一半走到另一半"。
const MAP_NODE_SPACING = 120;
const MAP_NODE_PADDING = 180;

export function clampIndex(value, max, fallback = 0) {
  const n = Number.isFinite(+value) ? Math.floor(+value) : fallback;
  return Math.max(0, Math.min(Math.max(0, max - 1), n));
}

export function installDerived(layerData, mapSeed, generatorVersion = GENERATOR_VERSION, layoutVersion = LAYOUT_VERSION, routeVersion = null, routePlan = null) {
  game.rings = [];
  game.mapSeed = mapSeed;
  game.routeVersion = routeVersion;
  game.routePlan = routePlan;
  game.generatorVersion = generatorVersion;
  game.layoutVersion = layoutVersion;
  game.layerData = layerData;
  game.layerData.forEach(ld => { ld.toLogical = new Map(ld.logical.map((_, i) => [i, i])); });
  const reachable = checkConnectivity(game.layerData);
  if (!reachable.ok) console.error('[map] 不可达结点：', reachable.unreachable.join(' · '));

  // 每层使用自己的局部网格坐标，不再把四层横向平移后硬挤进一张图。
  // 生成器保证 x/row 为四向网格；这里仅负责把格心映射为稳定世界坐标。
  game.nodePos = game.layerData.map(ld => {
    const grid = ld.gridBounds || {};
    const minX = Number.isFinite(grid.minX) ? grid.minX : Math.min(...ld.logical.map(c => c.x || 0));
    const minRow = Number.isFinite(grid.minRow) ? grid.minRow : Math.min(...ld.logical.map(c => c.row || 0));
    return ld.logical.map(cell => ({
      x: MAP_NODE_PADDING + ((cell.x || 0) - minX) * MAP_NODE_SPACING,
      y: MAP_NODE_PADDING + ((cell.row || 0) - minRow) * MAP_NODE_SPACING,
    }));
  });
  game.layerBounds = game.nodePos.map((positions, li) => {
    const grid = game.layerData[li].gridBounds || {};
    const minX = Math.min(...positions.map(p => p.x));
    const maxX = Math.max(...positions.map(p => p.x));
    const minY = Math.min(...positions.map(p => p.y));
    const maxY = Math.max(...positions.map(p => p.y));
    return {
      minX: minX - MAP_NODE_SPACING * 0.5,
      maxX: maxX + MAP_NODE_SPACING * 0.5,
      minY: minY - MAP_NODE_SPACING * 0.5,
      maxY: maxY + MAP_NODE_SPACING * 0.5,
      gridBounds: grid,
    };
  });
  game.geometryVersion = `${String(game.mapSeed)}:${game.generatorVersion}:${game.layoutVersion}`;
  game.centerPos = [];
  game.nodes = [];                  // 扁平结点表（渲染与最近结点命中用）
  game.cellDefs = new Map();        // 'li,idx' → { def, x, y, li, idx }
  const addNode = (li, idx, def) => {
    const p = li === -1 ? game.centerPos[idx] : game.nodePos[li][idx];
    const node = { x: p.x, y: p.y, li, idx, def };
    game.nodes.push(node);
    game.cellDefs.set(li + ',' + idx, { def, x: p.x, y: p.y, li, idx });
    return node;
  };
  game.layerData.forEach((ld, li) => {
    ld.logical.forEach((lc, idx) => {
      let def = lc.def;
      const eIdx = ld.entrances.indexOf(idx);
      if (eIdx >= 0) def = { type: 'entrance', name: ld.entranceNames[eIdx] };
      addNode(li, idx, def);
    });
  });
}

export function buildDerived(mapSeed = game.mapSeed ?? game.seed ?? Random.seed ?? 0) {
  installDerived(createLayeredMap(mapSeed), mapSeed, GENERATOR_VERSION, LAYOUT_VERSION);
}

export function buildNewRunDerived(mapSeed) {
  const base = createLayeredMap(mapSeed);
  const routed = applyRouteOverlay({ seed: mapSeed, generatorVersion: GENERATOR_VERSION, layoutVersion: LAYOUT_VERSION, layerData: base, routeVersion: ROUTE_VERSION });
  if (!routed.ok) { installDerived(base, mapSeed, GENERATOR_VERSION, LAYOUT_VERSION, ROUTE_VERSION, { layerIndex: 1, status: 'fallback', fallbackReason: 'SESSION_OVERLAY_REJECTED' }); return; }
  installDerived(routed.value.layerData, mapSeed, GENERATOR_VERSION, LAYOUT_VERSION, routed.value.routeVersion, routed.value.routePlan);
}
