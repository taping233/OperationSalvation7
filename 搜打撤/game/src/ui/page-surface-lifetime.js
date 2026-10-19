// Presentation ownership only. Business entry arbitration remains in page-entry-cancellation.
// A detached/replaced/closing destination must never receive an old reveal callback.
export function createPageSurfaceLifetime(page, { overlay = page?.closest('#overlay'), getRevision, onInvalidate } = {}) {
  const controller = new AbortController();
  const revision = getRevision?.();
  const current = () => !controller.signal.aborted && !!page?.isConnected && !!overlay?.isConnected
    && overlay.contains(page) && !overlay.hidden && !overlay.dataset.uiClosing
    && !overlay.classList.contains('closing') && (!getRevision || getRevision() === revision);
  const dispose = () => { observer.disconnect(); controller.abort(); };
  const check = () => {
    if (controller.signal.aborted || current()) return;
    dispose(); onInvalidate?.();
  };
  const observer = new MutationObserver(check);
  if (overlay) {
    observer.observe(overlay, { childList: true, subtree: true, attributes: true,
      attributeFilter: ['hidden', 'data-ui-closing', 'class'] });
    if (overlay.parentElement) observer.observe(overlay.parentElement, { childList: true });
  }
  // Let callers finish wiring their cleanup before rejecting an already invalid host.
  queueMicrotask(check);
  return { current, signal: controller.signal, dispose };
}
