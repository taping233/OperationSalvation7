import { interfaceReducedMotion } from './interface-motion.js';
import { motionTiming, motionEasing } from './motion-presets.js';
import { completeSurfaceMotion } from './motion-completion.js';
import '../../css/home-ui-tokens.css';
import '../../css/home-menu-motion.css';

// Home-menu choreography accompanies the shared interface transitions.
const title = /** @type {import('./ui.dom.types.js').UIElement} */ (document.getElementById('title'));
const overlay = document.getElementById('overlay');
const credits = /** @type {HTMLDialogElement} */ (document.getElementById('homeCredits'));
const routes = new Set(['mStart', 'mGuide', 'mAch', 'btnCardLib', 'mSettings', 'mInbox']);
const homePages = '.slot-page, .beginner-guide, .achievement-gallery, .card-library-page, .settings-page';
// Home entry/return choreography; ordinary destinations follow the short departure.
const homeEntryDuration = 560;
const homeEntryDelays = new Map([
  ['mStart', 80], ['mGuide', 140], ['mAch', 220], ['btnCardLib', 280],
  ['mSettings', 350], ['mCredits', 400], ['btnTitleExit', 450],
]);
const homeRestoreDelays = new Map([
  ['mStart', 100], ['mGuide', 150], ['mAch', 230], ['btnCardLib', 290],
  ['mSettings', 340], ['mCredits', 390], ['btnTitleExit', 440],
]);
let route = null;
let routeVersion = 0;
let navigationObserver = null;
let settleTimer;
let returnToken = 0;
let exitBusy = false;
let replayExit = false;
let replayNavigation = false;
let pendingNavigation = null;
let cancelNavigation = null;
let homeHasEntered = false;
let revealVersion = false;

export function homeReducedMotion() {
  return interfaceReducedMotion();
}

function leavingHome() {
  clearTimeout(settleTimer);
  returnToken += 1;
  if (title) {
    delete title.dataset.homeReveal;
    title.dataset.homePhase = 'out';
  }
}

export function restoreHomeFromWallpaper() {
  if (!title || title.hidden || title._scrHiding) return;
  clearTimeout(settleTimer);
  const token = ++returnToken;
  homeHasEntered = true;
  revealVersion = !revealVersion;
  /** @type {import("./ui.dom.types.js").UIElement} */ (title.querySelector('.is-picked'))?.classList.remove('is-picked');
  delete title.dataset.homePick;
  title.style.setProperty('--home-console-duration', '480ms');
  title.style.setProperty('--home-console-delay', '100ms');
  let finishAt = 580;
  /** @type {NodeListOf<HTMLElement>} */ (title.querySelectorAll('.home-brand, .home-plate, .home-footer, .home-readout')).forEach(region => {
    const delay = region.classList.contains('home-brand') ? 40
      : region.classList.contains('home-footer') ? 430
        : region.classList.contains('home-readout') ? 380 : homeRestoreDelays.get(region.id) ?? 340;
    region.style.setProperty('--home-enter-duration', '360ms');
    region.style.setProperty('--home-enter-delay', `${delay}ms`);
    finishAt = Math.max(finishAt, delay + 360);
  });
  title.dataset.homeReveal = revealVersion ? 'a' : 'b';
  title.dataset.homePhase = 'in';
  settleTimer = setTimeout(() => {
    if (token !== returnToken) return;
    title.dataset.homePhase = 'rest';
    delete title.dataset.homeReveal;
  }, homeReducedMotion() ? 0 : finishAt + 40);
}

export function hideHomeForWallpaper() {
  if (!title) return;
  clearTimeout(settleTimer);
  returnToken += 1;
  // 恢复的是操作界面，壁纸不再重播首次打开时的透明度淡入。
  title.dataset.homeSceneReady = '1';
  delete title.dataset.homeReveal;
  title.dataset.homePhase = 'rest';
}

export function returnHome() {
  if (!title || title.hidden || title._scrHiding
    || title.dataset.homePhase === 'in' || title.dataset.homePhase === 'rest') return;
  clearTimeout(settleTimer);
  const token = ++returnToken;
  const firstEntry = !homeHasEntered;
  homeHasEntered = true;
  const entryDuration = firstEntry ? homeEntryDuration : 380;
  title.style.setProperty('--surface-in', `${entryDuration}ms`);
  title.style.setProperty('--home-console-duration', firstEntry ? '560ms' : '380ms');
  title.style.setProperty('--home-console-delay', firstEntry ? '140ms' : '80ms');
  let finishAt = entryDuration;
  /** @type {NodeListOf<HTMLElement>} */ (title.querySelectorAll('.home-brand, .home-plate, .home-footer, .home-readout')).forEach(region => {
    const plate = region.classList.contains('home-plate');
    const duration = region.classList.contains('home-brand') ? (firstEntry ? 700 : 420) : plate ? entryDuration : (firstEntry ? 420 : 320);
    const entryDelay = region.classList.contains('home-brand') ? 0
      : plate ? (region.classList.contains('is-picked') ? 0 : homeEntryDelays.get(region.id) ?? 350)
        : region.classList.contains('home-footer') ? 440 : 320;
    const delay = firstEntry ? entryDelay : Math.round(entryDelay * .4);
    region.style.setProperty('--home-enter-duration', `${duration}ms`);
    region.style.setProperty('--home-enter-delay', `${delay}ms`);
    if (plate) region.style.setProperty('--hd', `${delay}ms`);
    finishAt = Math.max(finishAt, delay + duration);
  });
  title.dataset.homePhase = 'in';
  settleTimer = setTimeout(() => {
    if (token === returnToken && title.dataset.homePhase === 'in') title.dataset.homePhase = 'rest';
  }, homeReducedMotion() ? 0 : finishAt + 20);
}

function clearRoute() {
  cancelNavigation?.();
  cancelNavigation = null;
  pendingNavigation = null;
  navigationObserver?.disconnect();
  navigationObserver = null;
  route = null;
  routeVersion += 1;
  if (overlay) {
    delete overlay.dataset.homeRoute;
    delete overlay.dataset.homeMotion;
  }
  document.body.classList.remove('home-menu-flow');
}

function enterPage() {
  if (!route || !overlay) return;
  document.body.classList.add('home-menu-flow');
  overlay.dataset.homeRoute = route;
}

function tapFeedback(button) {
  if (homeReducedMotion()) return;
  button.querySelector('svg')?.animate?.(
    [{ opacity: 1, transform: 'scale(1)' }, { opacity: .75, transform: 'scale(1.1)' }, { opacity: 1, transform: 'scale(1)' }],
    { duration: motionTiming.feedback, easing: motionEasing.enter },
  );
}

function watchNavigation() {
  const requested = ++routeVersion;
  navigationObserver?.disconnect();
  navigationObserver = new MutationObserver(() => {
    if (routeVersion !== requested || !overlay.hidden) {
      navigationObserver?.disconnect();
      navigationObserver = null;
      return;
    }
    // A cancelled cold entry removes its cover without ever opening #overlay.
    if (!/** @type {import("./ui.dom.types.js").UIElement} */ (document.querySelector('.page-loading')) && !credits?.open) { clearRoute(); returnHome(); }
  });
  navigationObserver.observe(document.body, { childList: true });
  setTimeout(() => {
    if (routeVersion === requested && overlay.hidden && !credits?.open && !/** @type {import("./ui.dom.types.js").UIElement} */ (document.querySelector('.page-loading'))) { clearRoute(); returnHome(); }
  }, 1800);
}

function animateExit(event, button) {
  if (replayExit || homeReducedMotion()) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  if (exitBusy) return;
  exitBusy = true;
  leavingHome();
  setTimeout(() => {
    replayExit = true;
    try { button.click(); } finally { replayExit = false; exitBusy = false; }
    // Browsers can refuse window.close(); keep their homepage usable in that case.
    setTimeout(() => { if (overlay?.hidden && !credits?.open) returnHome(); }, 250);
  }, motionTiming.exit + motionTiming.staggerMax + 20);
}

export function enterHomeDialog(dialog) {
  leavingHome();
  dialog.dataset.homeMotion = 'in';
}

export function leaveHomeDialog(dialog, finish) {
  if (dialog.dataset.homeMotion === 'out') return;
  dialog.dataset.homeMotion = 'out';
  returnHome();
  completeSurfaceMotion(dialog, finish, { duration: motionTiming.exit, name: 'creditsFrameOut' });
}

if (title && overlay) {
  title.addEventListener('click', event => {
      if (!(event.target instanceof Element)) return;
    const button = event.target.closest?.('button');
    if (!button || !title.contains(button) || button.closest('dialog') || button.disabled) return;
    if (replayNavigation) return;
    if (pendingNavigation) {
      event.preventDefault(); event.stopImmediatePropagation(); return;
    }
    if (button.id === 'btnTitleExit') { animateExit(event, button); return; }
    if (route && title.dataset.homePhase === 'out') {
      // The next click can precede the cover-removal observer after Escape.
      if (overlay.hidden && !/** @type {import("./ui.dom.types.js").UIElement} */ (document.querySelector('.page-loading'))) clearRoute();
      else {
        event.preventDefault();
        event.stopImmediatePropagation();
        return;
      }
    }
    if (route && !overlay.hidden) return;
    if (routes.has(button.id)) {
      route = button.id;
      leavingHome();
      enterPage();
    }
    // The city already owns its archive reveal. Other entries need one visible
    // departure before an opaque destination or native dialog covers the home.
    if ((routes.has(button.id) || button.id === 'mCredits') && button.id !== 'mStart' && !homeReducedMotion()) {
      event.preventDefault(); event.stopImmediatePropagation();
      if (button.id === 'mCredits') leavingHome();
      pendingNavigation = button;
      tapFeedback(button);
      // The shared completion owner advances on the selected control's exit,
      // with a timeout fallback and cancellation when Escape changes the route.
      const departure = button.classList.contains('home-plate') ? button : title.querySelector('.home-footer');
      cancelNavigation = completeSurfaceMotion(departure, () => {
        cancelNavigation = null;
        if (pendingNavigation !== button) return;
        pendingNavigation = null;
        if (!button.isConnected || title.hidden || title._scrHiding || title.classList.contains('wallpaper-only') || !overlay.hidden || credits?.open) {
          clearRoute(); returnHome(); return;
        }
        if (routes.has(button.id)) watchNavigation();
        replayNavigation = true;
        try { button.click(); } finally { replayNavigation = false; }
      }, { duration: motionTiming.exit, name: button.classList.contains('home-plate') ? 'hmPickedOut' : 'hmQuietOut' });
      return;
    }
    if (routes.has(button.id)) watchNavigation();
    tapFeedback(button);
  }, true);

  window.addEventListener('keydown', event => {
    if (!pendingNavigation || event.key !== 'Escape') return;
    event.preventDefault(); event.stopImmediatePropagation();
    clearRoute(); returnHome();
  }, true);

  document.addEventListener('sdt-overlay-mode', (/** @type {CustomEvent} */ event) => {
    if (!route) return;
    navigationObserver?.disconnect();
    navigationObserver = null;
    const body = document.getElementById('ovBody');
    if (body?.querySelector(homePages)) { leavingHome(); enterPage(); return; }
    if (event.detail === 'battle' || /** @type {import("./ui.dom.types.js").UIElement} */ (body?.querySelector('#hubMain, #depMain, .flow-transition, .cls2-page'))) {
      clearRoute();
    }
  });

  new MutationObserver(() => {
    if (route && overlay.classList.contains('closing')) returnHome();
    // Base/character pages clear the original route while the title stays visible.
    // Restore that title on close even when no menu route remains to clear.
    if (overlay.hidden) {
      clearRoute();
      if (!credits?.open) returnHome();
    }
  }).observe(overlay, { attributes: true, attributeFilter: ['hidden', 'class'] });

  new MutationObserver(() => {
    if (!title.hidden && overlay.hidden && !credits?.open) returnHome();
  }).observe(title, { attributes: true, attributeFilter: ['hidden'] });

  credits?.addEventListener('close', () => {
    delete credits.dataset.homeMotion;
    returnHome();
  });
  returnHome();
}

if (import.meta.hot) import.meta.hot.dispose(() => {
  cancelNavigation?.();
  clearTimeout(settleTimer);
  navigationObserver?.disconnect();
  pendingNavigation = null;
});
