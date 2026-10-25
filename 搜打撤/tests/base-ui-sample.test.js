// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cardBrowserHTML, bindCardBrowser, refreshCardBrowser } from '../game/src/ui/card-browser.js';
import { presentHub, bindHubBrowse, restoreHubFocus } from '../game/src/hub/hub.presentation.js';
import { warehouseHTML, bindWarehouse } from '../game/src/hub/hub.warehouse.js';
import { decorateInventoryZoom } from '../game/src/ui/inventory-zoom.js';

let serial = 0;
beforeEach(() => {
  document.body.replaceChildren(); document.body.className = '';
  vi.stubGlobal('matchMedia', () => ({ matches: false }));
  window.SDT = { Base: { slot: ++serial }, Icons: { rich: html => html } };
});
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); document.body.replaceChildren(); });
const shown = root => [...root.querySelectorAll('[data-browser-key]')].filter(item => !item.hidden);

function mountBrowser(id, count = 14, options = {}) {
  const host = document.createElement('div');
  host.innerHTML = cardBrowserHTML(id, '测试卡牌', Array.from({ length: count }, (_, index) => `<button data-browser-key="${index + 1}"><b>卡牌 ${index + 1}</b></button>`).join(''));
  document.body.append(host);
  const root = host.firstElementChild, track = root.querySelector('.card-browser-track');
  track.style.setProperty('--card-browser-min', '210px'); track.style.columnGap = '20px';
  Object.defineProperty(track, 'clientWidth', { configurable: true, value: 680 });
  bindCardBrowser(root, options);
  return root;
}

function shell(page, body, view = `${page}/cards`) {
  return `<section id="hubMain" data-page="${page}"><header><span class="hub-slot-label">档案 01</span><div class="hub-res"></div></header><main class="hub-page" data-view="${view}">${body}</main></section>`;
}
function makeUI() {
  const overlay = document.createElement('div'); overlay.id = 'overlay'; document.body.append(overlay);
  const ui = { el: { overlay }, _acts: {}, act: (key, callback) => { ui._acts[key] = callback; },
    showOverlay: vi.fn((_title, html) => { overlay.innerHTML = html; ui._acts = {}; }) };
  window.SDT.UI = ui;
  return ui;
}
const icons = { rich: html => html };

describe('common two-row card browser', () => {
  it('shows two rows of three cards and bounds page/keyboard navigation', () => {
    const page = vi.fn(), root = mountBrowser(`rows-${serial}`, 14, { onPage: page });
    expect(root.dataset.browserRows).toBe('2');
    expect(shown(root).map(item => item.dataset.browserKey)).toEqual(['1', '2', '3', '4', '5', '6']);
    expect(root.querySelector('[data-browser-page="previous"]').disabled).toBe(true);
    root.querySelector('[data-browser-page="next"]').click();
    expect(shown(root).map(item => item.dataset.browserKey)).toEqual(['7', '8', '9', '10', '11', '12']);
    root.dispatchEvent(new KeyboardEvent('keydown', { key: 'PageDown', bubbles: true }));
    expect(shown(root).map(item => item.dataset.browserKey)).toEqual(['13', '14']);
    expect(root.querySelector('[data-browser-page="next"]').disabled).toBe(true);
    root.querySelector('[data-browser-page="next"]').click();
    expect(page).toHaveBeenCalledTimes(2);
    root.dispatchEvent(new KeyboardEvent('keydown', { key: 'PageUp', bubbles: true }));
    expect(shown(root)[0].dataset.browserKey).toBe('7');
  });

  it('filters the complete collection before pagination and safely handles no matches', () => {
    const root = mountBrowser(`filter-${serial}`, 18);
    root.querySelector('[data-browser-page="next"]').click();
    const items = [...root.querySelectorAll('[data-browser-key]')];
    items.forEach(item => { item.dataset.browseFiltered = String(Number(item.dataset.browserKey) % 2 === 0); });
    refreshCardBrowser(root, { reset: true });
    expect(shown(root).map(item => item.dataset.browserKey)).toEqual(['1', '3', '5', '7', '9', '11']);
    root.querySelector('[data-browser-page="next"]').click();
    expect(shown(root).map(item => item.dataset.browserKey)).toEqual(['13', '15', '17']);
    items.forEach(item => { item.dataset.browseFiltered = 'true'; }); refreshCardBrowser(root);
    expect(shown(root)).toHaveLength(0);
    expect(root.dataset.empty).toBe('true');
    expect(root.querySelector('[data-browser-page="previous"]').disabled).toBe(true);
    expect(root.querySelector('[data-browser-page="next"]').disabled).toBe(true);
  });

  it('remembers the current page within a save and keeps other saves independent', () => {
    const id = `slots-${serial}`, originalSlot = window.SDT.Base.slot;
    let root = mountBrowser(id); root.querySelector('[data-browser-page="next"]').click(); root.remove();
    root = mountBrowser(id); expect(shown(root)[0].dataset.browserKey).toBe('7'); root.remove();
    window.SDT.Base.slot = originalSlot + 100;
    root = mountBrowser(id); expect(shown(root)[0].dataset.browserKey).toBe('1'); root.remove();
    window.SDT.Base.slot = originalSlot;
    root = mountBrowser(id); expect(shown(root)[0].dataset.browserKey).toBe('7');
  });

  it('opens the clicked card with its exact source element and ignores cards outside the current page', () => {
    const open = vi.fn(), root = mountBrowser(`open-${serial}`, 14, { onOpen: open });
    const source = shown(root)[2]; source.querySelector('b').click();
    expect(open).toHaveBeenCalledWith('3', source);
    root.querySelector('[data-browser-key="8"]').click();
    expect(open).toHaveBeenCalledTimes(1);
    expect(shown(root)).toContain(source);
  });
});

describe('base page and inventory return contracts', () => {
  it('仓库保护标识使用保护状态，保留收录的未保护卡不显示禁售标记', () => {
    const card = { id:'catalogued', name:'已收录卡牌', type:'武术', rarity:'古朴' };
    const base = window.SDT.Base = { slot:++serial, PET_EGG_ID:'egg', data:{ stash:[{card,count:2}], pocket:[] },
      stashUsed:() => 2, stashCap:() => 25, isCollected:vi.fn(() => true), isCollectionProtected:vi.fn(() => false) };
    window.SDT.Cards = { cardHTML:item => `<span>${item.name}</span>` };
    document.body.innerHTML = warehouseHTML();
    expect(document.querySelector('.warehouse-protected')).toBeNull();
    expect(document.querySelector('.warehouse-selection-v12')).toBeNull();
    expect(base.isCollected).not.toHaveBeenCalled();

    base.isCollectionProtected.mockReturnValue(true);
    document.body.innerHTML = warehouseHTML();
    expect(document.querySelector('.warehouse-protected').textContent).toBe('收藏保护');
  });

  it('moves glass regions during base subpage entry without animating opacity', () => {
    const animate = vi.fn(() => ({ finished:Promise.resolve(), cancel:vi.fn() }));
    const originalAnimate = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'animate');
    Object.defineProperty(HTMLElement.prototype, 'animate', { configurable:true, value:animate });
    const ui = makeUI();
    const glassPage = view => shell('ach', '<header class="av3-header">收藏室</header><div class="av12-content"><aside class="av3-back-detail">卡背</aside></div>', view).replace('id="hubMain"', 'id="hubMain" class="base-camp base-frame-v7"');
    try {
      presentHub(ui, glassPage('ach/cards'), icons);
      presentHub(ui, glassPage('ach/backs'), icons);
      expect(animate).toHaveBeenCalledTimes(2);
      for (const [frames, options] of animate.mock.calls) {
        expect(frames.every(frame => !Object.hasOwn(frame, 'opacity'))).toBe(true);
        expect(frames[0].transform).toBe('translateX(64px)');
        expect(options.fill).toBe('backwards');
      }
      animate.mockClear();
      presentHub(ui, glassPage('ach/cards'), icons);
      for (const [frames] of animate.mock.calls) expect(frames[0].transform).toBe('translateX(-64px)');
    } finally {
      if (originalAnimate) Object.defineProperty(HTMLElement.prototype, 'animate', originalAnimate);
      else delete HTMLElement.prototype.animate;
    }
  });
  it('delegates a filtered inventory click using the real stack index and restores its source after a refresh', async () => {
    const ui = makeUI();
    const base = window.SDT.Base = { slot: ++serial, PET_EGG_ID: 'egg', data: { stash: [
      { card: { name: '甲', type: '武术', rarity: '古朴' }, count: 2 }, { card: { name: '乙', type: '法术', rarity: '稀有' }, count: 3 },
    ], pocket: [], coins: 5 }, stashUsed: () => 5, stashCap: () => 20, materialInfo: () => null };
    window.SDT.Cards = { cardHTML: card => `<span>${card.name}</span>` };
    window.SDT.Icons.img = id => `<i>${id}</i>`;
    const original = JSON.stringify(base.data);
    presentHub(ui, shell('stash', warehouseHTML()), icons);
    const openCard = vi.fn((_index, { from }) => {
      const zoom = document.createElement('div'); zoom.id = 'cardZoom'; zoom._returnSource = from; document.body.append(zoom);
    });
    const sound = { tick: vi.fn() };
    bindWarehouse({ ui, base, cards: window.SDT.Cards, sound, openCard });
    const focus = new Map(); bindHubBrowse(document.getElementById('hubMain'), new Map(), focus);
    const query = document.querySelector('[data-warehouse-filter="query"]'); query.value = '乙'; query.dispatchEvent(new Event('input'));
    const source = document.querySelector('[data-name="乙"]'); source.focus(); source.click();
    // 单击卡面直接打开该堆操作台。
    expect(document.querySelector('[data-act="warehousePick"]')).toBeNull();
    expect(openCard).toHaveBeenCalledWith(1, { from: source });
    expect(document.getElementById('cardZoom')._returnSource).toBe(source);
    expect(focus.get('stash/cards')?.browserKey).toBe('乙');
    presentHub(ui, shell('stash', warehouseHTML()), icons);
    bindWarehouse({ ui, base, cards: window.SDT.Cards, sound, openCard });
    const observer = restoreHubFocus('stash/cards', focus);
    document.getElementById('cardZoom').remove(); await Promise.resolve();
    expect(document.activeElement).toBe(document.querySelector('[data-name="乙"]'));
    expect(document.querySelector('[data-warehouse-filter="query"]').value).toBe('乙');
    expect(JSON.stringify(base.data)).toBe(original);
    observer?.disconnect();
  });

  it('preserves current inventory actions across same-page refreshes and discards unrelated page actions', () => {
    const ui = makeUI(); presentHub(ui, shell('stash', '<p>仓库</p>'), icons);
    const collect = vi.fn(), use = vi.fn(), stale = vi.fn();
    ui.act('stashCollectToggle', collect); ui.act('stashUseMat', use); ui.act('obsoletePageAction', stale);
    const zoom = document.createElement('section'); zoom.id = 'cardZoom'; zoom.innerHTML = '<div class="cz-card"></div><div class="cz-foot"><button data-act="stashCollectToggle">收藏卡牌</button><button data-act="stashUseMat">使用材料</button></div>'; document.body.append(zoom);
    decorateInventoryZoom({ name: '甲', type: '武术', rarity: '古朴', desc: '造成 1 点伤害' });
    zoom.addEventListener('click', event => { const button = event.target.closest('.cz-foot [data-act]'); if (button) ui._acts[button.dataset.act]?.(button.dataset); });
    zoom.querySelector('[data-act="stashCollectToggle"]').click();
    presentHub(ui, shell('stash', '<p>库存已刷新</p>'), icons);
    expect(document.getElementById('cardZoom')).toBe(zoom);
    zoom.querySelector('[data-act="stashCollectToggle"]').click();
    expect(collect).toHaveBeenCalledTimes(2);
    expect(ui._acts.stashUseMat).toBe(use);
    expect(ui._acts.obsoletePageAction).toBeUndefined();
  });

  it('mounts a fresh independent page when data-page changes', () => {
    const ui = makeUI(); presentHub(ui, shell('deploy', '<button>出征</button>'), icons);
    const previous = document.getElementById('hubMain'); ui.act('oldPage', vi.fn());
    presentHub(ui, shell('ach', '<h2>归档室</h2>', 'ach/achievements'), icons);
    expect(ui.showOverlay).toHaveBeenCalledTimes(2);
    expect(document.getElementById('hubMain')).not.toBe(previous);
    expect(previous.isConnected).toBe(false);
    expect(document.getElementById('hubMain').dataset.page).toBe('ach');
    expect(ui._acts.oldPage).toBeUndefined();
  });
});
