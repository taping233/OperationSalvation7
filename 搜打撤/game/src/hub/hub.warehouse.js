import { esc, escAttr } from '../core/shared.js';
import { stackKeyOf } from './collection.commands.js';
import { characterFor } from '../core/characters.js';
import '../../css/card-browser.css';
import { bindCardNavigation } from './hub.presentation.js';
import { decorateInventoryZoom } from '../ui/inventory-zoom.js';
import { warehouseCategoriesV7HTML } from './hub.warehouse-categories-v7.js';
import { animateBaseRefresh } from './base-motion-v4.js';

const state = { slot: null, query: '', type: '', rarity: '', character: '', group: '', key: '', scrollTop:0 };
export function clearWarehouseFilters() { Object.assign(state, { query: '', type: '', rarity: '', character: '', group: '', key: '', scrollTop:0 }); }
const inventoryKeyOf = stack => stackKeyOf(stack) || stack.card.name;
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
function itemsHTML(base, cards, pocket) {
  return (pocket ? base.data.pocket : base.data.stash).map(stack => `<button type="button" class="stash-cell${inventoryKeyOf(stack) === state.key ? ' selected' : ''}" data-browser-key="${escAttr(inventoryKeyOf(stack))}" data-stack-key="${escAttr(inventoryKeyOf(stack))}" data-name="${escAttr(stack.card.name)}" data-browse-filtered="${pocket ? false : !matches(stack.card)}" aria-pressed="${inventoryKeyOf(stack) === state.key}" aria-label="选择${escAttr(stack.card.name)}，${pocket ? '待复原' : '持有'}${stack.count}张"><span class="warehouse-card-art">${cards.cardHTML(stack.card, 'sm')}</span><span class="stash-card-caption"><b>${esc(stack.card.name)}</b><strong class="stack-count">×${stack.count}</strong></span>${base.isCollected?.(stack.card) ? '<span class="warehouse-protected">收藏</span>' : ''}</button>`).join('');
}
function warehouseSelectionHTML(rows) {
  const stack = rows.find(item => inventoryKeyOf(item) === state.key);
  return stack ? `<div><small>当前浏览</small><b>${esc(stack.card.name)}</b><span>${stack.count} 张${window.SDT.Base.isCollected?.(stack.card) ? ' · 收藏保护' : ''}</span></div><button type="button" class="mini-btn" data-act="warehousePick" data-stack-key="${escAttr(inventoryKeyOf(stack))}" data-name="${escAttr(stack.card.name)}">查看详情 ↗</button>` : '<p>选择卡牌后查看详情</p>';
}
function refreshWarehouseBrowser(browser, reset = false) {
  const track = browser.querySelector('.card-browser-track');
  const items = [...track.querySelectorAll('[data-browser-key]')];
  const visible = items.filter(item => item.dataset.browseFiltered !== 'true');
  // Each tile reserves its complete framed art and caption height; rows never share the art slot.
  const columns = Math.max(1, Math.floor((track.clientWidth + 24) / 348));
  track.style.gridTemplateColumns = `repeat(${columns}, minmax(0,1fr))`;
  for (const item of items) item.hidden = item.dataset.browseFiltered === 'true';
  browser.dataset.empty = String(!visible.length);
  if (reset) state.scrollTop = 0;
  track.scrollTop = state.scrollTop;
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
  const { Base: base, Cards: cards } = window.SDT;
  synchronize(base);
  const pocket = view === 'pocket';
  const rows = pocket ? base.data.pocket : base.data.stash.filter(stack => matches(stack.card));
  state.key = inventoryKeyOf(rows.find(item => inventoryKeyOf(item) === state.key) || rows[0] || { card: { name: '' } });
  const person = characterFor(state.character);
  const options = (field, label) => `<option value="">${label}</option>` + [...new Set(base.data.stash.map(stack => stack.card[field]))].filter(Boolean).map(value => `<option value="${escAttr(value)}"${state[field] === value ? ' selected' : ''}>${esc(value)}</option>`).join('');
  return `<div class="warehouse-v3 warehouse-v2" data-pocket="${pocket}"><header class="camp-section-head"><h2>${pocket ? '待复原' : '后勤仓库'}</h2><div class="warehouse-header-actions">${warehouseSectionsHTML(base, view)}${pocket ? '' : '<button type="button" class="base-link" data-act="rawItem" data-kind="wood">木材 ↗</button><button type="button" class="base-link" data-act="rawItem" data-kind="rations">口粮 ↗</button><button class="base-link" data-act="hubTab" data-tab="shop">交易所 ↗</button>'}<div class="warehouse-capacity"><span class="camp-page-stat">${base.stashUsed()} / ${base.stashCap()} 格</span><button class="base-link" data-act="hubTab" data-tab="upgrade" data-facility="stash">扩建 ↗</button></div></div></header>
    <p class="stash-pocket-note">仓库按格计容量，卡牌数量以张计，种表示不同卡名。木材／口粮资源卡需打开详情使用，才折入基地材料；材料库存见上方入口。</p><div class="warehouse-controls-v12">${pocket ? '<p class="stash-pocket-note">下次出征时，未复原卡牌会清空。</p>' : `${warehouseCategoriesV7HTML(state.group)}<div class="warehouse-purpose"${person ? '' : ' hidden'}>${person ? `<b>${esc(person.name)} · 归档培养</b><button class="mini-btn" data-act="hubTab" data-tab="classes" data-group="people" data-section="profile" data-character="${person.id}">返回${esc(person.name)} →</button>` : ''}</div><div class="warehouse-toolbar"><input data-warehouse-filter="query" aria-label="搜索仓库卡牌" placeholder="搜索卡牌" value="${escAttr(state.query)}"><select data-warehouse-filter="type" aria-label="筛选卡牌类型">${options('type', '全部类型')}</select><select data-warehouse-filter="rarity" aria-label="筛选卡牌品质">${options('rarity', '全部品质')}</select><span data-warehouse-count>${rows.length} 种</span></div>`}</div>
    <div class="warehouse-workspace-v12"><section class="warehouse-inventory-v12"><section class="card-browser" data-card-browser="${pocket ? 'warehouse-pocket' : 'warehouse'}" aria-label="${pocket ? '待复原卡牌' : '战利品卡牌'}"><div class="card-browser-track" tabindex="0" aria-label="向下滚动浏览卡牌">${itemsHTML(base, cards, pocket)}</div></section>
    <div class="warehouse-no-results"${rows.length ? ' hidden' : ''}>${emptyWarehouseHTML(base, pocket)}</div></section><aside class="warehouse-selection-v12" aria-label="当前浏览卡牌">${warehouseSelectionHTML(rows)}</aside></div></div>`;
}
export function bindWarehouse({ ui, base, sound, openCard }) {
  const root = document.querySelector('.warehouse-v3');
  if (!root) return;
  const slotId = base.slot;
  const currentWarehouse = () => window.SDT.Base === base && base.slot === slotId && root.isConnected && document.querySelector('.warehouse-v3') === root;
  const pocket = root.dataset.pocket === 'true';
  const browser = root.querySelector('[data-card-browser]');
  const update = (reset = false) => {
    if (!currentWarehouse()) return;
    synchronize(base);
    const rows = pocket ? base.data.pocket : base.data.stash.filter(stack => matches(stack.card));
    state.key = inventoryKeyOf(rows.find(item => inventoryKeyOf(item) === state.key) || rows[0] || { card: { name: '' } });
    for (const button of browser.querySelectorAll('[data-browser-key]')) {
      const stack = (pocket ? base.data.pocket : base.data.stash).find(item => inventoryKeyOf(item) === button.dataset.stackKey);
      button.dataset.browseFiltered = String(!stack || !pocket && !matches(stack.card));
      button.classList.toggle('selected', button.dataset.stackKey === state.key);
      button.setAttribute('aria-pressed', String(button.dataset.stackKey === state.key));
    }
    refreshWarehouseBrowser(browser, reset);
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
  // 2026-10-15 老板指令：仓库点卡只选中浏览，不再直接弹大卡特写；放大收进「查看详情」按钮，
  // 特写页脚的卖出/收藏/使用/孵化/拆包与待复原「复原」入口全部保留。
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
  browser.addEventListener('click', event => {
    const item = event.target.closest('[data-browser-key]');
    if (item && browser.contains(item) && !item.hidden) select(item.dataset.browserKey);
  });
  browser.querySelector('.card-browser-track').addEventListener('scroll', event => { if (currentWarehouse()) state.scrollTop = event.target.scrollTop; }, { passive:true });
  browser.addEventListener('load', () => { if (currentWarehouse()) refreshWarehouseBrowser(browser); }, true);
  refreshWarehouseBrowser(browser);
  bindCardNavigation(browser.querySelector('.card-browser-track'), '[data-browser-key]', { activate: false });
  for (const input of root.querySelectorAll('[data-warehouse-filter]')) input.addEventListener(input.tagName === 'SELECT' ? 'change' : 'input', () => { if (!currentWarehouse()) return; state[input.dataset.warehouseFilter] = input.value; update(true); });
  ui.act('warehouseGroup', data => { if (!currentWarehouse()) return; if (!['', 'battle', 'supplies', 'growth'].includes(data.group)) return; state.group = data.group; if (data.group !== 'growth') state.character = ''; update(true); sound.tick(); });
  ui.act('warehouseReset', () => { if (!currentWarehouse()) return; const character = state.character; clearWarehouseFilters(); if (character) { state.character = character; state.group = 'growth'; } for (const input of root.querySelectorAll('[data-warehouse-filter]')) input.value = ''; update(true); });
  ui.act('warehousePick', data => open(data.stackKey || data.name, [...browser.querySelectorAll('[data-stack-key]')].find(button => button.dataset.stackKey === (data.stackKey || data.name))));
}
