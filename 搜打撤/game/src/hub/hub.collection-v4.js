import { isCardBrowserCurrent, cardBrowserItems, filterCardBrowserItems, selectCardBrowserItems } from '../ui/card-browser-state.js';
import { animateBaseRefresh } from './base-motion-v4.js';
import { esc, escAttr } from '../core/shared.js';
import { cardBrowserHTML, bindCardBrowser, refreshCardBrowser } from '../ui/card-browser.js';
import { bindCardNavigation } from './hub.presentation.js';
import { decorateInventoryZoom } from '../ui/inventory-zoom.js';
import '../../css/base-collection-v4.css';

let slot, query = '', type = '', selectedId = '';
const ownedCards = (base, cards) => {
  const catalog = new Map(cards.all().map(card => [card.id, card]));
  const stash = new Map((base.data.stash || []).map(stack => [stack.card.id, stack.card]));
  return Object.entries(base.data.collection || {}).filter(([, record]) => !!record).map(([id, record]) => {
    const card = catalog.get(id) || stash.get(id);
    return { id, card, name:card?.name || record.name || id };
  });
};
const ownedCard = (base, cards, id) => {
  if (!Object.hasOwn(base.data.collection || {}, id)) return null;
  const record = base.data.collection[id];
  if (!record) return null;
  // Match the catalog/stash Maps used by the initial render: the last duplicate wins.
  let card;
  for (const candidate of cards.all()) if (candidate.id === id) card = candidate;
  if (!card) for (const stack of base.data.stash || []) if (stack.card.id === id) card = stack.card;
  return { id, card, name:card?.name || record.name || id };
};
const synchronize = base => { if (slot !== base.slot) { slot = base.slot; query = ''; type = ''; selectedId = ''; } };
const detailHTML = (row, cards) => row ? `<div class="collection-v12-display">${row.card ? cards.cardHTML(row.card, 'sm') : '<span class="collection-legacy">旧收藏档案</span>'}</div><div class="collection-v12-info"><span>已收藏 · 卡牌预览</span><h3>${esc(row.name)}</h3>${row.card ? `<dl><div><dt>类型</dt><dd>${esc(row.card.type || '卡牌')}</dd></div><div><dt>稀有度</dt><dd>${esc(row.card.rarity || '—')}</dd></div></dl><button type="button" class="mini-btn base-command" data-act="collectionV12Zoom" data-id="${escAttr(row.id)}">查看卡牌详情 →</button>` : '<p>旧收藏档案</p>'}</div>` : '';

export function collectionCardsHTML(base, cards) {
  synchronize(base);
  const owned = ownedCards(base, cards);
  const types = [...new Set(owned.map(row => row.card?.type).filter(Boolean))];
  const selected = owned.find(row => row.id === selectedId) || owned[0];
  selectedId = selected?.id || '';
  return `<div class="collection-cards-v4 collection-v12" data-empty="${!owned.length}"><div class="collection-browse-tools"${owned.length ? '' : ' hidden'}><input data-collection-query aria-label="搜索收藏卡牌" placeholder="搜索收藏卡牌" value="${escAttr(query)}"><select data-collection-type aria-label="筛选收藏卡牌类型"><option value="">全部类型</option>${types.map(value => `<option value="${escAttr(value)}"${value === type ? ' selected' : ''}>${esc(value)}</option>`).join('')}</select><span data-collection-count>${owned.length} 张已收藏</span></div><section class="collection-v12-stage" aria-live="polite">${detailHTML(selected, cards)}</section>${cardBrowserHTML('collection-owned', '已收藏卡牌', owned.map(row => `<button type="button" class="collection-card${row.id === selectedId ? ' on' : ''}" data-browser-key="${escAttr(row.id)}" data-search="${escAttr(row.name)}" data-type="${escAttr(row.card?.type || '')}" aria-pressed="${row.id === selectedId}" aria-label="选择${escAttr(row.name)}"><span class="collection-card-art">${row.card ? cards.cardHTML(row.card, 'sm') : '<span class="collection-legacy">旧收藏档案</span>'}</span><b>${esc(row.name)}</b></button>`).join(''), { rows:1 })}<div class="collection-empty"${owned.length ? ' hidden' : ''}><h3>${owned.length ? '没有匹配的收藏卡牌' : '尚未收藏卡牌'}</h3><p>${owned.length ? '调整搜索或类型，继续查看已有收藏。' : '在仓库收藏卡牌后，会陈列在这里。'}</p><button class="mini-btn base-command" data-act="${owned.length ? 'collectionReset' : 'hubTab'}" data-tab="stash" data-view="cards">${owned.length ? '显示全部收藏' : '前往仓库 →'}</button></div></div>`;
}

export function bindCollectionCards({ root, base, cards, ui }) {
  const content = root.querySelector('.collection-cards-v4');
  if (!content) return;
  const browser = content.querySelector('[data-card-browser]');
  const slotId = base.slot;
  const current = () => isCardBrowserCurrent(content) && root.contains(content) && base.slot === slotId;
  let lastDetailHTML = null;
  const select = (id, animate = true) => {
    if (!current()) return;
    const row = ownedCard(base, cards, id);
    selectedId = row?.id || '';
    const stage = content.querySelector('.collection-v12-stage');
    const html = detailHTML(row, cards);
    if (lastDetailHTML !== html) {
      if (stage.innerHTML !== html) { stage.innerHTML = html; if (animate) animateBaseRefresh(stage); }
      lastDetailHTML = html;
    }
    selectCardBrowserItems(cardBrowserItems(browser), selectedId);
  };
  const update = (reset = false) => {
    if (!current()) return;
    const search = query.trim().toLowerCase();
    const { items, visible } = filterCardBrowserItems(browser, button =>
      (!search || button.dataset.search.toLowerCase().includes(search)) && (!type || button.dataset.type === type));
    const count = visible.length;
    refreshCardBrowser(browser, { reset, items });
    if (reset) animateBaseRefresh(browser.querySelector('.card-browser-track'));
    content.querySelector('[data-collection-count]').textContent = search || type
      ? `匹配 ${count} / 已收藏 ${items.length}`
      : `${items.length} 张已收藏`;
    content.querySelector('.collection-empty').hidden = count > 0;
    content.dataset.empty = String(count === 0);
    const selected = items.find(button => button.classList.contains('on'));
    if (!selected || selected.dataset.browseFiltered === 'true') select(visible[0]?.dataset.browserKey, reset);
  };
  bindCardBrowser(browser, { onPage:() => animateBaseRefresh(browser.querySelector('.card-browser-track')), onOpen:id => select(id) });
  ui.act('collectionV12Zoom', data => {
    if (!current()) return;
    const id = data.id;
    const card = ownedCard(base, cards, id)?.card;
    if (!card) return;
    ui.showCardZoom(card, { presentation:'inventory', from:content.querySelector('[data-act="collectionV12Zoom"]') });
    decorateInventoryZoom(card);
  });
  bindCardNavigation(browser.querySelector('.card-browser-track'), '[data-browser-key]', { activate:false });
  const queryInput = content.querySelector('[data-collection-query]');
  const applyQuery = event => { if (!current() || event.isComposing || query === queryInput.value) return; query = queryInput.value; update(true); };
  queryInput.addEventListener('input', applyQuery);
  queryInput.addEventListener('compositionend', applyQuery);
  content.querySelector('[data-collection-type]').addEventListener('change', event => { if (!current() || type === event.target.value) return; type = event.target.value; update(true); });
  ui.act('collectionReset', () => { if (!current()) return; query = ''; type = ''; content.querySelector('input').value = ''; content.querySelector('select').value = ''; update(true); });
  update();
}
