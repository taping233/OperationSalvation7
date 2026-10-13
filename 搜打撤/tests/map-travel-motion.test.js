import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const harness = vi.hoisted(() => ({ game: {}, save: vi.fn(), consume: vi.fn(), safePage: vi.fn() }));
vi.mock('../game/src/run/game.session.js', () => ({
  game: harness.game, MAP: {}, curLayer: () => harness.game.layerData[harness.game.layerIdx],
  cellCenter: (li, idx) => harness.game.layerData[li]?.logical[idx] && { x: idx * 120, y: li * 120 },
  markSeen: (li, idx) => { harness.game.seen[`${li},${idx}`] = 1; }, saveGame: harness.save,
  gainCoins: vi.fn(), getActiveSlot: vi.fn(), modeCfg: vi.fn(), pick: vi.fn(), scaledEnemy: vi.fn(), weighted: vi.fn(),
}));
vi.mock('../game/src/run/game.run.scenes.js', () => ({
  finishInstant: () => { harness.game.state = 'idle'; }, consumeCell: harness.consume,
  preloadCellScene: vi.fn(), buildEncounter: vi.fn(), cancelLegacyChainMove: vi.fn(), consumeCurrentCell: vi.fn(),
  enterNode: vi.fn(), grantEventCard: vi.fn(), nodeShell: vi.fn(), openBattleCell: vi.fn(),
  openBlankSafePage: () => { harness.safePage(); harness.game.state = 'modal'; },
  openChestsOnCell: vi.fn(), openPickupPage: vi.fn(), openPocketRestore: vi.fn(), openShop: vi.fn(),
}));
vi.mock('../game/src/hub/game.cardslib.js', () => ({ _set_cardPageOpen: vi.fn() }));
vi.mock('../game/src/run/game.run.data.js', () => ({ EVENT_SCENE_META: {} }));
vi.mock('../game/src/home/narrative.js', () => ({ eventNarrative: vi.fn(), lastLampNarrative: vi.fn() }));
vi.mock('../game/src/home/story.last-lamp.js', () => ({ makeLastLampEventInstanceId: vi.fn() }));
vi.mock('../game/src/hub/game.storage.js', () => ({ RunStorage: {} }));
vi.mock('../game/src/home/story.commands.js', () => ({ storyCommands: {} }));
vi.mock('../game/src/hub/bag-return-hook.js', () => ({ setBagReturnHook: vi.fn() }));
vi.mock('../game/src/battle/battle-loader.js', () => ({ startBattle: vi.fn() }));
vi.mock('../game/src/core/turbo.js', () => ({ isTurbo: () => false }));
vi.mock('../game/src/core/render-scheduler.js', () => ({ renderScheduler: { invalidate: vi.fn() } }));
vi.mock('../game/src/run/game.run.altar.js', () => ({ openDoorModal: vi.fn(), openFireRest: vi.fn(), openAltarRitual: vi.fn(), openBossGate: vi.fn(), openEmergencyModal: vi.fn() }));
window.SDT = { UI: { refresh: vi.fn(), log: vi.fn(), beginRoom: vi.fn(), act: vi.fn() }, Meta: { track: vi.fn() } };
const { moveTo } = await import('../game/src/run/game.run.flow.js');
const { getMapTravelPresentation, mapTravelPoint } = await import('../game/src/run/map-travel-path.js');
let callbacks;
beforeEach(() => {
  vi.clearAllMocks();
  harness.save.mockReset();
  callbacks = [];
  vi.stubGlobal('requestAnimationFrame', cb => { callbacks.push(cb); return callbacks.length; });
  localStorage.removeItem('sdt-reduce-motion');
  Object.assign(harness.game, { state: 'idle', layerIdx: 0, trackPos: 0, pos: { x: 0, y: 0 }, turn: 1,
    runActive: true, geometryVersion: 'test', seen: { '0,0': 1, '0,1': 1, '0,2': 1 }, explored: {}, visited: { '0,2': 1 },
    layerData: [{ doors: [], logical: [
      { def: { type: 'blank' }, next: [[0,1]] },
      { def: { type: 'blank' }, next: [[0,2]] },
      { def: { type: 'coin' }, next: [] },
    ] }],
  });
});
const arrive = () => callbacks.pop()(performance.now() + 500);
afterEach(() => { vi.useRealTimers(); });
describe('continuous travel commits stable nodes', () => {
  it('avatar interpolation uses the same eased curve as route rendering and retains direct cross-layer travel', () => {
    const g = harness.game;
    g.layerData[0].logical[0].next = [[1, 1]];
    g.layerData.push({ doors: [], logical: [null, { def: { type: 'coin' }, next: [] }] });
    g.visited['1,1'] = 1;
    expect(moveTo(1, 1)).toBe(true);
    callbacks.at(-1)(performance.now() + 70);
    const travel = getMapTravelPresentation(g);
    expect(travel.progress).toBeGreaterThan(0);
    expect(travel.progress).toBeLessThan(1);
    expect(g.pos).toEqual(mapTravelPoint(travel.path[0], travel.path[1], travel.progress));
    arrive();
    expect(g).toMatchObject({ layerIdx: 1, trackPos: 1, turn: 2, pos: { x: 120, y: 120 } });
  });
  it('animates each segment, counts each arrival, rejects reentry and resolves only at destination', () => {
    const g = harness.game;
    expect(moveTo(0, 2)).toBe(true);
    expect(moveTo(0, 2)).toBe(false);
    expect(g.trackPos).toBe(0);
    expect(getMapTravelPresentation(g)).toMatchObject({ segmentIndex: 1, progress: 0, phase: 'moving' });
    const old = callbacks.at(-1);
    arrive();
    expect(g).toMatchObject({ trackPos: 1, turn: 2, state: 'moving', pos: { x: 120, y: 0 } });
    expect(harness.save).toHaveBeenCalledTimes(1);
    expect(g.explored).toEqual({ '0,1': 1 });
    old(performance.now() + 1000);
    expect(g.turn).toBe(2);
    expect(getMapTravelPresentation(g).segmentIndex).toBe(2);
    arrive();
    expect(g).toMatchObject({ trackPos: 2, turn: 3, state: 'modal', pos: { x: 240, y: 0 } });
    expect(harness.safePage).toHaveBeenCalledTimes(1);
    expect(g.explored).toEqual({ '0,1': 1, '0,2': 1 });
    expect(getMapTravelPresentation(g).phase).toBe('arrived');
  });
  it('leaving midway keeps the last arrived node and old callbacks cannot resolve', () => {
    const g = harness.game;
    moveTo(0, 2); arrive();
    const stale = callbacks.at(-1);
    stale(performance.now() + 40);
    g.state = 'title'; g.runActive = false;
    stale(performance.now() + 1000);
    expect(g).toMatchObject({ trackPos: 1, turn: 2, state: 'title', pos: { x: 120, y: 0 } });
    expect(getMapTravelPresentation(g)).toBeNull();
    stale(performance.now() + 2000);
    expect(g.turn).toBe(2);
  });
  it('reduced motion still commits every traversed cell synchronously', () => {
    localStorage.setItem('sdt-reduce-motion', '1');
    expect(moveTo(0, 2)).toBe(true);
    expect(harness.game).toMatchObject({ trackPos: 2, turn: 3, state: 'modal' });
    expect(harness.game.explored).toEqual({ '0,1': 1, '0,2': 1 });
    expect(getMapTravelPresentation(harness.game)).toBeNull();
  });
  it('geometry invalidation releases the movement lock without committing an obsolete destination', () => {
    const g = harness.game;
    moveTo(0, 2); arrive();
    const stale = callbacks.at(-1);
    g.geometryVersion = 'replacement';
    stale(performance.now() + 1000);
    expect(g).toMatchObject({ trackPos: 1, turn: 2, state: 'idle', pos: { x: 120, y: 0 } });
    expect(getMapTravelPresentation(g)).toBeNull();
    expect(harness.safePage).not.toHaveBeenCalled();
    expect(moveTo(0, 2)).toBe(true);
    arrive();
    expect(g.trackPos).toBe(2);
  });
  it('the background watchdog saves each arrived node and resolves only the final page', () => {
    vi.useFakeTimers();
    vi.stubGlobal('requestAnimationFrame', cb => { callbacks.push(cb); return callbacks.length; });
    const g = harness.game, saved = [];
    harness.save.mockImplementation(() => saved.push({ state:g.state, trackPos:g.trackPos, turn:g.turn, pos:{...g.pos}, visited:{...g.visited} }));
    expect(moveTo(0, 2)).toBe(true);
    vi.advanceTimersByTime(920);
    expect(saved).toEqual([{ state:'idle', trackPos:1, turn:2, pos:{x:120,y:0}, visited:{'0,2':1} }]);
    expect(g.state).toBe('moving');
    expect(harness.safePage).not.toHaveBeenCalled();
    vi.advanceTimersByTime(920);
    expect(g).toMatchObject({ state:'modal', trackPos:2, turn:3 });
    expect(harness.safePage).toHaveBeenCalledTimes(1);
    expect(getMapTravelPresentation(g).phase).toBe('arrived');
    const refreshed = window.SDT.UI.refresh.mock.calls.length;
    vi.advanceTimersByTime(280);
    expect(getMapTravelPresentation(g)).toBeNull();
    expect(window.SDT.UI.refresh.mock.calls.length).toBeGreaterThan(refreshed);
    harness.save.mockReset();
  });
});
