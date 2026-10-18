import { escAttr } from '../core/shared.js';
import '../../css/card-browser.css';

const instances = new WeakMap();
const positions = new Map();
export function cardBrowserHTML(id, label, itemsHTML, { rows = 2, columns = 0 } = {}) {
  return `<section class="card-browser" data-card-browser="${escAttr(id)}" data-browser-rows="${rows}" data-browser-columns="${columns}" aria-label="${escAttr(label)}"><div class="card-browser-track">${itemsHTML}</div><footer class="card-browser-footer"><div><button type="button" class="card-browser-page" data-browser-page="previous" aria-label="上一页卡牌">←</button><span class="card-browser-position" role="status" aria-live="polite"></span><button type="button" class="card-browser-page" data-browser-page="next" aria-label="下一页卡牌">→</button></div></footer></section>`;
}
export function refreshCardBrowser(root, { reset = false } = {}) {
  const state = instances.get(root);
  if (!state || !root.isConnected) return;
  const track = root.querySelector('.card-browser-track');
  const style = getComputedStyle(track);
  const minimum = parseFloat(style.getPropertyValue('--card-browser-min')) || 210;
  const gap = parseFloat(style.columnGap) || 20;
  const items = [...track.querySelectorAll('[data-browser-key]')];
  const visible = items.filter(item => item.dataset.browseFiltered !== 'true');
  const visibleIndex = new Map(visible.map((item, index) => [item, index]));
  const rows = Math.max(1, Number(root.dataset.browserRows) || 2);
  const fit = Math.max(1, Math.floor(((track.clientWidth || minimum * 3 + gap * 2) + gap) / (minimum + gap)));
  const fixedColumns = Math.max(0, Number(root.dataset.browserColumns) || 0);
  const columns = fixedColumns || Math.min(fit, Math.max(1, Math.ceil(visible.length / rows)));
  const perPage = columns * rows;
  const pages = Math.max(1, Math.ceil(visible.length / perPage));
  state.page = reset ? 0 : Math.min(state.page, pages - 1);
  const gridColumns = `repeat(${columns}, minmax(0, ${fixedColumns ? '1fr' : `${minimum}px`}))`;
  if (track.style.gridTemplateColumns !== gridColumns) track.style.gridTemplateColumns = gridColumns;
  const first = state.page * perPage;
  for (const item of items) {
    const index = visibleIndex.get(item);
    const hidden = index === undefined || index < first || index >= first + perPage;
    if (item.hidden !== hidden) item.hidden = hidden;
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
}
export function bindCardBrowser(root, { onOpen, onPage } = {}) {
  if (!root || instances.has(root)) return;
  const key = `${window.SDT?.Base?.slot || ''}/${root.dataset.cardBrowser}`;
  const state = positions.get(key) || { page: 0 };
  positions.delete(key); positions.set(key, state);
  while (positions.size > 64) positions.delete(positions.keys().next().value);
  instances.set(root, state);
  let loadFrame = 0;
  root.addEventListener('click', event => {
    const paging = event.target.closest('[data-browser-page]');
    if (paging && root.contains(paging) && !paging.disabled) {
      state.page += paging.dataset.browserPage === 'next' ? 1 : -1;
      refreshCardBrowser(root); onPage?.(); return;
    }
    const item = event.target.closest('[data-browser-key]');
    if (item && root.contains(item) && !item.hidden) onOpen?.(item.dataset.browserKey, item);
  });
  root.addEventListener('keydown', event => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    const direction = event.key === 'PageDown' ? 'next' : event.key === 'PageUp' ? 'previous' : null;
    if (direction) { event.preventDefault(); root.querySelector(`[data-browser-page="${direction}"]`).click(); }
  });
  root.addEventListener('load', () => {
    if (loadFrame) return;
    loadFrame = requestAnimationFrame(() => {
      loadFrame = 0;
      refreshCardBrowser(root);
    });
  }, true);
  refreshCardBrowser(root);
}
