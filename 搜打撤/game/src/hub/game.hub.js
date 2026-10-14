/* 基地轻门面：选档后首次进入才装载页面；共享态仍由 session / depart 单独持有。 */
import { game, getActiveSlot, startNewGame } from '../run/game.session.js';
import { captureBattleContext } from '../battle/battle-loader.js';
import { cardPageOpen, setCardPageOpen } from './game.cardslib.common.js';
import { runPageLoading } from '../ui/page-loading.js';
import { beginPageEntryCancellation, releasePageEntryCancellation } from '../ui/page-entry-cancellation.js';
// 本轮只延迟 JavaScript。保持原静态样式顺序，避免改变全局级联。
import '../../css/preparation.css';
import '../../css/base-camp-rework.css';
import '../../css/base-controls-v4.css';
import '../../css/card-browser.css';
import '../../css/inventory-zoom.css';
import '../../css/base-reward-feedback.css';
import '../../css/base-collection-v4.css';
import '../../css/base-courtyard-v3.css';
import '../../css/base-panel-layout.css';
import '../../css/base-cohesion-v5.css';
import '../../css/base-framework-v7.css';
import '../../css/base-rooms-v7.css';
import '../../css/base-personnel-v12.css';
import '../../css/base-logistics-trade-v12.css';
import '../../css/base-archive-facilities-v12.css';
import '../../css/base-page-motion-v7.css';
import '../../css/base-home-v7.css';
import '../../css/departure-selected.css';
import '../../css/roster-reference.css';
import '../../css/base-shop-v3.css';
import '../../css/base-archive-v3.css';
import { deployPick } from './game.hub.depart.js';

let modulePromise = null;
let pageModule = null;
let pageRequest = 0;
let activeEntry = null;
export let baseHubLoading = false;

function loadHubModule() {
  if (!modulePromise) {
    const loading = import('./game.hub.runtime.js');
    const retryable = loading.then(page => { pageModule = page; return page; }).catch(error => {
      if (modulePromise === retryable) modulePromise = null;
      throw error;
    });
    modulePromise = retryable;
  }
  return modulePromise;
}

function cancelPendingBaseHubOpen() {
  const entry = activeEntry;
  if (!entry) return false;
  activeEntry = null;
  pageRequest += 1;
  baseHubLoading = false;
  releasePageEntryCancellation('hub', cancelPendingBaseHubOpen);
  entry.controller.abort();
  if (!entry.ready) setCardPageOpen(entry.wasCardPageOpen);
  // 已显示的目标页只收去淡出尾幕，Escape 仍交给真实页面的关闭路由。
  return !entry.ready;
}

function enterHub(method, args) {
  const slot = getActiveSlot();
  if (!slot) {
    startNewGame();
    return Promise.resolve(false);
  }
  if (!['idle', 'modal', 'title', 'done'].includes(game.state) || game.battleActive || game.nestActive || game.runActive) {
    return Promise.resolve(false);
  }
  const key = `${method}/${args[0] || 'deploy'}/${slot}`;
  if (activeEntry && activeEntry.key === key) return activeEntry.promise;
  cancelPendingBaseHubOpen();
  beginPageEntryCancellation('hub', cancelPendingBaseHubOpen);
  const overlay = document.getElementById('overlay');
  const body = document.getElementById('ovBody');
  const entry = {
    key, request: ++pageRequest, slot, baseSlot: window.SDT?.Base?.slot,
    originState: game.state, originOverlayHidden: overlay?.hidden,
    originBody: body, originRoot: body?.firstElementChild,
    currentContext: captureBattleContext(game, getActiveSlot),
    wasCardPageOpen: cardPageOpen, controller: new AbortController(), ready: false, promise: null,
  };
  activeEntry = entry;
  baseHubLoading = true;
  setCardPageOpen(true);
  const isCurrent = () => activeEntry === entry && entry.request === pageRequest &&
    !entry.controller.signal.aborted && entry.currentContext() && getActiveSlot() === entry.slot &&
    window.SDT?.Base?.slot === entry.baseSlot && game.state === entry.originState &&
    document.getElementById('overlay')?.hidden === entry.originOverlayHidden &&
    document.getElementById('ovBody') === entry.originBody && entry.originBody?.firstElementChild === entry.originRoot;
  const open = async () => {
    const page = await loadHubModule();
    if (!isCurrent()) {
      if (activeEntry === entry) cancelPendingBaseHubOpen();
      return false;
    }
    const result = page[method](...args);
    entry.ready = result !== false;
    baseHubLoading = false;
    if (!entry.ready) setCardPageOpen(entry.wasCardPageOpen);
    return result;
  };
  const loading = runPageLoading({ title: '基地', detail: '正在准备基地档案', signal: entry.controller.signal, open });
  const operation = loading.catch(error => {
    if (activeEntry === entry) {
      cancelPendingBaseHubOpen();
      window.SDT?.UI?.log?.('基地载入失败，请重试；档案已保留。', 'warn');
      console.warn('[基地] 页面载入失败，可再次重试。', error);
    }
    return false;
  }).finally(() => {
    if (activeEntry === entry) {
      activeEntry = null;
      baseHubLoading = false;
      releasePageEntryCancellation('hub', cancelPendingBaseHubOpen);
    }
  });
  entry.promise = operation;
  return operation;
}

function openBaseHub(tab) { return enterHub('openBaseHub', [tab]); }
function renderHomeScene() { return enterHub('renderHomeScene', []); }
function renderHub() { return pageModule?.renderHub() ?? false; }
function closeBase() {
  if (cancelPendingBaseHubOpen()) return;
  return pageModule?.closeBase();
}

export { closeBase, deployPick, openBaseHub, renderHub, renderHomeScene, cancelPendingBaseHubOpen };
