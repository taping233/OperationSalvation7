import { interfaceReducedMotion } from './interface-motion.js';
import { motionTiming, motionEasing } from './motion-presets.js';
import '../../css/home-ui-tokens.css';

// Home-menu choreography accompanies the shared interface transitions.
const title = document.getElementById('title');
const overlay = document.getElementById('overlay');
const credits = document.getElementById('homeCredits');
const routes = new Set(['mStart', 'mGuide', 'mAch', 'btnCardLib', 'mSettings', 'mInbox']);
const homePages = '.slot-page, .beginner-guide, .achievement-gallery, .card-library-page, .settings-page';
// Only hover/leave feedback is slower; menu actions retain their original dispatch timing.
const homeEntryDuration = 900;
const homeEntryDelays = new Map([
  ['mStart', 160], ['mGuide', 300], ['mAch', 440], ['btnCardLib', 550],
  ['mSettings', 650], ['mCredits', 740], ['btnTitleExit', 830],
]);
const homeRestoreDelays = new Map([
  ['mStart', 170], ['mGuide', 270], ['mAch', 430], ['btnCardLib', 510],
  ['mSettings', 590], ['mCredits', 670], ['btnTitleExit', 750],
]);
let route = null;
let routeVersion = 0;
let navigationObserver = null;
let settleTimer;
let returnToken = 0;
let exitBusy = false;
let replayExit = false;
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
  title.querySelector('.is-picked')?.classList.remove('is-picked');
  delete title.dataset.homePick;
  title.style.setProperty('--home-console-duration', '640ms');
  title.style.setProperty('--home-console-delay', '280ms');
  let finishAt = 920;
  title.querySelectorAll('.home-brand, .home-plate, .home-footer, .home-readout').forEach(region => {
    const delay = region.classList.contains('home-brand') ? 80
      : region.classList.contains('home-footer') ? 880
        : region.classList.contains('home-readout') ? 820 : homeRestoreDelays.get(region.id) ?? 590;
    region.style.setProperty('--home-enter-duration', '440ms');
    region.style.setProperty('--home-enter-delay', `${delay}ms`);
    finishAt = Math.max(finishAt, delay + 440);
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
  const entryDuration = firstEntry ? homeEntryDuration : 640;
  title.style.setProperty('--surface-in', `${entryDuration}ms`);
  title.style.setProperty('--home-console-duration', firstEntry ? '850ms' : '500ms');
  title.style.setProperty('--home-console-delay', firstEntry ? '220ms' : '240ms');
  let finishAt = entryDuration;
  title.querySelectorAll('.home-brand, .home-plate, .home-footer, .home-readout').forEach(region => {
    const plate = region.classList.contains('home-plate');
    const duration = region.classList.contains('home-brand') ? (firstEntry ? 1100 : 640) : plate ? entryDuration : (firstEntry ? 700 : 500);
    const entryDelay = region.classList.contains('home-brand') ? 0
      : plate ? (region.classList.contains('is-picked') ? 0 : homeEntryDelays.get(region.id) ?? 650)
        : region.classList.contains('home-footer') ? 760 : 480;
    const delay = firstEntry ? entryDelay : Math.round(entryDelay * .65);
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
    if (!document.querySelector('.page-loading') && !credits?.open) { clearRoute(); returnHome(); }
  });
  navigationObserver.observe(document.body, { childList: true });
  setTimeout(() => {
    if (routeVersion === requested && overlay.hidden && !credits?.open && !document.querySelector('.page-loading')) { clearRoute(); returnHome(); }
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
  if (homeReducedMotion()) { finish(); return; }
  let finished = false;
  let timer;
  const settle = () => {
    if (finished) return;
    finished = true;
    clearTimeout(timer);
    dialog.removeEventListener('animationend', onEnd);
    finish();
  };
  const onEnd = event => {
    if (event.target === dialog && event.animationName === 'creditsFrameOut') settle();
  };
  dialog.addEventListener('animationend', onEnd);
  timer = setTimeout(settle, motionTiming.exit + 30);
}

if (title && overlay) {
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = new URL('../../css/home-menu-motion.css', import.meta.url).href;
  link.dataset.homeMenuMotion = '1';
  document.head.appendChild(link);

  title.addEventListener('click', event => {
    const button = event.target.closest?.('button');
    if (!button || !title.contains(button) || button.closest('dialog') || button.disabled) return;
    if (button.id === 'btnTitleExit') { animateExit(event, button); return; }
    if (route && title.dataset.homePhase === 'out') {
      // The next click can precede the cover-removal observer after Escape.
      if (overlay.hidden && !document.querySelector('.page-loading')) clearRoute();
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
      watchNavigation();
    }
    tapFeedback(button);
  }, true);

  document.addEventListener('sdt-overlay-mode', event => {
    if (!route) return;
    navigationObserver?.disconnect();
    navigationObserver = null;
    const body = document.getElementById('ovBody');
    if (body?.querySelector(homePages)) { leavingHome(); enterPage(); return; }
    if (event.detail === 'battle' || body?.querySelector('#hubMain, #depMain, .flow-transition, .cls2-page')) {
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
