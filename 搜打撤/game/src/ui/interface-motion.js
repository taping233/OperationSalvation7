// Shared visual choreography around the existing UI API. No route or save handler is replaced.
const installed = new WeakSet();
const overlay = document.getElementById('overlay');
let pendingClose = null;
let withinShow = false;
let enterFlip = false;
let screenFlip = false;

export function interfaceReducedMotion() {
  return !!(document.body.classList.contains('reduce-motion')
    || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
}

function kindFor(ui, mode, body) {
  if (mode === 'battle' || mode === 'discover' || mode === 'bag'
    || body?.querySelector('.bt-settings, .bt-gy-list')) return 'fast';
  if (mode === 'glass' || mode === 'doom' || body?.querySelector('.glass-panel, [data-act="leaveSave"]')) return 'confirm';
  if (mode === 'page' || mode === 'bagpage' || ui._roomActive) return 'page';
  return 'panel';
}

function tabKey(body) {
  const hub = body?.querySelector('#hubMain');
  if (!hub) return '';
  const main = hub.querySelector('.hub-tab.on')?.dataset.tab || '';
  const sub = hub.querySelector('.stash-section-tab.on, .person-tab.on, .collection-tabs button.on');
  return `${main}/${sub?.dataset.view || sub?.dataset.character || ''}`;
}

function markEntry(kind, restart) {
  if (!overlay) return;
  delete overlay.dataset.uiClosing;
  delete overlay.dataset.uiInstantClose;
  overlay.dataset.uiMotion = kind;
  if (restart || !overlay.dataset.uiEnter) {
    enterFlip = !enterFlip;
    overlay.dataset.uiEnter = enterFlip ? 'a' : 'b';
  }
}

function cancelLegacyCardTween() {
  queueMicrotask(() => {
    if (!overlay || overlay.hidden) return;
    const card = document.getElementById('ovBody')?.parentElement;
    let canceled = false;
    card?.getAnimations?.().forEach(animation => {
      if (animation.effect?.target === card && !('animationName' in animation)) {
        animation.cancel();
        canceled = true;
      }
    });
    if (canceled) {
      card.style.removeProperty('opacity');
      card.style.removeProperty('transform');
    }
  });
}

function install(ui = window.SDT?.UI) {
  if (!ui || !overlay || !ui.showOverlay || !ui.hideOverlay) return false;
  if (installed.has(ui)) return true;
  installed.add(ui);
  const showOverlay = ui.showOverlay;
  const hideOverlay = ui.hideOverlay;
  const showScreen = ui.showScreen;
  const hideScreen = ui.hideScreen;

  ui.showOverlay = function (heading, html, mode, options) {
    if (pendingClose) {
      clearTimeout(pendingClose.timer);
      pendingClose = null;
      // Finish the old cleanup before installing a new page; no delayed close may erase it.
      hideOverlay.call(this, { immediate: true });
    }
    const body = document.getElementById('ovBody');
    const wasOpen = !overlay.hidden;
    const oldTab = tabKey(body);
    const refreshHub = wasOpen && mode === 'page' && !!body?.querySelector('#hubMain')
      && typeof html === 'string' && html.includes('id="hubMain"');
    const restart = !wasOpen || this._lastMode !== mode || (mode === 'page' && !refreshHub);
    markEntry(kindFor(this, mode, null), restart);
    withinShow = true;
    let result;
    try { result = showOverlay.call(this, heading, html, mode, options); }
    finally { withinShow = false; }
    const currentBody = document.getElementById('ovBody');
    overlay.dataset.uiMotion = kindFor(this, mode, currentBody);
    if (refreshHub && oldTab !== tabKey(currentBody)) markEntry(overlay.dataset.uiMotion, true);
    cancelLegacyCardTween();
    return result;
  };

  ui.hideOverlay = function (options) {
    if (pendingClose) {
      if (!options?.immediate) return;
      clearTimeout(pendingClose.timer);
      pendingClose = null;
    }
    if (overlay.hidden) return hideOverlay.call(this, options);
    overlay.dataset.uiClosing = '1';
    const card = document.getElementById('ovBody')?.parentElement;
    const nativeFastClose = !!card?.querySelector('.bt-settings, .bt-gy-list, .glass-panel');
    const instantRoom = overlay.classList.contains('room-view') && !nativeFastClose;
    // Explicit synchronous cleanup and reduced-motion paths retain their original semantics.
    if (options?.immediate || interfaceReducedMotion() || this._hideTimer || !instantRoom) {
      return hideOverlay.call(this, options);
    }
    overlay.dataset.uiInstantClose = '1';
    const closing = { timer: null };
    pendingClose = closing;
    closing.timer = setTimeout(() => {
      if (pendingClose !== closing) return;
      pendingClose = null;
      hideOverlay.call(this, { ...options, immediate: true });
    }, 140);
  };

  if (showScreen) ui.showScreen = function (element) {
    if (element && (element.hidden || element._scrHiding)) {
      screenFlip = !screenFlip;
      element.dataset.uiMotionScreen = screenFlip ? 'a' : 'b';
    }
    return showScreen.call(this, element);
  };
  if (hideScreen) ui.hideScreen = function (element, after) {
    if (element && !element.hidden) element.dataset.uiMotionScreen = 'close';
    return hideScreen.call(this, element, after);
  };
  return true;
}

if (overlay) {
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = new URL('../../css/interface-motion.css', import.meta.url).href;
  link.dataset.interfaceMotion = '1';
  document.head.appendChild(link);
  document.body.classList.add('interface-motion');
  // The old navigation gate must not stack another transition or toggle blur mid-reveal.
  new MutationObserver(() => {
    if (!overlay.dataset.uiMotion) return;
    if (overlay.classList.contains('gate-live') || overlay.classList.contains('gate-squeeze')) {
      overlay.classList.remove('gate-live', 'gate-squeeze');
    }
    if (overlay.hidden) {
      delete overlay.dataset.uiClosing;
      delete overlay.dataset.uiInstantClose;
    }
  }).observe(overlay, { attributes: true, attributeFilter: ['hidden', 'class'] });

  const bootstrap = new MutationObserver(() => { if (install()) bootstrap.disconnect(); });
  if (!install()) {
    bootstrap.observe(document.body, { attributes: true, childList: true });
    document.addEventListener('DOMContentLoaded', () => { if (install()) bootstrap.disconnect(); }, { once: true });
  }
  document.addEventListener('sdt-overlay-mode', event => {
    if (!install() || withinShow) return;
    // The first event can occur inside the original showOverlay before decoration is installed.
    const ui = window.SDT.UI;
    const body = document.getElementById('ovBody');
    const restart = overlay.hidden || ui._lastMode !== event.detail || event.detail === 'page';
    markEntry(kindFor(ui, event.detail, body), restart);
    cancelLegacyCardTween();
  });
}
