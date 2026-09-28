/* 照相馆轻门面：共享视觉/菜单状态同步可用；页面与制作坊首次进入时按需加载。 */
import {
  CARD_DESIGNER_WRITES_ENABLED, Sfx, cardHTML, navigation, configureCardNavigation,
  cardPageOpen, setCardPageOpen, closeCardPageTop as closeCardPageTopNow,
  configurePendingCardPageEntry,
} from './game.cardslib.common.js';
import { game } from '../run/game.session.js';

let pageModulePromise = null;
let pageRequest = 0;
let pendingPageEntry = null;
export let cardPageLoading = false;

function cancelPendingPageEntry() {
  if (!pendingPageEntry) return false;
  const restoreCardPageOpen = pendingPageEntry.wasCardPageOpen;
  pendingPageEntry = null;
  pageRequest += 1;
  cardPageLoading = false;
  setCardPageOpen(restoreCardPageOpen);
  return true;
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

function enterPage(method, args) {
  const request = ++pageRequest;
  const originState = game.state;
  if (originState !== 'idle' && originState !== 'modal' && originState !== 'title') return Promise.resolve(false);
  const overlay = document.getElementById('overlay');
  const wasCardPageOpen = pendingPageEntry?.wasCardPageOpen ?? cardPageOpen;
  pendingPageEntry = {
    request,
    originState,
    originOverlayHidden: overlay?.hidden,
    originOverlayHTML: overlay?.innerHTML,
    wasCardPageOpen,
  };
  cardPageLoading = true;
  setCardPageOpen(true);
  return loadPageModule().then((page) => {
    if (request !== pageRequest) return;
    const pending = pendingPageEntry;
    const currentOverlay = document.getElementById('overlay');
    if (!pending || pending.request !== request || game.state !== pending.originState ||
        currentOverlay?.hidden !== pending.originOverlayHidden || currentOverlay?.innerHTML !== pending.originOverlayHTML) {
      cancelPendingPageEntry();
      return false;
    }
    pendingPageEntry = null;
    cardPageLoading = false;
    return page[method](...args);
  }).catch((error) => {
    if (request === pageRequest) {
      cancelPendingPageEntry();
      window.SDT?.UI?.log?.('照相馆载入失败，请重试。', 'warn');
      console.warn('[照相馆] 页面载入失败，可再次打开重试。', error);
    }
    return false;
  });
}

function openCardLibrary(...args) { return enterPage('openCardLibrary', args); }
function openCardDesigner(...args) { return enterPage('openCardDesigner', args); }

function closeCardPageTop() {
  pageRequest += 1;
  return closeCardPageTopNow();
}

const _set_cardPageOpen = (value) => {
  pageRequest += 1;
  pendingPageEntry = null;
  cardPageLoading = false;
  setCardPageOpen(value);
};

export {
  CARD_DESIGNER_WRITES_ENABLED, Sfx, cardHTML, navigation, configureCardNavigation,
  cardPageOpen, closeCardPageTop, openCardDesigner, openCardLibrary, _set_cardPageOpen,
  cancelPendingPageEntry as cancelPendingCardPageOpen,
};
