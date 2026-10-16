// Only the current backpack round trip owns this DOM snapshot; it is never saved.
const SCROLLERS = ['.shop-board', '.shop-detail-scroll'];
const ACTION_KEYS = ['act', 'i', 'uid'];

function scrollOf(element) {
  return element ? { top:element.scrollTop, left:element.scrollLeft } : null;
}

export function captureShopBrowseState(root, host, detailOpen = false) {
  if (!root) return null;
  const action = document.activeElement?.closest('[data-act]');
  const active = action instanceof HTMLElement ? action : null;
  const focus = active && root.contains(active) ? {
    detail:detailOpen && !!active.closest('.shop-detail'),
    keys:Object.fromEntries(ACTION_KEYS.filter(key => key in active.dataset).map(key => [key, active.dataset[key]])),
  } : null;
  return {
    root:scrollOf(root), host:scrollOf(host), focus,
    rulesOpen:detailOpen && !!root.querySelector('.shop-detail-rules[open]'),
    scrollers:SCROLLERS.filter(selector => detailOpen || selector !== '.shop-detail-scroll')
      .map(selector => ({ selector, position:scrollOf(root.querySelector(selector)) })),
  };
}

function canFocus(element) {
  return element instanceof HTMLElement && !element.matches(':disabled') && !element.closest('[hidden], [inert], [aria-hidden="true"]')
    && element.getClientRects().length > 0;
}

function setScroll(element, position) {
  if (!element || !position) return;
  element.scrollTop = position.top;
  element.scrollLeft = position.left;
}

export function restoreShopBrowseState(root, host, snapshot) {
  if (!root?.isConnected || !snapshot) return;
  const rules = root.querySelector('.shop-detail-rules');
  if (rules) rules.toggleAttribute('open', snapshot.rulesOpen);
  setScroll(host, snapshot.host);
  setScroll(root, snapshot.root);
  for (const entry of snapshot.scrollers) setScroll(root.querySelector(entry.selector), entry.position);
  // Match action data rather than old DOM references or selectors built from saved UIDs.
  const focus = snapshot.focus;
  let target = focus && [...root.querySelectorAll('[data-act]')].find(element =>
    !!element.closest('.shop-detail') === focus.detail
    && Object.entries(focus.keys).every(([key, value]) => element.getAttribute(`data-${key}`) === value)
    && canFocus(element));
  if (!target && focus?.detail) {
    const detail = root.querySelector('.shop-detail:not([hidden]):not([inert])');
    target = detail && [...detail.querySelectorAll('.shop-detail-buy, .shop-detail-bag, .shop-detail-done, .shop-detail-close')].find(canFocus);
  }
  if (!target) {
    target = [...root.querySelectorAll('.shop-bag-btn, [data-act="backShop"]')]
      .find(canFocus);
  }
  if (target instanceof HTMLElement) target.focus({ preventScroll:true });
}
