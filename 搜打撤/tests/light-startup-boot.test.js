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

const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};
const sceneGate = deferred(), fetchGate = deferred();
const flush = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };
let art, warning;
beforeAll(async () => {
  vi.useFakeTimers();
  vi.stubGlobal('requestAnimationFrame', vi.fn(() => 1));
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
  vi.stubGlobal('requestIdleCallback', vi.fn());
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ version: '1.0.0' }) })));
  warning = vi.spyOn(console, 'warn').mockImplementation(() => {});
  const html = readFileSync(resolve(process.cwd(), 'game/index.html'), 'utf8');
  document.body.innerHTML = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i)[1].replace(/<script[\s\S]*?<\/script>/g, '');
  h.canvas = document.getElementById('game');
  h.canvas.getBoundingClientRect = () => ({ left: 0, top: 0, right: 800, bottom: 600, width: 800, height: 600 });
  const noop = () => {};
  art = { collectCardAssets: vi.fn(() => ['unvisited-portrait.webp']),
    collectThumbnailAssets: vi.fn(() => ['unvisited-thumb.webp']), collectManifestAssets: vi.fn(() => ['unvisited-catalogue.webp']),
    warm: vi.fn(), warmBatched: vi.fn(() => sceneGate.promise), prefetchBatched: vi.fn(() => fetchGate.promise) };
  window.SDT = { UI: { el: { overlay: document.getElementById('overlay'), viewport: document.getElementById('viewport') },
    init: noop, refresh: noop, hideTooltip: noop, showTooltip: noop, log: noop },
    Sound: { muted: false, sfx: noop }, Camera: class { constructor() { return h.cam; } },
    Base: { migrateLegacy: noop }, Cards: { ensureStarters: noop, ensureSha: noop, ensureTabletop: noop, ensureDmgTypes: noop, ensureEffectFields: noop }, Art: art };
  await import('../game/src/game.boot.js');
  document.dispatchEvent(new Event('DOMContentLoaded', { bubbles: true }));
  await flush();
});
afterAll(() => { vi.clearAllTimers(); vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe('light startup uses actual boot wiring without gating menu entry', () => {
  it('空闲预热当前基地背景，交给已有受限解码池且不等待首屏预取', () => {
    expect(typeof h.runtime.preloadBaseHub).toBe('function');
    const task=requestIdleCallback.mock.calls.find(([callback]) => callback.name === 'warmHubWallpaper');
    expect(task).toBeDefined();
    expect(art.warm).not.toHaveBeenCalled();
    task[0]();
    expect(art.warm).toHaveBeenCalledExactlyOnceWith([expect.stringContaining('base-operations-v5.webp')]);
  });
  it('never creates startup scene warm tasks or enumerates unvisited catalogues', () => {
    expect(art.warmBatched).not.toHaveBeenCalled();
    expect(art.collectCardAssets).not.toHaveBeenCalled();
    expect(art.collectThumbnailAssets).not.toHaveBeenCalled();
    expect(art.collectManifestAssets).not.toHaveBeenCalled();
    expect(art.prefetchBatched).toHaveBeenCalledOnce();
  });
  it('menu entry and the main loop are available before the HTTP prefetch finishes', () => {
    expect(h.title).toHaveBeenCalledOnce();
    expect(requestAnimationFrame).toHaveBeenCalled();
    document.getElementById('mStart').click();
    document.getElementById('mSettings').click();
    expect(h.start).toHaveBeenCalledOnce();
    expect(h.settings).toHaveBeenCalledOnce();
  });
  it('prefetches all six scenes plus thirteen frames at concurrency four without gating entry', async () => {
    await flush();
    expect(art.prefetchBatched).toHaveBeenCalledOnce();
    const [urls, progress, batch] = art.prefetchBatched.mock.calls[0];
    expect(urls).toHaveLength(19); expect(new Set(urls).size).toBe(19); expect(batch).toBe(4);
    expect(urls.some(url => url.includes('unvisited-'))).toBe(false);
    expect(urls.slice(0, 6)).toEqual(['scene-battle.webp', 'scene-coin.webp', 'scene-wood.webp', 'scene-rations.webp', 'scene-key.webp', 'scene-fire.webp']);
    progress(0, 19); expect(document.getElementById('warmupNum').textContent).toBe('0/19');
    progress(6, 19); expect(document.getElementById('warmupNum').textContent).toBe('6/19');
    progress(19, 19);
    expect(document.getElementById('warmupNum').textContent).toBe('19/19');
    const starts = h.start.mock.calls.length;
    document.getElementById('mStart').click(); expect(h.start).toHaveBeenCalledTimes(starts + 1);
  });
  it('prefetch failure is handled and menu entry remains available without restarting the boot chain', async () => {
    fetchGate.reject(new Error('offline')); await flush();
    expect(warning).toHaveBeenCalledWith('[warmup] 首屏资源预取未完成', expect.any(Error));
    const starts = h.start.mock.calls.length;
    document.getElementById('mStart').click(); expect(h.start).toHaveBeenCalledTimes(starts + 1);
    document.dispatchEvent(new Event('DOMContentLoaded', { bubbles: true }));
    expect(art.warmBatched).not.toHaveBeenCalled();
    expect(art.prefetchBatched).toHaveBeenCalledOnce();
  });
});
