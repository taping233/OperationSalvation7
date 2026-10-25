import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
const h = vi.hoisted(() => ({ runtime: null, canvas: null, dpr: 1, start: vi.fn(), settings: vi.fn(), title: vi.fn(),
  ctx: { setTransform: vi.fn() }, reenter:vi.fn(), menuLoading:false, cancelMenu:vi.fn(), game: { runActive: false, state:'idle', toggles:{}, debug:{}, nodes:[], layerData:[], time:0, elapsed:0 },
  cam: { viewW:0, viewH:0, resize(w,height){ this.viewW=w; this.viewH=height; }, clamp:vi.fn(), panBy:vi.fn(), screenToWorld:(x,y)=>({x,y}) } }));
vi.mock('../game/src/run/game.session.js', () => ({
  MAP: { cols:4, rows:4, tile:100 }, SLOT_COUNT: 3, canvas: h.canvas, cam: h.cam, ctx: h.ctx, game: h.game,
  get dpr() { return h.dpr; }, _set_dpr: value => { h.dpr = value; }, _set_cam: vi.fn(),
  configureGameRuntime: value => { h.runtime = value; }, buildDerived: vi.fn(), hasRun: vi.fn(),
  migrateOldSave: vi.fn(), openLeaveMenu: vi.fn(), openSettings: h.settings, openTitleGuide: vi.fn(),
  saveGame: vi.fn(), setLobby: vi.fn(), showTitle: h.title, startNewGame: h.start, renderMiniMap: vi.fn(),
}));
vi.mock('../game/src/run/game.run.js', () => ({ bindRunMixins: vi.fn(), devForceBattle: vi.fn(), devJumpNode: vi.fn(),
  moveTo: vi.fn(), openDevConsole: vi.fn(), reenterCell: h.reenter, openClassChoice: vi.fn(), openShop: vi.fn(),
  showRunTransition: vi.fn(), resumeChestsOnCell: vi.fn(), resumeEventCardChoice: vi.fn(() => false) }));
vi.mock('../game/src/ui/game.menu.js', () => ({ get menuPageLoading() { return h.menuLoading; }, cancelPendingMenuPageOpen: h.cancelMenu }));
vi.mock('../game/src/run/game.run.data.js', () => ({ PRELOAD_SCENES: Object.fromEntries(['battle', 'coin', 'wood', 'rations', 'key', 'fire'].map(key => [key, `scene-${key}.webp`])) }));
vi.mock('../game/src/run/game.run.altar.js', () => ({ resumeExtraction: vi.fn() }));
vi.mock('../game/src/hub/game.hub.js', () => ({ openBaseHub: vi.fn(), preloadBaseHub: vi.fn(async () => {}), baseHubLoading: false }));
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

// Preserve the real empty UI cache until DOMContentLoaded; pre-populating it hid this race.
const frames = new Map();
let nextFrame = 0, finishMigration, renderScheduler, ui, hidden;
const migration = new Promise(resolve => { finishMigration = resolve; });
const flush = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };
function runFrame(now = 16) {
  const pending = [...frames.values()];
  frames.clear();
  for (const callback of pending) callback(now);
}
beforeAll(async () => {
  vi.useFakeTimers();
  vi.stubGlobal('requestAnimationFrame', vi.fn(callback => {
    const id = ++nextFrame;
    frames.set(id, callback);
    return id;
  }));
  vi.stubGlobal('cancelAnimationFrame', vi.fn(id => frames.delete(id)));
  vi.stubGlobal('requestIdleCallback', vi.fn());
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ version: '1.0.0' }) })));
  hidden = vi.spyOn(document, 'hidden', 'get').mockReturnValue(false);
  const html = readFileSync(resolve(process.cwd(), 'game/index.html'), 'utf8');
  document.body.innerHTML = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i)[1].replace(/<script[\s\S]*?<\/script>/g, '');
  h.canvas = document.getElementById('game');
  h.canvas.getBoundingClientRect = () => ({ left: 0, top: 0, right: 800, bottom: 600, width: 800, height: 600 });
  const noop = () => {};
  ui = { el: {}, init: vi.fn(function () {
    this.el = { overlay: document.getElementById('overlay'), viewport: document.getElementById('viewport') };
  }), refresh: noop, hideTooltip: noop, showTooltip: noop, log: noop };
  window.SDT = { UI: ui, Sound: { muted: false, sfx: noop },
    Camera: class { constructor() { return h.cam; } }, Renderer: { draw: vi.fn() },
    Base: { migrateLegacy: vi.fn(() => migration) },
    Cards: { ensureStarters: noop, ensureSha: noop, ensureTabletop: noop, ensureDmgTypes: noop, ensureEffectFields: noop },
    Art: { prefetchBatched: vi.fn(() => new Promise(() => {})) } };
  await import('../game/src/game.boot.js');
  ({ renderScheduler } = await import('../game/src/core/render-scheduler.js'));
});
afterAll(() => {
  renderScheduler?.setWake(null);
  frames.clear();
  vi.clearAllTimers(); vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals();
});

describe('main loop starts only after boot initialization', () => {
  it.each(['invalidate', 'visibilitychange'])('pre-DOMContentLoaded %s cannot run against the empty UI cache', trigger => {
    expect(ui.el.overlay).toBeUndefined();
    expect(ui.init).not.toHaveBeenCalled();
    if (trigger === 'invalidate') renderScheduler.invalidate();
    else document.dispatchEvent(new Event('visibilitychange'));
    expect(() => runFrame()).not.toThrow();
    expect(window.SDT.__frameStats).toBeUndefined();
    expect(requestAnimationFrame).not.toHaveBeenCalled();
    expect(renderScheduler.dirty).toBe(true);
  });

  it('keeps early wakes dormant through asynchronous boot, then explicitly starts once ready', async () => {
    document.dispatchEvent(new Event('DOMContentLoaded', { bubbles: true }));
    await flush();
    expect(ui.init).toHaveBeenCalledOnce();
    expect(ui.el.overlay).toBe(document.getElementById('overlay'));
    expect(window.SDT.Base.migrateLegacy).toHaveBeenCalledOnce();
    renderScheduler.invalidate();
    document.dispatchEvent(new Event('visibilitychange'));
    expect(() => runFrame()).not.toThrow();
    expect(window.SDT.__frameStats).toBeUndefined();
    expect(h.title).not.toHaveBeenCalled();
    finishMigration(true);
    await flush();
    expect(h.title).toHaveBeenCalledOnce();
    expect(frames.size).toBe(1);
    expect(() => runFrame(32)).not.toThrow();
    expect(window.SDT.__frameStats.loopTicks).toBe(1);
    expect(window.SDT.Art.prefetchBatched).toHaveBeenCalledOnce();
  });

  it('coalesces repeated ready wakes and keeps idle visibility resumption responsive', () => {
    const ticks = window.SDT.__frameStats.loopTicks;
    const scheduled = requestAnimationFrame.mock.calls.length;
    for (let i = 0; i < 4; i++) {
      renderScheduler.invalidate();
      document.dispatchEvent(new Event('visibilitychange'));
    }
    expect(requestAnimationFrame).toHaveBeenCalledTimes(scheduled + 1);
    expect(frames.size).toBe(1);
    runFrame(48);
    expect(window.SDT.__frameStats.loopTicks).toBe(ticks + 1);
    expect(frames.size).toBe(0);
    vi.advanceTimersByTime(250);
    expect(frames.size).toBe(1);
    runFrame(298);
    document.dispatchEvent(new Event('visibilitychange'));
    expect(frames.size).toBe(1);
    runFrame(314);
    expect(window.SDT.__frameStats.loopTicks).toBe(ticks + 3);
  });

  it('retains real drawing after startup, background coverage, and once-only initialization', async () => {
    document.getElementById('title').hidden = true;
    document.getElementById('exitScr').hidden = true;
    ui.el.overlay.hidden = true;
    h.game.state = 'idle';
    renderScheduler.invalidate();
    runFrame(330);
    expect(window.SDT.Renderer.draw).toHaveBeenCalledOnce();
    runFrame(346); // The uncovered transition may request its own follow-up frame.
    hidden.mockReturnValue(true);
    document.dispatchEvent(new Event('visibilitychange'));
    runFrame(362);
    expect(window.SDT.Renderer.draw).toHaveBeenCalledOnce();
    hidden.mockReturnValue(false);
    document.dispatchEvent(new Event('visibilitychange'));
    runFrame(378);
    expect(window.SDT.Renderer.draw).toHaveBeenCalledTimes(2);
    document.dispatchEvent(new Event('DOMContentLoaded', { bubbles: true }));
    await flush();
    expect(ui.init).toHaveBeenCalledOnce();
    expect(h.title).toHaveBeenCalledOnce();
    expect(window.SDT.Art.prefetchBatched).toHaveBeenCalledOnce();
  });
});
