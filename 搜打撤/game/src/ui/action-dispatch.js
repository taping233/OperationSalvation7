// Shared execution-time admission for delegated clicks, zoom footers and agents.
// Domain commands retain their own resource, session and transaction checks.
const observedTargets = new WeakMap();
export function bindObservedAction(action, element) { observedTargets.set(action, element); return action; }
export function getObservedActionTarget(action) { return observedTargets.get(action); }

export function isAvailableControl(element, styles = new Map()) {
  if (element.matches(':disabled, input[type="hidden"]') ||
      element.closest('[hidden], [aria-hidden="true"], [inert]')) return false;
  const styleOf = node => {
    if (!styles.has(node)) styles.set(node, getComputedStyle(node));
    return styles.get(node);
  };
  if (['hidden', 'collapse'].includes(styleOf(element).visibility)) return false;
  for (let node = element; node; node = node.parentElement) {
    if (styleOf(node).display === 'none') return false;
    if (node !== element && node.matches('details:not([open])')) {
      const summary = node.querySelector(':scope > summary');
      if (!summary?.contains(element)) return false;
    }
  }
  return true;
}

export function isActionTargetAvailable(element, UI = window.SDT?.UI, styles = new Map()) {
  if (!element?.isConnected || !element.dataset?.act ||
      element.closest('[aria-disabled="true"], .off, .closing, [data-ui-closing], .cz-out, .cz-photo-closing')) return false;
  for (let node = element; node; node = node.parentElement) if (node.inert) return false;
  const doc = element.ownerDocument;
  const zoom = doc.getElementById('cardZoom');
  if (zoom) {
    if (!zoom.contains(element) || !element.closest('.cz-foot')) return false;
  } else {
    const body = UI?.el?.ovBody || doc.getElementById('ovBody');
    const overlay = UI?.el?.overlay || doc.getElementById('overlay');
    if (!body?.isConnected || !overlay?.isConnected || !body.contains(element) || !overlay.contains(body)) return false;
    const root = UI?._overlayInteractionRoot?.() || body;
    if (!root.isConnected || !root.contains(element)) return false;
  }
  return isAvailableControl(element, styles);
}

// The wrapper distinguishes no handler from a handler that intentionally returns
// undefined, false or a Promise. It never catches or rewrites domain results.
export function invokeUiAction(UI, element, { allowBase = !element?.closest('#cardZoom'), expected = undefined } = {}) {
  if (!isActionTargetAvailable(element, UI)) return { ok:false, reason:'unavailable' };
  if (expected && (element.dataset.act !== expected.name ||
      !Object.entries(expected.params || {}).every(([key, value]) => String(element.dataset[key] ?? '') === String(value ?? '')))) {
    return { ok:false, reason:'unavailable' };
  }
  // Captured actions describe the complete observed button state. A retained
  // button may acquire a confirmation flag without being replaced in the DOM.
  if (expected && observedTargets.get(expected) === element &&
      Object.keys(element.dataset).filter(key => key !== 'act').length !== Object.keys(expected.params || {}).length) {
    return { ok:false, reason:'unavailable' };
  }
  const fn = UI?._acts?.[element.dataset.act] || (allowBase && UI?._baseActs?.[element.dataset.act]);
  if (typeof fn !== 'function') return { ok:false, reason:'unhandled' };
  return { ok:true, value:element.hasAttribute('data-photo-zoom-source') ? fn(element.dataset, element) : fn(element.dataset) };
}
