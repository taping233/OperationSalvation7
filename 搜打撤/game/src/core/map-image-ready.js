// Warm actual renderer images; failed resources keep their existing fallback presentation.
export function mapImageReady(image, { timeout = 3000, signal } = {}) {
  if (!image) return Promise.resolve(false);
  return new Promise(resolve => {
    let timer;
    let settled = false;
    const finish = ready => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      image.removeEventListener?.('load', loaded);
      image.removeEventListener?.('error', failed);
      signal?.removeEventListener('abort', failed);
      resolve(ready);
    };
    const loaded = () => finish(image.naturalWidth > 0);
    const failed = () => finish(false);
    timer = setTimeout(failed, timeout);
    signal?.addEventListener('abort', failed, { once: true });
    if (signal?.aborted) { failed(); return; }
    if (typeof image.decode === 'function') image.decode().then(() => finish(image.naturalWidth > 0), failed);
    else if (image.complete) loaded();
    else {
      image.addEventListener?.('load', loaded, { once: true });
      image.addEventListener?.('error', failed, { once: true });
    }
  });
}
