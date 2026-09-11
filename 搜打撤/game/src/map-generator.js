/* Seeded four-layer map generator. Emits plain data for session and renderer. */
const TARGETS = [13, 15, 17, 15];
const WIDTHS = [7, 8, 9, 8];
const ROW_MIN = -3;
const ROW_MAX = 3;
const GENERATOR_VERSION = 3;
const LAYOUT_VERSION = 5;   // v5：2026-09-10 玩法定版——每层物资格（搜刮点）保底 1 格、上限 4 格；野生敌人格上限 4 格不变（旧对局读档后按新版本重生成地图）
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
  // 名字必须忠实于节点类型（2026-09-09 老板：节点名与实际内容匹配）——
  // 此前 name 按 idx % names.length 机械循环，出现「1层·火堆」实为战斗的误导性命名
  const NAME_BY_TYPE = { battle: '战斗', event: '事件', fire: '火堆', chest: '搜刮点', shop: '补给站', emergencyExit: '紧急撤离点', altar: '祭坛', boss: '首脑' };
  const nodes = coords.map((c, idx) => ({ id: `L${li + 1}_N${idx + 1}`, li, idx, x: c.x, row: c.row,
    type: types[pick(random, names)], name: '', next: [], extraction: false }));
  for (let a = 0; a < nodes.length; a++) for (let b = a + 1; b < nodes.length; b++) if (adjacent(nodes[a], nodes[b])) addEdge(nodes[a], nodes[b]);
  const entry = nodes.findIndex(n => n.x === 0);
  const exit = nodes.reduce((best, n, idx) => n.x > nodes[best].x ? idx : best, 0);
  nodes[entry].type = 'entrance'; nodes[entry].name = li === 0 ? '外围入口' : `第${li + 1}层入口`;
  nodes[exit].type = li === 3 ? 'extraction' : 'door'; nodes[exit].name = li === 3 ? '终局撤离点' : `通往第${li + 2}层`;
  // —— 数量与位置定版（2026-09-10 玩法定版）——
  //   野生敌人格 ≤4、露天宝箱格（物资格）≤4（超出降级为事件格，后续战斗下限仍会补回 3 场）；
  //   火堆/补给站不生成在入口附近（x < 2 的先降级，保底逻辑在 x ≥ 2 的深处补回）。
  { let battles = 0, chests = 0;
    nodes.forEach(n => {
      if (n.type === 'battle') { battles++; if (battles > 4) n.type = 'event'; }
      else if (n.type === 'chest') { chests++; if (chests > 4) n.type = 'event'; }
      else if ((n.type === 'fire' || n.type === 'shop') && n.x < 2) n.type = 'event';
    });
  }
  // 2026-09-09 老板 #13：每层最多 1 个火堆 / 1 个补给站——随机布点会叠出双火堆、两三家补给站，
  // 收益重叠还拖节奏；多出来的降级为战斗（后续的三连战/战斗下限规则会再平衡）。
  for (const type of ['fire', 'shop']) {
    let seen = 0;
    nodes.forEach(n => {
      if (n.type !== type) return;
      if (seen++ === 0) return;
      n.type = 'battle';
    });
  }
  // —— 保底房间（2026-09-09 试玩反馈；必须在入口/出口定型之后执行）——
  // 均匀随机布点可能整层没有火堆/补给站（13 格概率约 13%），且设施格会扎堆
  // （实测出现过相邻双火堆、三格两家补给站，收益重叠体验很差）。两条规则：
  //   1) 功能房（火堆/补给站）互不相邻，相邻的后者降级为战斗；
  //   2) 每层保底至少 1 个火堆、1 个补给站（缺就补在普通格上，尽量不贴功能房）。
  // 搜刮点（宝箱）不参与间距约束：它与商店相邻不算扎堆。
  const SPECIAL = new Set(['entrance', 'door', 'extraction']);
  const KEY_ROOMS = new Set(['fire', 'shop']);
  const FACILITY = new Set(['fire', 'chest', 'shop']);
  const isAdj = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.row - b.row) === 1;
  for (let a = 0; a < nodes.length; a++) {
    if (!KEY_ROOMS.has(nodes[a].type)) continue;
    for (let b = a + 1; b < nodes.length; b++) {
      if (KEY_ROOMS.has(nodes[b].type) && isAdj(nodes[a], nodes[b])) nodes[b].type = 'battle';
    }
  }
  const placed = [];
  // 保底落点不挤占战斗格：软下限 2 场（战斗格仅在事件格用尽时才可动用）、硬下限 1 场（最后一格绝不转职业）
  const battleCount = () => nodes.filter(n => n.type === 'battle').length;
  const isConvertible = (n, hard) => {
    if (SPECIAL.has(n.type) || FACILITY.has(n.type) || placed.includes(n)) return false;
    if (n.type === 'battle' && battleCount() <= (hard ? 1 : 2)) return false;
    return true;
  };
  const distToKey = (n) => Math.min(...nodes.filter(m => KEY_ROOMS.has(m.type)).map(m => Math.abs(n.x - m.x) + Math.abs(n.row - m.row)), Infinity);
  const byKind = (a, b) => (a.type === 'event' ? 0 : 1) - (b.type === 'event' ? 0 : 1) || a.idx - b.idx;
  for (const type of ['fire', 'shop']) {
    if (nodes.some(n => n.type === type)) continue;
    // 落点优先级：不贴功能房的格子 > 离功能房最远的格子；同类内优先吃事件格。
    // 火堆/补给站远离入口：只在 x ≥ 2 的格子里补（2026-09-09 玩法定版）。
    let pool = nodes.filter(n => isConvertible(n) && n.x >= 2 && !nodes.some(m => m !== n && KEY_ROOMS.has(m.type) && isAdj(n, m)))
      .sort(byKind);
    if (!pool.length) pool = nodes.filter(n => isConvertible(n, true) && n.x >= 2)
      .sort((a, b) => distToKey(b) - distToKey(a) || byKind(a, b));
    if (pool.length) { pool[0].type = type; placed.push(pool[0]); }
  }
  // —— 物资格保底（2026-09-10 玩法定版：每层至少 1 个搜刮点/宝箱格）——
  // 均匀随机可能整层没有搜刮点；缺就补在普通格上（优先吃事件格，战斗不足 3 场时不动战斗格）。
  // 搜刮点不参与火堆/补给站的间距约束，也允许与功能房相邻。
  if (!nodes.some(n => n.type === 'chest')) {
    const evPool = nodes.filter(n => n.type === 'event' && !placed.includes(n));
    const btPool = battleCount() > 3 ? nodes.filter(n => n.type === 'battle') : [];
    const pool = (evPool.length ? evPool : btPool).sort(byKind);
    if (pool.length) pool[0].type = 'chest';
  }
  // —— 紧急撤离点（2026-09-09 需求 #13：只能在第三层和第五层撤离）——
  // 紧急撤离点只放在第三层（li===2，献祭 3 张卡牌撤离）；第五层走终局撤离点（败 BOSS 后放行）。
  // 落点取向同火堆/补给站，优先吃事件格，其次战斗格（战斗不足 3 场时留给战斗下限补位）。
  if (li === 2) {
    const evPool = nodes.filter(n => n.type === 'event');
    const btPool = battleCount() > 3 ? nodes.filter(n => n.type === 'battle') : [];
    const pool = (evPool.length ? evPool : btPool).sort(byKind);
    if (pool.length) pool[0].type = 'emergencyExit';
  }
  // —— 连续战斗上限（2026-09-09 老板定向：不要连续三个战斗，最多连续两个）——
  // 能走出三连战 ⇔ 某战斗节点同时邻接 ≥2 个战斗节点（从其一进、经它、从另一出）。
  // 把这类节点降级为事件格并重复检查，直到每个战斗节点的战斗邻居 ≤1（两连战对仍保留）。
  // 放在功能房保底之后执行：降级只会新增事件格，不会破坏火堆/补给站保底与间距。
  for (let guard = 0; guard < 64; guard++) {
    const over = nodes.find(n => n.type === 'battle'
      && nodes.filter(m => m.type === 'battle' && isAdj(n, m)).length > 1);
    if (!over) break;
    over.type = 'event';
  }
  // —— 战斗数量下限：均匀随机可能整层几乎没有战斗（外层约 0.5% 概率不足 3 场），
  // 没有战斗就没有掉落与经验。不足 3 场时把事件格补成战斗——只挑「自身至多邻接 1 个
  // 战斗格、且这些邻居也没别的战斗邻居」的格子，保证既不制造三连战（上限不被下限打穿）。
  for (let guard = 0; guard < 16 && nodes.filter(n => n.type === 'battle').length < 3; guard++) {
    const cand = nodes.find(n => {
      if (n.type !== 'event') return false;
      const bn = nodes.filter(m => m !== n && m.type === 'battle' && isAdj(n, m));
      if (bn.length > 1) return false;
      return bn.every(m => nodes.filter(q => q !== m && q !== n && q.type === 'battle' && isAdj(m, q)).length === 0);
    });
    if (!cand) break;
    cand.type = 'battle';
  }
  // —— 野生敌人格上限（2026-09-09 玩法定版：每层 ≤4）——
  // 战斗下限补足后再裁一次：超过 4 场的战斗格降级为事件格（battle-min 不会超过 3 场，
  // 这里主要防功能房间距/撤离点规则把多余战斗格留在场上一并收敛）。
  { let battles = 0;
    nodes.forEach(n => { if (n.type === 'battle') { battles++; if (battles > 4) n.type = 'event'; } });
  }
  // —— 第四层终局三连：祭坛（弃3激活选奖励）→ 首脑 → 终局撤离点（2026-09-09 玩法定版）——
  // 从候选格按纵深 (x,row) 排序取最深处为首脑格、其前一格为祭坛格；
  // 候选池只吃事件/搜刮格（不动保底火堆/补给站/战斗数）。
  let altarEntrances = [];
  if (li === 3) {
    const cand = () => nodes.filter(n => n.type === 'event' || n.type === 'chest');
    const byDepth = (a, b) => (a.x - b.x) || (a.row - b.row);
    const sorted = cand().sort(byDepth);
    const boss = sorted[sorted.length - 1];
    const altar = sorted[sorted.length - 2];
    if (boss && altar) {
      boss.type = 'boss';
      altar.type = 'altar';
    }
  }
  nodes.forEach((n) => { if (!n.name) n.name = `${li + 1}层·${NAME_BY_TYPE[n.type] || '据点'}`; });
  return { nodes, entry, exit, altarEntrances, gridBounds: { minX: 0, maxX: width - 1, minRow: ROW_MIN, maxRow: ROW_MAX } };
}

function quality(layers) {
  const issues = []; if (layers.length !== 4) issues.push('必须生成四层');
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
    if (li === 3 && layer.nodes.filter(n => n.type === 'altar').length !== 1) issues.push(`层 4 缺少祭坛格`);
    if (li === 3 && layer.nodes.filter(n => n.type === 'boss').length !== 1) issues.push(`层 4 缺少首脑格`);
    if (layer.nodes.filter(n => n.type === 'battle').length > 4) issues.push(`层 ${li + 1} 战斗格超过 4`);
    if (layer.nodes.filter(n => n.type === 'chest').length > 4) issues.push(`层 ${li + 1} 宝箱格（物资格）超过 4`);
    if (layer.nodes.filter(n => n.type === 'chest').length < 1) issues.push(`层 ${li + 1} 缺少物资格（宝箱格）`);
    if (layer.nodes.some(n => (n.type === 'fire' || n.type === 'shop') && n.x < 2)) issues.push(`层 ${li + 1} 火堆/补给站贴着入口`);
  });
  for (let li = 0; li < layers.length - 1; li++) { const door = layers[li].doors?.[0]; const next = layers[li + 1];
    if (!door || door.toLayer !== li + 1 || !layers[li].nodes[door.at]?.next.some(([l, i]) => l === li + 1 && i === door.arriveAt) || !next.nodes[door.arriveAt]?.next.some(([l, i]) => l === li && i === door.at)) issues.push(`层间门 ${li} 非法`); }
  return { ok: issues.length === 0, issues };
}
function build(seed) { const layers = TARGETS.map((target, li) => makeLayer(li, target, WIDTHS[li], rng(`${seed}:layer:${li}`)));
  // 撤离只发生在第三层（紧急撤离点）与第四层（击败首脑后的终局撤离点）——
  // 环间门不再挂 exit 免费撤离标记，一律只向深处通行
  for (let li = 0; li < 3; li++) { const from = layers[li].nodes[layers[li].exit]; const to = layers[li + 1].nodes[layers[li + 1].entry];
    addEdge(from, to); layers[li].doors = [{ pair: `p${li + 1}`, at: from.idx, toLayer: li + 1, arriveAt: to.idx, exit: false }]; }
  layers[3].doors = []; return layers; }
export function generateLayeredMap(seed = 0) { let lastIssues = [];
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) { const layers = build(`${seed}:attempt:${attempt}`); const result = quality(layers); if (result.ok)
    return { seed, generatorVersion: GENERATOR_VERSION, layoutVersion: LAYOUT_VERSION, layers }; lastIssues = result.issues; }
  throw new Error(`地图生成失败：${MAX_ATTEMPTS} 次候选均未通过质量校验（${lastIssues.join('；')}）`); }
export { quality as validateGeneratedMap, GENERATOR_VERSION, LAYOUT_VERSION };
