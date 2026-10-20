import { cardBrowserItems, isCardBrowserCurrent } from './card-browser-state.js';
import { escAttr } from '../core/shared.js';
import '../../css/card-browser.css';

const instances = new WeakMap();
const positions = new Map();
// Per-mounted-browser callbacks must not enter the cross-page position cache.
const artRenderers = new WeakMap();
export function cardBrowserHTML(id, label, itemsHTML, { rows = 2, columns = 0 } = {}) {
  return `<section class="card-browser" data-card-browser="${escAttr(id)}" data-browser-rows="${rows}" data-browser-columns="${columns}" aria-label="${escAttr(label)}"><div class="card-browser-track">${itemsHTML}</div><footer class="card-browser-footer"><div><button type="button" class="card-browser-page" data-browser-page="previous" aria-label="上一页卡牌">←</button><span class="card-browser-position" role="status" aria-live="polite"></span><button type="button" class="card-browser-page" data-browser-page="next" aria-label="下一页卡牌">→</button></div></footer></section>`;
}
export function refreshCardBrowser(root, { reset = false, items: suppliedItems = null, page: requestedPage = null } = {}) {
  const state = instances.get(root);
  if (!state || !isCardBrowserCurrent(root)) return;
  const track = root.querySelector('.card-browser-track');
  const style = getComputedStyle(track);
  const minimum = parseFloat(style.getPropertyValue('--card-browser-min')) || 210;
  const gap = parseFloat(style.columnGap) || 20;
  const items = cardBrowserItems(track, suppliedItems);
  const visible = items.filter(item => item.dataset.browseFiltered !== 'true');
  const visibleIndex = new Map(visible.map((item, index) => [item, index]));
  const rows = Math.max(1, Number(root.dataset.browserRows) || 2);
  const fit = Math.max(1, Math.floor(((track.clientWidth || minimum * 3 + gap * 2) + gap) / (minimum + gap)));
  const fixedColumns = Math.max(0, Number(root.dataset.browserColumns) || 0);
  const columns = fixedColumns || Math.min(fit, Math.max(1, Math.ceil(visible.length / rows)));
  const perPage = columns * rows;
  let nextPage = requestedPage ?? state.page;
  const focused = document.activeElement;
  const focusedItem = focused?.closest?.('[data-browser-key]');
  const focusedIndex = visibleIndex.get(focusedItem);
  if (!reset && state.perPage && state.perPage !== perPage) {
    const first = state.page * state.perPage;
    const selectedIndex = visible.findIndex((item, index) => index >= first && index < first + state.perPage
      && (item.classList.contains('on') || item.getAttribute('aria-pressed') === 'true'));
    const anchor = focusedIndex ?? (selectedIndex >= 0 ? selectedIndex : first);
    nextPage = Math.floor(anchor / perPage);
  }
  const pages = Math.max(1, Math.ceil(visible.length / perPage));
  nextPage = reset ? 0 : Math.max(0, Math.min(nextPage, pages - 1));
  const first = nextPage * perPage;
  const art = artRenderers.get(root);
  const pendingArt = [];
  // Prepare every new face before changing the visible page or its saved position.
  // A genuine renderer error propagates, leaving the previous page usable for retry.
  if (art) for (const item of visible.slice(first, first + perPage)) {
    const host = item.querySelector('[data-browser-art]');
    if (!host || art.rendered.has(host)) continue;
    const html = art.render(item);
    if (html != null) pendingArt.push([host, window.SDT?.Icons?.rich?.(html) ?? html]);
  }
  state.perPage = perPage;
  state.page = nextPage;
  const gridColumns = `repeat(${columns}, minmax(0, ${fixedColumns ? '1fr' : `${minimum}px`}))`;
  if (track.style.gridTemplateColumns !== gridColumns) track.style.gridTemplateColumns = gridColumns;
  for (const item of items) {
    const index = visibleIndex.get(item);
    const hidden = index === undefined || index < first || index >= first + perPage;
    if (item.hidden !== hidden) item.hidden = hidden;
  }
  for (const [host, html] of pendingArt) {
    host.innerHTML = html;
    art.rendered.add(host);
  }
  const empty = String(!visible.length);
  if (root.dataset.empty !== empty) root.dataset.empty = empty;
  const previous = root.querySelector('[data-browser-page="previous"]');
  const next = root.querySelector('[data-browser-page="next"]');
  const position = root.querySelector('.card-browser-position');
  if (previous.disabled !== (state.page === 0)) previous.disabled = state.page === 0;
  if (next.disabled !== (state.page >= pages - 1)) next.disabled = state.page >= pages - 1;
  const label = visible.length ? `${state.page + 1} / ${pages}` : '暂无卡牌';
  if (position.textContent !== label) position.textContent = label;
  // Paging/filtering must not strand keyboard focus in a newly hidden card or disabled arrow.
  if (root.contains(focused) && ((focusedItem && focusedItem.hidden) || focused?.matches?.('[data-browser-page]:disabled'))) {
    const target = visible[first] || [previous, next].find(button => !button.disabled);
    if (target) target.focus({ preventScroll:true });
    else { root.tabIndex = -1; root.focus({ preventScroll:true }); }
  }
}
export function bindCardBrowser(root, { onOpen, onPage, renderArt } = {}) {
  if (!root || instances.has(root)) return;
  const key = `${window.SDT?.Base?.slot || ''}/${root.dataset.cardBrowser}`;
  const state = { ...(positions.get(key) || { page: 0 }) };
  positions.delete(key); positions.set(key, state);
  while (positions.size > 64) positions.delete(positions.keys().next().value);
  instances.set(root, state);
  if (renderArt) artRenderers.set(root, { render: renderArt, rendered: new WeakSet() });
  let loadFrame = 0, disposed = false;
  const track = root.querySelector('.card-browser-track');
  let measuredWidth = track.clientWidth;
  const schedule = () => {
    if (disposed || !isCardBrowserCurrent(root) || loadFrame || track.clientWidth <= 0) return;
    loadFrame = requestAnimationFrame(() => {
      loadFrame = 0;
      if (!disposed && track.clientWidth > 0) {
        measuredWidth = track.clientWidth;
        refreshCardBrowser(root);
      }
    });
  };
  const resized = () => {
    const width = track.clientWidth;
    // Hidden surfaces keep their reading position; height changes from pagination
    // must not schedule another layout pass.
    if (width <= 0 || width === measuredWidth) return;
    schedule();
  };
  const resize = typeof ResizeObserver === 'function' ? new ResizeObserver(resized) : null;
  resize?.observe(track);
  if (!resize) window.addEventListener('resize', resized);
  const lifetime = new MutationObserver(() => {
    if (root.isConnected) return;
    disposed = true;
    artRenderers.delete(root);
    resize?.disconnect(); lifetime.disconnect();
    window.removeEventListener('resize', resized);
    if (loadFrame) cancelAnimationFrame(loadFrame);
    loadFrame = 0;
  });
  lifetime.observe(root.ownerDocument, { childList: true, subtree: true });
  root.addEventListener('click', event => {
    if (!isCardBrowserCurrent(root) || root.closest('[hidden], [inert], [aria-hidden="true"], .closing')) return;
    const paging = event.target.closest('[data-browser-page]');
    if (paging && root.contains(paging) && !paging.disabled) {
      refreshCardBrowser(root, { page: state.page + (paging.dataset.browserPage === 'next' ? 1 : -1) });
      onPage?.(); return;
    }
    const item = event.target.closest('[data-browser-key]');
    if (item && root.contains(item) && !item.hidden) onOpen?.(item.dataset.browserKey, item);
  });
  root.addEventListener('keydown', event => {
    if (!isCardBrowserCurrent(root) || root.closest('[hidden], [inert], [aria-hidden="true"], .closing')) return;
    if (event.defaultPrevented || event.isComposing || event.altKey || event.ctrlKey || event.metaKey || event.target?.closest?.('input, textarea, select, [contenteditable="true"]')) return;
    const direction = event.key === 'PageDown' ? 'next' : event.key === 'PageUp' ? 'previous' : null;
    if (direction) { event.preventDefault(); root.querySelector(`[data-browser-page="${direction}"]`).click(); }
  });
  root.addEventListener('load', schedule, true);
  refreshCardBrowser(root);
}
