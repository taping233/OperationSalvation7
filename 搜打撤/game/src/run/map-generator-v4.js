/* 新局 5/9：复用冻结 3/9 的候选几何，第二至四层各删一个非关键节点，再赋型。
 * 地图内独立子流，不推进对局随机流；旧 3/9 的生成和重建入口保持逐字冻结。 */
import { generateLayeredMap } from './map-generator.js';
import { hashSeed, nextRandom } from '../core/random-core.js';
import { clone } from '../core/shared.js';
import { CURRENT_GENERATOR_VERSION, CURRENT_LAYOUT_VERSION, MAP_TYPE_BUDGETS,
  layerNeighbors, graphDistances, finaleOrderOk, validateCurrentGeneratedMap } from './map-generation-rules.js';

export const MAX_CURRENT_MAP_ATTEMPTS = 64;
const FALLBACK_TOPOLOGY_SEED = 'map-v4-fallback-20261017';
// 冻结旧函数的默认值让 TS 推成 number；实际历史契约同时接受字符串 seed。
const legacyMap = /** @type {(seed: string | number) => ReturnType<typeof generateLayeredMap>} */ (generateLayeredMap);
const NAMES = { battle: '战斗', event: '事件', fire: '火堆', chest: '宝箱', shop: '补给站',
  emergencyExit: '紧急撤离点', altar: '祭坛', boss: '首脑', resource: '物资格' };

function shuffled(values, random) {
  const result = [...values];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function randomFor(seed) {
  let state = hashSeed(seed) || 0x9e3779b9;
  return () => { const step = nextRandom(state); state = step.state; return step.value; };
}

function criticalPlacements(layer, li, pool, random) {
  if (li === 2) {
    const minimum = Math.floor((layer.gridBounds.maxX + 1) / 2);
    return shuffled(pool.filter(idx => layer.nodes[idx].x >= minimum), random)
      .sort((a, b) => Number(layer.nodes[b].type === 'emergencyExit') - Number(layer.nodes[a].type === 'emergencyExit') || layer.nodes[b].x - layer.nodes[a].x)
      .map(idx => ({ [idx]: 'emergencyExit' }));
  }
  if (li !== 3) return [{}];
  const neighbors = layerNeighbors(layer), fromExit = graphDistances(neighbors, layer.exit);
  const order = shuffled(pool, random), pairs = [];
  for (const boss of order) {
    const fromBoss = graphDistances(neighbors, boss);
    for (const altar of order) if (altar !== boss && finaleOrderOk(layer, altar, boss)) {
      const changes = Number(layer.nodes[altar].type !== 'altar') + Number(layer.nodes[boss].type !== 'boss');
      pairs.push({ altar, boss, changes, score: fromExit[boss] * layer.nodes.length + fromBoss[altar] });
    }
  }
  // 在真实距离顺序成立的候选中优先保留旧类型位置，再靠近撤离与首脑；同分使用种子顺序。
  return pairs.sort((a, b) => a.changes - b.changes || a.score - b.score).map(({ altar, boss }) => ({ [altar]: 'altar', [boss]: 'boss' }));
}

function chooseBattles(layer, pool, count, fire) {
  const neighbors = layerNeighbors(layer), chosen = new Set();
  pool = [...pool].sort((a, b) => Number(layer.nodes[b].type === 'battle') - Number(layer.nodes[a].type === 'battle'));
  const canAdd = idx => {
    const adjacentBattles = neighbors[idx].filter(next => chosen.has(next));
    return adjacentBattles.length <= 1
      && adjacentBattles.every(next => !neighbors[next].some(other => chosen.has(other)));
  };
  const search = offset => {
    if (chosen.size === count) {
      return layer.nodes[0].li !== 0 || !Number.isFinite(graphDistances(neighbors, layer.entry, chosen)[fire]);
    }
    if (pool.length - offset < count - chosen.size) return false;
    for (let i = offset; i < pool.length; i++) {
      const idx = pool[i];
      if (!canAdd(idx)) continue;
      chosen.add(idx);
      if (search(i + 1)) return true;
      chosen.delete(idx);
    }
    return false;
  };
  return search(0) ? [...chosen] : null;
}

function assignLayer(layer, li, seed) {
  const random = randomFor(seed), budget = MAP_TYPE_BUDGETS[li];
  const pool = shuffled(layer.nodes.map(node => node.idx).filter(idx => idx !== layer.entry && idx !== layer.exit), random);
  const minimum = li === 0 ? 1 : 2;
  for (const critical of criticalPlacements(layer, li, pool, random)) {
    const remaining = pool.filter(idx => !Object.hasOwn(critical, idx));
    const facilities = remaining.filter(idx => layer.nodes[idx].x >= minimum);
    const prefer = type => [...facilities].sort((a, b) => Number(layer.nodes[b].type === type) - Number(layer.nodes[a].type === type));
    const facilityType = budget.fire ? 'fire' : 'shop';
    for (const facility of prefer(facilityType)) {
      const ordinary = remaining.filter(idx => idx !== facility);
      const battles = chooseBattles(layer, ordinary, budget.battle, facility);
      if (!battles) continue;
      const types = { ...critical, [facility]: facilityType };
      battles.forEach(idx => { types[idx] = 'battle'; });
      const rest = ordinary.filter(idx => !Object.hasOwn(types, idx));
      const bag = shuffled(['chest', 'event', 'resource'].flatMap(type => Array(budget[type] || 0).fill(type)), random);
      if (rest.length !== bag.length) continue;
      // 可保持的既有奖励类型先保留；只把被硬约束挤出的剩余名额按子流补齐。
      for (const idx of rest) {
        const match = bag.indexOf(layer.nodes[idx].type);
        if (match >= 0) { types[idx] = bag[match]; bag.splice(match, 1); }
      }
      rest.filter(idx => !Object.hasOwn(types, idx)).forEach((idx, i) => { types[idx] = bag[i]; });
      layer.nodes.forEach(node => {
        if (node.idx === layer.entry) { node.type = 'entrance'; node.name = li === 0 ? '外围入口' : `第${li + 1}层入口`; }
        else if (node.idx === layer.exit) { node.type = li === 3 ? 'extraction' : 'door'; node.name = li === 3 ? '终局撤离点' : `通往第${li + 2}层`; }
        else { node.type = types[node.idx]; node.name = `${li + 1}层·${NAMES[node.type]}`; }
      });
      return true;
    }
  }
  return false;
}

function trimLayerNodes(layers) {
  const remaps = [];
  for (let li = 0; li < layers.length; li++) {
    const layer = layers[li], target = Object.values(MAP_TYPE_BUDGETS[li]).reduce((sum, count) => sum + count, 0);
    if (!Array.isArray(layer.nodes) || layer.nodes.length < target || layer.nodes.length > target + 1) return false;
    let remove = -1;
    if (layer.nodes.length > target) {
      const neighbors = layerNeighbors(layer);
      const candidates = layer.nodes.filter(node => node.idx !== layer.entry && node.idx !== layer.exit)
        .sort((a, b) => Number(b.type === 'resource') - Number(a.type === 'resource') || neighbors[a.idx].length - neighbors[b.idx].length || a.idx - b.idx);
      for (const node of candidates) {
        const blocked = new Set([node.idx]), depth = graphDistances(neighbors, layer.entry, blocked);
        const kept = layer.nodes.filter(item => item.idx !== node.idx);
        if (kept.some(item => !Number.isFinite(depth[item.idx]))) continue;
        const degree = item => neighbors[item.idx].filter(idx => idx !== node.idx).length;
        const edges = kept.reduce((sum, item) => sum + degree(item), 0) / 2;
        if (li > 0 && (kept.filter(item => degree(item) >= 3).length < 2 || edges - kept.length + 1 < 1)) continue;
        remove = node.idx; break;
      }
      if (remove < 0) return false;
    }
    const map = new Map();
    layer.nodes.filter(node => node.idx !== remove).forEach((node, idx) => map.set(node.idx, idx));
    remaps.push(map);
    layer.nodes = layer.nodes.filter(node => node.idx !== remove);
  }
  layers.forEach((layer, li) => {
    const map = remaps[li];
    layer.entry = map.get(layer.entry); layer.exit = map.get(layer.exit);
    layer.nodes.forEach((node, idx) => {
      node.idx = idx;
      node.next = node.next.filter(([to, at]) => remaps[to]?.has(at)).map(([to, at]) => [to, remaps[to].get(at)]);
    });
    layer.doors?.forEach(door => { door.at = map.get(door.at); door.arriveAt = remaps[door.toLayer].get(door.arriveAt); });
  });
  return true;
}

function prepare(seed, candidate, assignmentSeed) {
  const layers = clone(candidate);
  if (!Array.isArray(layers) || layers.length !== 4) return null;
  if (!trimLayerNodes(layers)) return null;
  if (!layers.every((layer, li) => assignLayer(layer, li, `${assignmentSeed}:layer:${li}`))) return null;
  const quality = validateCurrentGeneratedMap(layers);
  return quality.ok ? { seed, generatorVersion: CURRENT_GENERATOR_VERSION, layoutVersion: CURRENT_LAYOUT_VERSION, layers } : null;
}

function defaultCandidate(seed, attempt) {
  return legacyMap(attempt === 0 ? seed : `${seed}:v4:retry:${attempt}`).layers;
}

/** @param {string | number} seed */
export function generateCurrentLayeredMap(seed = 0, buildCandidate = defaultCandidate) {
  for (let attempt = 0; attempt < MAX_CURRENT_MAP_ATTEMPTS; attempt++) {
    try {
      const result = prepare(seed, buildCandidate(seed, attempt), `${seed}:v4:assignment:${attempt}`);
      if (result) return { ...result, generation: { attempts: attempt + 1, fallback: false } };
    } catch { /* 有界候选失败；不向调用方交付被放宽约束的地图。 */ }
  }
  // 独立于可注入候选源的已验证几何；最后仍经过相同赋型与质量门。
  const fallback = prepare(seed, legacyMap(FALLBACK_TOPOLOGY_SEED).layers, `${seed}:v4:fallback`);
  if (!fallback) throw new Error('5/9 地图生成失败：候选与保底地图均未满足最终约束');
  return { ...fallback, generation: { attempts: MAX_CURRENT_MAP_ATTEMPTS, fallback: true } };
}
