import { isCardBrowserCurrent, cardBrowserItems } from '../ui/card-browser-state.js';
import { createCollectionArt } from '../ui/collection-view-art.js';
import { mountCollectionView, collectionItemHTML, collectionWorkspaceHTML } from '../ui/collection-view.js';
import { esc, escAttr } from '../core/shared.js';
import { stackKeyOf } from './collection.commands.js';
import { characterFor } from '../core/characters.js';
import { bindCardNavigation } from './hub.presentation.js';
import { decorateInventoryZoom } from '../ui/inventory-zoom.js';
import { warehouseCategoriesV7HTML } from './hub.warehouse-categories-v7.js';
import { animateBaseRefresh } from './base-motion-v4.js';
import { uiDisclosure } from '../ui/ui-disclosure.js';

const state = { slot: null, query: '', type: '', rarity: '', character: '', group: '', key: '', scrollTop:0 };
export function clearWarehouseFilters() { Object.assign(state, { query: '', type: '', rarity: '', character: '', group: '', key: '', scrollTop:0 }); }
const inventoryKeyOf = stack => stackKeyOf(stack) || stack.card.name;
const protectedCard = (base, card) => typeof base.isCollectionProtected === 'function'
  ? !!base.isCollectionProtected(card) : !!base.isCollected?.(card);
const growth = card => !!card.cls && (card.rarity === '职业' || card.type === '能力卡');
const supply = card => card.id === window.SDT.Base.PET_EGG_ID || card.id === 'tt-econpack' || !!window.SDT.Base.materialInfo?.(card);
function matches(card) {
  return (!state.query || card.name.includes(state.query)) && (!state.type || card.type === state.type) && (!state.rarity || card.rarity === state.rarity)
    && (!state.character || characterFor(card.cls)?.id === state.character)
    && (!state.group || (state.group === 'growth' ? growth(card) : state.group === 'supplies' ? supply(card) : !supply(card)));
}
function synchronize(base) {
  if (state.slot !== base.slot) { clearWarehouseFilters(); state.slot = base.slot; }
}
export function focusWarehouseForCharacter(id) { synchronize(window.SDT.Base); clearWarehouseFilters(); state.character = characterFor(id)?.id || ''; state.group = 'growth'; }
export function warehouseSectionsHTML(base, view = 'cards') {
  if (view === 'pocket') return '';
  const pocket = (base.data.pocket || []).reduce((sum, stack) => sum + stack.count, 0);
  return pocket ? `<button type="button" class="base-link warehouse-pocket-entry" data-act="hubStashView" data-view="pocket">待复原 <b>${pocket}</b> ↗</button>` : '';
}
function itemsHTML(base,pocket) {
  return (pocket ? base.data.pocket : base.data.stash).map(stack => collectionItemHTML(inventoryKeyOf(stack),stack.card.name,{
    className:'stash-cell',artClass:'warehouse-card-art',captionClass:'stash-card-caption',selectedClass:'selected',selected:inventoryKeyOf(stack) === state.key,
    attrs:{'data-stack-key':inventoryKeyOf(stack),'data-name':stack.card.name,'data-browse-filtered':pocket ? false : !matches(stack.card)},
    ariaLabel:`选择${stack.card.name}，${pocket ? '待复原' : '持有'}${stack.count}张`,caption:`<strong class="stack-count">×${stack.count}</strong>`,
    status:protectedCard(base,stack.card) ? '<span class="warehouse-protected">收藏保护</span>' : '',
  })).join('');
}
function syncWarehouseColumns(track) {
  // Each tile reserves its complete framed art and caption height; rows never share the art slot.
  const columns = Math.max(1, Math.floor((track.clientWidth + 24) / 348));
  const layout = `repeat(${columns}, minmax(0,1fr))`;
  if (track.style.gridTemplateColumns !== layout) track.style.gridTemplateColumns = layout;
}
function refreshWarehouseBrowser(browser, reset = false, suppliedItems = null) {
  const track = browser.querySelector('.card-browser-track');
  const items = cardBrowserItems(track, suppliedItems);
  const visible = items.filter(item => item.dataset.browseFiltered !== 'true');
  syncWarehouseColumns(track);
  for (const item of items) {
    const hidden = item.dataset.browseFiltered === 'true';
    if (item.hidden !== hidden) item.hidden = hidden;
  }
  const empty = String(!visible.length);
  if (browser.dataset.empty !== empty) browser.dataset.empty = empty;
  if (reset) state.scrollTop = 0;
  if (track.scrollTop !== state.scrollTop) track.scrollTop = state.scrollTop;
}
function emptyWarehouseHTML(base, pocket) {
  if (pocket) return '<h3>暂无待复原卡牌</h3>';
  const character = characterFor(state.character);
  const eligible = character ? base.data.stash.some(stack => growth(stack.card) && characterFor(stack.card.cls)?.id === character.id) : base.data.stash.length > 0;
  if (character && !eligible) return `<h3>暂无该人物的培养卡牌</h3><p>撤离带回该人物的职业卡或能力卡后，可在这里培养。</p><button class="mini-btn" data-act="hubTab" data-tab="classes" data-group="people" data-section="profile" data-character="${escAttr(character.id)}">返回角色 →</button>`;
  if (!base.data.stash.length) return '<h3>仓库暂无卡牌</h3><p>出征带回的卡牌会存入这里。</p><button class="mini-btn" data-act="hubTab" data-tab="deploy">前往整备 →</button>';
  return '<h3>没有匹配的卡牌</h3><p>调整搜索或筛选，继续浏览。</p><button class="mini-btn" data-act="warehouseReset">显示全部</button>';
}

export function warehouseHTML(view = 'cards') {
  const { Base: base } = window.SDT;
  synchronize(base);
  const pocket = view === 'pocket';
  const rows = pocket ? base.data.pocket : base.data.stash.filter(stack => matches(stack.card));
  state.key = inventoryKeyOf(rows.find(item => inventoryKeyOf(item) === state.key) || rows[0] || { card: { name: '' } });
  const person = characterFor(state.character);
  const options = (field, label) => `<option value="">${label}</option>` + [...new Set(base.data.stash.map(stack => stack.card[field]))].filter(Boolean).map(value => `<option value="${escAttr(value)}"${state[field] === value ? ' selected' : ''}>${esc(value)}</option>`).join('');
  return collectionWorkspaceHTML('warehouse',{className:'warehouse-v3 warehouse-v2 ui-scale-system',attrs:{'data-pocket':pocket},
    head:pocket ? `<header class="camp-section-head"><h2>待复原</h2><span class="camp-page-stat" data-warehouse-pocket-count>${base.data.pocket.reduce((sum, stack) => sum + stack.count, 0)} 张</span></header>` : '',tools:`${pocket ? uiDisclosure({ className:'warehouse-rules', label:'复原说明', content:'<p>未复原卡牌将在下次出征时清空。</p>' }) : ''}<div class="warehouse-controls-v12">${pocket ? '' : `${warehouseCategoriesV7HTML(state.group)}<div class="warehouse-purpose"${person ? '' : ' hidden'}>${person ? `<b>${esc(person.name)} · 归档培养</b><button class="mini-btn" data-act="hubTab" data-tab="classes" data-group="people" data-section="profile" data-character="${person.id}">返回${esc(person.name)} →</button>` : ''}</div><div class="warehouse-toolbar collection-toolbar"><input data-warehouse-filter="query" aria-label="搜索仓库卡牌" placeholder="搜索卡牌" value="${escAttr(state.query)}"><select data-warehouse-filter="type" aria-label="筛选卡牌类型">${options('type', '全部类型')}</select><select data-warehouse-filter="rarity" aria-label="筛选卡牌品质">${options('rarity', '全部品质')}</select>${warehouseSectionsHTML(base, view)}<span data-warehouse-count>${rows.length} 种</span></div>`}</div>
    `,list:`<section class="card-browser" data-card-browser="${pocket ? 'warehouse-pocket' : 'warehouse'}" aria-label="${pocket ? '待复原卡牌' : '战利品卡牌'}"><div class="card-browser-track collection-list" tabindex="0" aria-label="向下滚动浏览卡牌">${itemsHTML(base, pocket)}</div></section>`,empty:`<div class="warehouse-no-results"${rows.length ? ' hidden' : ''}>${emptyWarehouseHTML(base, pocket)}</div>`,
  });
}
export function bindWarehouse({ ui, base, sound, openCard, refresh = () => {} }) {
  const root = /** @type {HTMLElement} */ (document.querySelector('.warehouse-v3'));
  if (!root) return;
  const slotId = base.slot;
  const currentWarehouse = () => window.SDT.Base === base && base.slot === slotId && isCardBrowserCurrent(root) && document.querySelector('.warehouse-v3') === root;
  const pocket = root.dataset.pocket === 'true';
  const browser = root.querySelector('[data-card-browser]');
  let artProjection = null;
  const artwork = createCollectionArt({root,track:browser.querySelector('.card-browser-track'),current:currentWarehouse,
    host:'.warehouse-card-art',margin:600,prepareRender:() => {
      const stacks = artProjection || new Map();
      if (!artProjection) for (const stack of pocket ? base.data.pocket : base.data.stash) if (!stacks.has(inventoryKeyOf(stack))) stacks.set(inventoryKeyOf(stack),stack);
      return item => {const stack = stacks.get(item.dataset.stackKey);return stack ? window.SDT.Cards.cardHTML(stack.card,'sm') : null;};
    },
  });
  const refreshArt = artwork.refresh;
  let rows = [], byKey;
  const view = mountCollectionView({root,browser,state,selection:'key',key:'stackKey',selectedClass:'selected',paged:false,
    current:currentWarehouse,reconcile:() => state.key,
    beforeRefresh:() => {
      synchronize(base);
      const list = pocket ? base.data.pocket : base.data.stash;
      byKey = new Map();
      for (const stack of list) if (!byKey.has(inventoryKeyOf(stack))) byKey.set(inventoryKeyOf(stack),stack);
      rows = pocket ? list : list.filter(stack => matches(stack.card));
      state.key = inventoryKeyOf(rows.find(item => inventoryKeyOf(item) === state.key) || rows[0] || {card:{name:''}});
    },
    matches:item => { const stack = byKey.get(item.dataset.stackKey); return !!stack && (pocket || matches(stack.card)); },
    layout:(items,reset) => {
      refreshWarehouseBrowser(browser,reset,items);artProjection = byKey;
      try {refreshArt();} finally {artProjection = null;}
    },motion:animateBaseRefresh,
    controls:['query','type','rarity'].map(field => /** @type {[string,string,{composition:boolean,skipEqual:boolean}]} */ ([`[data-warehouse-filter="${field}"]`,field,{composition:false,skipEqual:false}])),
    results:() => {
      const empty = /** @type {HTMLElement} */ (root.querySelector('.warehouse-no-results'));empty.hidden = rows.length > 0;
      if (!rows.length) empty.innerHTML = emptyWarehouseHTML(base,pocket);
      const count = root.querySelector('[data-warehouse-count]');if (count) count.textContent = `${rows.length} 种`;
      for (const button of /** @type {NodeListOf<HTMLElement>} */ (root.querySelectorAll('[data-act="warehouseGroup"]'))) {
        const on = button.dataset.group === state.group;button.classList.toggle('on',on);button.setAttribute('aria-pressed',String(on));
      }
      const purpose = /** @type {HTMLElement} */ (root.querySelector('.warehouse-purpose'));if (purpose) purpose.hidden = !state.character;
    },
  });
  const update = view.refresh;
  // 资源单击使用一张；其他卡单击打开对应操作台。
  const select = (key) => {
    if (!currentWarehouse()) return;
    const list = pocket ? base.data.pocket : base.data.stash;
    const candidates = list.filter(stack => inventoryKeyOf(stack) === key);
    if (candidates.length !== 1) return;
    state.key = key; update(); sound.tick();
  };
  const open = (key, from) => {
    if (!currentWarehouse()) return;
    const list = pocket ? base.data.pocket : base.data.stash;
    const candidates = list.filter(stack => inventoryKeyOf(stack) === key);
    if (candidates.length !== 1) return;
    const stack = candidates[0], index = list.indexOf(stack), name = stack.card.name;
    state.key = key; update(); sound.tick();
    if (!pocket && openCard) { openCard(index, { from }); return; }
    const keys = base.data.keys || 0, cost = pocket ? base.pocketKeyCost(stack) : 0;
    const count = stack.count || 1;
    const missing = pocket && (keys < cost || base.stashRoom() < count);
    const footer = pocket ? `<div class="pocket-zoom-actions"><span>待复原 ${stack.count} 张</span><button class="mini-btn ok" data-act="restoreCard" data-stack-key="${escAttr(stackKeyOf(stack))}" data-count="${count}" data-name="${escAttr(name)}" data-i="${index}"${missing ? ' disabled' : ''}>复原 ${count} 张 · ${cost} 钥匙</button>${missing ? `<p>${keys < cost ? `还需 ${cost - keys} 把钥匙` : `仓库空位不足，还需 ${count - base.stashRoom()} 格`}</p>` : ''}</div>` : '';
    ui.showCardZoom(stack.card, { items:list.map(item => item.card), getItems:() => (pocket ? base.data.pocket : base.data.stash).map(item => item.card), presentation:'inventory', from, footer }); decorateInventoryZoom(stack.card);
  };
  let usingMaterial = false;
  browser.addEventListener('click', async event => {
    const item = /** @type {Element} */ (event.target).closest('[data-browser-key]');
    if (!item || !browser.contains(item) || /** @type {HTMLElement} */ (item).hidden || !currentWarehouse()) return;
    const rows = pocket ? base.data.pocket : base.data.stash;
    const matches = rows.filter(stack => inventoryKeyOf(stack) === /** @type {HTMLElement} */ (item).dataset.browserKey);
    if (matches.length !== 1) return;
    const stack = matches[0];
    if (!pocket && base.materialInfo?.(stack.card)) {
      if (usingMaterial) return;
      select(/** @type {HTMLElement} */ (item).dataset.browserKey);
      if (rows.filter(row => row.card.name === stack.card.name).length !== 1) { ui.log('库存引用不唯一，请刷新仓库', 'warn'); return; }
      usingMaterial = true;
      let result;
      try { result = await base.useStashMaterial(stack.card.name, false); }
      catch { result = { ok:false, msg:'基地存档未保存，材料未消耗，请重试。' }; }
      finally { usingMaterial = false; }
      if (!currentWarehouse()) return;
      if (result.ok) { sound.ding?.(); ui.log(result.msg, 'loot'); refresh(); }
      else if (result.msg) ui.log(result.msg, 'warn');
      return;
    }
    open(/** @type {HTMLElement} */ (item).dataset.browserKey, item);
  });
  browser.querySelector('.card-browser-track').addEventListener('scroll', event => { if (currentWarehouse()) state.scrollTop = /** @type {HTMLElement} */ (event.target).scrollTop; }, { passive:true });
  let artRefreshFrame = 0;
  browser.addEventListener('load', () => {
    if (!currentWarehouse() || artRefreshFrame) return;
    artRefreshFrame = requestAnimationFrame(() => {
      artRefreshFrame = 0;
      // Image completion changes neither inventory nor filters. Only the track
      // dimensions can need another column calculation; do not walk every stack.
      if (currentWarehouse()) syncWarehouseColumns(browser.querySelector('.card-browser-track'));
    });
  }, true);
  bindCardNavigation(browser.querySelector('.card-browser-track'), '[data-browser-key]', { activate: false });
  ui.act('warehouseGroup', data => { if (!currentWarehouse()) return; if (!['', 'battle', 'supplies', 'growth'].includes(data.group)) return; state.group = data.group; if (data.group !== 'growth') state.character = ''; update(true); sound.tick(); });
  ui.act('warehouseReset', () => { if (!currentWarehouse()) return; const character = state.character; clearWarehouseFilters(); if (character) { state.character = character; state.group = 'growth'; } for (const input of root.querySelectorAll('[data-warehouse-filter]')) /** @type {HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement} */ (input).value = ''; update(true); });
}
