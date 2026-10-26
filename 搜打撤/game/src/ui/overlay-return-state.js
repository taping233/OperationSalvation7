import { isAvailableControl } from './action-dispatch.js';

// Temporary overlay pages retain presentation state only, never game data or old DOM.
function identity(element) {
  if (!element) return null;
  return { tag: element.tagName, id: element.id,
    classes: [...element.classList],
    // Visual phases change during a return; they are not part of the control's identity.
    data: Object.entries(element.dataset).filter(([name]) => !name.startsWith('surface')
      && !['regionTransition','uiActivity','uiEnter','uiClosing','uiMotion','uiShell','uiTransition','visualPending'].includes(name)) };
}

function resolve(root, key) {
  if (!root || !key) return null;
  const matches = [root, ...root.querySelectorAll(key.tag)].filter(element =>
    element.tagName === key.tag && (!key.id || element.id === key.id) &&
    // An explicit ID survives selected/loading/entry classes changing on rebuild.
    // Domain data still distinguishes a reused control's category/card/source.
    (key.id || key.classes.every(name => element.classList.contains(name))) &&
    key.data.every(([name, value]) => element.dataset[name] === value));
  // Ambiguous elements are skipped instead of restoring an unrelated row by ordinal.
  return matches.length === 1 ? matches[0] : null;
}

/** Capture live scroll and a stable focus key before replacing a temporary page. */
export function captureOverlayReturnState(root, focusTarget, { readContext = () => null } = {}) {
  if (!root) return { scroll: [], disclosures: [], focus: null };
  return {
    // Adapters return plain presentation values keyed by stable domain identities.
    context: readContext(),
    disclosures: [.../** @type {NodeListOf<HTMLDetailsElement>} */ (root.querySelectorAll('details'))].map(element => ({ key:identity(element), open:element.open })),
    scroll: [root, .../** @type {NodeListOf<HTMLElement>} */ (root.querySelectorAll('*'))]
      .filter(element => element.scrollTop || element.scrollLeft)
      .map(element => ({ key: identity(element), top: element.scrollTop, left: element.scrollLeft })),
    focus: identity(focusTarget || (root.contains(root.ownerDocument.activeElement) ? root.ownerDocument.activeElement : null)),
  };
}

export function restoreOverlayReturnState(root, snapshot, {
  applyContext = /** @type {(context: unknown) => void} */ (() => {}), isCurrent = /** @type {() => boolean} */ (() => true),
} = {}) {
  if (!root || !snapshot || !isCurrent()) return;
  // Restore filters/category before resolving scroll, disclosures and focus identities.
  if (snapshot.context != null) applyContext(snapshot.context);
  if (!isCurrent()) return;
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
  if (target && isCurrent() && isAvailableControl(target)) {
    target.focus({ preventScroll: true });
  }
}

/** Return once after actually leaving the temporary page that created this action.
 * The owner keeps its domain/session guard in back(). After asynchronous preparation,
 * back(commit) uses commit(render) for the synchronous target-page replacement.
 * Only that replacement (or a synchronous legacy back) can own restored presentation.
 */
export function createOverlayReturn({ revision, getRevision, isOpen, back, restore, onFailure = () => {} }) {
  let consumed = false;
  let pending = null;
  const sourceCurrent = () => isOpen() && getRevision() === revision;
  return () => {
    if (consumed || pending || !sourceCurrent() || typeof back !== 'function') return false;
    const attempt = {};
    pending = attempt;
    let targetRevision = null;
    const captureTarget = () => {
      if (isOpen() && getRevision() === revision + 1) targetRevision = getRevision();
    };
    const commit = render => {
      if (pending !== attempt || !sourceCurrent() || typeof render !== 'function') return false;
      const value = render();
      captureTarget();
      return value;
    };
    const finish = value => {
      pending = null;
      // A declined return or an unchanged temporary page can be retried.
      if (value === false || sourceCurrent()) {
        if (sourceCurrent()) onFailure();
        return false;
      }
      consumed = true;
      const targetCurrent = () => targetRevision !== null && isOpen() && getRevision() === targetRevision;
      if (targetCurrent()) restore(targetCurrent);
      return value;
    };
    const fail = () => {
      pending = null;
      if (sourceCurrent()) onFailure();
      return false;
    };
    try {
      const value = back(commit);
      // Capture only the page produced in this call stack. An unrelated page that
      // appears while a Promise is pending must never inherit the old presentation.
      captureTarget();
      return value && typeof value.then === 'function'
        ? Promise.resolve(value).then(finish, fail)
        : finish(value);
    } catch {
      return fail();
    }
  };
}
