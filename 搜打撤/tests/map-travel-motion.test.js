import { cancelLayerPassage } from '../game/src/ui/map-passage.js';
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
  openChestsOnCell: vi.fn(), openFixedRewardsOnCell: vi.fn(), openPickupPage: vi.fn(), openPocketRestore: vi.fn(), openShop: vi.fn(),
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
vi.mock('../game/src/core/render-scheduler.js', () => ({ renderScheduler: { invalidate: vi.fn(), invalidateAnimation: vi.fn() } }));
vi.mock('../game/src/run/game.run.altar.js', () => ({ openDoorModal: vi.fn(), openFireRest: vi.fn(), openAltarRitual: vi.fn(), openBossGate: vi.fn(), openEmergencyModal: vi.fn(), resumeNodeRestore:vi.fn(() => false) }));
window.SDT = { UI: { refresh: vi.fn(), log: vi.fn(), beginRoom: vi.fn(), act: vi.fn(), hideOverlay: vi.fn() }, Meta: { track: vi.fn() } };
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
afterEach(() => { cancelLayerPassage(); vi.useRealTimers(); });
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
    expect(document.querySelectorAll('.map-layer-passage')).toHaveLength(1);
    expect(moveTo(0, 0)).toBe(false);
  });
  it('shares one route clock: commits passed stable nodes, rejects reentry and resolves the destination', () => {
    const g = harness.game;
    const t0 = performance.now();
    expect(moveTo(0, 2)).toBe(true);
    expect(moveTo(0, 2)).toBe(false);
    expect(g.trackPos).toBe(0);
    expect(getMapTravelPresentation(g)).toMatchObject({ segmentIndex: 1, progress: 0, phase: 'moving' });
    callbacks.at(-1)(t0 + 375);   // 时钟推进 75%：首格已提交为稳定节点，末格仍在途
    expect(g).toMatchObject({ trackPos: 1, turn: 2, state: 'moving' });
    expect(harness.save).toHaveBeenCalledTimes(1);
    expect(g.explored).toEqual({ '0,1': 1 });
    expect(getMapTravelPresentation(g).segmentIndex).toBe(2);
    callbacks.at(-1)(t0 + 600);   // 时钟走满：全部节点提交，进入抵达反馈
    expect(g).toMatchObject({ trackPos: 2, turn: 3, state: 'moving' });
    expect(g.explored).toEqual({ '0,1': 1, '0,2': 1 });
    expect(getMapTravelPresentation(g)).toMatchObject({ phase: 'arrived', segmentIndex: 2 });
    callbacks.at(-1)(performance.now() + 1000);   // 抵达反馈完成：已结算目的格直接收尾回地图
    expect(g).toMatchObject({ trackPos: 2, turn: 3, state: 'idle', pos: { x: 240, y: 0 } });
    expect(harness.safePage).not.toHaveBeenCalled();
    expect(getMapTravelPresentation(g)).toBeNull();
  });
  it('leaving midway keeps the last committed node and old callbacks cannot resolve', () => {
    const g = harness.game;
    const t0 = performance.now();
    moveTo(0, 2);
    callbacks.at(-1)(t0 + 375);
    const stale = callbacks.at(-1);
    g.state = 'title'; g.runActive = false;
    stale(t0 + 1000);
    expect(g).toMatchObject({ trackPos: 1, turn: 2, state: 'title', pos: { x: 120, y: 0 } });
    expect(getMapTravelPresentation(g)).toBeNull();
    stale(t0 + 2000);
    expect(g.turn).toBe(2);
  });
  it('reduced motion still commits every traversed cell synchronously', () => {
    localStorage.setItem('sdt-reduce-motion', '1');
    expect(moveTo(0, 2)).toBe(true);
    expect(harness.game).toMatchObject({ trackPos: 2, turn: 3, state: 'idle' });
    expect(harness.game.explored).toEqual({ '0,1': 1, '0,2': 1 });
    expect(harness.safePage).not.toHaveBeenCalled();
    expect(getMapTravelPresentation(harness.game)).toBeNull();
  });
  it('geometry invalidation releases the movement lock without committing an obsolete destination', () => {
    const g = harness.game;
    const t0 = performance.now();
    moveTo(0, 2);
    callbacks.at(-1)(t0 + 375);
    const stale = callbacks.at(-1);
    g.geometryVersion = 'replacement';
    stale(t0 + 1000);
    expect(g).toMatchObject({ trackPos: 1, turn: 2, state: 'idle', pos: { x: 120, y: 0 } });
    expect(getMapTravelPresentation(g)).toBeNull();
    expect(harness.safePage).not.toHaveBeenCalled();
    expect(moveTo(0, 2)).toBe(true);
    callbacks.at(-1)(performance.now() + 10000);
    expect(g.trackPos).toBe(2);
  });
  it('the background watchdog commits each stable node and settles the destination without rAF', () => {
    vi.useFakeTimers();
    vi.stubGlobal('requestAnimationFrame', cb => { callbacks.push(cb); return callbacks.length; });
    const g = harness.game, saved = [];
    harness.save.mockImplementation(() => saved.push({ state:g.state, trackPos:g.trackPos, turn:g.turn, pos:{...g.pos}, visited:{...g.visited} }));
    expect(moveTo(0, 2)).toBe(true);
    vi.advanceTimersByTime(600);   // 后台页 rAF 暂停：移动锁保持，尚无提交
    expect(saved).toEqual([]);
    expect(g.state).toBe('moving');
    expect(harness.safePage).not.toHaveBeenCalled();
    vi.advanceTimersByTime(700);   // 看门狗兜底：提交稳定节点并结算目的格
    expect(saved).toEqual([{ state:'idle', trackPos:1, turn:2, pos:{x:120,y:0}, visited:{'0,2':1} }]);
    expect(g).toMatchObject({ state:'idle', trackPos:2, turn:3 });
    expect(harness.safePage).not.toHaveBeenCalled();
    expect(getMapTravelPresentation(g)).toBeNull();
    expect(window.SDT.UI.refresh.mock.calls.length).toBeGreaterThan(0);
    harness.save.mockReset();
  });
});

it('cross-layer arrival resolves only once after the shared curtain, without a second travel commit', async () => {
  vi.useFakeTimers();
  vi.stubGlobal('requestAnimationFrame', cb => { callbacks.push(cb); return callbacks.length; });
  const g=harness.game;
  g.layerData[0].logical[0].next=[[1,1]];
  g.layerData.push({doors:[],logical:[null,{def:{type:'coin'},next:[]}]});
  g.visited['1,1']=1;
  expect(moveTo(1,1)).toBe(true);
  arrive(); arrive();
  expect(g).toMatchObject({state:'moving',layerIdx:1,trackPos:1,turn:2});
  expect(document.querySelectorAll('.map-layer-passage')).toHaveLength(1);
  await vi.advanceTimersByTimeAsync(1000);
  expect(g).toMatchObject({state:'idle',layerIdx:1,trackPos:1,turn:2});
  expect(getMapTravelPresentation(g)).toBeNull();
  expect(document.querySelector('.map-layer-passage')).toBeNull();
  await vi.runAllTimersAsync(); expect(g.turn).toBe(2);
});
