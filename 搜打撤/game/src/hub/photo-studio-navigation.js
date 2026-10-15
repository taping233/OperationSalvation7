import { trackLinkedAnimation } from '../ui/home-linked-interactions.js';
import { motionTiming, motionEasing } from '../ui/motion-presets.js';
// Browsing history belongs to a filter context, never to an array index.
export function createPhotoStudioBrowseHistory() {
  const contexts = new Map();
  const key = filters => JSON.stringify([
    filters.tab, filters.rar, filters.cls, filters.q.trim().toLowerCase(), filters.sort,
  ]);
  return {
    remember(filters, position) {
      const id = key(filters);
      contexts.delete(id);
      contexts.set(id, { ...position });
      if (contexts.size > 64) contexts.delete(contexts.keys().next().value);
    },
    restore(filters, cards) {
      const position = contexts.get(key(filters));
      if (!position) return null;
      const ids = new Set(cards.map(card => card.id));
      const selectedId = ids.has(position.selectedId) ? position.selectedId : cards[0]?.id || null;
      const anchorExists = ids.has(position.anchorId);
      return {
        ...position, selectedId,
        anchorId: anchorExists ? position.anchorId : selectedId,
        offset: anchorExists ? position.offset : 0,
      };
    },
  };
}

// WAAPI keeps rapid changes interruptible; only the affected visible surface moves.
export function createPhotoStudioMotion() {
  const active = new Map();
  const snapshots = new Set();
  const reduced = node => node.ownerDocument.body.classList.contains('reduce-motion') ||
    node.ownerDocument.defaultView?.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  function cancel(node) {
    const animation = active.get(node);
    active.delete(node);
    animation?.cancel();
    if (snapshots.delete(node)) node.remove();
  }
  return {
    leaveGrid(grid, { reason, direction = 0 }) {
      for (const snapshot of snapshots) cancel(snapshot);
      if (reason !== 'tab' || !grid?.animate || reduced(grid) || !grid.parentElement) return;
      const rect = grid.getBoundingClientRect();
      const parentRect = grid.parentElement.getBoundingClientRect();
      const scale = rect.height / grid.offsetHeight || 1;
      const layer = grid.ownerDocument.createElement('div');
      layer.className = 'lib-grid studio-grid-exit';
      layer.setAttribute('aria-hidden', 'true');
      layer.inert = true;
      Object.assign(layer.style, {
        position: 'absolute', display: 'block', overflow: 'hidden', pointerEvents: 'none', zIndex: '4',
        left: `${(rect.left - parentRect.left) / scale}px`, top: `${(rect.top - parentRect.top) / scale}px`,
        width: `${grid.clientWidth}px`, height: `${grid.clientHeight}px`,
      });
      layer.style.setProperty('padding', '0', 'important');
      let count = 0;
      for (const tile of grid.children) {
        if (!tile.classList.contains('lib-item') || tile.classList.contains('lib-ph')) continue;
        const bounds = tile.getBoundingClientRect();
        if (bounds.bottom <= rect.top || bounds.top >= rect.bottom) continue;
        const copy = tile.cloneNode(true);
        Object.assign(copy.style, {
          position: 'absolute', left: `${(bounds.left - rect.left) / scale}px`,
          top: `${(bounds.top - rect.top) / scale}px`, width: `${bounds.width / scale}px`,
          height: `${bounds.height / scale}px`, contentVisibility: 'visible',
        });
        copy.querySelectorAll('[data-act]').forEach(button => { button.removeAttribute('data-act'); button.tabIndex = -1; });
        layer.appendChild(copy);
        if (++count === 24) break;
      }
      if (!count) return;
      grid.parentElement.appendChild(layer);
      snapshots.add(layer);
      const animation = layer.animate([
        { opacity: 1, transform: 'translateX(0)' },
        { opacity: 0, transform: `translateX(${-Math.sign(direction) * 10}px)` },
      ], { duration: motionTiming.fastExit, easing: motionEasing.exit });
      active.set(layer, trackLinkedAnimation(animation));
      const release = () => cancel(layer);
      animation.finished.then(release, release);
    },
    play(node, { reason = 'filter', direction = 0, axis = 'x', delay = 0, surface = 'grid', width } = {}) {
      if (!node) return;
      cancel(node);
      delete node.dataset.studioMotion;
      delete node.dataset.surfaceRole;
      delete node.dataset.surfaceBlock;
      if (!node.animate || reduced(node)) return;
      const duration = reason === 'tab' || reason === 'step' ? motionTiming.change : motionTiming.feedback;
      const distance = Math.sign(direction) * 10;
      const x = axis === 'x' ? distance : 0;
      const y = axis === 'y' ? distance : direction ? 0 : 3;
      let frames = [
        { opacity: reason === 'hover' ? .9 : .72, transform: `translate(${x}px,${y}px)` },
        { opacity: 1, transform: 'translate(0,0)' },
      ];
      if (surface === 'dossier') {
        frames = [{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'translateY(0)' }];
      } else if (surface === 'grid') {
        // Every photo refresh enters from the left, regardless of filter or tab direction.
        const travel = Math.max(64, Math.min(160, (width ?? node.clientWidth) * .18));
        frames = [{ opacity: 0, transform: `translateX(${-travel}px)` }, { opacity: 1, transform: 'translateX(0)' }];
      }
      const animation = node.animate(frames, { duration: surface === 'grid' ? motionTiming.regionEnter : duration, delay, easing: motionEasing.enter, fill: 'backwards' });
      active.set(node, trackLinkedAnimation(animation));
      const release = () => { if (active.get(node) === animation) active.delete(node); };
      animation.finished.then(release, release);
    },
    cancelTree(root) {
      for (const node of active.keys()) {
        if (node === root || root?.contains(node)) cancel(node);
      }
    },
    cancelAll() { for (const node of active.keys()) cancel(node); },
  };
}
