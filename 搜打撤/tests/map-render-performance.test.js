import { afterEach, describe, expect, it, vi } from 'vitest';
import { mapNodeStatus, isConsumedMapNode } from '../game/src/core/map-node-state.js';
import { mapNodeInfo } from '../game/src/core/node-info.js';
import { nodeRestoreAt, beginNodeRestore } from '../game/src/run/node-restore-state.js';
import { drawMapBrushRoad, mapBrushRoadInView, mapBrushSteps } from '../game/src/core/map-brush-art.js';

afterEach(() => vi.restoreAllMocks());
const node = { li: 3, idx: 4, def: { type: 'altar' } };
function fixture() {
  const game = { layerIdx: 0, trackPos: 1, hp: 10, nodeRewards: {}, visited: { '3,4': 1 },
    layerData: [], altarActivated: true, altarRewardPending: false };
  Object.defineProperty(game, 'unrelatedRuntimeField', { enumerable: true, get() { throw new Error('whole game copied'); } });
  return game;
}
describe('地图节点热路径', () => {
  it('查询其他节点不枚举游戏运行态，也不修改当前位置', () => {
    const game = fixture();
    expect(mapNodeStatus(game, node).id).toBe('completed');
    expect(isConsumedMapNode(game, node)).toBe(true);
    expect(nodeRestoreAt(game, 3, 4)).toBeNull();
    expect([game.layerIdx, game.trackPos]).toEqual([0, 1]);
  });
  it('任意节点复原记录实时生效，原位置API与领取状态保持一致', () => {
    const game = fixture();
    const record = beginNodeRestore(game, { source: 'altar-offering', picks: 2 });
    game.nodeRewards['3,4'] = record;
    expect(nodeRestoreAt(game)).toBe(record);
    expect(nodeRestoreAt(game, 3, 4)).toBe(record);
    expect(mapNodeStatus(game, node).id).toBe('pending');
    expect(isConsumedMapNode(game, node)).toBe(false);
    record.finished = true;
    expect(nodeRestoreAt(game)).toBeNull();
    expect(mapNodeStatus(game, node).id).toBe('completed');
    expect(isConsumedMapNode(game, node)).toBe(true);
  });
  it('本帧状态可供标签复用，不再重复读取奖励；默认调用仍投影当前状态', () => {
    const game = fixture(), projection = mapNodeStatus(game, node);
    Object.defineProperty(game, 'nodeRewards', { get() { throw new Error('duplicate projection'); } });
    expect(mapNodeInfo(game, node, projection)).toEqual(['祭坛', '已完成 · 内容已结算，仍可通行。', 'altar', 'quiet']);
    const fresh = { layerData: [], visited: {}, altarActivated: false };
    expect(mapNodeInfo(fresh, node)[1]).toContain('未完成');
    fresh.altarActivated = true;
    expect(mapNodeInfo(fresh, node)[1]).toContain('已完成');
  });
});

const curve = { from: { x: 0, y: 0 }, c1: { x: 45, y: 12 }, c2: { x: 105, y: 12 }, to: { x: 150, y: 0 } };
const view = { left: -50, right: 50, top: -50, bottom: 50 };
describe('道路纹理裁剪与曲率采样', () => {
  it('两个端点都离屏但曲线穿过窗口时保留，透明边缘擦过窗口也保留', () => {
    expect(mapBrushRoadInView({ ...curve, from: { x: -300, y: 0 }, to: { x: 300, y: 0 } }, 1, view)).toBe(true);
    const shift = y => Object.fromEntries(Object.entries(curve).map(([key, p]) => [key, { x: p.x, y: p.y + y }]));
    expect(mapBrushRoadInView(shift(101), 1, view)).toBe(true);
    expect(mapBrushRoadInView(shift(200), 1, view)).toBe(false);
    expect(mapBrushRoadInView(shift(110), 2, view)).toBe(true);
  });
  it('离屏道路不建图或烘焙，移回视口时才绘制，同尺度复用缓存', () => {
    const painted = { ...curve, from: { x: 400, y: 400 }, c1: { x: 450, y: 410 }, c2: { x: 550, y: 410 }, to: { x: 600, y: 400 } };
    const context = () => Object.fromEntries(['save','restore','scale','translate','rotate','drawImage'].map(key => [key, vi.fn()]));
    const paint = context(), ctx = { ...context(), globalAlpha: 1 };
    const create = vi.spyOn(document, 'createElement');
    const image = { complete: true, naturalWidth: 1024, naturalHeight: 512 };
    vi.stubGlobal('Image', class { constructor() { return image; } });
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(paint);
    const road = { section: painted, edgeKey: 'offscreen-test' };
    try {
      expect(drawMapBrushRoad(ctx, road, 1, { view })).toBe(false);
      expect(create).not.toHaveBeenCalled();
      const shown = { left: 300, right: 700, top: 300, bottom: 500 };
      expect(drawMapBrushRoad(ctx, road, 1, { view: shown })).toBe(true);
      expect(create).toHaveBeenCalledTimes(1);
      const firstBake = paint.drawImage.mock.calls.length;
      expect(firstBake).toBeLessThan(40);
      expect(drawMapBrushRoad(ctx, road, .9, { view: shown })).toBe(true);
      expect(create).toHaveBeenCalledTimes(1);
      expect(paint.drawImage.mock.calls.length).toBeGreaterThan(firstBake);
      const secondBake = paint.drawImage.mock.calls.length;
      road.section = { ...painted, c1: { x: 460, y: 420 } };
      expect(drawMapBrushRoad(ctx, road, .9, { view: shown })).toBe(true);
      expect(create).toHaveBeenCalledTimes(1);
      expect(paint.drawImage.mock.calls.length).toBeGreaterThan(secondBake);
      const thirdBake = paint.drawImage.mock.calls.length;
      expect(drawMapBrushRoad(ctx, road, .9, { view: shown })).toBe(true);
      expect(create).toHaveBeenCalledTimes(1);
      expect(paint.drawImage).toHaveBeenCalledTimes(thirdBake);
    } finally { vi.unstubAllGlobals(); }
  });
  it('弯曲和放大提高采样数；典型道路误差不超过缓存像素的1/8', () => {
    const steps = mapBrushSteps(curve, 1);
    expect(steps).toBeLessThan(40);
    for (const density of [0.5, 1, 2, 4]) {
      const n = mapBrushSteps(curve, density);
      const acceleration = Math.max(...[
        [curve.from, curve.c1, curve.c2], [curve.c1, curve.c2, curve.to]
      ].map(([a,b,c]) => Math.hypot(c.x-2*b.x+a.x,c.y-2*b.y+a.y)*6));
      expect(acceleration*density/(8*n*n)).toBeLessThanOrEqual(.125);
    }
    expect(mapBrushSteps(curve, 4)).toBeGreaterThan(steps);
    expect(mapBrushSteps(curve, 100)).toBe(40);
  });
});
