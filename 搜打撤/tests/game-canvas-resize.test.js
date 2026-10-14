import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
const h = vi.hoisted(() => ({ runtime: null, canvas: null, dpr: 1,
  ctx: { setTransform: vi.fn() }, game: { runActive: false },
  cam: { viewW: 0, viewH: 0, resize(w, height) { this.viewW = w; this.viewH = height; } } }));
vi.mock('../game/src/run/game.session.js', () => ({
  MAP: {}, SLOT_COUNT: 3, canvas: h.canvas, cam: h.cam, ctx: h.ctx, game: h.game,
  get dpr() { return h.dpr; }, _set_dpr: value => { h.dpr = value; }, _set_cam: vi.fn(),
  configureGameRuntime: value => { h.runtime = value; }, buildDerived: vi.fn(), hasRun: vi.fn(),
  migrateOldSave: vi.fn(), openLeaveMenu: vi.fn(), openSettings: vi.fn(), openTitleGuide: vi.fn(),
  saveGame: vi.fn(), setLobby: vi.fn(), showTitle: vi.fn(), startNewGame: vi.fn(), renderMiniMap: vi.fn(),
}));
vi.mock('../game/src/run/game.run.js', () => ({ bindRunMixins: vi.fn(), devForceBattle: vi.fn(), devJumpNode: vi.fn(),
  moveTo: vi.fn(), openDevConsole: vi.fn(), reenterCell: vi.fn(), openClassChoice: vi.fn(), openShop: vi.fn(),
  showRunTransition: vi.fn(), resumeChestsOnCell: vi.fn() }));
vi.mock('../game/src/run/game.run.data.js', () => ({ PRELOAD_SCENES: {} }));
vi.mock('../game/src/run/game.run.altar.js', () => ({ resumeExtraction: vi.fn() }));
vi.mock('../game/src/hub/game.hub.js', () => ({ openBaseHub: vi.fn(), baseHubLoading: false }));
vi.mock('../game/src/hub/game.bag.js', () => ({ bindBagMixins: vi.fn(), resumeBattleRewards: vi.fn(),
  showBackpack: vi.fn(), showBackpackSection: vi.fn(), setBagReturnHook: vi.fn() }));
vi.mock('../game/src/run/game.run.shop.js', () => ({ configureShopRuntime: vi.fn() }));
vi.mock('../game/src/hub/game.notes.js', () => ({ TYPE_NAME: {}, bindNotesMixins: vi.fn(), initDevMode: vi.fn(),
  openCellEditor: vi.fn(), rebuildNotes: vi.fn(), showClearOverlay: vi.fn(), showExportOverlay: vi.fn(),
  showImportOverlay: vi.fn(), syncDevVisibility: vi.fn() }));
vi.mock('../game/src/hub/game.cardslib.js', () => ({ cardPageOpen: false, cardPageLoading: false,
  closeCardPageTop: vi.fn(), openCardDesigner: vi.fn(), openCardLibrary: vi.fn() }));
vi.mock('../game/src/run/game.session.browser.js', () => ({ createGameCanvas: () => ({ canvas: h.canvas, ctx: h.ctx }) }));
vi.mock('../game/src/agent/agent.js', () => ({}));
vi.mock('../game/src/ui/quick-nav.js', () => ({}));
vi.mock('../game/src/experience/pocket-strip.js', () => ({ startPocketStrip: vi.fn() }));
let bounds, widthWrites, heightWrites;
beforeAll(async () => {
  vi.stubGlobal('requestAnimationFrame', vi.fn(() => 1));
  const html = readFileSync(resolve(process.cwd(), 'game/index.html'), 'utf8');
  document.body.innerHTML = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i)[1].replace(/<script[\s\S]*?<\/script>/g, '');
  h.canvas = document.getElementById('game'); bounds = { width: 800.75, height: 600.75 };
  h.canvas.getBoundingClientRect = () => bounds;
  widthWrites = heightWrites = 0;
  for (const key of ['width', 'height']) {
    const native = Object.getOwnPropertyDescriptor(HTMLCanvasElement.prototype, key);
    Object.defineProperty(h.canvas, key, { get: () => native.get.call(h.canvas), set: value => {
      if (key === 'width') widthWrites++; else heightWrites++; native.set.call(h.canvas, value);
    } });
  }
  window.SDT = { UI: { el: { overlay: document.getElementById('overlay') } }, Sound: { muted: false } };
  // Real boot import publishes its actual resize function through the runtime port. Gameplay modules
  // are mocked here; tests/boot.test.js separately verifies the complete startup dependency chain.
  await import('../game/src/game.boot.js');
});
afterEach(() => h.ctx.setTransform.mockClear());
afterAll(() => vi.unstubAllGlobals());

describe('真实boot的Canvas resize接线', () => {
  it('小数逻辑尺寸赋值与no-op判断使用一致像素取整，重复调用不重置', () => {
    Object.defineProperty(window, 'devicePixelRatio', { configurable: true, value: 1 });
    h.runtime.resize(); expect(h.canvas.width).toBe(801); expect(h.canvas.height).toBe(601);
    const before = [widthWrites, heightWrites]; h.runtime.resize(); h.runtime.resize();
    expect([widthWrites, heightWrites]).toEqual(before); expect(h.ctx.setTransform).toHaveBeenCalledTimes(1);
    expect(h.cam.viewW).toBe(800.75); expect(h.cam.viewH).toBe(600.75);
  });
  it('DPR变更只重置一次，相同输入保持稳定', () => {
    Object.defineProperty(window, 'devicePixelRatio', { value: 2 });
    h.runtime.resize(); expect(h.canvas.width).toBe(1602); expect(h.canvas.height).toBe(1202);
    expect(h.ctx.setTransform).toHaveBeenCalledWith(2, 0, 0, 2, 0, 0);
    const before = [widthWrites, heightWrites]; h.runtime.resize(); expect([widthWrites, heightWrites]).toEqual(before);
  });
  it('零尺寸隐藏态保留像素缓冲，恢复原尺寸不会来回抖动', () => {
    const old = bounds, before = [widthWrites, heightWrites]; bounds = { width: 0, height: 0 };
    h.runtime.resize(); bounds = old; h.runtime.resize();
    expect([widthWrites, heightWrites]).toEqual(before); expect(h.ctx.setTransform).not.toHaveBeenCalled();
  });
});
