/* Seeded five-layer map generator. Emits plain data for session and renderer. */
const TARGETS = [13, 15, 17, 15, 13];
const WIDTHS = [7, 8, 9, 8, 7];
const ROW_MIN = -3;
const ROW_MAX = 3;
const GENERATOR_VERSION = 2;
const LAYOUT_VERSION = 2;
const MAX_ATTEMPTS = 8;

function hashSeed(value) { const text = String(value); let hash = 2166136261;
  for (let i = 0; i < text.length; i++) { hash ^= text.charCodeAt(i); hash = Math.imul(hash, 16777619); }
  return hash >>> 0; }
function rng(seed) { let state = hashSeed(seed) || 0x9e3779b9; return () => { state = (state + 0x6D2B79F5) >>> 0;
  let value = state; value = Math.imul(value ^ (value >>> 15), value | 1); value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
  return ((value ^ (value >>> 14)) >>> 0) / 0x100000000; }; }
const pick = (random, values) => values[Math.floor(random() * values.length)];
const key = (x, row) => `${x},${row}`;
const adjacent = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.row - b.row) === 1;
function addEdge(a, b) { if (!a.next.some(([li, idx]) => li === b.li && idx === b.idx)) a.next.push([b.li, b.idx]);
  if (!b.next.some(([li, idx]) => li === a.li && idx === a.idx)) b.next.push([a.li, a.idx]); }

function makeLayer(li, target, width, random) {
  // The spine alternates horizontal and vertical moves, so it visibly winds
  // through the grid without ever introducing a diagonal edge.
  const coords = []; const occupied = new Set(); let row = Math.floor((ROW_MIN + ROW_MAX) / 2) + pick(random, [-1, 0, 1]);
  const add = (x, y) => { const c = { x, row: y }; const k = key(x, y); if (!occupied.has(k)) { occupied.add(k); coords.push(c); } };
  add(0, row);
  for (let x = 0; x < width - 1; x++) { const step = pick(random, [-1, 1]); const nextRow = Math.max(ROW_MIN + 1, Math.min(ROW_MAX - 1, row + step));
    add(x, nextRow); row = nextRow; add(x + 1, row); }
  let growthAttempts = 0;
  while (coords.length < target && growthAttempts++ < 512) { const source = coords[Math.floor(random() * coords.length)];
    const candidates = [{ x: source.x - 1, row: source.row }, { x: source.x + 1, row: source.row },
      { x: source.x, row: source.row - 1 }, { x: source.x, row: source.row + 1 }]
      .filter(c => c.x >= 0 && c.x < width && c.row >= ROW_MIN && c.row <= ROW_MAX && !occupied.has(key(c.x, c.row)));
    if (candidates.length) { const next = pick(random, candidates); occupied.add(key(next.x, next.row)); coords.push(next); }
  }
  if (coords.length < target) throw new Error('候选网格无法扩展到目标节点数');
  const names = ['战斗', '事件', '火堆', '搜刮点', '补给站', '精英战'];
  const types = { 战斗: 'battle', 事件: 'event', 火堆: 'fire', 搜刮点: 'chest', 补给站: 'shop', 精英战: 'battle' };
  const nodes = coords.map((c, idx) => ({ id: `L${li + 1}_N${idx + 1}`, li, idx, x: c.x, row: c.row,
    type: types[pick(random, names)], name: '', next: [], extraction: false }));
  for (let a = 0; a < nodes.length; a++) for (let b = a + 1; b < nodes.length; b++) if (adjacent(nodes[a], nodes[b])) addEdge(nodes[a], nodes[b]);
  const entry = nodes.findIndex(n => n.x === 0);
  const exit = nodes.reduce((best, n, idx) => n.x > nodes[best].x ? idx : best, 0);
  nodes[entry].type = 'entrance'; nodes[entry].name = li === 0 ? '外围入口' : `第${li + 1}层入口`;
  nodes[exit].type = li === 4 ? 'extraction' : 'door'; nodes[exit].name = li === 4 ? '终局撤离点' : `通往第${li + 2}层`;
  nodes.forEach((n, idx) => { if (!n.name) n.name = `${li + 1}层·${names[idx % names.length]}`; });
  return { nodes, entry, exit, gridBounds: { minX: 0, maxX: width - 1, minRow: ROW_MIN, maxRow: ROW_MAX } };
}

function quality(layers) {
  const issues = []; if (layers.length !== 5) issues.push('必须生成五层');
  layers.forEach((layer, li) => {
    const expected = TARGETS[li]; if (layer.nodes.length !== expected) issues.push(`层 ${li + 1} 节点数异常`);
    if (layer.entry === layer.exit) issues.push(`层 ${li + 1} 入口出口相同`);
    const coords = new Set(); let edges = 0;
    layer.nodes.forEach(n => { const k = key(n.x, n.row); if (coords.has(k)) issues.push(`重复坐标 ${li},${k}`); coords.add(k);
      if (n.next.length > 4) issues.push(`层 ${li + 1} 节点度数超过4`); edges += n.next.filter(([toLi]) => toLi === li).length;
      n.next.forEach(([toLi, toIdx]) => { if (toLi === li && (!layer.nodes[toIdx] || !adjacent(n, layer.nodes[toIdx]))) issues.push(`非四向边 ${li},${n.idx}`); }); });
    const seen = new Set([layer.entry]); const queue = [layer.entry]; while (queue.length) { const idx = queue.shift();
      for (const [toLi, toIdx] of layer.nodes[idx].next) if (toLi === li && !seen.has(toIdx)) { seen.add(toIdx); queue.push(toIdx); } }
    if (seen.size !== layer.nodes.length) issues.push(`层 ${li + 1} 存在孤岛`);
    if (layer.nodes.filter(n => n.next.filter(([toLi]) => toLi === li).length >= 3).length < 2) issues.push(`层 ${li + 1} 分叉不足`);
    if (edges / 2 - layer.nodes.length + 1 < 1) issues.push(`层 ${li + 1} 没有回环`);
    if (!layer.gridBounds || layer.gridBounds.maxX <= layer.gridBounds.minX || layer.gridBounds.maxRow <= layer.gridBounds.minRow) issues.push(`层 ${li + 1} 缺少有效 bounds`);
  });
  for (let li = 0; li < layers.length - 1; li++) { const door = layers[li].doors?.[0]; const next = layers[li + 1];
    if (!door || door.toLayer !== li + 1 || !layers[li].nodes[door.at]?.next.some(([l, i]) => l === li + 1 && i === door.arriveAt) || !next.nodes[door.arriveAt]?.next.some(([l, i]) => l === li && i === door.at)) issues.push(`层间门 ${li} 非法`); }
  return { ok: issues.length === 0, issues };
}
function build(seed) { const layers = TARGETS.map((target, li) => makeLayer(li, target, WIDTHS[li], rng(`${seed}:layer:${li}`)));
  for (let li = 0; li < 4; li++) { const from = layers[li].nodes[layers[li].exit]; const to = layers[li + 1].nodes[layers[li + 1].entry];
    addEdge(from, to); layers[li].doors = [{ pair: `p${li + 1}`, at: from.idx, toLayer: li + 1, arriveAt: to.idx }]; }
  layers[4].doors = []; return layers; }
export function generateLayeredMap(seed = 0) { let lastIssues = [];
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) { const layers = build(`${seed}:attempt:${attempt}`); const result = quality(layers); if (result.ok)
    return { seed, generatorVersion: GENERATOR_VERSION, layoutVersion: LAYOUT_VERSION, layers }; lastIssues = result.issues; }
  throw new Error(`地图生成失败：${MAX_ATTEMPTS} 次候选均未通过质量校验（${lastIssues.join('；')}）`); }
export { quality as validateGeneratedMap, GENERATOR_VERSION, LAYOUT_VERSION };
