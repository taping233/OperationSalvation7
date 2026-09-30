// @ts-check
/* ============================================================
 * map-graph.js —— 环层图连通性检查（纯函数）
 *
 * 地图为「闭环轨道 + 双向门」结构：环上任意结点经轨道互达，
 * 环间只靠 door（含 altarEntrances 入口）转移。此模块对生成结果
 * 做整体可达性验证（procedural-gen：不要把不可达的结点发给玩家）。
 * 只做检查不改数据；session 在构建 layerData 后调用并告警。
 * ============================================================ */

/**
 * 环层地图数据（结构与 layeredMap.js 的 layerData 输出对齐）。
 * 未在生成器里显式给出的字段一律可选：手工层常省略 doors 等。
 * @typedef {Object} MapLayer
 * @property {{ next?: [number, number][] }[]} logical   每层逻辑结点；next 为 [目标层号, 层内序号]（生成器图才带）
 * @property {{ pair?: string, at: number, toLayer: number, arriveAt: number }[]} [doors]   环间双向门
 * @property {{ at: number }[]} [altarEntrances]         祭坛入口（连向中央结点 '-1,0'）
 * @property {number[]} [entrances]                      第 0 层授权图的玩家入口序号
 */

  // 构建邻接表：环上相邻结点互连（闭环），门/祭坛入口按转移边连接
  /**
   * @param {MapLayer[]} layerData
   * @returns {{ adj: Map<string, Set<string>>, key: (li: number, idx: number) => string }}
   *   adj 键/值均为 'li,idx' 结点键（含中央 '-1,0'）。
   */
  function buildAdjacency(layerData) {
    const adj = new Map();
    const key = (li, idx) => `${li},${idx}`;
    const link = (a, b) => {
      if (!adj.has(a)) adj.set(a, new Set());
      if (!adj.has(b)) adj.set(b, new Set());
      adj.get(a).add(b);
      adj.get(b).add(a);
    };
    layerData.forEach((ld, li) => {
      const n = ld.logical.length;
      // A generated layer is authored only when every logical cell carries a
      // next array. Partial data must not silently turn into an unrelated ring.
      const authoredGraph = n > 0 && ld.logical.every(cell => Array.isArray(cell.next));
      for (let i = 0; i < n; i++) {
        if (authoredGraph) {
          for (const next of (ld.logical[i].next || [])) {
            const [toLi, toIdx] = next;
            link(key(li, i), key(toLi, toIdx));
          }
        } else {
          link(key(li, i), key(li, (i + 1) % n));
          link(key(li, i), key(li, (i - 1 + n) % n));
        }
      }
      (ld.doors || []).forEach(d => link(key(li, d.at), key(d.toLayer, d.arriveAt)));
      (ld.altarEntrances || []).forEach(a => link(key(li, a.at), key(-1, 0)));   // 祭坛入口 → 中央
    });
    return { adj, key };
  }

  /**
   * 从 (0层,0号结点) 出发做可达性 flood-fill。
   * @param {MapLayer[]} layerData
   * @returns {{ ok: boolean, unreachable: string[] }} unreachable 为 'li,idx' 列表
   */
  function checkConnectivity(layerData) {
    const { adj, key } = buildAdjacency(layerData);
    const all = [...adj.keys()];
    if (!all.length) return { ok: true, unreachable: [] };
    const authored = layerData[0]?.logical?.length > 0 && layerData[0].logical.every(cell => Array.isArray(cell.next));
    const starts = authored && layerData[0]?.entrances?.length ? layerData[0].entrances : [0];
    const seen = new Set(starts.map(idx => key(0, idx)));
    const queue = starts.map(idx => key(0, idx));
    while (queue.length) {
      const cur = queue.shift();
      for (const next of adj.get(cur) || []) {
        if (!seen.has(next)) { seen.add(next); queue.push(next); }
      }
    }
    const unreachable = all.filter(k => !seen.has(k)).sort();
    return { ok: unreachable.length === 0, unreachable };
  }

export { buildAdjacency, checkConnectivity };
