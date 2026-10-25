import { reduceMotion } from '../core/motion.js';
import { createCityCut, prepareCityCut } from './camp-entry.js';
import { revealTransition } from './transition-handoff.js';
import '../../css/page-loading.css';
import { waitPageVisual, visualFrame } from './page-visual-ready.js';
import { createPageSurfaceLifetime } from './page-surface-lifetime.js';

let pending = null;

/** Own cold-entry input/readiness; illustrated cuts require an explicit scene entry. */
/** @param {{title: string, detail: string, open: () => unknown, prepare?: (signal: AbortSignal) => unknown, signal?: AbortSignal, presentation?: string, onRevealStart?: () => void}} options */
export function runPageLoading({ title, detail, open, prepare, signal, presentation, onRevealStart }) {
  if (signal?.aborted) return Promise.resolve(false);
  if (pending) return pending.promise;
  const cover = document.createElement('section');
  cover.className = 'page-loading';
  cover.setAttribute('role', 'status');
  cover.setAttribute('aria-live', 'polite');
  const cityCut = !reduceMotion();
  let cut = null;
  cover.classList.add('page-loading--city');
  if (presentation!=='city-cut') cover.dataset.handoffProfile='brief';
  cover.dataset.loadingDetail = detail;
  cover.setAttribute('aria-label', `${title}：${detail}`);
  if (cityCut) cut = createCityCut({ archive: '馆藏档案', title,
    subtitle: 'PHOTO STUDIO / 冬日影像档案', edition: 'WINTER RECORDS / VII',
    destination: 'PHOTO STUDIO', watermark: 'PHOTO', scene: presentation==='city-cut' ? 'photo' : 'loading' });
  if (cut) {
    if (presentation!=='city-cut') {
      cut.dataset.filmDuration='160';
      cut.style.setProperty('--silent-film-duration','160ms');
    }
    cut.classList.add('page-cut-waiting'); cover.append(cut);
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
      // Page adapters may supply their richer, page-specific artwork to this
      // existing cover. Keep that image instead of overwriting it with general art.
      const activeCut = /** @type {HTMLElement} */ (cover.querySelector('.camp-entry-cut'));
      const artworkReady = activeCut && activeCut !== cut
        ? prepareCityCut(activeCut, { signal:cutController.signal }) : curtainReady;
      // Non-overlay clients keep the existing loading-only contract.
      // Overlay clients bind readiness and reveal to the exact mounted page.
      if (body) surface = createPageSurfaceLifetime(/** @type {HTMLElement} */ (body.firstElementChild || body), { onInvalidate: onAbort });
      const current = () => !cutController.signal.aborted && (!surface || surface.current());
      const ready = await Promise.race([
        Promise.all([artworkReady, body
          ? waitPageVisual(body, { signal: cutController.signal, background: window.SDT?.UI?._pageBgReady })
          : true, prepare ? Promise.resolve().then(() => prepare(cutController.signal)).then(result => result !== false) : true]), cancelled,
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
      await revealTransition(cover, { signal:cutController.signal, isCurrent:current, painted:true,
        onReveal:() => {
          cut?.classList.remove('page-cut-waiting');
          onRevealStart?.();
          releaseInput();
        } });
      return result;
    } finally {
      signal?.removeEventListener('abort', onAbort);
      cleanup();
    }
  })();
  return operation.promise;
}
