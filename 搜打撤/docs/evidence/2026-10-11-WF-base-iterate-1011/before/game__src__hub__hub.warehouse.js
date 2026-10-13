import { esc, escAttr } from '../core/shared.js';
import { characterFor } from '../core/characters.js';
import { cardBrowserHTML, bindCardBrowser, refreshCardBrowser } from '../ui/card-browser.js';
import { bindCardNavigation } from './hub.presentation.js';
import { resourceStripHTML } from './hub.materials.js';
import { decorateInventoryZoom } from '../ui/inventory-zoom.js';

const state = { slot: null, query: '', type: '', rarity: '', character: '', group: '', name: '' };
export function clearWarehouseFilters() { Object.assign(state, { query: '', type: '', rarity: '', character: '', group: '', name: '' }); }
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
  const pocket = (base.data.pocket || []).reduce((sum, stack) => sum + stack.count, 0);
  return `<nav class="stash-sections" aria-label="仓库分区">${[['cards', '卡牌', ''], ['pocket', '待复原', pocket]].map(([id, name, count]) => `<button class="stash-section-tab${id === view ? ' on' : ''}" data-act="hubStashView" data-view="${id}" aria-pressed="${id === view}">${name}${count !== '' ? ` <small>${count}</small>` : ''}</button>`).join('')}</nav>`;
}
function itemsHTML(base, cards, pocket) {
  return (pocket ? base.data.pocket : base.data.stash).map(stack => `<button type="button" class="stash-cell${stack.card.name === state.name ? ' selected' : ''}" data-browser-key="${escAttr(stack.card.name)}" data-name="${escAttr(stack.card.name)}" data-browse-filtered="${pocket ? false : !matches(stack.card)}" aria-label="放大查看${escAttr(stack.card.name)}，${pocket ? '待复原' : '持有'}${stack.count}张"><span class="warehouse-card-art">${cards.cardHTML(stack.card, 'sm')}</span><span class="stash-card-caption"><b>${esc(stack.card.name)}</b><strong class="stack-count">×${stack.count}</strong></span></button>`).join('');
}
export function warehouseHTML(view = 'cards') {
  const { Base: base, Cards: cards } = window.SDT;
  synchronize(base);
  const pocket = view === 'pocket';
  const rows = pocket ? base.data.pocket : base.data.stash.filter(stack => matches(stack.card));
  const person = characterFor(state.character);
  const options = (field, label) => `<option value="">${label}</option>` + [...new Set(base.data.stash.map(stack => stack.card[field]))].filter(Boolean).map(value => `<option value="${escAttr(value)}"${state[field] === value ? ' selected' : ''}>${esc(value)}</option>`).join('');
  return `<div class="warehouse-v3 warehouse-v2" data-pocket="${pocket}"><header class="camp-section-head"><h2>仓库</h2>${resourceStripHTML(base)}<span class="camp-page-stat">${base.stashUsed()} / ${base.stashCap()} 格</span></header>${warehouseSectionsHTML(base, view)}
    ${pocket ? '<p class="stash-pocket-note">下次出征时，未复原卡牌会清空。</p>' : `<div class="warehouse-purpose"${person ? '' : ' hidden'}>${person ? `<b>${esc(person.name)} · 归档培养</b><button class="mini-btn" data-act="hubTab" data-tab="classes" data-group="people" data-character="${person.id}">返回${esc(person.name)} →</button>` : ''}</div><div class="warehouse-toolbar"><nav class="warehouse-use-tabs" aria-label="战利品用途">${[['', '全部'], ['battle', '战斗卡牌'], ['supplies', '消耗物品'], ['growth', '归档培养']].map(([id, name]) => `<button class="${state.group === id ? 'on' : ''}" data-act="warehouseGroup" data-group="${id}" aria-pressed="${state.group === id}">${name}</button>`).join('')}</nav><input data-warehouse-filter="query" aria-label="搜索仓库卡牌" placeholder="搜索卡牌" value="${escAttr(state.query)}"><details class="warehouse-more-filters"><summary>筛选 ▾</summary><div><select data-warehouse-filter="type" aria-label="筛选卡牌类型">${options('type', '全部类型')}</select><select data-warehouse-filter="rarity" aria-label="筛选卡牌品质">${options('rarity', '全部品质')}</select></div></details><span data-warehouse-count>${rows.length} 种</span></div>`}
    ${cardBrowserHTML(pocket ? 'warehouse-pocket' : 'warehouse', pocket ? '待复原卡牌' : '战利品卡牌', itemsHTML(base, cards, pocket))}
    <div class="warehouse-no-results"${rows.length ? ' hidden' : ''}><h3>${pocket ? '暂无待复原卡牌' : person ? `暂无${esc(person.name)}可用的培养卡牌` : base.data.stash.length ? '没有匹配的卡牌' : '仓库暂无卡牌'}</h3>${person ? '<p>在远征职业宝箱中获得专属卡牌后，撤离并存入仓库。</p>' : ''}<button class="mini-btn" data-act="${pocket ? 'hubStashView' : base.data.stash.length ? 'warehouseReset' : 'hubTab'}" data-view="cards" data-tab="shop">${pocket ? '卡牌仓库' : base.data.stash.length ? '显示全部' : '前往补给'}</button></div></div>`;
}
export function pocketWarehouseHTML() { return warehouseHTML('pocket'); }
export function bindWarehouse({ ui, base, sound, openCard }) {
  const root = document.querySelector('.warehouse-v3');
  if (!root) return;
  const pocket = root.dataset.pocket === 'true';
  const browser = root.querySelector('[data-card-browser]');
  const update = (reset = false) => {
    synchronize(base);
    for (const button of browser.querySelectorAll('[data-browser-key]')) {
      const stack = (pocket ? base.data.pocket : base.data.stash).find(item => item.card.name === button.dataset.name);
      button.dataset.browseFiltered = String(!stack || !pocket && !matches(stack.card));
      button.classList.toggle('selected', button.dataset.name === state.name);
    }
    refreshCardBrowser(browser, { reset });
    const rows = pocket ? base.data.pocket : base.data.stash.filter(stack => matches(stack.card));
    root.querySelector('.warehouse-no-results').hidden = rows.length > 0;
    const count = root.querySelector('[data-warehouse-count]');
    if (count) count.textContent = `${rows.length} 种`;
    for (const button of root.querySelectorAll('[data-act="warehouseGroup"]')) { const on = button.dataset.group === state.group; button.classList.toggle('on', on); button.setAttribute('aria-pressed', String(on)); }
    const purpose = root.querySelector('.warehouse-purpose');
    if (purpose) purpose.hidden = !state.character;
  };
  const open = (name, from) => {
    const list = pocket ? base.data.pocket : base.data.stash;
    const index = list.findIndex(stack => stack.card.name === name);
    if (index < 0) return;
    state.name = name; update(); sound.tick();
    if (!pocket && openCard) { openCard(index, { from }); return; }
    const stack = list[index];
    const keys = base.data.keys || 0, cost = pocket ? base.pocketKeyCost(stack) : 0;
    const missing = pocket && (keys < cost || base.stashRoom() < 1);
    const footer = pocket ? `<div class="pocket-zoom-actions"><span>待复原 ${stack.count} 张</span><button class="mini-btn ok" data-act="restoreCard" data-name="${escAttr(name)}" data-i="${index}"${missing ? ' disabled' : ''}>复原 1 张 · ${cost} 钥匙</button>${missing ? `<p>${keys < cost ? `还需 ${cost - keys} 把钥匙` : '仓库已满'}</p>` : ''}</div>` : '';
    ui.showCardZoom(stack.card, { presentation:'inventory', from, footer }); decorateInventoryZoom(stack.card);
  };
  bindCardBrowser(browser, { onPage: () => sound.tick(), onOpen: open });
  bindCardNavigation(browser.querySelector('.card-browser-track'), '[data-browser-key]', { activate: false });
  for (const input of root.querySelectorAll('[data-warehouse-filter]')) input.addEventListener(input.tagName === 'SELECT' ? 'change' : 'input', () => { state[input.dataset.warehouseFilter] = input.value; update(true); });
  ui.act('warehouseGroup', data => { if (!['', 'battle', 'supplies', 'growth'].includes(data.group)) return; state.group = data.group; if (data.group !== 'growth') state.character = ''; update(true); sound.tick(); });
  ui.act('warehouseReset', () => { clearWarehouseFilters(); for (const input of root.querySelectorAll('[data-warehouse-filter]')) input.value = ''; update(true); });
  ui.act('warehousePick', data => open(data.name, [...browser.querySelectorAll('[data-name]')].find(button => button.dataset.name === data.name)));
  ui.act('warehouseZoom', () => open(state.name, [...browser.querySelectorAll('[data-browser-key]')].find(button => button.dataset.name === state.name)));
}
