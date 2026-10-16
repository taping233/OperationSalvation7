import { describe, expect, it } from 'vitest';
import { findMapTravelPath, getMapTravelPresentation, setMapTravelPresentation, mapTravelCurve, mapTravelPoint } from '../game/src/run/map-travel-path.js';
import { renderExpeditionPanel, setExpeditionPreview } from '../game/src/run/expedition.view.js';

const makeGame = (types, edges, extra = {}) => {
  const logical = types.map((type, idx) => ({ def: { type }, next: (edges[idx] || []).map(next => [0, next]) }));
  return { layerIdx: 0, trackPos: 0, layerData: [{ logical, doors: [] }],
    seen: Object.fromEntries(types.map((_, idx) => [`0,${idx}`, 1])), visited: {}, ...extra };
};
const target = idx => ({ li: 0, idx });
describe('known map travel path', () => {
  it('treats pending entry supply as an endpoint and restores blank travel after collection', () => {
    const game = makeGame(['blank', 'blank', 'chest'], [[1], [2], []], { runActive: true, state: 'idle', hp: 30, maxHp: 30,
      entrySupply: { version: 1, layerIdx: 0, trackPos: 1, cardIds: ['class-a'], taken: [] } });
    game.nodes = game.layerData[0].logical.map((cell, idx) => ({ ...target(idx), def: cell.def }));
    expect(findMapTravelPath(game, target(1))).toEqual([target(1)]);
    expect(findMapTravelPath(game, target(2))).toBeNull();
    document.body.innerHTML = '<aside id="sidebar"></aside>';
    setExpeditionPreview(game, target(1));
    renderExpeditionPanel(null, game, icon => icon);
    expect(document.querySelector('.expedition-preview-copy b').textContent).toBe('入城补给');
    expect(document.querySelector('.expedition-preview-hint').textContent).toBe('可回地图整理，回到此节点继续领取。');
    expect(game.layerData[0].logical[1].def.type).toBe('blank');
    game.entrySupply.taken = [0];
    expect(findMapTravelPath(game, target(2))).toEqual([target(1), target(2)]);
    renderExpeditionPanel(null, game, icon => icon);
    expect(document.querySelector('.expedition-preview-copy b').textContent).not.toBe('入城补给');
    game.entrySupply = null;
    expect(findMapTravelPath(game, target(2))).toEqual([target(1), target(2)]);
  });
  it('入城补给全部领取前，打开过补给页仍不能前往其他节点', () => {
    const game = makeGame(['entrance', 'blank', 'chest'], [[1], [2], []], { runActive: true, state: 'idle', hp: 30, maxHp: 30,
      entrySupply: { version: 1, layerIdx: 0, trackPos: 0, cardIds: ['class-a'], taken: [] } });
    expect(findMapTravelPath(game, target(0))).toEqual([]);
    expect(findMapTravelPath(game, target(1))).toBeNull();
    expect(findMapTravelPath(game, target(2))).toBeNull();
    game.entrySupply.entered = true;
    expect(findMapTravelPath(game, target(1))).toBeNull();
    expect(findMapTravelPath(game, target(2))).toBeNull();
    game.entrySupply.taken = [0];
    expect(findMapTravelPath(game, target(1))).toEqual([target(1)]);
    expect(findMapTravelPath(game, target(2))).toEqual([target(1), target(2)]);   // blank 中途格可穿越
  });
  it('shares a pure cubic curve with clamped endpoints and symmetric reverse travel', () => {
    const from = Object.freeze({ x: 20, y: 10 }), to = Object.freeze({ x: 120, y: 80 });
    const forwardCurve=mapTravelCurve(from,to),reverseCurve=mapTravelCurve(to,from);
    expect(forwardCurve.from).toEqual(from);
    expect(forwardCurve.to).toEqual(to);
    expect(forwardCurve.c1).toEqual(reverseCurve.c2);
    expect(forwardCurve.c2).toEqual(reverseCurve.c1);
    expect(mapTravelPoint(from, to, -1)).toEqual(from);
    expect(mapTravelPoint(from, to, 2)).toEqual(to);
    expect(mapTravelPoint(from, to, 0)).toEqual(from);
    expect(mapTravelPoint(from, to, 1)).toEqual(to);
    for (const t of [.15, .3, .75]) {
      const forward = mapTravelPoint(from, to, t), reverse = mapTravelPoint(to, from, 1 - t);
      expect(forward.x).toBeCloseTo(reverse.x, 12);
      expect(forward.y).toBeCloseTo(reverse.y, 12);
    }
    const curve = mapTravelCurve(from, to);
    curve.from.x = -99;
    curve.to.y = -99;
    expect(from).toEqual({ x: 20, y: 10 });
    expect(to).toEqual({ x: 120, y: 80 });
  });
  it('gently bows collinear roads while retaining the identical reverse route', () => {
    const a={x:0,y:0},b={x:240,y:0},c={x:0,y:240};
    expect(mapTravelPoint(a,b,.5).y).toBeGreaterThan(0);
    expect(mapTravelPoint(a,c,.5).x).toBeLessThan(0);
    for(const target of [b,c]){
      const f=mapTravelPoint(a,target,.3),r=mapTravelPoint(target,a,.7);
      expect(f.x).toBeCloseTo(r.x,10);expect(f.y).toBeCloseTo(r.y,10);
      expect(Math.hypot(mapTravelPoint(a,target,.5).x-target.x/2,mapTravelPoint(a,target,.5).y-target.y/2)).toBeLessThan(17);
    }
  });
  it('keeps direct edges and current position compatible with old saves', () => {
    const game = makeGame(['entrance', 'battle'], [[1], []], { seen: undefined });
    expect(findMapTravelPath(game, target(0))).toEqual([]);
    expect(findMapTravelPath(game, target(1))).toEqual([target(1)]);
    expect(findMapTravelPath(game, target(8))).toBeNull();
    game.layerData.push({ logical: [{ def: { type: 'blank' }, next: [] }] });
    game.layerData[0].logical[0].next.push([1, 0]);
    expect(findMapTravelPath(game, { li: 1, idx: 0 })).toEqual([{ li: 1, idx: 0 }]);
  });
  it('uses shortest BFS and original edge order for equal paths despite duplicates and cycles', () => {
    const game = makeGame(['entrance', 'blank', 'blank', 'blank', 'chest'], [[2, 2, 1], [4], [0, 3, 4], [4], []]);
    expect(findMapTravelPath(game, target(4))).toEqual([target(2), target(4)]);
    game.layerData[0].logical[2].next = [[0, 0], [0, 3]];
    expect(findMapTravelPath(game, target(4))).toEqual([target(1), target(4)]);
  });
  it('does not cross unknown or unresolved contents or reveal unknown distant targets', () => {
    const game = makeGame(['entrance', 'blank', 'chest'], [[1], [2], []]);
    delete game.seen['0,1'];
    expect(findMapTravelPath(game, target(2))).toBeNull();
    game.seen['0,1'] = 1;
    delete game.seen['0,2'];
    expect(findMapTravelPath(game, target(2))).toBeNull();
    game.seen['0,2'] = 1;
    game.layerData[0].logical[1].def.type = 'battle';
    expect(findMapTravelPath(game, target(2))).toBeNull();
    game.visited['0,1'] = 1;
    expect(findMapTravelPath(game, target(2))).toEqual([target(1), target(2)]);
  });
  it('allows a known door endpoint but never crosses doors, altars, bosses or layers', () => {
    const game = makeGame(['entrance', 'blank', 'blank', 'chest'], [[1], [2], [3], []]);
    game.layerData[0].doors = [{ at: 2 }];
    expect(findMapTravelPath(game, target(2))).toEqual([target(1), target(2)]);
    expect(findMapTravelPath(game, target(3))).toBeNull();
    game.layerData[0].doors = [];
    for (const type of ['altar', 'boss', 'door']) {
      game.layerData[0].logical[2].def.type = type;
      game.bossKilled = true;
      game.visited['0,2'] = 1;
      expect(findMapTravelPath(game, target(3))).toBeNull();
    }
    game.layerData[0].logical[1].next = [[1, 0]];
    expect(findMapTravelPath(game, target(3))).toBeNull();
  });
  it('returns null for disconnected graphs without mutating game or persisting presentation', () => {
    const game = makeGame(['entrance', 'blank', 'chest'], [[1], [0], []]);
    const before = JSON.stringify(game);
    expect(findMapTravelPath(game, target(2))).toBeNull();
    const presentation = { path: [target(0), target(1)], segmentIndex: 0, progress: .5, phase: 'moving' };
    setMapTravelPresentation(game, presentation);
    expect(getMapTravelPresentation(game)).toBe(presentation);
    expect(JSON.stringify(game)).toBe(before);
    setMapTravelPresentation(game, null);
    expect(getMapTravelPresentation(game)).toBeNull();
  });
  it('enables distant known previews and retains real final target across segment commits', () => {
    document.body.innerHTML = '<aside id="sidebar"></aside>';
    const game = makeGame(['entrance', 'blank', 'chest'], [[1], [2], []], { runActive: true, state: 'idle', hp: 30, maxHp: 30 });
    game.nodes = game.layerData[0].logical.map((cell, idx) => ({ ...target(idx), def: cell.def }));
    setExpeditionPreview(game, target(2));
    renderExpeditionPanel(null, game, icon => icon);
    expect(document.querySelector('[data-route-enter]').disabled).toBe(false);
    setMapTravelPresentation(game, { path: [target(0), target(1), target(2)], segmentIndex: 2, progress: 0, phase: 'moving' });
    game.trackPos = 1;
    game.state = 'moving';
    renderExpeditionPanel(null, game, icon => icon);
    expect(document.querySelector('.expedition-map-preview').dataset.nodeState).toBe('moving');
    expect(document.querySelector('.expedition-preview-status').textContent).toContain('2/2');
    expect(document.querySelector('[data-route-enter]').disabled).toBe(true);
    game.trackPos = 2;
    game.state = 'idle';
    setMapTravelPresentation(game, { path: [target(0), target(1), target(2)], segmentIndex: 2, progress: 1, phase: 'arrived' });
    renderExpeditionPanel(null, game, icon => icon);
    expect(document.querySelector('.expedition-map-preview').dataset.nodeState).toBe('current');
    expect(document.querySelector('.expedition-preview-status').textContent).toBe('已抵达');
    expect(document.querySelector('[data-route-enter]').disabled).toBe(false);
  });
});
