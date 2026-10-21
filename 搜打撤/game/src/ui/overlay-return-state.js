// Temporary overlay pages retain presentation state only, never game data or old DOM.
function identity(element) {
  if (!element) return null;
  return { tag: element.tagName, id: element.id,
    classes: [...element.classList],
    data: Object.entries(element.dataset) };
}

function resolve(root, key) {
  if (!root || !key) return null;
  const matches = [root, ...root.querySelectorAll(key.tag)].filter(element =>
    element.tagName === key.tag && (!key.id || element.id === key.id) &&
    key.classes.every(name => element.classList.contains(name)) &&
    key.data.every(([name, value]) => element.dataset[name] === value));
  // Ambiguous elements are skipped instead of restoring an unrelated row by ordinal.
  return matches.length === 1 ? matches[0] : null;
}

/** Capture live scroll and a stable focus key before replacing a temporary page. */
export function captureOverlayReturnState(root, focusTarget) {
  if (!root) return { scroll: [], disclosures: [], focus: null };
  return {
    disclosures: [.../** @type {NodeListOf<HTMLDetailsElement>} */ (root.querySelectorAll('details'))].map(element => ({ key:identity(element), open:element.open })),
    scroll: [root, .../** @type {NodeListOf<HTMLElement>} */ (root.querySelectorAll('*'))]
      .filter(element => element.scrollTop || element.scrollLeft)
      .map(element => ({ key: identity(element), top: element.scrollTop, left: element.scrollLeft })),
    focus: identity(focusTarget || (root.contains(root.ownerDocument.activeElement) ? root.ownerDocument.activeElement : null)),
  };
}

export function restoreOverlayReturnState(root, snapshot) {
  // Expand before restoring scroll so layout changes do not displace the saved position.
  for (const saved of snapshot.disclosures || []) {
    const element = resolve(root, saved.key);
    if (element) element.open = saved.open;
  }
  for (const saved of snapshot.scroll) {
    const element = resolve(root, saved.key);
    if (element) { element.scrollTop = saved.top; element.scrollLeft = saved.left; }
  }
  const target = resolve(root, snapshot.focus);
  if (target && !target.matches(':disabled') && !target.closest('[hidden], [aria-hidden="true"], [inert]')) {
    target.focus({ preventScroll: true });
  }
}

/** Return once, only from the temporary page that created this action.
 * The owner keeps its domain/session guard in back(); only one synchronous page
 * replacement permits presentation restoration. No callback means the legacy no-op.
 */
export function createOverlayReturn({ revision, getRevision, isOpen, back, restore }) {
  let consumed = false;
  return () => {
    if (consumed || !isOpen() || getRevision() !== revision || typeof back !== 'function') return;
    consumed = true;
    back();
    if (isOpen() && getRevision() === revision + 1) restore();
  };
}
