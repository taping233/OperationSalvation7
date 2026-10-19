import { reduceMotion } from '../core/motion.js';
import { createCityCut, cityCutDuration, prepareCityCut } from './camp-entry.js';
import '../../css/page-loading.css';
import { waitPageVisual, visualFrame } from './page-visual-ready.js';
import { createPageSurfaceLifetime } from './page-surface-lifetime.js';

let pending = null;

/** Show the shared page cover before preparing an expensive destination. */
export function runPageLoading({ title, detail, open, signal, presentation, onRevealStart }) {
  if (signal?.aborted) return Promise.resolve(false);
  if (pending) return pending.promise;
  const cover = document.createElement('section');
  cover.className = 'page-loading';
  cover.setAttribute('role', 'status');
  cover.setAttribute('aria-live', 'polite');
  const cityPresentation = presentation === 'city-cut';
  const cityCut = cityPresentation && !reduceMotion();
  let cut = null;
  if (cityPresentation) {
    cover.classList.add('page-loading--city');
    cover.dataset.loadingDetail = detail;
    cover.setAttribute('aria-label', `${title}：${detail}`);
    if (cityCut) cut = createCityCut({ archive: '馆藏档案', title,
      subtitle: 'PHOTO STUDIO / 冬日影像档案', edition: 'WINTER RECORDS / VII',
      destination: 'PHOTO STUDIO', watermark: 'PHOTO', scene: 'photo' });
    if (cut) { cut.classList.add('page-cut-waiting'); cover.append(cut); }
  } else {
    cover.innerHTML = '<div class="page-loading-copy"><small>WINTER ARCHIVE</small><h2></h2><p></p><div class="page-loading-track" aria-hidden="true"><i></i><i></i><i></i></div></div>';
    cover.querySelector('h2').textContent = title;
    cover.querySelector('p').textContent = detail;
  }
  document.body.appendChild(cover);
  const busyHost = document.getElementById('viewport');
  const previousBusy = busyHost?.getAttribute('aria-busy');
  busyHost?.setAttribute('aria-busy', 'true');
  // Keep keyboard input from acting on the covered source page during mounting.
  const blockKeys = e => {
    // Escape and quick navigation retain the facade's existing cancellation contract.
    if (e.key === 'Escape' || e.altKey) return;
    e.preventDefault(); e.stopImmediatePropagation();
  };
  window.addEventListener('keydown', blockKeys, true);
  const started = performance.now();
  const operation = { promise: null };
  pending = operation;
  const cutController = new AbortController();
  let released = false;
  let surface = null;
  const releaseInput = () => {
    if (released) return;
    released = true;
    window.removeEventListener('keydown', blockKeys, true);
    if (previousBusy === null) busyHost?.removeAttribute('aria-busy');
    else if (previousBusy !== undefined) busyHost?.setAttribute('aria-busy', previousBusy);
  };
  const cleanup = () => {
    cutController.abort();
    surface?.dispose();
    cover.remove();
    releaseInput();
    if (pending === operation) pending = null;
  };
  let cancel;
  const cancelled = new Promise(resolve => { cancel = resolve; });
  const onAbort = () => { cleanup(); cancel(false); };
  signal?.addEventListener('abort', onAbort, { once: true });
  operation.promise = (async () => {
    try {
      // Artwork loading and destination preparation overlap under the painted
      // curtain; neither can reveal the page before the other is ready.
      const curtainReady = cut ? prepareCityCut(cut, { signal: cutController.signal }) : Promise.resolve(true);
      await visualFrame(cutController.signal);
      await visualFrame(cutController.signal);
      if (signal?.aborted) return false;
      const prepared = performance.now();
      const result = await Promise.race([Promise.resolve().then(open), cancelled]);
      if (signal?.aborted) return false;
      if (result === false) return false;
      const mounted = performance.now();
      const body = document.getElementById('ovBody');
      // Non-overlay clients keep the existing loading-only contract.
      // Overlay clients bind readiness and reveal to the exact mounted page.
      if (body) surface = createPageSurfaceLifetime(body.firstElementChild || body, { onInvalidate: onAbort });
      const current = () => !cutController.signal.aborted && (!surface || surface.current());
      const ready = await Promise.race([
        Promise.all([curtainReady, body
          ? waitPageVisual(body, { signal: cutController.signal, background: window.SDT?.UI?._pageBgReady })
          : true]), cancelled,
      ]);
      if (!ready || !ready.every(Boolean) || !current()) return false;
      await visualFrame(cutController.signal);
      if (!current()) return false;
      if (import.meta.env.DEV && new URLSearchParams(location.search).has('photoFps')) {
        console.info('[page-loading]', JSON.stringify({
          prepareMs: +(prepared - started).toFixed(1), mountMs: +(mounted - prepared).toFixed(1),
          visible: document.visibilityState,
        }));
      }
      if (!reduceMotion()) {
        // The ready curtain has already painted; reveal only after the destination
        // and its first-screen resources have settled underneath it.
        if (cut && result !== false) cut.classList.remove('page-cut-waiting');
        // Initialize the destination while it is still covered. Starting it after
        // cleanup would hide an already visible page again and look like a refresh.
        if (current()) onRevealStart?.();
        cover.classList.add('leaving');
        releaseInput();
        await Promise.race([new Promise(resolve => setTimeout(resolve, cityCut ? cityCutDuration : 180)), cancelled]);
      } else if (current()) {
        onRevealStart?.();
        if (cityPresentation) cover.classList.add('leaving');
        releaseInput();
      }
      return result;
    } finally {
      signal?.removeEventListener('abort', onAbort);
      cleanup();
    }
  })();
  return operation.promise;
}
