/* 照相馆轻门面：共享视觉/菜单状态同步可用；页面与制作坊首次进入时按需加载。 */
import {
  CARD_DESIGNER_WRITES_ENABLED, Sfx, cardHTML, configureCardNavigation,
  cardPageOpen, setCardPageOpen, closeCardPageTop as closeCardPageTopNow,
  configurePendingCardPageEntry,
} from './game.cardslib.common.js';
import { game } from '../run/game.session.js';
import { runPageLoading } from '../ui/page-loading.js';
import { beginPageEntryCancellation, releasePageEntryCancellation } from '../ui/page-entry-cancellation.js';
import { enterSurface } from '../ui/surface-motion.js';

let pageModulePromise = null;
let pageRequest = 0;
let pendingPageEntry = null;
let activePageEntry = null;
let pageEntryPromise = null;
export let cardPageLoading = false;

function cancelPendingPageEntry() {
  const entry = pendingPageEntry || activePageEntry;
  if (!entry) return false;
  releasePageEntryCancellation('cardslib', cancelPendingPageEntry);
  if (pendingPageEntry === entry) {
    pendingPageEntry = null;
    pageRequest += 1;
    cardPageLoading = false;
    setCardPageOpen(entry.wasCardPageOpen);
    entry.controller.abort();
    if (activePageEntry === entry) activePageEntry = null;
    if (pageEntryPromise === entry.promise) pageEntryPromise = null;
    return true;
  }
  // The destination is already interactive. Remove only the fading cover and let
  // the shared closer continue to close the real page.
  if (entry.ready) {
    entry.controller.abort();
    if (activePageEntry === entry) activePageEntry = null;
    if (pageEntryPromise === entry.promise) pageEntryPromise = null;
  }
  return false;
}

configurePendingCardPageEntry(cancelPendingPageEntry);

function loadPageModule() {
  if (!pageModulePromise) {
    const pending = import('./game.cardslib.page.js');
    const retryable = pending.catch((error) => {
      if (pageModulePromise === retryable) pageModulePromise = null;
      throw error;
    });
    pageModulePromise = retryable;
  }
  return pageModulePromise;
}

// Code/CSS only: no gallery DOM, catalogue refresh or save writes during idle preload.
export function preloadCardLibrary() { return loadPageModule(); }

function enterPage(method, args) {
  if (pageEntryPromise) return pageEntryPromise;
  const request = ++pageRequest;
  const originState = game.state;
  if (originState !== 'idle' && originState !== 'modal' && originState !== 'title') return Promise.resolve(false);
  beginPageEntryCancellation('cardslib', cancelPendingPageEntry);
  const overlay = document.getElementById('overlay');
  const originBody = document.getElementById('ovBody');
  const wasCardPageOpen = pendingPageEntry?.wasCardPageOpen ?? cardPageOpen;
  const controller = new AbortController();
  const entry = {
    request,
    originState,
    originOverlayHidden: overlay?.hidden,
    originBody,
    originRoot: originBody?.firstElementChild,
    wasCardPageOpen,
    controller,
    ready: false,
    promise: null,
  };
  pendingPageEntry = entry;
  activePageEntry = entry;
  cardPageLoading = true;
  setCardPageOpen(true);
  let mountedPage = null;
  let mountedRoot = null;
  const loading = runPageLoading({
    title: method === 'openCardDesigner' ? '制作坊' : '照相馆',
    detail: method === 'openCardDesigner' ? '正在准备编辑工作台' : '正在整理收藏档案',
    presentation: method === 'openCardDesigner' ? undefined : 'city-cut',
    signal: controller.signal,
    prepare: method === 'openCardLibrary' ? async signal => {
      const ready = await mountedPage?.preparePhotoStudioEntry(signal);
      const cut = /** @type {HTMLElement} */ (document.querySelector('.page-loading [data-film-kind="photo"]'));
      if (cut) cut.dataset.filmExitDuration = '760';
      return ready;
    } : undefined,
    onRevealStart: method === 'openCardLibrary' ? () => {
      const currentOverlay = document.getElementById('overlay');
      if (!controller.signal.aborted && currentOverlay?.querySelector('.studio-unified')) {
        // Let the gallery settle while the photograph dissolves into the room.
        enterSurface(currentOverlay, { restart: true });
      }
    } : undefined,
    open: async () => {
      const page = await loadPageModule();
      const pending = pendingPageEntry;
      const currentOverlay = document.getElementById('overlay');
      const currentBody = document.getElementById('ovBody');
      if (request !== pageRequest || pending !== entry || game.state !== entry.originState ||
          currentOverlay?.hidden !== entry.originOverlayHidden || currentBody !== entry.originBody ||
          currentBody?.firstElementChild !== entry.originRoot) {
        if (pendingPageEntry === entry) cancelPendingPageEntry();
        return false;
      }
      const result = await page[method](...args);
      mountedPage = page;
      mountedRoot = document.querySelector('.card-library-page');
      if (pendingPageEntry === entry) {
        entry.ready = true;
        pendingPageEntry = null;
        cardPageLoading = false;
      }
      return result;
    },
  });
  const operation = loading.catch((error) => {
    if (request === pageRequest) {
      releasePageEntryCancellation('cardslib', cancelPendingPageEntry);
      const pending = pendingPageEntry;
      pendingPageEntry = null;
      activePageEntry = null;
      cardPageLoading = false;
      if (pending) {
        setCardPageOpen(pending.wasCardPageOpen);
        if (document.querySelector('.card-library-page') || document.getElementById('cdesStage')) closeCardPageTopNow();
        else if (game.state !== pending.originState) {
          game.state = pending.originState;
          window.SDT?.UI?.refresh?.(game);
        }
      }
      window.SDT?.UI?.log?.('照相馆载入失败，请重试。', 'warn');
      console.warn('[照相馆] 页面载入失败，可再次重试。', error);
    }
    return false;
  }).finally(() => {
    if (method === 'openCardLibrary') mountedPage?.finishPhotoStudioEntry?.(mountedRoot);
    if (activePageEntry === entry) {
      releasePageEntryCancellation('cardslib', cancelPendingPageEntry);
      activePageEntry = null;
    }
    if (pendingPageEntry === entry) {
      pendingPageEntry = null;
      cardPageLoading = false;
    }
    if (pageEntryPromise === operation) pageEntryPromise = null;
  });
  entry.promise = operation;
  pageEntryPromise = operation;
  return operation;
}

function openCardLibrary(...args) { return enterPage('openCardLibrary', args); }
function openCardDesigner(...args) { return enterPage('openCardDesigner', args); }

function closeCardPageTop() {
  pageRequest += 1;
  return closeCardPageTopNow();
}

const _set_cardPageOpen = (value) => {
  pageRequest += 1;
  releasePageEntryCancellation('cardslib', cancelPendingPageEntry);
  activePageEntry?.controller.abort();
  activePageEntry = null;
  pageEntryPromise = null;
  pendingPageEntry = null;
  cardPageLoading = false;
  setCardPageOpen(value);
};

export {
  CARD_DESIGNER_WRITES_ENABLED, Sfx, cardHTML, configureCardNavigation,
  cardPageOpen, closeCardPageTop, openCardDesigner, openCardLibrary, _set_cardPageOpen,
  cancelPendingPageEntry as cancelPendingCardPageOpen,
};
