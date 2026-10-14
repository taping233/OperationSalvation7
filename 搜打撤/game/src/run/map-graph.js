// @ts-check
/* ============================================================
 * map-graph.js —— 环层图连通性检查（纯函数）
 *
 * 显式图沿 next 与门描述的真实方向行走；无 next 的旧地图保留
 *「闭环轨道 + 双向门」兼容结构。此模块对生成结果
 * 做整体可达性验证（procedural-gen：不要把不可达的结点发给玩家）。
 * 只做检查不改数据；session 在构建 layerData 后调用并告警。
 * ============================================================ */

/**
 * 环层地图数据（结构与 layeredMap.js 的 layerData 输出对齐）。
 * 未在生成器里显式给出的字段一律可选：手工层常省略 doors 等。
 * @typedef {Object} MapLayer
 * @property {{ next?: [number, number][] }[]} logical   每层逻辑结点；next 为 [目标层号, 层内序号]（生成器图才带）
 * @property {{ pair?: string, at: number, toLayer: number, arriveAt: number }[]} [doors]   环间门（显式图按记录方向，旧图双向）
 * @property {{ at: number }[]} [altarEntrances]         祭坛入口（连向中央结点 '-1,0'）
 * @property {number[]} [entrances]                      第 0 层授权图的玩家入口序号
 */

  /** @param {MapLayer} ld */
  const authoredLayer = ld => ld.logical.some(cell => Array.isArray(cell.next));

  // 显式 next 不补反向边；旧环与旧门仍互连。
  /**
   * @param {MapLayer[]} layerData
   * @returns {{ adj: Map<string, Set<string>>, key: (li: number, idx: number) => string }}
   *   adj 键/值均为 'li,idx' 结点键（含中央 '-1,0'）。
   */
  function buildAdjacency(layerData) {
    const adj = new Map();
    const key = (li, idx) => `${li},${idx}`;
    const link = (a, b, bidirectional = true) => {
      if (!adj.has(a)) adj.set(a, new Set());
      if (!adj.has(b)) adj.set(b, new Set());
      adj.get(a).add(b);
      if (bidirectional) adj.get(b).add(a);
    };
    layerData.forEach((ld, li) => {
      const n = ld.logical.length;
      // Any explicit next marks an authored layer. Missing cells stay isolated
      // rather than silently gaining the unrelated legacy ring edges.
      const authoredGraph = authoredLayer(ld);
      for (let i = 0; i < n; i++) {
        if (!adj.has(key(li, i))) adj.set(key(li, i), new Set());
        if (authoredGraph) {
          for (const next of (ld.logical[i].next || [])) {
            const [toLi, toIdx] = next;
            link(key(li, i), key(toLi, toIdx), false);
          }
        } else {
          link(key(li, i), key(li, (i + 1) % n));
          link(key(li, i), key(li, (i - 1 + n) % n));
        }
      }
      // Door actions call enterLayer directly, so metadata is a real edge even
      // without next, but an authored door does not create a return action.
      (ld.doors || []).forEach(d => link(key(li, d.at), key(d.toLayer, d.arriveAt), !authoredGraph));
      (ld.altarEntrances || []).forEach(a => link(key(li, a.at), key(-1, 0)));   // 祭坛入口 → 中央
    });
    return { adj, key };
  }

  /**
   * 从第 0 层显式入口（旧图为 0 号结点）出发做可达性 flood-fill。
   * @param {MapLayer[]} layerData
   * @returns {{ ok: boolean, unreachable: string[] }} unreachable 为 'li,idx' 列表
   */
  function checkConnectivity(layerData) {
    const { adj, key } = buildAdjacency(layerData);
    const all = [...adj.keys()];
    if (!all.length) return { ok: true, unreachable: [] };
    const authored = layerData[0] && authoredLayer(layerData[0]);
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

export { checkConnectivity };
