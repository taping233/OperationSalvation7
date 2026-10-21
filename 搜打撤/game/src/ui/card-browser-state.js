// Transient list projections only: callers collect again for every filter/action.
export function isCardBrowserCurrent(root) {
  const pageBody = window.SDT?.UI?.el?.ovBody;
  return !!root?.isConnected && (!pageBody?.isConnected || pageBody.contains(root));
}

export function cardBrowserItems(root, candidate = null) {
  if (!isCardBrowserCurrent(root)) return [];
  // Reused nodes must still belong to this track. Never retain an earlier page's list.
  if (candidate && candidate.length === root.children.length
    && candidate.every((item, index) => item === root.children[index] && item.matches('[data-browser-key]'))) return candidate;
  return [.../** @type {NodeListOf<HTMLElement>} */ (root.querySelectorAll('[data-browser-key]'))];
}

export function filterCardBrowserItems(root, matches) {
  const items = cardBrowserItems(root), visible = [];
  for (const item of items) {
    const filtered = !matches(item);
    if (item.dataset.browseFiltered !== String(filtered)) item.dataset.browseFiltered = String(filtered);
    if (!filtered) visible.push(item);
  }
  return { items, visible };
}

export function selectCardBrowserItems(items, selected, { key = 'browserKey', className = 'on' } = {}) {
  for (const item of items) {
    if (!isCardBrowserCurrent(item)) continue;
    const active = item.dataset[key] === selected;
    if (item.classList.contains(className) !== active) item.classList.toggle(className, active);
    if (item.getAttribute('aria-pressed') !== String(active)) item.setAttribute('aria-pressed', String(active));
  }
}
