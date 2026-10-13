// Only the small category strip is observed; the photograph grid keeps its own lifecycle.
export function updatePhotoStudioTabMarker(tabs) {
  tabs?.querySelectorAll('.type-tab').forEach(tab => {
    const selected = tab.classList.contains('on');
    tab.setAttribute('aria-selected', String(selected));
    tab.tabIndex = selected ? 0 : -1;
  });
  const active = tabs?.querySelector('.type-tab.on');
  if (!active?.offsetWidth) return;
  tabs.style.setProperty('--studio-tab-x', `${active.offsetLeft}px`);
  tabs.style.setProperty('--studio-tab-y', `${active.offsetTop + active.offsetHeight - 2}px`);
  tabs.style.setProperty('--studio-tab-width', String(active.offsetWidth));
  tabs.dataset.studioMarker = 'ready';
}

export function bindPhotoStudioTabMarker(tabs) {
  if (!tabs) return () => {};
  const view = tabs.ownerDocument.defaultView;
  let disposed = false;
  const update = () => { if (!disposed) updatePhotoStudioTabMarker(tabs); };
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
    observer?.disconnect();
    tabs.removeEventListener('keydown', navigate);
    view?.removeEventListener('resize', update);
  };
}
