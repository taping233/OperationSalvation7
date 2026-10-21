import { saveRunCheckpoint } from '../core/run-checkpoint.js';
import { nodeActionBinding, nodeEventAt } from './node-reward-state.js';
import { createPageSurfaceLifetime } from '../ui/page-surface-lifetime.js';
import { beginPageEntryCancellation, cancelPendingPageEntries, releasePageEntryCancellation } from '../ui/page-entry-cancellation.js';

// The synchronous reward/close path must remain available before the event deck
// implementation loads: restore callers depend on a real boolean, not a promise.
export function createEventLifecycle(ports) {
  const { game, UI, saveGame, nodeShell, nodeOpt, captureRunContext,
    createCardChoice, setBagReturnHook } = ports;
  let request = 0, cardChoices = null;
  const eventSettling = new WeakSet();
  const captureEventContext = () => {
    const generation = request, current = captureRunContext();
    return () => generation === request && current() && game.state !== 'title';
  };
  function beginRequest() {
    if (eventSettling.has(nodeEventAt(game))) return null;
    request++;
    return captureEventContext();
  }
  function captureEventPresentation({ allowClosing = false } = {}) {
    const body = UI.el?.ovBody, root = body?.firstElementChild, overlay = UI.el?.overlay;
    const revision = UI._overlayRevision;
    const closing = () => overlay?.hidden || overlay?.dataset?.uiClosing || overlay?.classList?.contains('closing');
    const mayClear = allowClosing && (closing() || root?.matches?.('.flow-transition'));
    return () => !body || (UI.el?.ovBody === body && UI.el?.overlay === overlay
      && body.isConnected && overlay?.isConnected
      && (body.firstElementChild === root || (mayClear && !body.firstElementChild))
      && (UI._overlayRevision === revision || (mayClear && overlay.hidden && !body.firstElementChild && UI._overlayRevision === revision + 1))
      && (mayClear || !closing()));
  }
  function eventPageBinding(act, current) {
    const active = nodeActionBinding(game, UI, act);
    const surface = UI.el?.ovBody?.firstElementChild;
    return () => current() && active() && (!surface || UI.el?.ovBody?.firstElementChild === surface);
  }
  function eventNodeShell(spec, current = captureEventContext()) {
    nodeShell(spec);
    const body = UI.el?.ovBody, surface = body?.firstElementChild;
    UI.act('eventExit', () => {
      if (current() && game.state === 'modal' && !eventSettling.has(nodeEventAt(game))
        && UI.el?.ovBody === body && (!surface || body.firstElementChild === surface)) closeEventFlow();
    });
  }
  function closeEventFlow() {
    game.state = 'idle';
    if (!saveRunCheckpoint(saveGame)) {
      renderEventSaveRetry();
      return false;
    }
    setBagReturnHook(null);
    UI.hideOverlay();
    UI.refresh(game);
    return true;
  }
  function renderEventSaveRetry() {
    const current = captureEventContext();
    const render = () => {
      if (!current()) return;
      game.state = 'modal';
      eventNodeShell({ tone:'event', icon:'[[icon:notes]]', title:'事件进度尚未保存',
        sub:'本局已完成的领取、花费与投骰结果会保留。请重试保存，成功后返回地图。',
        body:nodeOpt('eventSaveRetry', '重试保存并返回地图', '本次操作只保存进度，不重新结算') });
      const active = eventPageBinding('eventSaveRetry', current);
      setBagReturnHook(render);
      UI.act('eventSaveRetry', () => { if (active()) closeEventFlow(); });
      UI.refresh(game);
    };
    render();
  }
  function eventCardChoiceController() {
    return cardChoices ||= createCardChoice({
      game, UI, saveGame, getActiveSlot:ports.getActiveSlot, nodeShell,
      grantEventCard:ports.grantEventCard, consumeCurrentCell:ports.consumeCurrentCell,
      openFixedRewardsOnCell:ports.openFixedRewardsOnCell,
      captureContext:captureEventContext, close:closeEventFlow,
    });
  }
  return { beginRequest, invalidate:current => { if (!current || current()) request++; }, captureEventContext,
    eventSettling, captureEventPresentation, eventPageBinding, eventNodeShell, closeEventFlow, eventCardChoiceController,
    resumeEventCardChoice:() => eventCardChoiceController().resume() };
}

// Loading owns only its temporary page. Once the deck is ready, the existing
// event/transition controller takes over with the original request context.
export function createLazyEventEntry({ game, UI, nodeShell, lifecycle, load, create,
  setBagReturnHook, timeout = 10000 }) {
  let modulePromise = null, controller = null, pending = null;
  function loadModule() {
    if (!modulePromise) {
      const loading = Promise.resolve().then(load);
      const retryable = loading.catch(error => {
        if (modulePromise === retryable) modulePromise = null;
        throw error;
      });
      modulePromise = retryable;
    }
    return modulePromise;
  }
  function runEventDeck() {
    if (pending?.owns()) return pending.promise;
    const current = lifecycle.beginRequest();
    if (!current || !current()) return Promise.resolve(false);
    pending?.cancel(false);
    cancelPendingPageEntries();
    if (lifecycle.resumeEventCardChoice()) return Promise.resolve(true);
    if (controller) return Promise.resolve(controller.runEventDeck(current));

    game.state = 'modal';
    setBagReturnHook(null);
    nodeShell({ tone:'event', icon:'[[icon:notes]]', title:'正在进入事件',
      sub:'正在准备事件内容，候选与节点进度保持不变。',
      body:'<button class="ov-btn" data-act="eventEntryCancel" data-cancel="true">返回地图</button>' });
    const body = UI.el?.ovBody, root = body?.firstElementChild;
    const overlay = UI.el?.overlay, revision = UI._overlayRevision;
    let timer, surfaceLifetime, finish, active = true;
    const cancelled = new Promise(resolve => { finish = resolve; });
    const entry = {
      promise:null,
      owns:() => active && pending === entry && current() && game.state === 'modal'
        && UI.el?.ovBody === body && (!body || body.firstElementChild === root)
        && UI.el?.overlay === overlay && UI._overlayRevision === revision
        && (!surfaceLifetime || surfaceLifetime.current()),
      cancel(restore = true) {
        if (!active || pending !== entry) return false;
        const owned = entry.owns();
        cleanup();
        lifecycle.invalidate(current);
        finish(false);
        if (restore && owned) {
          game.state = 'idle';
          UI.hideOverlay();
          UI.refresh(game);
        }
        return owned;
      },
    };
    const cleanup = () => {
      active = false;
      clearTimeout(timer);
      surfaceLifetime?.dispose();
      releasePageEntryCancellation('event', cancelEntry);
      if (pending === entry) pending = null;
    };
    const cancelEntry = () => entry.cancel();
    const failure = () => {
      if (!entry.owns()) { entry.cancel(false); return false; }
      cleanup();
      nodeShell({ tone:'event', icon:'[[icon:notes]]', title:'事件载入未完成',
        sub:'节点与已保存的候选均已保留。可以重试，或先返回地图。',
        body:'<button class="ov-btn ok" data-act="eventEntryRetry">重试载入</button>'
          + '<button class="ov-btn" data-act="eventEntryCancel" data-cancel="true">返回地图</button>' });
      const retryCurrent = lifecycle.eventPageBinding('eventEntryRetry', current);
      UI.act('eventEntryRetry', () => { if (retryCurrent()) return runEventDeck(); });
      const leave = () => {
        if (!retryCurrent()) return false;
        lifecycle.invalidate(current);
        game.state = 'idle'; UI.hideOverlay(); UI.refresh(game);
        return true;
      };
      UI.act('eventEntryCancel', leave);
      UI.act('eventExit', leave);
      return false;
    };
    pending = entry;
    beginPageEntryCancellation('event', cancelEntry);
    UI.act('eventEntryCancel', cancelEntry);
    UI.act('eventExit', cancelEntry);
    if (overlay?.nodeType && root?.nodeType) {
      surfaceLifetime = createPageSurfaceLifetime(root, { overlay, getRevision:() => UI._overlayRevision,
        onInvalidate:() => entry.cancel(false) });
    }
    const loading = loadModule();
    const timedOut = new Promise(resolve => {
      timer = setTimeout(() => {
        if (modulePromise === loading) modulePromise = null;
        resolve(false);
      }, timeout);
    });
    entry.promise = (async () => {
      let page;
      try { page = await Promise.race([loading, timedOut, cancelled]); }
      catch { return failure(); }
      if (!entry.owns()) { entry.cancel(false); return false; }
      if (!page) return failure();
      // Release the loader surface before enterNode replaces it. The context
      // remains live and is checked again after that controller's own awaits.
      try { controller ||= create(page); }
      catch {
        if (modulePromise === loading) modulePromise = null;
        return failure();
      }
      cleanup();
      return controller.runEventDeck(current);
    })();
    return entry.promise;
  }
  return { runEventDeck, resumeEventCardChoice:() => {
    pending?.cancel(false);
    return lifecycle.resumeEventCardChoice();
  },
    cancel:() => pending?.cancel() || false };
}
