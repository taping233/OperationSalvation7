import { beginRuntimeStage, captureRuntimeStageContext } from '../core/runtime-trace-stages.local.js';
import { createPageSurfaceLifetime } from './page-surface-lifetime.js';
import { acquirePageVisualReadiness } from './page-visual-readiness-sharing.js';
import '../../css/page-visual-ready.css';
import { revealTransition, transitionFrame } from './transition-handoff.js';
import { createSilentNodeCut, prepareSilentFilm } from './silent-node-film.js';

let handoff = null;

function visualCover(kind, returning = false, illustrated = true) {
  const cover = document.createElement('div');
  cover.className = `page-visual-handoff${returning ? ' page-visual-return' : ''}`;
  cover.dataset.kind = kind;
  cover.setAttribute('aria-hidden', 'true');
  if (kind==='page' && !returning && illustrated) {
    cover.dataset.handoffProfile='brief';
    cover.append(createSilentNodeCut('loading'));
  }
  return cover;
}

export const visualFrame = transitionFrame;

// Only first-screen representative images are gated; long card lists retain lazy loading.
/** @param {HTMLElement} root @param {{signal?: AbortSignal, extraRoots?: HTMLElement[], background?: Promise<unknown>, timeout?: number, frameReady?: boolean, revisionOwner?: typeof window.SDT.UI}} [options] */
export async function waitPageVisual(root, { signal, extraRoots = [], background, timeout = 1500,
  frameReady = false, revisionOwner = window.SDT?.UI } = {}) {
  const page = root?.id === 'ovBody' ? root.firstElementChild || root : root;
  const revision = revisionOwner?._overlayRevision;
  const current = () => !!root?.isConnected && !!page?.isConnected
    && (root.id !== 'ovBody' || (root.firstElementChild || root) === page)
    && revisionOwner?._overlayRevision === revision;
  if (signal?.aborted) return false;
  if (!frameReady) await visualFrame(signal);
  if (signal?.aborted || !current()) return false;
  let resources;
  let release;
  const deadline = new Promise((/** @type {(value?: void) => void} */ resolve) => { release = resolve; });
  const stop = () => { resources?.release(); release(); };
  signal?.addEventListener('abort', stop, { once: true });
  const timer = setTimeout(stop, timeout);
  try {
    resources = acquirePageVisualReadiness(root, { page, revisionOwner, revision, extraRoots });
    if (signal?.aborted) stop();
    await Promise.race([Promise.all([
      resources.ready,
      background,
      document.fonts?.ready,
    ]), deadline]);
    await visualFrame(signal);
    return !signal?.aborted && current();
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', stop);
    resources?.release();
  }
}

export function cancelPageVisual() { handoff?.cancel(); }

// Battle owns its resource/fallback decision; the shared curtain waits for that
// same mounted stage instead of exposing half-loaded scenery or scanning it twice.
function waitBattlePresentation(stage, signal) {
  return new Promise(resolve => {
    const finish = value => { observer.disconnect(); signal.removeEventListener('abort', stop); resolve(value); };
    const stop = () => finish(false);
    const check = () => {
      if (signal.aborted || !stage.isConnected) finish(false);
      else if (stage.dataset.battleEntry !== 'loading') finish(true);
    };
    const observer = new MutationObserver(check);
    observer.observe(stage, { attributes:true, attributeFilter:['data-battle-entry'] });
    signal.addEventListener('abort', stop, { once:true });
    check();
  });
}

// Prepare the map while the departing scene still covers it. The original
// scene fades once; the transparent shield only owns input through first paint.
export function stageMapReturn(ui, game) {
  cancelPageVisual();
  const controller = new AbortController();
  const run = game.discoveredPairs;
  const overlay = ui.el.overlay;
  overlay.dataset.mapReturn = '';
  const cover = visualCover('panel', true);
  cover.classList.add('page-map-return');
  document.body.append(cover);
  const block = event => {
    if (event.key === 'Escape' || event.altKey) return;
    event.preventDefault(); event.stopImmediatePropagation();
  };
  window.addEventListener('keydown', block, true);
  const current = () => handoff === operation && !controller.signal.aborted
    && game.discoveredPairs === run && game.runActive && !game.battleActive && !game.nestActive;
  let unhide;
  const hidden = new Promise((/** @type {(value?: void) => void} */ resolve) => { unhide = resolve; });
  const cleanup = () => {
    clearTimeout(deadline); observer.disconnect(); controller.abort(); unhide(); cover.remove();
    window.removeEventListener('keydown', block, true);
    if (handoff === operation) {
      delete overlay.dataset.mapReturn;
      handoff = null;
    }
  };
  const operation = { cancel: cleanup };
  handoff = operation;
  const observer = new MutationObserver(() => { if (overlay.hidden) unhide(); });
  observer.observe(overlay, { attributes: true, attributeFilter: ['hidden'] });
  const deadline = setTimeout(cleanup, 4500);
  if (overlay.hidden) unhide();
  const prepared = Promise.resolve().then(() => window.SDT?.Renderer?.prepare?.(game, current, { resetBackdrop:false }))
    .catch(error => { console.error('返回地图视觉准备失败：', error); return false; });
  (async () => {
    try {
      await hidden;
      await prepared;
      await visualFrame(controller.signal);
      if (!current()) return;
      await revealTransition(cover, { signal:controller.signal, isCurrent:current, painted:true,
        onReveal:() => window.removeEventListener('keydown', block, true) });
    } catch (error) { console.error('返回地图视觉准备失败：', error); }
    finally { cleanup(); }
  })();
}

// Preserve the synchronous UI API: only presentation is delayed, never route/save actions.
/** @param {typeof window.SDT.UI} ui @param {() => void} reveal @param {{kind?: string, scene?: HTMLElement, illustrated?: boolean}} [options] */
export function stagePageVisual(ui, reveal, { kind = 'page', scene, illustrated = true } = {}) {
  cancelPageVisual();
  const overlay = ui.el.overlay;
  const body = ui.el.ovBody;
  const source = /** @type {HTMLElement} */ (body.firstElementChild || body);
  const traceContext = captureRuntimeStageContext();
  const settingsTraceContext = traceContext && source.matches?.('.settings-page:not(.sugin-page)') ? traceContext : null;
  const controller = new AbortController();
  const cover = visualCover(kind, false, illustrated);
  if (scene) {
    cover.classList.add('page-visual-scene');
    cover.replaceChildren(scene);
    scene.inert = true;
    for (const element of [scene, ...scene.querySelectorAll('[id], [data-act]')]) {
      element.removeAttribute('id');
      element.removeAttribute('data-act');
    }
  }
  overlay.dataset.visualPending = kind;
  // Retain the scene's existing #overlay styling without duplicating its IDs.
  scene?.querySelectorAll('.silent-node-cut').forEach(cut => cut.classList.add('silent-film-settled'));
  (scene ? overlay : document.body).append(cover);
  const coverFilm=/** @type {HTMLElement} */ (cover.querySelector('.silent-node-cut'));
  const artworkReady=coverFilm && !scene ? prepareSilentFilm(coverFilm,{signal:controller.signal}) : Promise.resolve(true);
  const current = () => handoff === operation && !controller.signal.aborted && lifetime.current();
  const block = event => {
    if (event.key === 'Escape' || event.altKey) return;
    event.preventDefault(); event.stopImmediatePropagation();
  };
  window.addEventListener('keydown', block, true);
  const cleanup = () => {
    controller.abort(); cover.remove(); lifetime.dispose();
    window.removeEventListener('keydown', block, true);
    if (handoff === operation) {
      delete overlay.dataset.visualPending;
      handoff = null;
    }
  };
  const operation = { cancel: cleanup };
  handoff = operation;
  const lifetime = createPageSurfaceLifetime(source, { overlay, getRevision: () => ui._overlayRevision, onInvalidate: cleanup });
  (async () => {
    try {
      await visualFrame(controller.signal);
      // Dedicated city cuts own their cover; avoid stacking a second dark veil over them.
      if (/** @type {HTMLElement} */ (body.parentElement.querySelector('.camp-entry-cut'))) cover.style.visibility = 'hidden';
      // The layout frame above also serves readiness measurement. Do not wait
      // for it twice; waitPageVisual still owns the final presentation frame.
      const finishWait = settingsTraceContext ? beginRuntimeStage('settings-visual-wait', settingsTraceContext) : () => {};
      let ready;
      try { ready = source.matches('.battle-stage')
        ? await waitBattlePresentation(source, controller.signal)
        : await waitPageVisual(body, { signal: controller.signal, background: ui._pageBgReady,
          frameReady: true, revisionOwner: ui }); }
      finally { finishWait(); }
      if (!ready || !current()) return;
      await artworkReady;
      if (!current()) return;
      await revealTransition(cover, { signal:controller.signal, isCurrent:current, painted:true,
        onReveal:() => {
          delete overlay.dataset.visualPending;
          reveal();
          window.removeEventListener('keydown', block, true);
        } });
    } catch (error) {
      console.error('界面视觉准备失败：', error);
    } finally { cleanup(); }
  })();
}

if (import.meta.hot) import.meta.hot.dispose(cancelPageVisual);
