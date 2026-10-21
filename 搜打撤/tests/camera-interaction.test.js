import { describe, expect, it } from 'vitest';

globalThis.window = globalThis.window || {};
window.SDT = {};
const { nodeHitRadius } = await import('../game/src/core/camera.js');

describe('地图相机交互几何', () => {
  it('入口居中并扩大周围视野，同时保留独立点击目标及HUD空间', () => {
    const cam = new window.SDT.Camera({cols:30,rows:30,tile:48},1920,968);
    const game = {layerIdx:0,trackPos:0,nodePos:[[{x:180,y:180},{x:360,y:180},{x:180,y:360}]],
      layerData:[{logical:[{next:[[0,1],[0,2]]},{next:[]},{next:[]}]}]};
    cam.frameExploration(game);
    const a=cam.worldToScreen(180,180),b=cam.worldToScreen(360,180);
    expect(a.x).toBeCloseTo(960);
    expect(a.y).toBeCloseTo(484);
    expect(cam.zoom).toBeLessThan(1.5);
    expect(b.x-a.x).toBeGreaterThanOrEqual(120);
    expect(nodeHitRadius(cam.zoom)*cam.zoom*2).toBeLessThan(b.x-a.x);
    expect(cam.screenToWorld(b.x,b.y).x).toBeCloseTo(game.nodePos[0][1].x);
    expect(cam.screenToWorld(b.x,b.y).y).toBeCloseTo(game.nodePos[0][1].y);
    cam.setDetailInset(530);
    cam.frameExploration(game);
    const entry = cam.worldToScreen(180,180);
    expect(entry.x).toBeCloseTo((1920-530)/2);
    expect(entry.y).toBeCloseTo(968/2);
    for(const p of game.nodePos[0]){
      const s=cam.worldToScreen(p.x,p.y);
      expect(s.x).toBeGreaterThan(100);
      expect(s.x).toBeLessThan(1920-530-100);
      expect(s.y).toBeGreaterThan(100);
      expect(s.y).toBeLessThan(968-100);
    }
  });
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
    expect(cam.zoom).toBeGreaterThan(.4);
    const framing = { cx:cam.cx, cy:cam.cy, zoom:cam.zoom };
    game.nodePos[0][2] = { x:1e6, y:1e6 };
    cam.frameExploration(game);
    expect({ cx:cam.cx, cy:cam.cy, zoom:cam.zoom }).toEqual(framing);
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

  it('展开和收回节点详情仅平移视野，世界点与点击换算保持一致', () => {
    const cam = new window.SDT.Camera({cols:30,rows:30,tile:48},1920,1080);
    cam.zoom=2;
    const point={x:640,y:640};
    const before=cam.worldToScreen(point.x,point.y);
    cam.setDetailInset(530);
    const after=cam.worldToScreen(point.x,point.y);
    expect(after.x).toBeCloseTo(before.x-265);
    expect(cam.screenToWorld(after.x,after.y)).toEqual(point);
    cam.setDetailInset(0);
    expect(cam.worldToScreen(point.x,point.y)).toEqual(before);
  });

  it('带详情的探索取景保留全部合法相邻点，未探明远点不参与', () => {
    const cam=new window.SDT.Camera({cols:30,rows:30,tile:48},900,600);
    const game={layerIdx:0,trackPos:0,seen:{'0,0':1,'0,1':1},
      nodePos:[[{x:50,y:80},{x:220,y:160},{x:1400,y:1400}]],
      layerData:[{logical:[{next:[[0,1]]},{next:[]},{next:[]}]}]};
    const before=JSON.stringify(game);
    cam.setDetailInset(310);
    cam.frameExploration(game);
    for(const point of game.nodePos[0].slice(0,2)){
      const screen=cam.worldToScreen(point.x,point.y);
      expect(screen.x).toBeGreaterThan(78);
      expect(screen.x).toBeLessThan(900-310-78);
    }
    expect(JSON.stringify(game)).toBe(before);
  });
});

describe('整层全景与安全取景',()=>{
  const fixture=()=>({layerIdx:0,trackPos:0,seen:{'0,0':1,'0,1':1},visited:{},
    nodePos:[[{x:100,y:100},{x:280,y:100},{x:100,y:1360},{x:1360,y:1360}]],
    layerData:[{logical:[{next:[[0,1]]},{next:[]},{next:[]},{next:[]}]}]});
  it('G框全部结构，F回当前分支；全程不揭示或访问未知节点类型',()=>{
    const game=fixture(),before=JSON.stringify(game);
    const cam=new window.SDT.Camera({cols:30,rows:30,tile:48},1180,664);
    cam.frameExploration(game,true);
    expect(cam.frameMode).toBe('overview');
    for(const p of game.nodePos[0]){
      const s=cam.worldToScreen(p.x,p.y);
      expect(s.x).toBeGreaterThanOrEqual(105);
      expect(s.x).toBeLessThanOrEqual(1075);
      expect(s.y).toBeGreaterThanOrEqual(95);
      expect(s.y).toBeLessThanOrEqual(490);
    }
    expect(cam.zoom).toBeLessThan(.4);
    const overviewZoom=cam.zoom;
    cam.frameExploration(game);
    expect(cam.frameMode).toBe('routes');
    expect(cam.zoom).toBeGreaterThan(overviewZoom);
    expect(JSON.stringify(game)).toBe(before);
  });
  it('有详情侧栏时全景仍将整层中心点留在可见安全区',()=>{
    const cam=new window.SDT.Camera({cols:30,rows:30,tile:48},1180,664);
    cam.setDetailInset(350);cam.frameExploration(fixture(),true);
    for(const p of fixture().nodePos[0]){
      const s=cam.worldToScreen(p.x,p.y);
      expect(s.x).toBeGreaterThan(90);expect(s.x).toBeLessThan(1180-350-90);
      expect(s.y).toBeGreaterThan(90);expect(s.y).toBeLessThan(500);
    }
  });
  it('低于原0.4的全景缩放后滚轮不会反向跳大，单点不会产生无穷值',()=>{
    const cam=new window.SDT.Camera({cols:30,rows:30,tile:48},1180,664);
    cam.frameExploration(fixture(),true);const z=cam.zoom;
    cam.zoomAt(500,300,.9);expect(cam.zoom).toBeLessThan(z);
    const g=fixture();g.nodePos=[[{x:100,y:100}]];g.layerData[0].logical=[{next:[]}];
    cam.frameExploration(g,true);expect([cam.cx,cam.cy,cam.zoom].every(Number.isFinite)).toBe(true);
  });
  it('全景仅允许有限留白位移，详情侧栏仍保留节点可见',()=>{
    const cam=new window.SDT.Camera({cols:300,rows:300,tile:48},1180,664);
    const game=fixture(); cam.setDetailInset(350); cam.frameExploration(game,true);
    const before={cx:cam.cx,cy:cam.cy};
    cam.panBy(100000,-100000);
    expect((before.cx-cam.cx)*cam.zoom).toBeCloseTo(1180/1280*80);
    expect((cam.cy-before.cy)*cam.zoom).toBeCloseTo(1180/1280*80);
    for(const p of game.nodePos[0]){
      const s=cam.worldToScreen(p.x,p.y);
      expect(s.x).toBeGreaterThan(0);expect(s.x).toBeLessThan(830);
      expect(s.y).toBeGreaterThan(0);expect(s.y).toBeLessThan(664);
    }
  });
  it('允许边缘节点居中并留出四周，换层和窗口变化重新计算',()=>{
    const cam=new window.SDT.Camera({cols:300,rows:300,tile:48},1180,664);
    const game=fixture(); cam.frameExploration(game); cam.zoom=2;
    cam.panBy(100000,100000);
    const first=cam.worldToScreen(100,100);
    expect(first.x).toBeGreaterThan(1180/2);
    expect(first.x).toBeLessThan(1180);
    expect(first.y).toBeGreaterThan(664/2);
    expect(first.y).toBeLessThan(664);
    cam.panBy(-100000,-100000);
    const last=cam.worldToScreen(1360,1360);
    expect(last.x).toBeGreaterThan(0);
    expect(last.x).toBeLessThan(1180/2);
    expect(last.y).toBeGreaterThan(0);
    expect(last.y).toBeLessThan(664/2);
    game.nodePos.push([{x:300,y:400}]);game.layerIdx=1;
    cam.resize(900,600);
    const only=cam.worldToScreen(300,400);
    expect(only.x).toBeGreaterThan(900*.2);
    expect(only.x).toBeLessThan(900*.8);
    expect(only.y).toBeGreaterThan(600*.2);
    expect(only.y).toBeLessThan(600*.8);
  });
});
