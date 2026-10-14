/* 开发工具轻门面：生产也保留入口，首次请求才装载控制台与测试节点实现。 */
import { game, getActiveSlot } from './game.session.js';
import { captureBattleContext } from '../battle/battle-loader.js';
import { cardPageOpen } from '../hub/game.cardslib.common.js';
import { beginPageEntryCancellation, releasePageEntryCancellation } from '../ui/page-entry-cancellation.js';

let modulePromise = null;
let devModule = null;
let activeEntry = null;
export let devToolsLoading = false;

function loadDevModule() {
  if (!modulePromise) {
    const loading = import('./game.run.dev.js');
    const retryable = loading.then(runtime => { devModule = runtime; return runtime; }).catch(error => {
      if (modulePromise === retryable) modulePromise = null;
      throw error;
    });
    modulePromise = retryable;
  }
  return modulePromise;
}

function releaseEntry(entry) {
  if (activeEntry !== entry) return;
  activeEntry = null;
  devToolsLoading = false;
  releasePageEntryCancellation('dev-tools', cancelPendingDevTools);
}

export function cancelPendingDevTools() {
  if (!activeEntry) return false;
  releaseEntry(activeEntry);
  return true;
}

function captureOrigin(UI) {
  const overlay = UI.el.overlay, body = UI.el.ovBody;
  const visible = !overlay.hidden && !overlay.classList.contains('closing') && !overlay.dataset.uiClosing;
  return {
    visible, state:game.state, battleActive:game.battleActive, cardPageOpen,
    html:visible ? body.innerHTML : '', nodes:visible ? [...body.childNodes] : [],
    title:UI.el.ovTitle?.innerHTML || '', mode:UI._lastMode,
    acts:{ ...UI._acts }, input:UI._inputHandler, hover:UI._hoverHandler,
    roomActive:UI._roomActive, bagClose:UI._bagCloseHook,
    returnFocus:UI._overlayReturnFocus, focus:document.activeElement,
  };
}

function enterDevTools(method, args) {
  const key = `${method}/${args[0] ?? ''}`;
  if (activeEntry && activeEntry.key === key && activeEntry.current()) return activeEntry.promise;
  cancelPendingDevTools();
  beginPageEntryCancellation('dev-tools', cancelPendingDevTools);
  const UI = window.SDT?.UI;
  const overlay = UI?.el?.overlay, body = UI?.el?.ovBody;
  if (!overlay || !body) {
    releasePageEntryCancellation('dev-tools', cancelPendingDevTools);
    return Promise.resolve(false);
  }
  const entry = {
    key, overlay, body, root:body.firstElementChild, hidden:overlay.hidden, revision:UI._overlayRevision,
    slot:getActiveSlot(), base:window.SDT?.Base, baseSlot:window.SDT?.Base?.slot,
    currentContext:captureBattleContext(game, getActiveSlot), origin:captureOrigin(UI), promise:null, current:null,
  };
  activeEntry = entry;
  devToolsLoading = !devModule;
  const sourceCurrent = () => entry.currentContext() &&
    getActiveSlot() === entry.slot && window.SDT?.Base === entry.base && window.SDT?.Base?.slot === entry.baseSlot &&
    window.SDT?.UI === UI && game.state === entry.origin.state && game.battleActive === entry.origin.battleActive &&
    UI.el.overlay === entry.overlay && UI.el.ovBody === entry.body &&
    document.getElementById('overlay') === entry.overlay && document.getElementById('ovBody') === entry.body &&
    entry.overlay.hidden === entry.hidden && entry.body.firstElementChild === entry.root && UI._overlayRevision === entry.revision;
  const isCurrent = () => activeEntry === entry && sourceCurrent();
  entry.current = isCurrent;
  let invoked = false;
  const invoke = runtime => {
    if (!isCurrent()) { releaseEntry(entry); return false; }
    // 运行时接手之后不再是等待页面入口；它自己的战斗异步边界负责局身份守卫。
    releaseEntry(entry);
    invoked = true;
    return method === 'openDevConsole' ? runtime.openDevConsole(entry.origin) : runtime[method](...args);
  };
  const onFailure = error => {
    if (isCurrent()) {
      UI.log?.('[[icon:cross]] 开发工具载入失败，请重试；原页面已保留。', 'warn');
      console.warn('[开发工具] 载入失败，可再次重试。', error);
    } else if (invoked && !activeEntry && sourceCurrent()) {
      UI.log?.('[[icon:cross]] 开发工具操作失败，请重试。', 'warn');
      console.warn('[开发工具] 操作失败。', error);
    }
    return false;
  };
  // 缓存命中仍即时执行同步节点/开关；返回 Promise 统一收住冷入口与异步开战错误。
  let result;
  try { result = devModule ? invoke(devModule) : loadDevModule().then(invoke); }
  catch (error) { result = onFailure(error); }
  const operation = Promise.resolve(result).catch(onFailure).finally(() => releaseEntry(entry));
  entry.promise = operation;
  return operation;
}

export function devForceBattle(...args) { return enterDevTools('devForceBattle', args); }
export function devJumpNode(...args) { return enterDevTools('devJumpNode', args); }
export function openDevConsole() {
  if (activeEntry?.key === 'openDevConsole/' && activeEntry.current()) {
    cancelPendingDevTools();
    return Promise.resolve(false);
  }
  return enterDevTools('openDevConsole', []);
}
