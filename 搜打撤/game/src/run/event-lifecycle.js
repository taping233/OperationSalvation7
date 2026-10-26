import { saveRunCheckpoint } from '../core/run-checkpoint.js';
import { beginRoomSave } from '../ui/room-footer.js';
import { nodeActionBinding, nodeEventAt } from './node-reward-state.js';
import { createPageSurfaceLifetime } from '../ui/page-surface-lifetime.js';
import { beginPageEntryCancellation, cancelPendingPageEntries, releasePageEntryCancellation } from '../ui/page-entry-cancellation.js';

// The eager reward/close path remains available before the event deck loads.
// Closing now awaits the actual persisted checkpoint before releasing its page.
export function createEventLifecycle(ports) {
  const { game, UI, saveGame, nodeShell, nodeOpt, captureRunContext,
    createCardChoice, setBagReturnHook } = ports;
  let request = 0, cardChoices = null, closing = null;
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
  function eventPageBinding(act, current) {
    const active = nodeActionBinding(game, UI, act);
    const surface = UI.el?.ovBody?.firstElementChild;
    return () => current() && active() && (!surface || UI.el?.ovBody?.firstElementChild === surface);
  }
  function eventNodeShell(spec, current = captureEventContext()) {
    nodeShell(spec);
    const body = UI.el?.ovBody, surface = body?.firstElementChild;
    UI.act('eventExit', () => {
      if (!current() || game.state !== 'modal' || eventSettling.has(nodeEventAt(game))
        || UI.el?.ovBody !== body || (surface && body.firstElementChild !== surface)) return false;
      return closeEventFlow();
    });
  }
  function closeEventFlow() {
    if (closing?.ownsPage()) return closing.promise;
    const current = captureEventContext();
    if (!current()) return false;
    const body = UI.el?.ovBody, source = body?.firstElementChild;
    const overlay = UI.el?.overlay, revision = UI._overlayRevision;
    let savingSurface = null;
    const ownsPage = () => current() && UI.el?.ovBody === body && (!body || body.firstElementChild === source || (!source && body.firstElementChild === savingSurface))
      && UI.el?.overlay === overlay && UI._overlayRevision === revision;
    game.state = 'modal';
    const flight = { ownsPage, promise:null };
    closing = flight;
    // Publish the promise before calling storage: even a synchronous save port
    // can re-enter an action, and must join this departure rather than save twice.
    flight.promise = Promise.resolve().then(async () => {
      if (!ownsPage()) return false;
      const finishSave = beginRoomSave(source || body);
      // The saving indicator may be the only child when returning from a closed reward page.
      if (!source) savingSurface = body?.firstElementChild;
      try {
        const saved = await saveRunCheckpoint(saveGame);
        if (!ownsPage()) return false;
        if (!saved) {
          renderEventSaveRetry(current);
          return false;
        }
        game.state = 'idle';
        // Persistence has completed. Presentation failures cannot turn this
        // departure into another settlement/save attempt in an awaiting caller.
        try { setBagReturnHook(null); }
        catch (error) { console.warn('[event] 进度已保存，返回入口清理未完成', error); }
        try { UI.hideOverlay(); }
        catch (error) { console.warn('[event] 进度已保存，关闭事件页未完成', error); }
        try { UI.refresh(game); }
        catch (error) { console.warn('[event] 进度已保存，界面刷新未完成', error); }
        return true;
      } finally {
        try { finishSave(); }
        catch (error) { console.warn('[event] 保存等待状态清理未完成', error); }
      }
    }).finally(() => { if (closing === flight) closing = null; });
    return flight.promise;
  }
  function renderEventSaveRetry(current = captureEventContext()) {
    const render = () => {
      if (!current()) return false;
      game.state = 'modal';
      eventNodeShell({ tone:'event', icon:'[[icon:notes]]', title:'事件进度尚未保存',
        sub:'本局已完成的领取、花费与投骰结果会保留。请重试保存，成功后返回地图。',
        body:nodeOpt('eventSaveRetry', '重试保存并返回地图', '本次操作只保存进度，不重新结算') }, current);
      const active = eventPageBinding('eventSaveRetry', current);
      setBagReturnHook(render);
      UI.act('eventSaveRetry', () => active() ? closeEventFlow() : false);
      try { UI.refresh(game); }
      catch (error) { console.warn('[event] 保存重试入口已就绪，界面刷新未完成', error); }
      return true;
    };
    return render();
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
    eventSettling, eventPageBinding, eventNodeShell, closeEventFlow, eventCardChoiceController,
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
      foot:'<button class="ov-btn" data-act="eventEntryCancel" data-cancel="true">返回地图</button>' });
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
        foot:'<button class="ov-btn ok" data-act="eventEntryRetry">重试载入</button>'
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
