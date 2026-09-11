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

