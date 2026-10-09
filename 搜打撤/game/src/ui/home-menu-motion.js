import { interfaceReducedMotion } from './interface-motion.js';

// Home-menu choreography accompanies the shared interface transitions.
const title = document.getElementById('title');
const overlay = document.getElementById('overlay');
const credits = document.getElementById('homeCredits');
const routes = new Set(['mStart', 'mGuide', 'mAch', 'btnCardLib', 'mSettings', 'mInbox']);
const homePages = '.slot-page, .beginner-guide, .achievement-gallery, .card-library-page, .settings-page';
let route = null;
let routeVersion = 0;
let settleTimer;
let returnToken = 0;
let exitBusy = false;
let replayExit = false;

export function homeReducedMotion() {
  return interfaceReducedMotion();
}

function leavingHome() {
  clearTimeout(settleTimer);
  returnToken += 1;
  if (title) title.dataset.homePhase = 'out';
}

export function returnHome() {
  if (!title || title.hidden || title._scrHiding
    || title.dataset.homePhase === 'in' || title.dataset.homePhase === 'rest') return;
  clearTimeout(settleTimer);
  const token = ++returnToken;
  title.dataset.homePhase = 'in';
  settleTimer = setTimeout(() => {
    if (token === returnToken && title.dataset.homePhase === 'in') title.dataset.homePhase = 'rest';
  }, homeReducedMotion() ? 0 : 520);
}

function clearRoute() {
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
    { duration: 180, easing: 'cubic-bezier(.22,1,.36,1)' },
  );
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
  }, 220);
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
    if (event.target === dialog && event.animationName === 'hmDialogOut') settle();
  };
  dialog.addEventListener('animationend', onEnd);
  timer = setTimeout(settle, 210);
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
      event.preventDefault();
      event.stopImmediatePropagation();
      return;
    }
    if (route && !overlay.hidden) return;
    if (routes.has(button.id)) {
      route = button.id;
      leavingHome();
      enterPage();
      // A route that fails before it opens must not leave invisible, inert menu items.
      const requested = ++routeVersion;
      setTimeout(() => {
        if (routeVersion === requested && overlay.hidden && !credits?.open) { clearRoute(); returnHome(); }
      }, 1800);
    }
    tapFeedback(button);
  }, true);

  document.addEventListener('sdt-overlay-mode', event => {
    if (!route) return;
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
