// Only the explicitly installed, app-owned panel joins the active modal surface.
// Keep this bridge independent of the lazy recorder and the UI implementation.
const panels = new WeakMap();

export function registerRuntimeTracePanel(panel) {
  const doc = panel.ownerDocument;
  panels.set(doc, panel);
  syncRuntimeTracePanel(doc.getElementById('overlay'));
  return () => { if (panels.get(doc) === panel) panels.delete(doc); };
}

export function syncRuntimeTracePanel(overlay) {
  const panel = panels.get(overlay?.ownerDocument);
  if (!panel?.isConnected) return;
  const activeDialog = !overlay.hidden && overlay.getAttribute('role') === 'dialog'
    && overlay.getAttribute('aria-modal') === 'true';
  const parent = activeDialog ? overlay : overlay.ownerDocument.body;
  if (panel.parentElement !== parent) parent.append(panel);
}

export function getOverlayRuntimeTracePanel(overlay) {
  const panel = panels.get(overlay?.ownerDocument);
  return panel?.isConnected && panel.parentElement === overlay ? panel : null;
}
