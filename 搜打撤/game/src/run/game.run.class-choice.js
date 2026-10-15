/* 选角轻门面：首次用户请求才下载叶页面；不预取、不持有另一份游戏或档案状态。 */
import { game, getActiveSlot, exitToTitle } from './game.session.js';
import { captureBattleContext } from '../battle/battle-loader.js';
import { runPageLoading } from '../ui/page-loading.js';
import { beginPageEntryCancellation, releasePageEntryCancellation } from '../ui/page-entry-cancellation.js';

let modulePromise = null;
let activeEntry = null;

function loadClassChoice() {
  if (!modulePromise) {
    const loading = import('./game.run.class-choice.page.js').catch(error => {
      if (modulePromise === loading) modulePromise = null;
      throw error;
    });
    modulePromise = loading;
  }
  return modulePromise;
}

function cancelClassChoiceEntry() {
  const entry = activeEntry;
  if (!entry) return false;
  activeEntry = null;
  releasePageEntryCancellation('class-choice', cancelClassChoiceEntry);
  window.removeEventListener('keydown', entry.escape, true);
  entry.controller.abort();
  return !entry.ready;
}

export function openClassChoice(options = {}) {
  if (game.battleActive || game.nestActive || !['idle', 'modal'].includes(game.state) || (options.isCurrent && !options.isCurrent())) return Promise.resolve(false);
  if (activeEntry && activeEntry.current() &&
    activeEntry.initialCharacter === options.initialCharacter && activeEntry.deferred === !!options.onSelect) {
    return activeEntry.promise;
  }
  cancelClassChoiceEntry();
  beginPageEntryCancellation('class-choice', cancelClassChoiceEntry);
  // 未选角的 pending run 不能在下载期间开放地图操作；已经写入的 run 不回滚。
  game.state = 'modal';
  const overlay = document.getElementById('overlay');
  const body = document.getElementById('ovBody');
  const entry = {
    slot: getActiveSlot(), base: window.SDT?.Base, baseSlot: window.SDT?.Base?.slot,
    root: body?.firstElementChild, body, overlayHidden: overlay?.hidden,
    context: captureBattleContext(game, getActiveSlot), myClass: game.myClass, characterId: game.characterId,
    initialCharacter: options.initialCharacter, deferred: !!options.onSelect,
    controller: new AbortController(), ready: false, promise: null, current: null, escape: null,
  };
  activeEntry = entry;
  entry.current = () => activeEntry === entry && !entry.controller.signal.aborted && entry.context() &&
    window.SDT?.Base === entry.base && window.SDT?.Base?.slot === entry.baseSlot &&
    getActiveSlot() === entry.slot && game.state === 'modal' && game.myClass === entry.myClass &&
    game.characterId === entry.characterId && document.getElementById('ovBody') === entry.body &&
    entry.body?.firstElementChild === entry.root && document.getElementById('overlay')?.hidden === entry.overlayHidden &&
    (!options.isCurrent || options.isCurrent());
  entry.escape = event => {
    if (event.key !== 'Escape' || event.repeat || event.isComposing || event.keyCode === 229 || entry.ready) return;
    const current = entry.current();
    cancelClassChoiceEntry();
    event.preventDefault(); event.stopImmediatePropagation();
    if (!current) return;
    if (options.onCancel) options.onCancel();
    else if (!options.recoveringRun) exitToTitle();
  };
  window.addEventListener('keydown', entry.escape, true);
  const open = async () => {
    const page = await loadClassChoice();
    if (!entry.current()) {
      if (activeEntry === entry) cancelClassChoiceEntry();
      return false;
    }
    const result = page.openClassChoice(options);
    if (result !== false) options.onPresented?.();
    entry.ready = result !== false;
    window.removeEventListener('keydown', entry.escape, true);
    return result;
  };
  const loading = runPageLoading({ title: '人物选择', detail: '正在准备人物与职业卡池',
    signal: entry.controller.signal, open });
  entry.promise = loading.catch(error => {
    if (activeEntry === entry && entry.current()) {
      window.SDT?.UI?.log?.('人物选择载入失败，请重试；已有进度已保留。', 'warn');
      console.warn('[选角] 页面载入失败，可再次重试。', error);
      // 普通基地入口保留原按钮；读档由选档消费方回到可重试入口。
      // 直接 newRun 没有来源按钮，提供重试，不再次准备出征或重建局内状态。
      if (!options.onCancel && !options.recoveringRun) {
        const UI = window.SDT?.UI;
        UI?.showOverlay('', '<div class="pg"><h2>人物选择暂未打开</h2><p>当前对局已保留，可以重试。</p><button class="ov-btn" data-act="retryClassChoice">重试人物选择</button><button class="ov-btn" data-act="cancelClassChoice">返回标题</button></div>', 'page');
        const currentContext = captureBattleContext(game, getActiveSlot);
        UI?.act('retryClassChoice', () => currentContext() && openClassChoice(options));
        UI?.act('cancelClassChoice', () => { if (currentContext()) exitToTitle(); });
      }
    }
    return false;
  }).finally(() => {
    window.removeEventListener('keydown', entry.escape, true);
    if (activeEntry === entry) {
      activeEntry = null;
      releasePageEntryCancellation('class-choice', cancelClassChoiceEntry);
    }
  });
  return entry.promise;
}
