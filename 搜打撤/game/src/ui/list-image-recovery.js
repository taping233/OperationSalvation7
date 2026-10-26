import { createVisualRecoveryNotice, createVisualResourceRecovery } from './visual-resource-recovery.js';

// One recovery control per browsing surface, outside interactive card faces.
// Probes are created only for actual failures and share a four-request queue.
export function createListImageRecovery({ root, selector = '.hsc-art img[data-asset-key]',
  host = root, current = () => true, source = image => image.getAttribute('src') || '',
  listen = true, onRecovered = /** @type {(image: HTMLImageElement, src: string) => void} */ (() => {}) }) {
  const records = new Map(), queue = [];
  const doc = root.ownerDocument;
  let disposed = false, active = 0, notice = null, pumping = false, pumpQueued = false, retryFocus = false;
  const live = () => !disposed && root.isConnected && current();
  const present = (image, src) => live() && root.contains(image) && source(image) === src;
  const removeNotice = focusImage => {
    if (!notice) return;
    const focused = notice.panel.contains(doc.activeElement)
      || (retryFocus && doc.activeElement === doc.body);
    notice.panel.remove(); notice = null;
    retryFocus = false;
    if (focused && live()) {
      const target = [focusImage?.closest('button,[tabindex="0"]'), ...root.querySelectorAll('button:not(:disabled),[tabindex="0"]')]
        .find(node => node && !node.matches(':disabled') && !node.closest('[hidden],[inert],[aria-hidden="true"]'));
      target?.focus({ preventScroll:true });
    }
  };
  const sync = focusImage => {
    if (!live() || !records.size) { removeNotice(focusImage); return; }
    if (!notice) {
      notice = createVisualRecoveryNotice({ host, label:'', onRetry:retry });
      notice.panel.classList.add('list-image-recovery');
    }
    const waiting = active > 0 || queue.length > 0;
    const label = waiting ? `正在重新加载 ${records.size} 张图片…` : `${records.size} 张图片未能加载`;
    if (notice.message.textContent !== label) notice.message.textContent = label;
    if (notice.button.disabled !== waiting) notice.button.disabled = waiting;
    if (notice.button.hasAttribute('aria-busy') !== waiting) notice.button.toggleAttribute('aria-busy', waiting);
  };
  const schedulePump = () => {
    if (disposed || pumpQueued) return;
    pumpQueued = true;
    queueMicrotask(() => { pumpQueued = false; pump(); });
  };
  const release = record => {
    if (!record.pending) return;
    record.pending = false; active = Math.max(0, active - 1);
    // Removal clears record identity before its recovery emits cancelled.
    // The released slot therefore owns scheduling the next queued image.
    schedulePump();
  };
  const remove = (image, record) => {
    if (records.get(image) !== record) return;
    records.delete(image); release(record); record.recovery.dispose();
  };
  function pump() {
    if (!live() || pumping) return;
    pumping = true;
    try {
      while (active < 4 && queue.length) {
        const [image, record] = queue.shift();
        if (records.get(image) !== record || !present(image, record.src)) continue;
        record.queued = false; record.pending = true; active++;
        record.recovery.load();
      }
    } finally { pumping = false; }
    sync();
  }
  function retry() {
    if (!live()) return;
    retryFocus = !!notice?.panel.contains(doc.activeElement);
    for (const [image, record] of records) {
      if (!present(image, record.src)) { remove(image, record); continue; }
      if (!record.pending && !record.queued) { record.queued = true; queue.push([image, record]); }
    }
    pump();
  }
  const fail = (image, src = source(image)) => {
    if (!image.matches(selector) || !src || !present(image, src)) return;
    const previous = records.get(image);
    if (previous?.src === src) return;
    if (previous) remove(image, previous);
    const record = { src, pending:false, queued:false, recovery:null };
    records.set(image, record);
    image.dataset.visualState = 'unavailable';
    record.recovery = createVisualResourceRecovery({ host, source:src, observe:image, notice:false,
      isCurrent:() => present(image, src) && records.get(image) === record,
      apply:() => { image.setAttribute('src', src); image.dataset.visualState = 'ready'; onRecovered(image, src); },
      onStatus:status => {
        if (records.get(image) !== record || status === 'loading') return;
        release(record);
        if (status === 'ready' || status === 'cancelled') remove(image, record);
        schedulePump(); sync(status === 'ready' ? image : null);
      },
    });
    sync();
  };
  const failed = event => { if (event.target instanceof HTMLImageElement) fail(event.target); };
  const loaded = event => {
    const image = event.target, record = records.get(image);
    if (record && present(image, record.src) && image.naturalWidth > 0) {
      image.dataset.visualState = 'ready'; remove(image, record); sync(image); schedulePump();
    }
  };
  const refresh = () => {
    if (!live()) { dispose(); return; }
    for (const [image, record] of records) if (!present(image, record.src)) remove(image, record);
    if (listen) for (const image of root.querySelectorAll(selector)) {
      if (image.complete && !image.naturalWidth && source(image)) fail(image);
    }
    sync();
  };
  const otherInput = event => {
    if (notice && !notice.panel.contains(event.target)) retryFocus = false;
  };
  function dispose() {
    if (disposed) return;
    disposed = true; observer.disconnect(); queue.length = 0;
    root.removeEventListener('error', failed, true); root.removeEventListener('load', loaded, true);
    root.ownerDocument.removeEventListener('pointerdown', otherInput, true);
    for (const [image, record] of records) remove(image, record);
    removeNotice();
  }
  const observer = new MutationObserver(() => {
    if (!live()) { dispose(); return; }
    for (const [image, record] of records) if (!present(image, record.src)) remove(image, record);
    sync();
  });
  observer.observe(root.ownerDocument, { childList:true, subtree:true });
  observer.observe(root, { attributes:true, subtree:true, attributeFilter:['src','data-lib-src'] });
  root.ownerDocument.addEventListener('pointerdown', otherInput, true);
  if (listen) { root.addEventListener('error', failed, true); root.addEventListener('load', loaded, true); }
  return { fail, refresh, dispose };
}
