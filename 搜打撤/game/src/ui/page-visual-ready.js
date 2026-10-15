import { mapImageReady } from '../core/map-image-ready.js';
import '../../css/page-visual-ready.css';

let handoff = null;

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
export async function waitPageVisual(root, { signal, extraRoots = [], background, timeout = 1500 } = {}) {
  if (signal?.aborted) return false;
  await visualFrame(signal);
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
export function stageMapReturn(ui, game) {
  cancelPageVisual();
  const controller = new AbortController();
  const run = game.discoveredPairs;
  const overlay = ui.el.overlay;
  const cover = document.createElement('div');
  cover.className = 'page-visual-handoff page-visual-return';
  cover.setAttribute('aria-hidden', 'true');
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
      await new Promise(resolve => {
        const timer = setTimeout(finish, 160);
        function finish() { clearTimeout(timer); controller.signal.removeEventListener('abort', finish); resolve(); }
        controller.signal.addEventListener('abort', finish, { once: true });
      });
    } catch (error) { console.error('返回地图视觉准备失败：', error); }
    finally { cleanup(); }
  })();
}

// Preserve the synchronous UI API: only presentation is delayed, never route/save actions.
export function stagePageVisual(ui, reveal) {
  cancelPageVisual();
  const overlay = ui.el.overlay;
  const body = ui.el.ovBody;
  const source = body.firstElementChild;
  const revision = ui._overlayRevision;
  const controller = new AbortController();
  const cover = document.createElement('div');
  cover.className = 'page-visual-handoff';
  cover.setAttribute('aria-hidden', 'true');
  document.body.append(cover);
  const current = () => handoff === operation && !controller.signal.aborted && !overlay.hidden
    && !overlay.dataset.uiClosing && ui._overlayRevision === revision && body.firstElementChild === source;
  const block = event => {
    if (event.key === 'Escape' || event.altKey) return;
    event.preventDefault(); event.stopImmediatePropagation();
  };
  window.addEventListener('keydown', block, true);
  const cleanup = () => {
    controller.abort(); cover.remove(); observer.disconnect();
    window.removeEventListener('keydown', block, true);
    if (handoff === operation) handoff = null;
  };
  const operation = { cancel: cleanup };
  handoff = operation;
  const observer = new MutationObserver(() => { if (!current()) cleanup(); });
  observer.observe(overlay, { attributes: true, attributeFilter: ['hidden', 'data-ui-closing'] });
  observer.observe(body, { childList: true });
  (async () => {
    try {
      await visualFrame(controller.signal);
      // Dedicated city cuts own their cover; avoid stacking a second dark veil over them.
      if (body.parentElement.querySelector('.camp-entry-cut')) cover.style.visibility = 'hidden';
      const ready = await waitPageVisual(body, { signal: controller.signal, background: ui._pageBgReady });
      if (!ready || !current()) return;
      reveal();
      window.removeEventListener('keydown', block, true);
      cover.classList.add('leaving');
      await new Promise(resolve => {
        const timer = setTimeout(finish, 160);
        function finish() { clearTimeout(timer); controller.signal.removeEventListener('abort', finish); resolve(); }
        controller.signal.addEventListener('abort', finish, { once: true });
      });
    } catch (error) {
      console.error('界面视觉准备失败：', error);
    } finally { cleanup(); }
  })();
}

if (import.meta.hot) import.meta.hot.dispose(cancelPageVisual);
