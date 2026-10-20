import { beginRuntimeStage, captureRuntimeStageContext } from '../core/runtime-trace-stages.local.js';
import { mapImageReady } from '../core/map-image-ready.js';
import { createPageSurfaceLifetime } from './page-surface-lifetime.js';
import { motionTiming, motionReduced } from './motion-presets.js';
import '../../css/page-visual-ready.css';

let handoff = null;

function visualCover(kind, returning = false) {
  const cover = document.createElement('div');
  cover.className = `page-visual-handoff${returning ? ' page-visual-return' : ''}`;
  cover.dataset.kind = kind;
  cover.setAttribute('aria-hidden', 'true');
  if (kind !== 'panel') {
    for (let index = 0; index < 3; index++) {
      const band = document.createElement('i');
      band.style.setProperty('--band', String(index));
      cover.append(band);
    }
  }
  return cover;
}

function finishVisual(signal) {
  if (motionReduced()) return Promise.resolve();
  return new Promise(resolve => {
    const finish = () => { clearTimeout(timer); signal.removeEventListener('abort', finish); resolve(); };
    const timer = setTimeout(finish, motionTiming.handoff + 2 * motionTiming.navigationStagger);
    signal.addEventListener('abort', finish, { once: true });
    if (signal.aborted) finish();
  });
}

export function visualFrame(signal) {
  return new Promise(resolve => {
    let frame;
    let timer;
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      if (frame != null) cancelAnimationFrame(frame);
      signal?.removeEventListener('abort', finish);
      resolve();
    };
    timer = setTimeout(finish, 150);
    signal?.addEventListener('abort', finish, { once: true });
    if (signal?.aborted) finish();
    else frame = requestAnimationFrame(finish);
  });
}

// Only first-screen representative images are gated; long card lists retain lazy loading.
export async function waitPageVisual(root, { signal, extraRoots = [], background, timeout = 1500, frameReady = false } = {}) {
  if (signal?.aborted) return false;
  if (!frameReady) await visualFrame(signal);
  if (signal?.aborted || !root?.isConnected) return false;
  const controller = new AbortController();
  let release;
  const deadline = new Promise(resolve => { release = resolve; });
  const stop = () => { controller.abort(); release(); };
  signal?.addEventListener('abort', stop, { once: true });
  const timer = setTimeout(stop, timeout);
  const images = [];
  for (const host of [root, ...extraRoots]) {
    for (const image of host.querySelectorAll('img')) {
      if (images.length >= 12) break;
      if (!image.src || image.loading === 'lazy' || image.closest('[hidden], .lib-grid, .pool-grid')) continue;
      const rect = image.getBoundingClientRect();
      if (rect.width && rect.height && rect.bottom > 0 && rect.right > 0
        && rect.top < window.innerHeight && rect.left < window.innerWidth) images.push(image);
    }
  }
  try {
    await Promise.race([Promise.all([
      ...images.map(image => mapImageReady(image, { timeout, signal: controller.signal })),
      background,
      document.fonts?.ready,
    ]), deadline]);
    await visualFrame(signal);
    return !signal?.aborted && root.isConnected;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', stop);
    controller.abort();
  }
}

export function cancelPageVisual() { handoff?.cancel(); }

// Returning from a full page can resize the map; retain a veil until its new first frame.
export function stageMapReturn(ui, game, { kind = 'page' } = {}) {
  cancelPageVisual();
  const controller = new AbortController();
  const run = game.discoveredPairs;
  const overlay = ui.el.overlay;
  const cover = visualCover(kind, true);
  if (kind !== 'panel' && ui.el.ovBody.querySelector('.node-pg, .event-scene, .reward-replica, .cqo-overview, .shop-market')) {
    cover.classList.add('node-map-return');
    const label = document.createElement('span');
    label.textContent = '返回探索';
    cover.append(label);
  }
  document.body.append(cover);
  const block = event => {
    if (event.key === 'Escape' || event.altKey) return;
    event.preventDefault(); event.stopImmediatePropagation();
  };
  window.addEventListener('keydown', block, true);
  const current = () => handoff === operation && !controller.signal.aborted
    && game.discoveredPairs === run && game.runActive && !game.battleActive && !game.nestActive;
  let unhide;
  const hidden = new Promise(resolve => { unhide = resolve; });
  const cleanup = () => {
    clearTimeout(deadline); observer.disconnect(); controller.abort(); unhide(); cover.remove();
    window.removeEventListener('keydown', block, true);
    if (handoff === operation) handoff = null;
  };
  const operation = { cancel: cleanup };
  handoff = operation;
  const observer = new MutationObserver(() => { if (overlay.hidden) unhide(); });
  observer.observe(overlay, { attributes: true, attributeFilter: ['hidden'] });
  const deadline = setTimeout(cleanup, 4500);
  if (overlay.hidden) unhide();
  (async () => {
    try {
      await hidden;
      await visualFrame(controller.signal);
      if (!current()) return;
      await window.SDT?.Renderer?.prepare?.(game, current);
      if (!current()) return;
      cover.classList.add('leaving');
      window.removeEventListener('keydown', block, true);
      await finishVisual(controller.signal);
    } catch (error) { console.error('返回地图视觉准备失败：', error); }
    finally { cleanup(); }
  })();
}

// Preserve the synchronous UI API: only presentation is delayed, never route/save actions.
export function stagePageVisual(ui, reveal, { kind = 'page' } = {}) {
  cancelPageVisual();
  const overlay = ui.el.overlay;
  const body = ui.el.ovBody;
  const source = body.firstElementChild || body;
  const traceContext = captureRuntimeStageContext();
  const settingsTraceContext = traceContext && source.matches?.('.settings-page:not(.sugin-page)') ? traceContext : null;
  const controller = new AbortController();
  const cover = visualCover(kind);
  overlay.dataset.visualPending = kind;
  document.body.append(cover);
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
      if (body.parentElement.querySelector('.camp-entry-cut')) cover.style.visibility = 'hidden';
      // The layout frame above also serves readiness measurement. Do not wait
      // for it twice; waitPageVisual still owns the final presentation frame.
      const finishWait = settingsTraceContext ? beginRuntimeStage('settings-visual-wait', settingsTraceContext) : () => {};
      let ready;
      try { ready = await waitPageVisual(body, { signal: controller.signal, background: ui._pageBgReady, frameReady: true }); }
      finally { finishWait(); }
      if (!ready || !current()) return;
      delete overlay.dataset.visualPending;
      reveal();
      window.removeEventListener('keydown', block, true);
      cover.classList.add('leaving');
      await finishVisual(controller.signal);
    } catch (error) {
      console.error('界面视觉准备失败：', error);
    } finally { cleanup(); }
  })();
}

if (import.meta.hot) import.meta.hot.dispose(cancelPageVisual);
