import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
const h = vi.hoisted(() => ({ runtime: null, canvas: null, dpr: 1,
  ctx: { setTransform: vi.fn() }, reenter:vi.fn(), game: { runActive: false, state:'idle', toggles:{}, debug:{}, nodes:[], layerData:[], time:0, elapsed:0 },
  cam: { viewW:0, viewH:0, resize(w,height){ this.viewW=w; this.viewH=height; }, clamp:vi.fn(), panBy:vi.fn(), screenToWorld:(x,y)=>({x,y}) } }));
vi.mock('../game/src/run/game.session.js', () => ({
  MAP: { cols:4, rows:4, tile:100 }, SLOT_COUNT: 3, canvas: h.canvas, cam: h.cam, ctx: h.ctx, game: h.game,
  get dpr() { return h.dpr; }, _set_dpr: value => { h.dpr = value; }, _set_cam: vi.fn(),
  configureGameRuntime: value => { h.runtime = value; }, buildDerived: vi.fn(), hasRun: vi.fn(),
  migrateOldSave: vi.fn(), openLeaveMenu: vi.fn(), openSettings: vi.fn(), openTitleGuide: vi.fn(),
  saveGame: vi.fn(), setLobby: vi.fn(), showTitle: vi.fn(), startNewGame: vi.fn(), renderMiniMap: vi.fn(),
}));
vi.mock('../game/src/run/game.run.js', () => ({ bindRunMixins: vi.fn(), devForceBattle: vi.fn(), devJumpNode: vi.fn(),
  moveTo: vi.fn(), openDevConsole: vi.fn(), reenterCell: h.reenter, openClassChoice: vi.fn(), openShop: vi.fn(),
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

const captured = new Set();
beforeAll(async () => {
  vi.stubGlobal('requestAnimationFrame', vi.fn(() => 1));
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok:true, json:async()=>({ version:'1.0.0' }) })));
  const html = readFileSync(resolve(process.cwd(), 'game/index.html'), 'utf8');
  document.body.innerHTML = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i)[1].replace(/<script[\s\S]*?<\/script>/g, '');
  h.canvas = document.getElementById('game');
  h.canvas.getBoundingClientRect = () => ({ left:0, top:0, right:800, bottom:600, width:800, height:600 });
  h.canvas.setPointerCapture=vi.fn(id=>captured.add(id));
  h.canvas.hasPointerCapture=id=>captured.has(id);
  h.canvas.releasePointerCapture=vi.fn(id=>{ captured.delete(id); pointer('lostpointercapture',id); });
  const ui={ el:{ overlay:document.getElementById('overlay'), viewport:document.getElementById('viewport') }, init(){}, refresh(){}, hideTooltip(){}, showTooltip(){}, log(){} };
  const noop=()=>{};
  window.SDT = { UI:ui, Sound:{ muted:false, sfx:noop }, Camera:class { constructor(){return h.cam;} },
    Base:{ migrateLegacy:noop }, Cards:{ ensureStarters:noop, ensureSha:noop, ensureTabletop:noop, ensureDmgTypes:noop, ensureEffectFields:noop },
    Art:{ collectThumbnailAssets:()=>[], collectManifestAssets:()=>[], prefetchBatched:async()=>{} } };
  await import('../game/src/game.boot.js');
  document.dispatchEvent(new Event('DOMContentLoaded', { bubbles:true }));
});
afterEach(() => { window.dispatchEvent(new Event('blur')); captured.clear(); h.cam.panBy.mockClear(); h.reenter.mockClear(); h.canvas.releasePointerCapture.mockClear(); });
afterAll(() => vi.unstubAllGlobals());
function pointer(type,id,x=20,y=20) {
  if (type === 'lostpointercapture' || type === 'pointercancel') captured.delete(id);
  const event=new MouseEvent(type, { bubbles:true, cancelable:true, button:0, clientX:x, clientY:y });
  Object.defineProperties(event,{ pointerId:{value:id}, pointerType:{value:'mouse'} });
  h.canvas.dispatchEvent(event);
}
describe('真实 boot Canvas 被中断的指针输入', () => {
  it('lostpointercapture 取消当前拖动，新的指针可继续拖动', () => {
    pointer('pointerdown',1); pointer('pointermove',1,40,20);
    expect(h.game.camDragging).toBe(true);
    pointer('lostpointercapture',1,40,20);
    expect(h.game.camDragging).toBe(false);
    pointer('pointerdown',2); pointer('pointermove',2,40,20);
    expect(h.cam.panBy).toHaveBeenCalledTimes(2);
    pointer('pointercancel',2);
  });
  it('窗口失焦取消拖动，不能保留旧 pointer 归属', () => {
    // 先取消上一测试可能留下的指针，避免红测连带。
    pointer('pointercancel',1); pointer('pointercancel',2);
    pointer('pointerdown',3); pointer('pointermove',3,40,20);
    expect(h.game.camDragging).toBe(true);
    window.dispatchEvent(new Event('blur'));
    expect(h.game.camDragging).toBe(false);
    pointer('pointercancel',3);
  });
  it('正常拖动和 pointerup 保持效果，自动 lost 事件收尾幂等', () => {
    pointer('pointerdown',4); pointer('pointermove',4,40,20); pointer('pointerup',4,40,20);
    expect(h.cam.panBy).toHaveBeenCalledOnce();
    expect(h.game.camDragging).toBe(false);
    expect(h.canvas.releasePointerCapture).toHaveBeenCalledOnce();
    pointer('lostpointercapture',4); window.dispatchEvent(new Event('blur'));
    expect(h.canvas.releasePointerCapture).toHaveBeenCalledOnce();
  });
  it('旧 pointer 的 lost/cancel/up 不清除新 pointer 归属', () => {
    pointer('pointerdown',5); pointer('pointermove',5,40,20); pointer('pointerup',5,40,20);
    pointer('pointerdown',6); pointer('pointermove',6,40,20);
    pointer('lostpointercapture',5); pointer('pointercancel',5); pointer('pointerup',5);
    expect(h.game.camDragging).toBe(true);
    pointer('pointermove',6,60,20);
    expect(h.cam.panBy).toHaveBeenCalledTimes(3);
    pointer('pointerup',6,60,20);
    expect(h.game.camDragging).toBe(false);
    expect(h.canvas.releasePointerCapture).toHaveBeenCalledTimes(2);
  });
  it('短点击仍先预览再确认当前格；取消和失焦不确认', () => {
    const node={ li:0, idx:0, x:20, y:20, def:{type:'blank'} };
    Object.assign(h.game,{ layerIdx:0, trackPos:0, nodes:[node], layerData:[{logical:[{next:[],def:node.def}]}], seen:{}, visited:{} });
    pointer('pointerdown',7); pointer('pointerup',7);
    expect(h.reenter).not.toHaveBeenCalled();
    pointer('pointerdown',8); pointer('pointercancel',8); pointer('pointerup',8);
    pointer('pointerdown',9); window.dispatchEvent(new Event('blur')); pointer('pointerup',9);
    expect(h.reenter).not.toHaveBeenCalled();
    pointer('pointerdown',10); pointer('pointerup',10);
    expect(h.reenter).toHaveBeenCalledOnce();
    expect(h.game.camDragging).toBe(false);
  });
});
