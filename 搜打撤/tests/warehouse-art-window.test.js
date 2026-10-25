// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { warehouseHTML, bindWarehouse, clearWarehouseFilters } from '../game/src/hub/hub.warehouse.js';
import SDT from '../game/src/core/sdt-facade.js';
import { cardHTML } from '../game/src/cards/cards.view.js';
import { esc, escAttr } from '../game/src/core/shared.js';
import { stackKeyOf } from '../game/src/hub/collection.commands.js';
import { warehouseCategoriesV7HTML } from '../game/src/hub/hub.warehouse-categories-v7.js';
import { bindCardNavigation } from '../game/src/hub/hub.presentation.js';
import { isCardBrowserCurrent, cardBrowserItems } from '../game/src/ui/card-browser-state.js';
import { mountCollectionView, collectionItemHTML, collectionWorkspaceHTML } from '../game/src/ui/collection-view.js';
import { createCollectionArt } from '../game/src/ui/collection-view-art.js';
import { uiDisclosure } from '../game/src/ui/ui-disclosure.js';

let intersections, artFrames;
const flushArt=()=>{for(let i=0;i<40;i++){const index=artFrames.findIndex(callback=>callback.name==='drawBatch');if(index<0)return;artFrames.splice(index,1)[0](performance.now());}};
beforeEach(() => {
  clearWarehouseFilters(); intersections = [];artFrames=[];
  vi.stubGlobal('requestAnimationFrame',callback=>{artFrames.push(callback);return artFrames.length;});
  vi.stubGlobal('cancelAnimationFrame',()=>{});
  vi.stubGlobal('matchMedia', () => ({ matches:true }));
  vi.stubGlobal('IntersectionObserver', class {
    constructor(callback, options) { this.callback = callback; this.options = options; this.observe = vi.fn(); this.unobserve = vi.fn(); this.disconnect = vi.fn(); intersections.push(this); }
  });
});
afterEach(async () => { document.body.replaceChildren(); await Promise.resolve(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });
function fixture({ size = 200, pocket = false, eager = false } = {}) {
  const stacks = Array.from({ length:size }, (_, i) => ({ card:{ id:`window-${i}`, name:`仓库${i}`, type:'法术', rarity:'古朴', cost:2, desc:'对战开始时：获得 2 点护甲，抽 1 张牌。' }, count:i + 1 }));
  const base = { slot:'warehouse-window', data:{ stash:pocket ? [] : stacks, pocket:pocket ? stacks : [], keys:1000 }, stashUsed:() => size, stashCap:() => 9999, stashRoom:() => 9999, isCollected:() => false, materialInfo:() => null, pocketKeyCost:() => 1 };
  const cards = { cardHTML:vi.fn(cardHTML), NO_COST_TYPES:[], DMG_TYPES:['法术'], RARITIES:['古朴'], TYPES:['法术'], rarityOf:card => card.rarity, sellPrice:() => 1, isSellable:() => true };
  const ui = { act:vi.fn(), showCardZoom:vi.fn() }, openCard = vi.fn();
  Object.assign(SDT, { Base:base, Cards:cards, Icons:{ img:() => '<i class="ic"></i>', TYPE_ART:{} }, UI:ui });
  window.SDT = SDT;
  let html = warehouseHTML, bind = bindWarehouse;
  if (eager) {
    // Eager reference changes only art construction, using identical synthetic stacks.
    const source = readFileSync('game/src/hub/hub.warehouse.js','utf8')
      .replace('const refreshArt = artwork.refresh;','const refreshArt = () => {};');
    const eagerItem = (key,label,options) => collectionItemHTML(key,label,{...options,
      art:window.SDT.Cards.cardHTML(stacks.find(stack => stack.card.name === label).card,'sm')});
    const evaluate = new Function('mountCollectionView','createCollectionArt','collectionItemHTML','collectionWorkspaceHTML','esc','escAttr','stackKeyOf','characterFor','warehouseCategoriesV7HTML','uiDisclosure','bindCardNavigation','decorateInventoryZoom','animateBaseRefresh','isCardBrowserCurrent','cardBrowserItems',
      source.replace(/^import .*;\r?$/gm,'').replace(/export /g,'') + '\nreturn {warehouseHTML,bindWarehouse};');
    const feature = evaluate(mountCollectionView,createCollectionArt,eagerItem,collectionWorkspaceHTML,esc,escAttr,stackKeyOf,() => null,warehouseCategoriesV7HTML,uiDisclosure,bindCardNavigation,() => {},() => {},isCardBrowserCurrent,cardBrowserItems);
    html = feature.warehouseHTML; bind = feature.bindWarehouse;
  }
  const started = performance.now();
  document.body.innerHTML = html(pocket ? 'pocket' : 'cards');
  const track = document.querySelector('.card-browser-track');
  const tiles = [...track.children];
  Object.defineProperty(track, 'clientWidth', { value:720 });
  const positions = new Map();
  track.getBoundingClientRect = () => { tiles.filter(item => !item.hidden).forEach((item, index) => positions.set(item, index)); return { top:100, bottom:600, height:500, width:720 }; };
  for (const tile of tiles) {
    tile.getBoundingClientRect = () => {
      const index = positions.get(tile) ?? tiles.indexOf(tile);
      const top = 108 + Math.floor(index / 2) * 504 - track.scrollTop;
      return { top, bottom:top + 480, width:330, height:480 };
    };
    tile.getClientRects = () => tile.hidden ? [] : [tile.getBoundingClientRect()];
    tile.scrollIntoView = vi.fn();
  }
  bind({ base, ui, sound:{ tick:vi.fn() }, openCard });
  const mountMs = performance.now() - started;
  return { base, cards, stacks, ui, openCard, track, tiles, mountMs, input(value) { const input = document.querySelector('input'); input.value = value; input.dispatchEvent(new Event('input')); } };
}
function enter(...tiles) { intersections.at(-1).callback(tiles.map(target => ({ target, isIntersecting:true }))); flushArt(); }

describe('仓库保留卡槽，延迟构造邻屏复杂卡面', () => {
  it('200 叠模拟库存、真实 cardHTML 对照：入口只构造首屏及邻屏，全部按钮、数量、无分页保持', () => {
    const before = fixture({ eager:true });
    const baseline = { cards:before.cards.cardHTML.mock.calls.length, nodes:document.querySelectorAll('*').length, mountMs:before.mountMs };
    let started = performance.now(); before.input('仓库199'); before.input(''); baseline.inputPairMs = performance.now() - started;
    const after = fixture();
    const optimized = { cards:after.cards.cardHTML.mock.calls.length, nodes:document.querySelectorAll('*').length, mountMs:after.mountMs };
    started = performance.now(); after.input('仓库199'); after.input(''); optimized.inputPairMs = performance.now() - started;
    expect(baseline.cards).toBe(200); expect(optimized.cards).toBe(2); // Visible faces stay synchronous; neighbouring prints wait for a frame.
    flushArt();expect(after.cards.cardHTML.mock.calls.length).toBe(7); // Filtered target plus six initial/nearby prints.
    expect(optimized.nodes).toBeLessThan(baseline.nodes / 3);
    expect(after.tiles).toHaveLength(200); expect(document.querySelector('[data-browser-page]')).toBeNull();
    expect(after.tiles[199].getAttribute('aria-label')).toContain('200张');
    expect(after.tiles[198].querySelector('.warehouse-card-art').childElementCount).toBe(0);
    console.log('warehouse real cardHTML / controlled DOM mount', JSON.stringify({ baseline, optimized }));
  });
  it('快速滚动只补目标卡面，重复/隐藏交叉回调不重复构造；按钮与焦点节点稳定', () => {
    const f = fixture(); f.track.scrollTop = 48000; f.track.dispatchEvent(new Event('scroll'));
    enter(f.tiles[198], f.tiles[199]); enter(f.tiles[199]);
    expect(f.cards.cardHTML).toHaveBeenCalledTimes(8);
    expect(f.track.children[199]).toBe(f.tiles[199]);
    f.tiles[199].focus(); f.tiles[199].click();
    expect(document.activeElement).toBe(f.tiles[199]); expect(f.openCard).toHaveBeenCalledWith(199, { from:f.tiles[199] });
    f.input('没有匹配'); enter(f.tiles[90]);
    expect(f.tiles[90].querySelector('.hs-card')).toBeNull();
  });
  it('End 焦点即时补卡，未经过观察回调也可开操作台', () => {
    const f = fixture(); f.tiles[0].focus();
    f.tiles[0].dispatchEvent(new KeyboardEvent('keydown', { key:'End', bubbles:true }));
    expect(document.activeElement).toBe(f.tiles[199]);
    expect(f.tiles[199].querySelector('.hs-card')).not.toBeNull();
    f.tiles[199].click(); expect(f.openCard).toHaveBeenCalledTimes(1);
  });
  it('输入过滤后按压缩网格补屏，清除恢复原按钮，库存不变', () => {
    const f = fixture(), inventory = JSON.stringify(f.base.data);
    f.track.scrollTop = 30000; f.track.dispatchEvent(new Event('scroll'));
    f.input('仓库199');
    expect(f.track.scrollTop).toBe(0); expect(f.tiles.filter(tile => !tile.hidden)).toEqual([f.tiles[199]]);
    expect(f.tiles[199].querySelector('.hs-card')).not.toBeNull();
    expect(document.activeElement).not.toBe(f.tiles[199]);
    f.input(''); expect(f.tiles.filter(tile => !tile.hidden)).toHaveLength(200);
    expect(f.track.children[199]).toBe(f.tiles[199]); expect(JSON.stringify(f.base.data)).toBe(inventory);
  });
  it('延迟卡面读取最新库存；键已变化的旧按钮不显示错卡', () => {
    const f = fixture(); f.stacks[50].card = { ...f.stacks[50].card, name:'新卡名' };
    enter(f.tiles[50]); expect(f.tiles[50].querySelector('.hs-card').textContent).toContain('新卡名');
    f.stacks[51].card.id = 'changed-key'; enter(f.tiles[51]); expect(f.tiles[51].querySelector('.hs-card')).toBeNull();
  });
  it('待复原也按邻屏构造，并保持原复原入口与数量', () => {
    const f = fixture({ pocket:true }); expect(f.cards.cardHTML).toHaveBeenCalledTimes(2);flushArt();expect(f.cards.cardHTML).toHaveBeenCalledTimes(6);
    f.tiles[199].focus(); f.tiles[199].click();
    expect(f.ui.showCardZoom).toHaveBeenCalledWith(f.stacks[199].card, expect.objectContaining({ footer:expect.stringContaining('复原 200 张') }));
  });
  it('重进恢复滚动位置且直接补该位置卡面', () => {
    const first = fixture(); first.track.scrollTop = 48000; first.track.dispatchEvent(new Event('scroll'));
    const next = fixture(); expect(next.track.scrollTop).toBe(48000);
    expect(next.tiles[190].querySelector('.hs-card')).not.toBeNull();
    expect(next.tiles[0].querySelector('.hs-card')).toBeNull();
  });
  it('离页和切档后观察回调失效并释放观察器', async () => {
    const f = fixture(), observer = intersections.at(-1), calls = f.cards.cardHTML.mock.calls.length;
    f.base.slot = 'different'; enter(f.tiles[80]); expect(f.cards.cardHTML).toHaveBeenCalledTimes(calls);
    document.body.replaceChildren(); await Promise.resolve();
    expect(observer.disconnect).toHaveBeenCalledTimes(1);
    observer.callback([{ target:f.tiles[80], isIntersecting:true }]); expect(f.cards.cardHTML).toHaveBeenCalledTimes(calls);
  });
  it('缺少 IntersectionObserver 时仍能浏览所有卡面', () => {
    vi.stubGlobal('IntersectionObserver', undefined);
    const f = fixture({ size:20 }); expect(f.cards.cardHTML).toHaveBeenCalledTimes(20);
  });
});
