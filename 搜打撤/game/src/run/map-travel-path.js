import { isConsumedMapNode } from '../core/map-node-state.js';
import { entrySupplyGate } from './node-reward-state.js';

export function mapTravelCurve(from, to) {
  const dx = to.x - from.x;
  const dy = to.y - from.y, length = Math.hypot(dx, dy) || 1;
  // Canonical orientation keeps the same gentle bow when an edge is traversed backwards.
  const direction = from.x < to.x || (from.x === to.x && from.y <= to.y) ? 1 : -1;
  const bend = Math.min(16, length * .06) * direction;
  const ox = -dy / length * bend, oy = dx / length * bend;
  return { from: { x: from.x, y: from.y },
    c1: { x: from.x + dx * .45 + ox, y: from.y + oy },
    c2: { x: to.x - dx * .45 + ox, y: to.y + oy },
    to: { x: to.x, y: to.y } };
}

// Progress is already eased by the movement owner; rendering shares this exact geometry.
export function mapTravelPoint(from, to, progress) {
  const { c1, c2 } = mapTravelCurve(from, to);
  const t = Math.max(0, Math.min(1, progress)), u = 1 - t;
  return { x: u ** 3 * from.x + 3 * u ** 2 * t * c1.x + 3 * u * t ** 2 * c2.x + t ** 3 * to.x,
    y: u ** 3 * from.y + 3 * u ** 2 * t * c1.y + 3 * u * t ** 2 * c2.y + t ** 3 * to.y };
}

const presentations = new WeakMap();
export function getMapTravelPresentation(game) { return presentations.get(game) || null; }
export function setMapTravelPresentation(game, value) {
  if (value == null) presentations.delete(game);
  else presentations.set(game, value);
}

// Preserve existing direct edges; longer travel only crosses known, cleared ordinary cells.
export function findMapTravelPath(game, target) {
  const li = game.layerIdx, start = game.trackPos;
  const layer = game.layerData?.[li];
  const current = layer?.logical?.[start];
  if (!current || !Number.isInteger(target?.li) || !Number.isInteger(target?.idx) ||
      !game.layerData?.[target.li]?.logical?.[target.idx]) return null;
  if (target.li === li && target.idx === start) return [];
  // 入城闸门：未进入过入城节点前，除脚下本格外哪里都不可达（点击/悬停/面板/moveTo 同源判定）。
  if (entrySupplyGate(game)) return null;
  if ((current.next || []).some(([nl, idx]) => nl === target.li && idx === target.idx)) {
    return [{ li: target.li, idx: target.idx }];
  }
  const known = idx => !!(game.seen?.[`${li},${idx}`] || game.visited?.[`${li},${idx}`]);
  if (target.li !== li || !known(target.idx)) return null;
  const doors = new Set((layer.doors || []).map(door => door.at));
  const passable = idx => {
    const cell = layer.logical[idx];
    const supply = game.entrySupply;
    if (supply?.layerIdx === li && supply.trackPos === idx &&
        (supply.taken?.length || 0) < (supply.cardIds?.length || 0)) return false;
    if (!cell || !known(idx) || doors.has(idx) ||
        game.doorKeys?.has(`${li},${idx}`) || ['door', 'altar', 'boss'].includes(cell.def?.type)) return false;
    return cell.def?.type === 'blank' || isConsumedMapNode(game, { li, idx, def: cell.def });
  };
  const parents = new Map([[start, null]]), queue = [start], blocked = new Set();
  for (let cursor = 0; cursor < queue.length; cursor++) {
    const idx = queue[cursor];
    for (const [nl, next] of layer.logical[idx].next || []) {
      if (nl !== li || !layer.logical[next] || parents.has(next)) continue;
      // Rejected cells may have many incoming edges. Only this query reuses their
      // state; the next query must observe rewards or visibility edited in place.
      if (blocked.has(next)) continue;
      if (next !== target.idx && !passable(next)) { blocked.add(next); continue; }
      parents.set(next, idx);
      if (next === target.idx) {
        const path = [];
        for (let node = next; node !== start; node = parents.get(node)) path.push({ li, idx: node });
        return path.reverse();
      }
      queue.push(next);
    }
  }
  return null;
}
