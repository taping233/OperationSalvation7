import { reduceMotion } from '../core/motion.js';
import { createCityCut, cityCutDuration, prepareCityCut } from './camp-entry.js';
import '../../css/page-loading.css';
import { waitPageVisual } from './page-visual-ready.js';

let pending = null;

// A second frame lets the loading screen paint before a synchronous page mounts.
// The timeout also lets a background or suspended preview finish opening.
function nextFrame(signal) {
  return new Promise(resolve => {
    let frame;
    const finish = () => {
      clearTimeout(timer);
      cancelAnimationFrame(frame);
      signal?.removeEventListener('abort', finish);
      resolve();
    };
    const timer = setTimeout(finish, 150);
    frame = requestAnimationFrame(finish);
    signal?.addEventListener('abort', finish, { once: true });
    if (signal?.aborted) finish();
  });
}

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
  const releaseInput = () => {
    if (released) return;
    released = true;
    window.removeEventListener('keydown', blockKeys, true);
    if (previousBusy === null) busyHost?.removeAttribute('aria-busy');
    else if (previousBusy !== undefined) busyHost?.setAttribute('aria-busy', previousBusy);
  };
  const cleanup = () => {
    cutController.abort();
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
      await nextFrame(signal);
      await nextFrame(signal);
      if (signal?.aborted) return false;
      const prepared = performance.now();
      const result = await Promise.race([Promise.resolve().then(open), cancelled]);
      if (signal?.aborted) return false;
      if (result === false) return false;
      const mounted = performance.now();
      if (result !== false) await Promise.race([
        Promise.all([curtainReady,
          waitPageVisual(document.getElementById('ovBody'), { signal, background: window.SDT?.UI?._pageBgReady })]),
        cancelled,
      ]);
      if (signal?.aborted) return false;
      await nextFrame(signal);
      if (signal?.aborted) return false;
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
        if (result !== false && !signal?.aborted) onRevealStart?.();
        cover.classList.add('leaving');
        releaseInput();
        await Promise.race([new Promise(resolve => setTimeout(resolve, cityCut ? cityCutDuration : 180)), cancelled]);
      } else if (result !== false && !signal?.aborted) {
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
