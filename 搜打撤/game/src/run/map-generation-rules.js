/* 新局6/9的数量与硬约束唯一来源；旧3/9、4/9、5/9快照保留各自规则。 */
import { validateGeneratedMap as validateLegacyMap } from './map-generator.js';

/**
 * @typedef {'entrance'|'door'|'extraction'|'battle'|'event'|'fire'|'chest'|'shop'|'emergencyExit'|'altar'|'boss'|'resource'} GeneratedMapNodeType
 * @typedef {Readonly<Partial<Record<GeneratedMapNodeType, number>>>} MapLayerTypeBudget
 * @typedef {ReadonlyArray<MapLayerTypeBudget>} MapTypeBudgets
 */

export const CURRENT_GENERATOR_VERSION = 6;
export const CURRENT_LAYOUT_VERSION = 9;
export const FIRE_BATTLE_LIMIT = 2;
/** @type {MapTypeBudgets} */
export const PREVIOUS_MAP_TYPE_BUDGETS = Object.freeze([
  Object.freeze({ entrance: 1, door: 1, battle: 2, chest: 1, fire: 1, shop: 1 }),
  Object.freeze({ entrance: 1, door: 1, battle: 3, chest: 2, event: 2, resource: 1, fire: 1, shop: 1 }),
  Object.freeze({ entrance: 1, door: 1, emergencyExit: 1, battle: 4, chest: 4, event: 3, resource: 1, fire: 1, shop: 1 }),
  Object.freeze({ entrance: 1, extraction: 1, altar: 1, boss: 1, battle: 4, chest: 4, event: 2, resource: 1, fire: 1, shop: 1 }),
]);
// 2026-10-18：1/3层各一个火堆，2/4层各一个商店；另一设施格改为物资。
/** @type {MapTypeBudgets} */
export const V4_MAP_TYPE_BUDGETS = Object.freeze([
  Object.freeze({ entrance: 1, door: 1, battle: 2, chest: 1, resource: 1, fire: 1 }),
  Object.freeze({ entrance: 1, door: 1, battle: 3, chest: 2, event: 2, resource: 2, shop: 1 }),
  Object.freeze({ entrance: 1, door: 1, emergencyExit: 1, battle: 4, chest: 4, event: 3, resource: 2, fire: 1 }),
  Object.freeze({ entrance: 1, extraction: 1, altar: 1, boss: 1, battle: 4, chest: 4, event: 2, resource: 2, shop: 1 }),
]);

// 新局5/9：首层物资格改事件，第二至四层各删除一个物资格。
/** @type {MapTypeBudgets} */
export const MAP_TYPE_BUDGETS = Object.freeze([
  Object.freeze({ entrance: 1, door: 1, battle: 2, chest: 1, event: 1, fire: 1 }),
  Object.freeze({ entrance: 1, door: 1, battle: 3, chest: 2, event: 2, resource: 1, shop: 1 }),
  Object.freeze({ entrance: 1, door: 1, emergencyExit: 1, battle: 4, chest: 4, event: 3, resource: 1, fire: 1 }),
  Object.freeze({ entrance: 1, extraction: 1, altar: 1, boss: 1, battle: 4, chest: 4, event: 2, resource: 1, shop: 1 }),
]);

export function layerNeighbors(layer) {
  return layer.nodes.map(node => node.next.filter(([li]) => li === node.li).map(([, idx]) => idx));
}

export function graphDistances(neighbors, start, blocked = new Set()) {
  const distances = neighbors.map(() => Infinity);
  if (!neighbors[start] || blocked.has(start)) return distances;
  distances[start] = 0;
  const queue = [start];
  for (let cursor = 0; cursor < queue.length; cursor++) {
    const node = queue[cursor];
    for (const next of neighbors[node]) {
      if (blocked.has(next) || distances[next] !== Infinity) continue;
      distances[next] = distances[node] + 1;
      queue.push(next);
    }
  }
  return distances;
}

// 只计普通战斗节点；事件是否额外触发战斗取决于实际内容与选择。
export function minimumBattlesTo(layer, target, battleNodes = new Set(layer.nodes.filter(node => node.type === 'battle').map(node => node.idx))) {
  const neighbors = layerNeighbors(layer), costs = neighbors.map(() => Infinity), queue = [layer.entry];
  costs[layer.entry] = 0;
  while (queue.length) {
    queue.sort((a, b) => costs[a] - costs[b]);
    const at = queue.shift();
    for (const next of neighbors[at]) {
      const cost = costs[at] + Number(battleNodes.has(next));
      if (cost >= costs[next]) continue;
      costs[next] = cost;
      queue.push(next);
    }
  }
  return costs[target];
}

export function finaleOrderOk(layer, altar, boss) {
  const neighbors = layerNeighbors(layer);
  const depth = graphDistances(neighbors, layer.entry);
  return depth[altar] < depth[boss] && depth[boss] < depth[layer.exit]
    && Number.isFinite(graphDistances(neighbors, altar, new Set([layer.exit]))[boss]);
}

// 只校验，不修补。任何后置覆盖也必须经过这一最终门，不能重引入已消除的冲突。
export function validateCurrentGeneratedMap(layers, budgets = MAP_TYPE_BUDGETS, enforceFirePacing = true) {
  let legacy;
  try { legacy = validateLegacyMap(layers); }
  catch { return { ok: false, issues: ['新地图结构无效'] }; }
  // 旧质量门的节点数量冻结；新版数量由下方完整配额独立校验。
  const issues = legacy.issues.filter(issue => !/^层 \d+ 节点数异常$/.test(issue));
  if (layers.length !== MAP_TYPE_BUDGETS.length) return { ok: false, issues };
  layers.forEach((layer, li) => {
    const budget = budgets[li], counts = {};
    layer.nodes.forEach(node => { counts[node.type] = (counts[node.type] || 0) + 1; });
    for (const type of new Set([...Object.keys(counts), ...Object.keys(budget)])) {
      if ((counts[type] || 0) !== (budget[type] || 0)) issues.push(`层 ${li + 1} ${type} 配额异常`);
    }
    const neighbors = layerNeighbors(layer);
    const fire = layer.nodes.find(node => node.type === 'fire');
    const shop = layer.nodes.find(node => node.type === 'shop');
    if (fire && enforceFirePacing && minimumBattlesTo(layer, fire.idx) > FIRE_BATTLE_LIMIT) {
      issues.push(`层 ${li + 1} 火堆须经过超过 ${FIRE_BATTLE_LIMIT} 场普通战斗`);
    }
    if (fire && shop && neighbors[fire.idx].includes(shop.idx)) issues.push(`层 ${li + 1} 火堆与补给站相邻`);
    if (layer.nodes.some(node => node.type === 'battle'
      && neighbors[node.idx].filter(idx => layer.nodes[idx]?.type === 'battle').length > 1)) {
      issues.push(`层 ${li + 1} 存在连续三场战斗`);
    }
    if (li === 2) {
      const emergency = layer.nodes.find(node => node.type === 'emergencyExit');
      if (emergency && emergency.x < Math.floor((layer.gridBounds.maxX + 1) / 2)) issues.push('第三层紧急撤离点不在深区');
    }
    if (li === 3) {
      const altar = layer.nodes.find(node => node.type === 'altar');
      const boss = layer.nodes.find(node => node.type === 'boss');
      if (altar && boss && !finaleOrderOk(layer, altar.idx, boss.idx)) issues.push('祭坛、首脑与撤离点的图距离顺序无效');
    }
  });
  return { ok: issues.length === 0, issues };
}
