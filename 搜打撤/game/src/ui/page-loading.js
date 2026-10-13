import { reduceMotion } from '../core/motion.js';
import { createCityCut, cityCutDuration } from './camp-entry.js';
import '../../css/page-loading.css';

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
  let released = false;
  const releaseInput = () => {
    if (released) return;
    released = true;
    window.removeEventListener('keydown', blockKeys, true);
    if (previousBusy === null) busyHost?.removeAttribute('aria-busy');
    else if (previousBusy !== undefined) busyHost?.setAttribute('aria-busy', previousBusy);
  };
  const cleanup = () => {
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
      await nextFrame(signal);
      await nextFrame(signal);
      if (signal?.aborted) return false;
      const prepared = performance.now();
      const result = await Promise.race([Promise.resolve().then(open), cancelled]);
      if (signal?.aborted) return false;
      const mounted = performance.now();
      releaseInput();
      await nextFrame(signal);
      if (signal?.aborted) return false;
      if (import.meta.env.DEV && new URLSearchParams(location.search).has('photoFps')) {
        console.info('[page-loading]', JSON.stringify({
          prepareMs: +(prepared - started).toFixed(1), mountMs: +(mounted - prepared).toFixed(1),
          visible: document.visibilityState,
        }));
      }
      if (!reduceMotion()) {
        // 准备期间保留来源画面；就绪后才挂上切幕，避免暂停首帧先遮成黑屏。
        if (cut && result !== false) cover.append(cut);
        // Initialize the destination while it is still covered. Starting it after
        // cleanup would hide an already visible page again and look like a refresh.
        if (result !== false && !signal?.aborted) onRevealStart?.();
        cover.classList.add('leaving');
        await Promise.race([new Promise(resolve => setTimeout(resolve, cityCut ? cityCutDuration : 180)), cancelled]);
      } else if (result !== false && !signal?.aborted) {
        onRevealStart?.();
        if (cityPresentation) cover.classList.add('leaving');
      }
      return result;
    } finally {
      signal?.removeEventListener('abort', onAbort);
      cleanup();
    }
  })();
  return operation.promise;
}
