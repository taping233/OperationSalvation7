import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const { roads } = vi.hoisted(() => ({ roads: vi.fn() }));
vi.mock('../game/src/core/map-brush-art.js', async importOriginal => ({
  ...await importOriginal(), drawMapBrushRoad: roads,
}));
let renderer, game, ctx;
const context = () => new Proxy({ measureText: () => ({ width: 12 }) }, {
  get(target, key) { return target[key] ??= String(key).startsWith('create') ? () => ({ addColorStop() {} }) : () => {}; },
});
beforeEach(async () => {
  vi.resetModules(); roads.mockClear();
  vi.stubGlobal('Image', class { complete = false; naturalWidth = 0; });
  vi.stubGlobal('Path2D', class { moveTo() {} quadraticCurveTo() {} bezierCurveTo() {} lineTo() {} closePath() {} addPath() {} });
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(context);
  window.SDT = { Motion: { reduceMotion: () => true } };
  const points = [[100,200],[280,200],[100,500],[280,560]];
  const nodes = points.map(([x,y],idx) => ({ x,y,li:0,idx,def:{type:'blank',name:'空地'} }));
  game = { nodes, layerIdx:0, trackPos:0, seen:{}, visited:{}, nodePos:[nodes],
    layerData:[{logical:nodes.map((node,idx)=>({def:node.def,next:[[0,idx^1]]})),doors:[]}],
    toggles:{index:false}, state:'idle', time:100,
    cam:{viewW:1280,viewH:800,cx:200,cy:400,zoom:1,
      worldToScreen(x,y){return {x:x-this.cx+640,y:y-this.cy+400};}} };
  await import('../game/src/core/renderer.js'); renderer=window.SDT.Renderer;ctx=context();
});
afterEach(() => { renderer?.dispose();vi.restoreAllMocks();vi.unstubAllGlobals(); });
function sections() {
  roads.mockClear(); renderer.draw(ctx,game);
  return new Map(roads.mock.calls.map(([,road])=>[road.edgeKey,road.section]));
}
it('预览改变仅重裁关联道路，其余道路保留纹理输入对象', () => {
  const initial=sections(); game.moveTarget={li:0,idx:1}; const first=sections();
  expect(first.get('0,0|0,1')).not.toBe(initial.get('0,0|0,1'));
  expect(first.get('0,2|0,3')).toBe(initial.get('0,2|0,3'));
  expect(sections().get('0,0|0,1')).toBe(first.get('0,0|0,1'));
  game.moveTarget={li:0,idx:3}; const second=sections();
  expect(second.get('0,0|0,1')).not.toBe(first.get('0,0|0,1'));
  expect(second.get('0,2|0,3')).not.toBe(first.get('0,2|0,3'));
  expect(second.get('0,0|0,1')).toEqual(initial.get('0,0|0,1'));
});
it('缩放、视口与原位奖励状态改变仍重裁，不复用过期留白', () => {
  const initial=sections();game.cam.zoom=.75; const zoomed=sections();
  for(const [key,section] of initial)expect(zoomed.get(key)).not.toBe(section);
  game.cam.viewW=1100; const resized=sections();
  for(const [key,section] of zoomed)expect(resized.get(key)).not.toBe(section);
  game.entrySupply={layerIdx:0,trackPos:2,cardIds:['a'],taken:[]}; const pending=sections();
  expect(pending.get('0,2|0,3')).not.toEqual(resized.get('0,2|0,3'));
  game.entrySupply.taken.push(0); const complete=sections();
  expect(complete.get('0,2|0,3')).toEqual(resized.get('0,2|0,3'));
});
it('清空预览仅恢复旧目标关联边', () => {
  const initial=sections();game.moveTarget={li:0,idx:3}; const selected=sections();
  game.moveTarget=null; const cleared=sections();
  expect(cleared.get('0,0|0,1')).toBe(initial.get('0,0|0,1'));
  expect(cleared.get('0,2|0,3')).not.toBe(selected.get('0,2|0,3'));
  expect(cleared.get('0,2|0,3')).toEqual(initial.get('0,2|0,3'));
});
it('离屏期间多次切换目标，回到视口按最终目标补齐裁剪', () => {
  game.moveTarget={li:0,idx:1}; const expected=sections();
  game.moveTarget={li:0,idx:3}; sections();game.cam.cx=5000;
  for(const idx of [2,0,2,1]){game.moveTarget={li:0,idx};expect(sections().size).toBe(0);}
  game.cam.cx=200;const returned=sections();
  expect([...returned]).toEqual([...expected]);
});
