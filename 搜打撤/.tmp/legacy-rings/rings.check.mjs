const RINGS = {
  // buildNodePositions 依赖的世界坐标基准（与 mapData.js 的 cols/rows/tile 相同）
  cols: 30,
  rows: 30,
  tile: 48,

  // ---------- 结点布局（分布式结点地图的唯一真源） ----------
  // 为每个 (li, idx) 逻辑格确定性生成结点中心坐标（世界像素）：
  // 每环按轨道顺序在极坐标上均匀取角 + 半径按环 + hash 抖动 + 同环间距防重叠微调；
  // 中央祭坛在正中心，三只 BOSS 环绕。布局确定（无随机数），同输入必得同输出。
  nodeLayout: {
    radii: [560, 390, 225],  // 三环基础半径（外 / 中 / 内）
    radiusJitter: 44,        // 半径抖动幅度（± 一半）
    angleJitter: 0.38,       // 角度抖动（占相邻角距的比例上限）
    bossRadius: 96,          // BOSS 结点环绕祭坛的半径
    minGap: 116,             // 同环相邻结点的最小间距（含结点半径余量）
  },

  buildNodePositions(logicalCounts) {
    const T = this.tile;
    const cx = this.cols * T / 2, cy = this.rows * T / 2;
    const lay = this.nodeLayout;
    const lo = 14, hiX = this.cols * T - 14, hiY = this.rows * T - 14;   // 板内安全边界
    const layers = logicalCounts.map((n, li) => {
      const R = lay.radii[li];
      const arr = [];
      for (let i = 0; i < n; i++) {
        const a = -Math.PI / 2 + (i / n) * Math.PI * 2 +
          (this._hash(li * 91 + i * 7, li * 13 + 5) - 0.5) * lay.angleJitter * (Math.PI * 2 / n);
        const r = R + (this._hash(li * 17 + i * 3 + 1, li * 29 + 2) - 0.5) * lay.radiusJitter;
        arr.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r });
      }
      // 防重叠微调：同环内任意两点距 < minGap 时沿连线推开，迭代收敛
      for (let pass = 0; pass < 24; pass++) {
        let moved = false;
        for (let a = 0; a < n; a++) {
          for (let b = a + 1; b < n; b++) {
            const dx = arr[b].x - arr[a].x, dy = arr[b].y - arr[a].y;
            const d = Math.hypot(dx, dy);
            if (d >= lay.minGap || d < 0.001) continue;
            const push = (lay.minGap - d) / 2, ux = dx / d, uy = dy / d;
            arr[a].x -= ux * push; arr[a].y -= uy * push;
            arr[b].x += ux * push; arr[b].y += uy * push;
            moved = true;
          }
        }
        if (!moved) break;
      }
      // 拉回板内
      for (const p of arr) {
        p.x = Math.min(hiX, Math.max(lo, p.x));
        p.y = Math.min(hiY, Math.max(lo, p.y));
      }
      return arr;
    });
    // 中央区：祭坛居中，三只 BOSS 环绕（与 MAP.center 顺序一一对应）
    const center = [{ x: cx, y: cy }];
    const br = lay.bossRadius;
    [[-Math.PI / 2, -0.35], [Math.PI / 6 - 0.35, 0.3], [Math.PI * 5 / 6 + 0.35, -0.3]].forEach(([a, dj]) => {
      center.push({ x: cx + Math.cos(a + dj) * br, y: cy + Math.sin(a + dj) * br });
    });
    return { layers, center };
  },

  // 确定性 hash → [0,1)
  _hash(a, b) {
    let n = (Math.floor(a) * 374761393 + Math.floor(b) * 668265263) >>> 0;
    n = ((n ^ (n >>> 13)) * 1274126177) >>> 0;
    return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
  },

  // 生成一圈顺时针轨道（inset = 向内缩进的圈层，0=外圈）
  makeRing(inset) {
    const size = 8 - inset * 2, o = inset, ring = [];
    for (let x = 0; x < size; x++) ring.push({ x: o + x, y: o });              // 上边 →
    for (let y = 1; y < size; y++) ring.push({ x: o + size - 1, y: o + y });   // 右边 ↓
    for (let x = size - 2; x >= 0; x--) ring.push({ x: o + x, y: o + size - 1 });// 下边 ←
    for (let y = size - 2; y >= 1; y--) ring.push({ x: o, y: o + y });         // 左边 ↑
    return ring;
  },

  // ---------- 三个环层 ----------
  layers: [
    {
      id: 'L1', name: '外环 · 荒地边缘', nameEn: 'The Ashen Fringe', inset: 0, color: '#6e5133',   // 铁锈沙土：荒地外环
      risk: '低', tempo: '补给与试探（战斗较少，适合整备）',

      entrances: [0, 7, 14, 21],
      entranceNames: ['清扫口A · 西北角', '清扫口B · 东北角', '清扫口C · 东南角', '清扫口D · 西南角'],
      doors: [   // 出口和下一层的入口（exit=true 表示可从此撤离）
        { pair: 'p1', at: 1,  toLayer: 1, arriveAt: 0,  exit: true },  // (1,0)↔(1,1)
        { pair: 'p2', at: 8,  toLayer: 1, arriveAt: 5,  exit: true },  // (7,1)↔(6,1)
        { pair: 'p3', at: 15, toLayer: 1, arriveAt: 10, exit: true },  // (6,7)↔(6,6)
        { pair: 'p4', at: 22, toLayer: 1, arriveAt: 15, exit: true },  // (0,6)↔(1,6)
      ],
      cells: {
        // 2:{'两个币'} 3:{'商店'} 4:{'事件'} 5:{'战斗'} 6:{'木材×1'}
        2: { type: 'coin', n: 2 },
        3: { type: 'shop' },
        4: { type: 'event' },
        5: { type: 'battle' },
        6: { type: 'wood', n: 1 },
        // 9:{'两个币'} 10:{'战斗'} 11:{'事件'} 12:{'战斗'} 13:{'战斗'}
        9:  { type: 'coin', n: 2 },
        10: { type: 'battle' },
        11: { type: 'event' },
        12: { type: 'battle' },
        13: { type: 'battle' },
        // 16:{'战斗'} 17:{'小宝箱'} 18:{'事件'} 19:{'两个币'} 20:{'战斗'}
        16: { type: 'battle' },
        17: { type: 'chest' },
        18: { type: 'event' },
        19: { type: 'coin', n: 2 },
        20: { type: 'battle' },
        // 23:{'火堆'} 24:{'火堆'} 25:{'事件'} 26:{'战斗'} 27:{'木材×1'}
        23: { type: 'fire' },
        24: { type: 'fire' },
        25: { type: 'event' },
        26: { type: 'battle' },
        27: { type: 'wood', n: 1 },
      },
    },

    {
      id: 'L2', name: '中环 · 废墟市街', nameEn: 'The Rusted Blocks', inset: 1, color: '#3d5a50',   // 锈绿残垣：中环街区
      risk: '中', tempo: '分岔与取舍（战斗、钥匙、商店交错）',

      doors: [
        { pair: 'p5', at: 13, toLayer: 2, arriveAt: 8 },   // (3,6)→(3,5) 商店，第三层入口
        { pair: 'p6', at: 18, toLayer: 2, arriveAt: 11 },  // (1,3)→(2,3) 商店，第三层入口
      ],
      cells: {
        0:  { type: 'coin', n: 2 },   // (1,1) 第二层入口，2币
        1:  { type: 'fire' },         // (2,1) 火堆
        2:  { type: 'fire' },         // (3,1) 火堆
        3:  { type: 'battle' },       // (4,1) 战斗
        4:  { type: 'event' },        // (5,1) 事件
        5:  { type: 'coin', n: 2 },   // (6,1) 2币
        6:  { type: 'battle' },       // (6,2) 战斗
        7:  { type: 'rations' },      // (6,3) 口粮
        8:  { type: 'battle' },       // (6,4) 战斗
        9:  { type: 'coin', n: 4 },   // (6,5) 4币
        10: { type: 'coin', n: 2 },   // (6,6) 2层入口，2币
        11: { type: 'battle' },       // (5,6) 战斗
        12: { type: 'key' },          // (4,6) 钥匙
        13: { type: 'shop' },         // (3,6) 商店，第三层入口
        14: { type: 'battle' },       // (2,6) 战斗
        15: { type: 'coin', n: 2 },   // (1,6) 2币
        16: { type: 'battle' },       // (1,5) 战斗
        17: { type: 'coin', n: 3 },   // (1,4) 3币
        18: { type: 'shop' },         // (1,3) 商店，第三层入口
        19: { type: 'event' },        // (1,2) 事件
      },
    },

    {
      id: 'L3', name: '内环 · 污染核心区', nameEn: 'The Contaminated Core', inset: 2, color: '#443a63',   // 病变紫岩：污染核心
      risk: '高', tempo: '高压冲刺（高价值、精英预警、紧急撤离）',

      altarEntrances: [
        { pair: 'a1', at: 1 },    // (3,2) 祭坛入口（格本身+4币）
        { pair: 'a2', at: 11 },   // (2,3) 祭坛入口（格本身是商店）
      ],
      cells: {
        0:  { type: 'battle' },          // (2,2) 战斗
        1:  { type: 'coin', n: 4 },      // (3,2) 4币，祭坛入口
        2:  { type: 'wood', n: 2 },      // (4,2) 2木材
        3:  { type: 'battle' },          // (5,2) 战斗
        4:  { type: 'fire' },            // (5,3) 火堆
        5:  { type: 'fire' },            // (5,4) 火堆
        6:  { type: 'battle' },          // (5,5) 战斗
        7:  { type: 'event' },           // (4,5) 事件
        8:  { type: 'shop' },            // (3,5) 商店
        9:  { type: 'battle' },          // (2,5) 战斗
        10: { type: 'emergencyExit' },   // (2,4) 紧急撤离点，花10币直接撤离
        11: { type: 'shop' },            // (2,3) 商店，祭坛入口
      },
    },
  ],

  // ---------- 中央 2×2（渲染与悬浮提示用；战斗经由祭坛触发） ----------
  center: [
    { x: 3, y: 3, type: 'altar', name: '污染核心' },
    { x: 4, y: 3, type: 'boss', icon: '将', name: '肃清总督 · 550HP' },
    { x: 3, y: 4, type: 'boss', icon: '能', name: '异能领主 · 400HP' },
    { x: 4, y: 4, type: 'boss', icon: '巢', name: '变异巢母 · 320HP' },
  ],
};
const counts=RINGS.layers.map(l=>RINGS.makeRing(l.inset).length);
const layout=RINGS.buildNodePositions(counts);
console.log('每环结点数:', counts.join('/'));
console.log('坐标层数:', layout.layers.map(a=>a.length).join('/'), '| center:', layout.center.length);
console.log('中心坐标:', JSON.stringify(layout.center[0]), '| 首环首点:', JSON.stringify(layout.layers[0][0]).slice(0,60));
console.log('环间门:', RINGS.layers.map((l,i)=>(l.doors||[]).length).join('/'), '| 祭坛入口:', RINGS.layers.map(l=>(l.altarEntrances||[]).length).join('/'));
