import { describe, expect, it } from 'vitest';
import { checkConnectivity } from '../game/src/run/map-graph.js';

// 环层图连通性（procedural-gen）：闭环轨道 + 双向门结构下，
// 从 (0层,0号) 出发必须能到达全部结点；门缺失/单向会造成孤岛。

const mkLayer = (li, n, doors = [], altarEntrances = []) => ({
  logical: Array.from({ length: n }, () => ({})),
  doors,
  altarEntrances,
});

describe('地图连通性校验', () => {
  it('单层闭环：所有结点互达', () => {
    const res = checkConnectivity([mkLayer(0, 6)]);
    expect(res.ok).toBe(true);
  });

  it('双层经双向门连通', () => {
    const layers = [
      mkLayer(0, 6, [{ pair: 'p1', at: 0, toLayer: 1, arriveAt: 2 }]),
      mkLayer(1, 8, [{ pair: 'p1', at: 2, toLayer: 0, arriveAt: 0 }]),
    ];
    expect(checkConnectivity(layers).ok).toBe(true);
  });

  it('三层链式 + 祭坛入口可达中央', () => {
    const layers = [
      mkLayer(0, 6, [{ pair: 'a', at: 1, toLayer: 1, arriveAt: 3 }]),
      mkLayer(1, 8, [
        { pair: 'a', at: 3, toLayer: 0, arriveAt: 1 },
        { pair: 'b', at: 5, toLayer: 2, arriveAt: 0 },
      ], [{ at: 2 }]),
      mkLayer(2, 5, [{ pair: 'b', at: 0, toLayer: 1, arriveAt: 5 }]),
    ];
    const res = checkConnectivity(layers);
    expect(res.ok).toBe(true);
  });

  it('门缺失的层成为孤岛 → 校验失败并列出不可达结点', () => {
    const layers = [
      mkLayer(0, 4),
      mkLayer(1, 4),   // 没有任何门
    ];
    const res = checkConnectivity(layers);
    expect(res.ok).toBe(false);
    expect(res.unreachable).toEqual(['1,0', '1,1', '1,2', '1,3']);
  });
});
