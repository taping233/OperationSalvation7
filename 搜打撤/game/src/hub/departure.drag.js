import { scale as uiScale } from '../ui/ui-scale.js';

// Pointer capture keeps one opaque card attached to the hand until release.
export function bindDepartureDrag(pool, bag, { add, remove }) {
  let active = null, frame = 0, suppressClick = false;
  const draw = () => {
    frame = 0;
    if (!active?.clone) return;
    const z = uiScale();
    active.clone.style.left = `${(active.x - active.offsetX) / z}px`;
    active.clone.style.top = `${(active.y - active.offsetY) / z}px`;
  };
  const finish = (event, cancelled = false) => {
    if (!active || event.pointerId !== active.id) return;
    const a = active; active = null;
    if (frame) cancelAnimationFrame(frame); frame = 0;
    a.clone?.remove(); a.source.classList.remove('dep-drag-source');
    bag.classList.remove('drop-here'); pool.classList.remove('drop-here');
    if (a.source.hasPointerCapture?.(a.id)) a.source.releasePointerCapture(a.id);
    if (!a.clone) return;
    suppressClick = true;
    setTimeout(() => { suppressClick = false; }, 0);
    if (cancelled || !pool.isConnected || !bag.isConnected) return;
    const destination = a.from === pool ? bag : pool;
    const r = destination.getBoundingClientRect();
    if (event.clientX >= r.left && event.clientX <= r.right && event.clientY >= r.top && event.clientY <= r.bottom) {
      const key = a.from === pool ? a.source.dataset.stackKey : a.source.dataset.removeKey || a.source.dataset.stackKey;
      (a.from === pool ? add : remove)(key || a.source.dataset.name);
    }
  };
  for (const host of [pool, bag]) {
    host.addEventListener('dragstart', event => event.preventDefault());
    host.addEventListener('click', event => {
      if (suppressClick) { event.preventDefault(); event.stopImmediatePropagation(); }
    }, true);
    host.addEventListener('pointerdown', event => {
      if (event.button !== 0 || active) return;
      const source = event.target.closest('[data-name][draggable="true"]');
      if (!source || !host.contains(source) || source.classList.contains('drained') || source.dataset.canAdd === 'false') return;
      const r = source.getBoundingClientRect();
      active = { source, from:host, id:event.pointerId, sx:event.clientX, sy:event.clientY, x:event.clientX, y:event.clientY, offsetX:event.clientX-r.left, offsetY:event.clientY-r.top, rect:r, clone:null };
      source.setPointerCapture(event.pointerId);
    });
    host.addEventListener('pointermove', event => {
      if (!active || event.pointerId !== active.id) return;
      active.x = event.clientX; active.y = event.clientY;
      if (!active.clone && Math.hypot(active.x-active.sx, active.y-active.sy) < 6) return;
      if (!active.clone) {
        const clone = active.source.cloneNode(true);
        clone.removeAttribute('id'); clone.removeAttribute('data-act'); clone.removeAttribute('tabindex');
        clone.className = 'departure-drag-card'; clone.setAttribute('aria-hidden','true');
        clone.style.width = `${active.rect.width / uiScale()}px`;
        clone.style.height = `${active.rect.height / uiScale()}px`;
        document.body.append(clone); active.clone = clone;
        active.source.classList.add('dep-drag-source');
        (host === pool ? bag : pool).classList.add('drop-here');
      }
      event.preventDefault();
      if (!frame) frame = requestAnimationFrame(draw);
    });
    host.addEventListener('pointerup', event => finish(event));
    host.addEventListener('pointercancel', event => finish(event, true));
    host.addEventListener('lostpointercapture', event => finish(event, true));
  }
}
