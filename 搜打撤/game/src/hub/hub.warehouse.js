import { isCardBrowserCurrent, cardBrowserItems, filterCardBrowserItems, selectCardBrowserItems } from '../ui/card-browser-state.js';
import { esc, escAttr } from '../core/shared.js';
import { stackKeyOf } from './collection.commands.js';
import { characterFor } from '../core/characters.js';
import '../../css/card-browser.css';
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
function itemsHTML(base, pocket) {
  return (pocket ? base.data.pocket : base.data.stash).map(stack => `<button type="button" class="stash-cell${inventoryKeyOf(stack) === state.key ? ' selected' : ''}" data-browser-key="${escAttr(inventoryKeyOf(stack))}" data-stack-key="${escAttr(inventoryKeyOf(stack))}" data-name="${escAttr(stack.card.name)}" data-browse-filtered="${pocket ? false : !matches(stack.card)}" aria-pressed="${inventoryKeyOf(stack) === state.key}" aria-label="选择${escAttr(stack.card.name)}，${pocket ? '待复原' : '持有'}${stack.count}张"><span class="warehouse-card-art"></span><span class="stash-card-caption"><b>${esc(stack.card.name)}</b><strong class="stack-count">×${stack.count}</strong></span>${protectedCard(base, stack.card) ? '<span class="warehouse-protected">收藏保护</span>' : ''}</button>`).join('');
}
function warehouseSelectionHTML(rows) {
  const stack = rows.find(item => inventoryKeyOf(item) === state.key);
  return stack ? `<div><small>当前浏览</small><b>${esc(stack.card.name)}</b><span>${stack.count} 张${protectedCard(window.SDT.Base, stack.card) ? ' · 收藏保护' : ''}</span></div>` : '';
}
function refreshWarehouseBrowser(browser, reset = false, suppliedItems = null) {
  const track = browser.querySelector('.card-browser-track');
  const items = cardBrowserItems(track, suppliedItems);
  const visible = items.filter(item => item.dataset.browseFiltered !== 'true');
  // Each tile reserves its complete framed art and caption height; rows never share the art slot.
  const columns = Math.max(1, Math.floor((track.clientWidth + 24) / 348));
  const layout = `repeat(${columns}, minmax(0,1fr))`;
  if (track.style.gridTemplateColumns !== layout) track.style.gridTemplateColumns = layout;
  for (const item of items) {
    const hidden = item.dataset.browseFiltered === 'true';
    if (item.hidden !== hidden) item.hidden = hidden;
  }
  const empty = String(!visible.length);
  if (browser.dataset.empty !== empty) browser.dataset.empty = empty;
  if (reset) state.scrollTop = 0;
  if (track.scrollTop !== state.scrollTop) track.scrollTop = state.scrollTop;
}
// Keep every accessible button and its framed art slot in the grid. Only the expensive
// card contents are deferred; cells are never recycled, removed or paginated.
function bindWarehouseArt(root, track, current, stacks) {
  const rendered = new WeakSet();
  let disposed = false;
  const observer = typeof IntersectionObserver === 'function' ? new IntersectionObserver(entries => {
    hydrate(entries.filter(entry => entry.isIntersecting).map(entry => entry.target));
  }, { root:track, rootMargin:'600px 0px' }) : null;
  const hydrate = candidates => {
    if (disposed || !current()) return;
    const pending = candidates.filter(item => !item.hidden && track.contains(item) && !rendered.has(item));
    if (!pending.length) return;
    // Resolve against live inventory at hydration time, never captured card/index snapshots.
    const byKey = new Map();
    for (const stack of stacks()) {
      const key = inventoryKeyOf(stack);
      if (!byKey.has(key)) byKey.set(key, stack);
    }
    for (const item of pending) {
      const stack = byKey.get(item.dataset.stackKey), art = item.querySelector('.warehouse-card-art');
      if (!stack || !art) continue;
      art.innerHTML = window.SDT.Cards.cardHTML(stack.card, 'sm');
      rendered.add(item);
      observer?.unobserve(item);
    }
  };
  const refresh = () => {
    if (disposed || !current()) return;
    const pending = [...track.children].filter(item => !item.hidden && !rendered.has(item));
    if (!observer) { hydrate(pending); return; }
    const viewport = track.getBoundingClientRect();
    if (viewport.height <= 0 || viewport.width <= 0) return;
    // Read all geometry before inserting art, including after a filter or restored scroll.
    hydrate(pending.filter(item => {
      const box = item.getBoundingClientRect();
      return box.bottom >= viewport.top - 600 && box.top <= viewport.bottom + 600;
    }));
  };
  const focus = event => {
    const item = event.target.closest('[data-browser-key]');
    if (item) hydrate([item]);
  };
  track.addEventListener('focusin', focus);
  for (const item of track.children) observer?.observe(item);
  const lifetime = new MutationObserver(() => {
    if (root.isConnected && current()) return;
    disposed = true;
    observer?.disconnect(); lifetime.disconnect();
    track.removeEventListener('focusin', focus);
  });
  lifetime.observe(root.ownerDocument, { childList:true, subtree:true });
  return refresh;
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
  return `<div class="warehouse-v3 warehouse-v2 ui-scale-system" data-pocket="${pocket}"><header class="camp-section-head"><h2>${pocket ? '待复原' : '后勤仓库'}</h2><div class="warehouse-header-actions">${warehouseSectionsHTML(base, view)}${pocket ? `<span class="camp-page-stat" data-warehouse-pocket-count>待复原 ${base.data.pocket.reduce((sum, stack) => sum + stack.count, 0)} 张</span>` : '<button type="button" class="base-link" data-act="rawItem" data-kind="wood">木材 ↗</button><button type="button" class="base-link" data-act="rawItem" data-kind="rations">口粮 ↗</button><button class="base-link" data-act="hubTab" data-tab="shop">交易所 ↗</button>'}<div class="warehouse-capacity"><span class="camp-page-stat">${base.stashUsed()} / ${base.stashCap()} 格</span><button class="base-link" data-act="hubTab" data-tab="upgrade" data-facility="stash">扩建 ↗</button></div></div></header>
    ${uiDisclosure({ className:'warehouse-rules', label:pocket ? '复原说明' : '仓库说明', content:pocket ? '<p>下次出征时，未复原卡牌会清空；出发前请检查待复原数量。</p>' : '<p>卡牌每张占一格。单击木材、口粮、钥匙卡使用一张，折入基地库存；其他卡单击打开操作台。</p>' })}<div class="warehouse-controls-v12">${pocket ? '' : `${warehouseCategoriesV7HTML(state.group)}<div class="warehouse-purpose"${person ? '' : ' hidden'}>${person ? `<b>${esc(person.name)} · 归档培养</b><button class="mini-btn" data-act="hubTab" data-tab="classes" data-group="people" data-section="profile" data-character="${person.id}">返回${esc(person.name)} →</button>` : ''}</div><div class="warehouse-toolbar"><input data-warehouse-filter="query" aria-label="搜索仓库卡牌" placeholder="搜索卡牌" value="${escAttr(state.query)}"><select data-warehouse-filter="type" aria-label="筛选卡牌类型">${options('type', '全部类型')}</select><select data-warehouse-filter="rarity" aria-label="筛选卡牌品质">${options('rarity', '全部品质')}</select><span data-warehouse-count>${rows.length} 种</span></div>`}</div>
    <div class="warehouse-workspace-v12"><section class="warehouse-inventory-v12"><section class="card-browser" data-card-browser="${pocket ? 'warehouse-pocket' : 'warehouse'}" aria-label="${pocket ? '待复原卡牌' : '战利品卡牌'}"><div class="card-browser-track" tabindex="0" aria-label="向下滚动浏览卡牌">${itemsHTML(base, pocket)}</div></section>
    <div class="warehouse-no-results"${rows.length ? ' hidden' : ''}>${emptyWarehouseHTML(base, pocket)}</div></section><aside class="warehouse-selection-v12" aria-label="当前浏览卡牌">${warehouseSelectionHTML(rows)}</aside></div></div>`;
}
export function bindWarehouse({ ui, base, sound, openCard, refresh = () => {} }) {
  const root = document.querySelector('.warehouse-v3');
  if (!root) return;
  const slotId = base.slot;
  const currentWarehouse = () => window.SDT.Base === base && base.slot === slotId && isCardBrowserCurrent(root) && document.querySelector('.warehouse-v3') === root;
  const pocket = root.dataset.pocket === 'true';
  const browser = root.querySelector('[data-card-browser]');
  const refreshArt = bindWarehouseArt(root, browser.querySelector('.card-browser-track'), currentWarehouse, () => pocket ? base.data.pocket : base.data.stash);
  const update = (reset = false) => {
    if (!currentWarehouse()) return;
    synchronize(base);
    const list = pocket ? base.data.pocket : base.data.stash;
    // Rebuild for each action: inventory entries and their cards can change in place.
    const byKey = new Map();
    for (const stack of list) {
      const key = inventoryKeyOf(stack);
      if (!byKey.has(key)) byKey.set(key, stack);
    }
    const rows = pocket ? list : list.filter(stack => matches(stack.card));
    state.key = inventoryKeyOf(rows.find(item => inventoryKeyOf(item) === state.key) || rows[0] || { card: { name: '' } });
    const { items } = filterCardBrowserItems(browser, button => {
      const stack = byKey.get(button.dataset.stackKey);
      return !!stack && (pocket || matches(stack.card));
    });
    selectCardBrowserItems(items, state.key, { key:'stackKey', className:'selected' });
    refreshWarehouseBrowser(browser, reset, items);
    refreshArt();
    if (reset) animateBaseRefresh(browser.querySelector('.card-browser-track'));
    const empty = root.querySelector('.warehouse-no-results'); empty.hidden = rows.length > 0;
    if (!rows.length) empty.innerHTML = emptyWarehouseHTML(base, pocket);
    const selection = root.querySelector('.warehouse-selection-v12');
    if (selection) selection.innerHTML = warehouseSelectionHTML(rows);
    const count = root.querySelector('[data-warehouse-count]');
    if (count) count.textContent = `${rows.length} 种`;
    const summary = root.querySelector('.warehouse-more-filters summary');
    if (summary) { const active = [state.group, state.type, state.rarity].filter(Boolean).length; summary.textContent = active ? `筛选 · ${active} ▾` : '筛选 ▾'; }
    for (const button of root.querySelectorAll('[data-act="warehouseGroup"]')) { const on = button.dataset.group === state.group; button.classList.toggle('on', on); button.setAttribute('aria-pressed', String(on)); }
    const purpose = root.querySelector('.warehouse-purpose');
    if (purpose) purpose.hidden = !state.character;
  };
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
    ui.showCardZoom(stack.card, { presentation:'inventory', from, footer }); decorateInventoryZoom(stack.card);
  };
  let usingMaterial = false;
  browser.addEventListener('click', async event => {
    const item = event.target.closest('[data-browser-key]');
    if (!item || !browser.contains(item) || item.hidden || !currentWarehouse()) return;
    const rows = pocket ? base.data.pocket : base.data.stash;
    const matches = rows.filter(stack => inventoryKeyOf(stack) === item.dataset.browserKey);
    if (matches.length !== 1) return;
    const stack = matches[0];
    if (!pocket && base.materialInfo?.(stack.card)) {
      if (usingMaterial) return;
      select(item.dataset.browserKey);
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
    open(item.dataset.browserKey, item);
  });
  browser.querySelector('.card-browser-track').addEventListener('scroll', event => { if (currentWarehouse()) state.scrollTop = event.target.scrollTop; }, { passive:true });
  let artRefreshFrame = 0;
  browser.addEventListener('load', () => {
    if (!currentWarehouse() || artRefreshFrame) return;
    artRefreshFrame = requestAnimationFrame(() => {
      artRefreshFrame = 0;
      if (currentWarehouse()) refreshWarehouseBrowser(browser);
    });
  }, true);
  refreshWarehouseBrowser(browser);
  refreshArt();
  bindCardNavigation(browser.querySelector('.card-browser-track'), '[data-browser-key]', { activate: false });
  for (const input of root.querySelectorAll('[data-warehouse-filter]')) input.addEventListener(input.tagName === 'SELECT' ? 'change' : 'input', () => { if (!currentWarehouse()) return; state[input.dataset.warehouseFilter] = input.value; update(true); });
  ui.act('warehouseGroup', data => { if (!currentWarehouse()) return; if (!['', 'battle', 'supplies', 'growth'].includes(data.group)) return; state.group = data.group; if (data.group !== 'growth') state.character = ''; update(true); sound.tick(); });
  ui.act('warehouseReset', () => { if (!currentWarehouse()) return; const character = state.character; clearWarehouseFilters(); if (character) { state.character = character; state.group = 'growth'; } for (const input of root.querySelectorAll('[data-warehouse-filter]')) input.value = ''; update(true); });
  ui.act('warehousePick', data => open(data.stackKey || data.name, [...browser.querySelectorAll('[data-stack-key]')].find(button => button.dataset.stackKey === (data.stackKey || data.name))));
}
