import { reduceMotion } from '../core/motion.js';
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
export function runPageLoading({ title, detail, open, signal }) {
  if (signal?.aborted) return Promise.resolve(false);
  if (pending) return pending.promise;
  const cover = document.createElement('section');
  cover.className = 'page-loading';
  cover.setAttribute('role', 'status');
  cover.setAttribute('aria-live', 'polite');
  cover.innerHTML = '<div class="page-loading-copy"><small>WINTER ARCHIVE</small><h2></h2><p></p><div class="page-loading-track" aria-hidden="true"><i></i><i></i><i></i></div></div>';
  cover.querySelector('h2').textContent = title;
  cover.querySelector('p').textContent = detail;
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
        cover.classList.add('leaving');
        await new Promise(resolve => setTimeout(resolve, 180));
      }
      return result;
    } finally {
      signal?.removeEventListener('abort', onAbort);
      cleanup();
    }
  })();
  return operation.promise;
}
