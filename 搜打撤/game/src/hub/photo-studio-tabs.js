// Coalesce page construction, filters and resize into one read-before-write pass.
const pendingMarkers = new WeakMap();
const markerGeometry = new WeakMap();
function paintPhotoStudioTabMarker(tabs, refresh) {
  const active = tabs?.querySelector('.type-tab.on');
  if (!active) return;
  let geometry = markerGeometry.get(tabs);
  if (refresh || !geometry?.has(active)) {
    geometry = new Map([...tabs.querySelectorAll('.type-tab')].map(tab => [tab, {
      width: tab.offsetWidth, left: tab.offsetLeft, top: tab.offsetTop, height: tab.offsetHeight,
    }]));
    markerGeometry.set(tabs, geometry);
  }
  const { width, left, top, height } = geometry.get(active);
  if (!width) return;
  tabs?.querySelectorAll('.type-tab').forEach(tab => {
    const selected = tab.classList.contains('on');
    tab.setAttribute('aria-selected', String(selected));
    tab.tabIndex = selected ? 0 : -1;
  });
  tabs.style.setProperty('--studio-tab-x', `${left}px`);
  tabs.style.setProperty('--studio-tab-y', `${top + height - 2}px`);
  tabs.style.setProperty('--studio-tab-width', String(width));
  tabs.dataset.studioMarker = 'ready';
}

export function updatePhotoStudioTabMarker(tabs, refresh = false) {
  if (!tabs) return;
  const pending = pendingMarkers.get(tabs);
  if (pending) { pending.refresh ||= refresh; return; }
  const view = tabs.ownerDocument.defaultView;
  if (!view?.requestAnimationFrame) { paintPhotoStudioTabMarker(tabs, refresh); return; }
  const work = { frame: 0, refresh };
  const frame = view.requestAnimationFrame(() => {
    if (pendingMarkers.get(tabs) !== work) return;
    pendingMarkers.delete(tabs);
    if (tabs.isConnected) paintPhotoStudioTabMarker(tabs, work.refresh);
  });
  work.frame = frame;
  pendingMarkers.set(tabs, work);
}

export function bindPhotoStudioTabMarker(tabs) {
  if (!tabs) return () => {};
  const view = tabs.ownerDocument.defaultView;
  let disposed = false;
  const update = () => { if (!disposed) updatePhotoStudioTabMarker(tabs, true); };
  const navigate = event => {
    if (event.isComposing || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    const buttons = [...tabs.querySelectorAll('.type-tab')];
    const current = buttons.indexOf(event.target.closest('.type-tab'));
    if (current < 0) return;
    const index = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 :
      (current + (event.key === 'ArrowRight' ? 1 : -1) + buttons.length) % buttons.length;
    event.preventDefault();
    event.stopPropagation();
    buttons[index].focus({ preventScroll: true });
    buttons[index].click();
  };
  tabs.addEventListener('keydown', navigate);
  const observer = typeof view?.ResizeObserver === 'function' ? new view.ResizeObserver(update) : null;
  observer?.observe(tabs);
  tabs.querySelectorAll('.type-tab').forEach(tab => observer?.observe(tab));
  view?.addEventListener('resize', update);
  update();
  return () => {
    disposed = true;
    const work = pendingMarkers.get(tabs);
    if (work) view?.cancelAnimationFrame?.(work.frame);
    pendingMarkers.delete(tabs);
    markerGeometry.delete(tabs);
    observer?.disconnect();
    tabs.removeEventListener('keydown', navigate);
    view?.removeEventListener('resize', update);
  };
}
