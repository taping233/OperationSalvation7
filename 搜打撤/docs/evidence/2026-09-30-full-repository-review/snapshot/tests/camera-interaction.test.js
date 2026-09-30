import { describe, expect, it } from 'vitest';

globalThis.window = globalThis.window || {};
window.SDT = {};
const { nodeHitRadius } = await import('../game/src/core/camera.js');

describe('地图相机交互几何', () => {
  it('screen/world 转换互为逆运算', async () => {
    const Camera = window.SDT.Camera;
    const cam = new Camera({ cols: 30, rows: 30, tile: 48 }, 900, 600);
    cam.zoom = 1.5; cam.cx = 420; cam.cy = 360;
    const screen = cam.worldToScreen(500, 280);
    expect(cam.screenToWorld(screen.x, screen.y).x).toBeCloseTo(500);
    expect(cam.screenToWorld(screen.x, screen.y).y).toBeCloseTo(280);
  });

  it('fitLayer 使用当前层 bounds，而不是固定全景坐标', async () => {
    const cam = new window.SDT.Camera({ cols: 30, rows: 30, tile: 48 }, 900, 600);
    const game = { layerIdx: 1, nodePos: [[], [{ x: 200, y: 300 }, { x: 800, y: 900 }]] };
    expect(cam.fitLayer(game, 40)).toBe(true);
    expect(cam.cx).toBeCloseTo(500);
    expect(cam.cy).toBeCloseTo(600);
    expect(cam.zoom).toBeGreaterThan(0.4);
  });

  it('探索构图只使用当前合法分支，远处隐藏节点不稀释构图', () => {
    const cam = new window.SDT.Camera({ cols: 30, rows: 30, tile: 48 }, 900, 600);
    const game = { layerIdx: 0, trackPos: 0, seen: {'0,0': 1, '0,1': 1},
      nodePos: [[{x: 50,y: 80}, {x: 220,y: 160}, {x: 1400,y: 1400}]],
      layerData: [{logical: [{next: [[0,1]]}, {next: []}, {next: []}]}] };
    expect(cam.frameExploration(game)).toBe(true);
    expect(cam.zoom).toBeGreaterThan(1);
    for (const point of game.nodePos[0].slice(0, 2)) {
      const screen = cam.worldToScreen(point.x, point.y);
      expect(screen.x).toBeGreaterThan(80);
      expect(screen.x).toBeLessThan(820);
      expect(screen.y).toBeGreaterThan(100);
      expect(screen.y).toBeLessThan(500);
    }
    const routeZoom = cam.zoom;
    game.seen['0,2'] = 1;
    cam.frameExploration(game, true);
    expect(cam.zoom).toBeLessThan(routeZoom);
    cam.panBy(10, 10);
    expect(cam.frameMode).toBe('manual');
  });

  it.each([
    [0.4, 70, 28],
    [1, 34, 34],
    [2.5, 34, 85],
  ])('zoom=%s 时命中半径至少覆盖节点圆盘与最小屏幕尺寸', (zoom, expectedWorld, expectedScreen) => {
    expect(nodeHitRadius(zoom)).toBe(expectedWorld);
    expect(nodeHitRadius(zoom) * zoom).toBeGreaterThanOrEqual(expectedScreen);
  });
});
