import { describe, expect, it } from 'vitest';
import { checkConnectivity } from '../game/src/run/map-graph.js';
import { findMapTravelPath } from '../game/src/run/map-travel-path.js';
import { createLayeredMap } from '../game/src/run/layeredMap.js';

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

  it('显式图保留孤立节点，不把没有任何边的节点漏掉', () => {
    const layers = [{ logical: [
      { next: [[0, 1]] }, { next: [[0, 0]] }, { next: [] },
    ], entrances: [0] }];
    expect(checkConnectivity(layers)).toEqual({ ok: false, unreachable: ['0,2'] });
  });

  it('显式图只沿真实 next 方向行走，不用反向边补出不存在的路线', () => {
    const layers = [{ logical: [{ next: [] }, { next: [[0, 0]] }], entrances: [0] }];
    expect(findMapTravelPath({ layerIdx: 0, trackPos: 0, layerData: layers }, { li: 0, idx: 1 })).toBeNull();
    expect(checkConnectivity(layers)).toEqual({ ok: false, unreachable: ['0,1'] });
  });

  it('部分显式图不会退回旧闭环', () => {
    expect(checkConnectivity([{ logical: [{ next: [] }, {}], entrances: [0] }]))
      .toEqual({ ok: false, unreachable: ['0,1'] });
  });

  it('显式图层门可独立于 next 穿层，只沿门描述方向通行', () => {
    const layers = [
      { logical: [{ next: [] }], entrances: [0], doors: [{ at: 0, toLayer: 1, arriveAt: 0 }] },
      { logical: [{ next: [] }] },
    ];
    const before = JSON.stringify(layers);
    expect(checkConnectivity(layers)).toEqual({ ok: true, unreachable: [] });
    expect(JSON.stringify(layers)).toBe(before);
    layers[0].doors = [];
    layers[1].doors = [{ at: 0, toLayer: 0, arriveAt: 0 }];
    expect(checkConnectivity(layers)).toEqual({ ok: false, unreachable: ['1,0'] });
  });

  it('空的旧地图保持空结果，单个显式入口节点保持可达', () => {
    expect(checkConnectivity([])).toEqual({ ok: true, unreachable: [] });
    expect(checkConnectivity([{ logical: [{ next: [] }], entrances: [0] }]))
      .toEqual({ ok: true, unreachable: [] });
  });

  it('现行生成器的完整显式图在 1000 个种子上仍全节点可达', () => {
    for (let seed = 0; seed < 1000; seed++) {
      expect(checkConnectivity(createLayeredMap(`audit-${seed}`)), `seed=${seed}`)
        .toEqual({ ok: true, unreachable: [] });
    }
  });
});
