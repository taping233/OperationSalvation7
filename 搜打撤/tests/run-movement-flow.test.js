import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  slot: 1,
  game: {},
  raf: [],
  layer: null,
  saves: 0,
}));

vi.mock('../game/src/core/shared.js', () => ({ esc: value => String(value), escAttr: value => String(value) }));
vi.mock('../game/src/run/game.session.js', () => ({
  MAP: { randomEvents: [], chestTable: [], monsters: {}, encounters: [], items: {}, rules: {} },
  game: h.game,
  getActiveSlot: () => h.slot,
  saveGame: () => { h.saves++; return true; },
  weighted: xs => xs[0], pick: xs => xs[0], gainCoins() {}, scaledEnemy: x => x,
  cellCenter: (li, idx) => ({ x: li / 10, y: idx / 10 }),
  curLayer: () => h.layer,
  markSeen() {}, modeCfg: () => ({ coinMul: 1 }),
}));
vi.mock('../game/src/hub/game.cardslib.js', () => ({ _set_cardPageOpen() {} }));
vi.mock('../game/src/run/game.run.data.js', () => ({ EVENT_SCENE_META: {} }));
vi.mock('../game/src/core/random.js', () => ({ Random: { random: () => 0 } }));
vi.mock('../game/src/home/narrative.js', () => ({ eventNarrative: async () => null, lastLampNarrative: async () => null }));
vi.mock('../game/src/home/story.last-lamp.js', () => ({ makeLastLampEventInstanceId: () => '' }));
vi.mock('../game/src/hub/game.storage.js', () => ({ RunStorage: {} }));
vi.mock('../game/src/home/story.commands.js', () => ({ storyCommands: {} }));
vi.mock('../game/src/hub/bag-return-hook.js', () => ({ setBagReturnHook() {} }));
vi.mock('../game/src/battle/battle-loader.js', () => ({ startBattle: async () => {} }));
vi.mock('../game/src/core/render-scheduler.js', () => ({ renderScheduler: { invalidate() {} } }));
vi.mock('../game/src/run/game.run.scenes.js', () => ({
  buildEncounter: () => [], cancelLegacyChainMove() {}, consumeCell() {}, consumeCurrentCell() {},
  enterNode: (_, fn) => fn(), finishInstant() {}, grantEventCard: () => true, nodeShell() {},
  openBattleCell() {}, openBlankSafePage() {}, openChestsOnCell() {}, openPickupPage() {},
  openPocketRestore() {}, openShop() {}, preloadCellScene() {},
}));
vi.mock('../game/src/run/game.run.altar.js', () => ({ openDoorModal() {}, openFireRest() {}, openAltarRitual() {}, openBossGate() {}, openEmergencyModal() {} }));

let moveTo, cancelMoveTo;
beforeAll(async () => {
  window.SDT = {
    UI: { refresh() {}, beginRoom() {}, log() {}, act() {}, hideOverlay() {} },
    Meta: { track() {} }, Cards: { all: () => [] }, Icons: { img: () => '' },
  };
  ({ moveTo, cancelMoveTo } = await import('../game/src/run/game.run.flow.js'));
});

function setup() {
  h.raf = [];
  h.slot = 1;
  h.saves = 0;
  localStorage.clear();
  const destination = { def: { type: 'ordinary' }, next: [] };
  h.layer = { logical: [{ def: { type: 'ordinary' }, next: [[0, 1]] }, destination] };
  Object.assign(h.game, {
    state: 'idle', runActive: true, pos: { x: 0, y: 0 }, layerIdx: 0, trackPos: 0,
    turn: 1, hop: 3, moveTarget: null, layerData: [h.layer], mapSeed: 'seed-a',
    layerBounds: [{ min: 0, max: 1 }], layoutVersion: 0, visited: {},
  });
  globalThis.requestAnimationFrame = callback => { h.raf.push(callback); return h.raf.length; };
}

describe('moveTo production flow', () => {
  beforeEach(setup);

  it('cancels through the flow entry point and restores the complete stable origin', () => {
    expect(moveTo(0, 1)).toBe(true);
    expect(h.game.state).toBe('moving');
    h.game.pos = { x: 0.03, y: 0.04 };
    expect(cancelMoveTo()).toBe(true);
    expect(h.game).toMatchObject({ state: 'idle', pos: { x: 0, y: 0 }, layerIdx: 0, trackPos: 0, turn: 1, hop: 3, moveTarget: null });
    expect(h.saves).toBe(0);
    h.raf[0](100000);
    expect(h.game.trackPos).toBe(0);
  });

  it('drops a late animation after a run switch without mutating the replacement state', () => {
    expect(moveTo(0, 1)).toBe(true);
    h.slot = 2;
    Object.assign(h.game, { state: 'idle', pos: { x: 0.77, y: 0.66 }, layerIdx: 4, trackPos: 9, turn: 22, hop: 0, moveTarget: null });
    h.raf[0](100000);
    expect(h.game).toMatchObject({ state: 'idle', pos: { x: 0.77, y: 0.66 }, layerIdx: 4, trackPos: 9, turn: 22 });
    expect(h.saves).toBe(0);
  });

  it('commits the stable landing once after the animation', () => {
    expect(moveTo(0, 1)).toBe(true);
    h.raf[0](100000);
    expect(h.game).toMatchObject({ state: 'idle', layerIdx: 0, trackPos: 1, turn: 2, hop: 0, moveTarget: null, pos: { x: 0, y: 0.1 } });
    expect(h.saves).toBe(1);
  });
});
