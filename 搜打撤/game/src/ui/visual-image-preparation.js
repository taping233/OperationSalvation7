// Decode promises cannot be aborted. Bind only clearable records so a deadline
// or cancellation can release the detached replacement and its source surface.
function releaseEntry(entry) {
  entry.done = true;
  entry.image.removeEventListener('load', entry.loaded);
  entry.image.removeEventListener('error', entry.failed);
  entry.image = entry.batch = null;
}

function finishBatch(batch, status) {
  if (batch.done) return;
  batch.done = true;
  clearTimeout(batch.timer);
  batch.signal?.removeEventListener('abort', batch.abort);
  for (const entry of batch.entries) {
    if (status === 'unavailable') entry.image.dataset.visualState = 'unavailable';
    releaseEntry(entry);
  }
  batch.entries.clear();
  const resolve = batch.resolve;
  batch.resolve = batch.signal = batch.abort = null;
  resolve(status);
}

function finishEntry(entry, ready) {
  if (entry.done) return;
  const { image, batch } = entry;
  const unchanged = image.getAttribute('src') === entry.src && image.getAttribute('srcset') === entry.srcset;
  if (!unchanged) { finishBatch(batch, 'cancelled'); return; }
  const available = ready && image.naturalWidth > 0;
  image.dataset.visualState = available ? 'ready' : 'unavailable';
  batch.entries.delete(entry);
  releaseEntry(entry);
  if (!available) { finishBatch(batch, 'unavailable'); return; }
  if (!--batch.remaining) finishBatch(batch, 'ready');
}

/** Prepare connected or detached artwork without replacing the displayed image.
 * @param {Element} root @param {{signal?: AbortSignal, timeout?: number}} [options]
 * @returns {Promise<'ready'|'unavailable'|'cancelled'>} */
export function prepareVisualImages(root, { signal, timeout = 2500 } = {}) {
  if (signal?.aborted) return Promise.resolve('cancelled');
  const images = [...root.querySelectorAll('img')];
  if (root.matches('img')) images.unshift(/** @type {HTMLImageElement} */ (root));
  const pending = images.filter(image => image.getAttribute('src') || image.getAttribute('srcset'));
  if (!pending.length) return Promise.resolve('ready');
  return new Promise(resolve => {
    const batch = { entries:new Set(), remaining:pending.length, done:false, signal, resolve, timer:null, abort:null };
    batch.abort = () => finishBatch(batch, 'cancelled');
    signal?.addEventListener('abort', batch.abort, { once:true });
    batch.timer = setTimeout(finishBatch, timeout, batch, 'unavailable');
    for (const image of pending) {
      if (batch.done) break;
      const entry = { image, batch, done:false, decoding:false, src:image.getAttribute('src'),
        srcset:image.getAttribute('srcset'), loaded:null, failed:null };
      entry.loaded = () => { if (!entry.decoding) finishEntry(entry, true); };
      entry.failed = finishEntry.bind(null, entry, false);
      batch.entries.add(entry);
      image.loading = 'eager'; image.decoding = 'async';
      image.addEventListener('load', entry.loaded);
      image.addEventListener('error', entry.failed);
      try {
        const decoded = image.decode?.();
        if (decoded) {
          entry.decoding = true;
          decoded.then(finishEntry.bind(null, entry, true), entry.failed);
        } else if (image.complete) finishEntry(entry, image.naturalWidth > 0);
      } catch { if (image.complete) finishEntry(entry, image.naturalWidth > 0); }
    }
    if (signal?.aborted) batch.abort?.();
  });
}
