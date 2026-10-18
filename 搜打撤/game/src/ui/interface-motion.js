// Shared visual choreography around the existing UI API. No route or save handler is replaced.
import { enterSurface, leaveSurface, clearSurface } from './surface-motion.js';
import { captureArchiveExit, enterCamp, clearCampEntry } from './camp-entry.js';
import { pageMotionProfile } from './page-motion-profiles.js';
import { enterArchive, clearArchiveMotion } from './archive-motion.js';
import { navigationState, navigationChange } from './navigation-motion.js';
import { stagePageVisual, stageMapReturn, cancelPageVisual } from './page-visual-ready.js';
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
  const revision = window.SDT?.UI?._overlayRevision;
  queueMicrotask(() => {
    if (!overlay || overlay.hidden || window.SDT?.UI?._overlayRevision !== revision) return;
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
      // hide 请求时已解绑旧页；保留调用方在 show 前登记的新页动作。
      const acts = this._acts, input = this._inputHandler, hover = this._hoverHandler;
      hideOverlay.call(this, { immediate: true });
      this._acts = acts;
      this._inputHandler = input;
      this._hoverHandler = hover;
    }
    const body = document.getElementById('ovBody');
    const isCamp = mode === 'page' && typeof html === 'string' && html.includes('base-camp');
    const initialCamp = isCamp && !body?.querySelector('#hubMain');
    const archiveExit = initialCamp && !interfaceReducedMotion() ? captureArchiveExit(body) : null;
    clearArchiveMotion(overlay);
    const wasOpen = !overlay.hidden;
    const oldProfile = pageMotionProfile(body)?.key;
    const oldTab = tabKey(body);
    const oldNavigation = navigationState(body?.querySelector('#hubMain'));
    const refreshHub = wasOpen && mode === 'page' && !!body?.querySelector('#hubMain')
      && typeof html === 'string' && html.includes('id="hubMain"');
    // 同一基地页的异步资料刷新只替换内容，不中断尚未播完的揭幕。
    if (!refreshHub) clearCampEntry();
    const motionKeyChanged = options?.motionKey && options.motionKey !== this._motionKey;
    // 背包分区、同页选牌与数量变化只刷新内容；不再清空遮罩并重播整页入场。
    const contentRefresh = wasOpen && this._lastMode === mode && !motionKeyChanged && !refreshHub
      && (mode === 'bagpage' && !!body?.querySelector('.bag-v2') && html.includes('bag-v2')
        || this._motionHeading === heading && mode !== 'battle' && oldProfile !== 'base-content');
    this._motionHeading = heading;
    this._motionKey = options?.motionKey || null;
    const restart = !wasOpen || this._lastMode !== mode || motionKeyChanged || (mode === 'page' && !refreshHub);
    overlay.style.removeProperty('--page-out');
    if (contentRefresh) {
      delete overlay.dataset.uiEnter;
      delete overlay.dataset.uiClosing;
      delete overlay.dataset.uiInstantClose;
      clearSurface(overlay);
    } else markEntry(kindFor(this, mode, null), restart);
    withinShow = true;
    let result;
    try { result = showOverlay.call(this, heading, html, mode, options); }
    finally { withinShow = false; }
    const currentBody = document.getElementById('ovBody');
    overlay.dataset.uiMotion = kindFor(this, mode, currentBody);
    const tabChanged = refreshHub && oldTab !== tabKey(currentBody);
    const navChange = navigationChange(oldNavigation, navigationState(currentBody?.querySelector('#hubMain')));
    const dedicated = !!currentBody?.querySelector('.city-run-transition, .expedition-cut')
      || !!(currentBody?.querySelector('.studio-unified') && document.querySelector('.page-loading'));
    const reveal = () => {
    if (contentRefresh) {
      delete overlay.dataset.uiEnter;
      clearSurface(overlay);
      return;
    }
    if (refreshHub || initialCamp) {
      // 基地外壳始终保持不透明；首次进入由专用编排展开内容，
      // 基地内刷新也不为重建的 header/body 重挂通用入场块。
      delete overlay.dataset.uiEnter;
      clearSurface(overlay);
      delete overlay.dataset.surfaceMotion;
      if (tabChanged || refreshHub && navChange.changed) {
        clearCampEntry();
        enterSurface(overlay, { restart: true, navigation: navChange });
      }
      if (initialCamp) {
        delete overlay.dataset.surfaceLayout;
        enterCamp(overlay, archiveExit, interfaceReducedMotion());
      }
    } else if (currentBody?.querySelector('.city-run-transition, .expedition-cut') ||
        (currentBody?.querySelector('.studio-unified') && document.querySelector('.page-loading'))) {
      // 挂载时不提前播放；照相馆在揭幕开始时接共用区域滑入，结束后不重播。
      delete overlay.dataset.uiEnter;
      clearSurface(overlay);
      delete overlay.dataset.surfaceMotion;
      delete overlay.dataset.surfaceLayout;
    } else {
      const samePage = wasOpen && mode === 'page' && oldProfile
        && oldProfile === pageMotionProfile(currentBody)?.key;
      if (samePage) delete overlay.dataset.uiEnter;
      enterSurface(overlay, { restart, fast: overlay.dataset.uiMotion === 'fast', contentOnly: !!samePage });
    }
    enterArchive(overlay, currentBody, interfaceReducedMotion());
    };
    // 基地内导航直接衔接区域动效，避免每次换房间都盖全屏黑幕。
    const staged = !contentRefresh && !dedicated && !initialCamp && !refreshHub
      && (mode === 'page' || mode === 'bagpage' || (this._roomActive && mode !== 'battle'));
    if (staged) {
      clearSurface(overlay);
      delete overlay.dataset.uiEnter;
      stagePageVisual(this, reveal);
    } else {
      cancelPageVisual();
      reveal();
    }
    cancelLegacyCardTween();
    return result;
  };

  ui.hideOverlay = function (options) {
    cancelPageVisual();
    const game = window.SDT?.game;
    if (!options?.immediate && !overlay.hidden && game?.runActive && !game.battleActive && !game.nestActive
      && (overlay.classList.contains('opaque') || overlay.dataset.surfaceContext === 'expedition'
        || !!this.el.ovBody?.querySelector('.node-pg:not(.flow-transition), .event-scene, .reward-replica, .cqo-overview, .shop-market'))) {
      stageMapReturn(this, game);
    }
    clearCampEntry();
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
    const exitDuration = overlay.dataset.surfaceContext === 'expedition' ? 220 : 140;
    overlay.style.setProperty('--page-out', `${exitDuration}ms`);
    enterSurface(overlay, { restart: false, fast: instantRoom || nativeFastClose || overlay.dataset.uiMotion === 'fast' });
    leaveSurface(overlay);
    // Explicit synchronous cleanup and reduced-motion paths retain their original semantics.
    if (options?.immediate || interfaceReducedMotion() || this._hideTimer || !instantRoom) {
      return hideOverlay.call(this, options);
    }
    overlay.dataset.uiInstantClose = '1';
    // 逻辑关闭同步生效，140ms 只保留退出画面；旧按钮不能在淡出期间重领。
    this._acts = {};
    this._inputHandler = null;
    this._hoverHandler = null;
    const closing = { timer: null };
    pendingClose = closing;
    closing.timer = setTimeout(() => {
      if (pendingClose !== closing) return;
      pendingClose = null;
      hideOverlay.call(this, { ...options, immediate: true });
    }, exitDuration);
  };

  if (showScreen) ui.showScreen = function (element) {
    if (element && (element.hidden || element._scrHiding)) {
      screenFlip = !screenFlip;
      element.dataset.uiMotionScreen = screenFlip ? 'a' : 'b';
      if (element.id !== 'title') enterSurface(element);
    }
    return showScreen.call(this, element);
  };
  if (hideScreen) ui.hideScreen = function (element, after) {
    if (element && !element.hidden) {
      element.dataset.uiMotionScreen = 'close';
      enterSurface(element, { restart: false });
      leaveSurface(element);
    }
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
      clearArchiveMotion(overlay);
      clearSurface(overlay);
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
    enterSurface(overlay, { restart, fast: overlay.dataset.uiMotion === 'fast' });
    cancelLegacyCardTween();
  });
}
