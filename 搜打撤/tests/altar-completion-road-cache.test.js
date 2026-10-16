import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const probe = vi.hoisted(() => ({ road:vi.fn() }));
vi.mock('../game/src/core/map-brush-art.js', async importOriginal => ({ ...await importOriginal(), drawMapBrushRoad:probe.road }));
vi.mock('../game/src/core/motion.js', () => ({ reduceMotion:() => true }));
let Renderer, game, ctx;
const context = () => new Proxy({ globalAlpha:1, drawImage:vi.fn(), measureText:() => ({ width:10 }) }, {
  get(target, key) { return target[key] ??= String(key).startsWith('create') ? () => ({ addColorStop() {} }) : vi.fn(); },
});
const road = () => {
  probe.road.mockClear(); Renderer.draw(ctx, game);
  return probe.road.mock.calls.find(call => call[1].edgeKey === '0,0|0,1')?.[1];
};
beforeEach(async () => {
  vi.resetModules();
  vi.stubGlobal('Image', class { complete = false; naturalWidth = 0; });
  vi.stubGlobal('Path2D', class { moveTo() {} quadraticCurveTo() {} bezierCurveTo() {} lineTo() {} closePath() {} addPath() {} });
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(context);
  const nodes = [{ li:0, idx:0, x:100, y:100, def:{ type:'blank' } }, { li:0, idx:1, x:340, y:100, def:{ type:'altar' } }];
  game = { nodes, layerIdx:0, trackPos:0, nodePos:[nodes], seen:{ '0,0':1, '0,1':1 }, visited:{ '0,1':1 },
    layerData:[{ logical:nodes.map((n, idx) => ({ def:n.def, next:[[0, 1 - idx]] })), doors:[] }], toggles:{ index:false },
    cam:{ viewW:1920, viewH:1080, zoom:1, cx:100, cy:100, worldToScreen:() => ({ x:400, y:300 }) },
  };
  window.SDT = { Motion:{ reduceMotion:() => true } };
  await import('../game/src/core/renderer.js'); Renderer = window.SDT.Renderer; ctx = context();
});
afterEach(() => { Renderer?.dispose(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe('祭坛状态参与地图道路裁剪缓存', () => {
  it.each([
    ['领取回赠改变待领标记', { altarActivated:true, altarRewardPending:true }, 'altarRewardPending', false],
    ['碎片直接激活祭坛', { altarActivated:false, altarRewardPending:false }, 'altarActivated', true],
  ])('%s时不依赖visited数量变化重算端点；相同状态仍复用', (_label, flags, field, value) => {
    Object.assign(game, flags);
    const pending = road(), count = Object.keys(game.visited).length;
    expect(pending).toBeTruthy(); expect(road()).toBe(pending);
    const previousSection = pending.section;
    game[field] = value;
    const completed = road();
    expect(Object.keys(game.visited)).toHaveLength(count);
    // The renderer reuses the descriptor, replacing only its geometry.
    expect(completed).toBe(pending);
    expect(completed.section).not.toBe(previousSection);
    expect(completed.section).toEqual(previousSection); // Both states retain the same full node icon and status label.
    expect(road()).toBe(completed);
  });
});
