// 成就页内部反馈独立于整页入场；不修改筛选结果、奖章状态或奖励。
import { rect } from './ui-scale.js';
import { trackLinkedAnimation } from './home-linked-interactions.js';
import { motionTiming, motionEasing, motionReduced as reduced } from './motion-presets.js';

export function createAchievementMotion(root) {
  const scroll = /** @type {HTMLElement} */ (root.querySelector('.ag-scroll'));
  const grid = /** @type {HTMLElement} */ (root.querySelector('.ag-grid'));
  const empty = /** @type {HTMLElement} */ (root.querySelector('.ag-empty'));
  let listAnimation = null;
  let source = null;
  let tileAnimations = [];
  let categoryAnimation = null;
  let categoryMarker = null;
  const categoryNav = /** @type {HTMLElement} */ (root.querySelector('.ag-categories'));
  const categoryButtons = [.../** @type {NodeListOf<HTMLElement>} */ (root.querySelectorAll('[data-gallery-category]'))];
  let categoryIndex = Math.max(0, categoryButtons.findIndex(button => button.getAttribute('aria-pressed') === 'true'));

  const animate = (el, frames, options) => {
    if (!el?.isConnected || reduced() || typeof el.animate !== 'function') return null;
    return trackLinkedAnimation(el.animate(frames, { easing: motionEasing.enter, fill: 'backwards', ...options }));
  };
  const settleEntry = () => {
    /** @type {NodeListOf<HTMLElement>} */ (root.querySelectorAll('[data-surface-role]')).forEach(el => {
      el.getAnimations?.().forEach(animation => {
        if (animation.effect && 'target' in animation.effect && animation.effect.target === el && 'animationName' in animation) animation.cancel();
      });
    });
  };
  const cancelTiles = () => {
    tileAnimations.forEach(animation => animation?.cancel());
    tileAnimations = [];
  };
  const revealTiles = (initial = false, direction = 1) => {
    cancelTiles();
    const edge = rect(scroll);
    const visible = [.../** @type {NodeListOf<HTMLElement>} */ (grid.querySelectorAll('[data-gallery-item]'))]
      .filter(tile => !tile.hidden).map(tile => ({ tile, bounds: rect(tile) }))
      .filter(({ bounds }) => bounds.top + bounds.height > edge.top && bounds.top < edge.top + edge.height)
      .slice(0, 12);
    let row = -1, rowTop = -Infinity, column = 0;
    tileAnimations = visible.map(({ tile, bounds }) => {
      if (Math.abs(bounds.top - rowTop) > 3) { row++; rowTop = bounds.top; column = 0; }
      const delay = (initial ? motionTiming.stagger : 0) + Math.min(row * motionTiming.stagger + column++ * 18, motionTiming.staggerMax);
      return animate(tile, [
      { opacity: initial ? 0 : .4, transform: initial ? 'translateY(18px) scale(.97)' : `translateX(${direction * 14}px) translateY(5px)` },
      { opacity: 1, transform: 'none' },
      ], { duration: initial ? motionTiming.regionEnter : motionTiming.change, delay });
    });
  };
  const moveCategory = () => {
    const next = Math.max(0, categoryButtons.findIndex(button => button.getAttribute('aria-pressed') === 'true'));
    const direction = next >= categoryIndex ? 1 : -1;
    const previous = categoryButtons[categoryIndex];
    const selected = categoryButtons[next];
    const movingRect = categoryMarker?.isConnected ? rect(categoryMarker) : null;
    categoryIndex = next;
    categoryAnimation?.cancel();
    categoryMarker?.remove();
    if (reduced() || !previous || !selected || previous === selected) return direction;
    const oldRect = movingRect || rect(previous), newRect = rect(selected), parent = rect(categoryNav);
    const marker = document.createElement('i');
    marker.className = 'ag-category-marker';
    marker.setAttribute('aria-hidden', 'true');
    Object.assign(marker.style, { left: `${newRect.left - parent.left}px`, top: `${newRect.top - parent.top}px`, width: `${newRect.width}px`, height: `${newRect.height}px` });
    categoryNav.appendChild(marker);
    categoryMarker = marker;
    categoryAnimation = animate(marker, [
      { transform: `translate(${oldRect.left - newRect.left}px,${oldRect.top - newRect.top}px)`, opacity: .7 },
      { transform: 'none', opacity: 1 },
    ], { duration: motionTiming.change });
    if (categoryAnimation) categoryAnimation.finished.then(() => marker.remove()).catch(() => marker.remove());
    else marker.remove();
    return direction;
  };
  const revealList = (kind = 'category') => {
    settleEntry();
    cancelTiles();
    const target = empty.hidden ? grid : empty;
    const currentOpacity = listAnimation && target?.isConnected ? Number(getComputedStyle(target).opacity) : 1;
    listAnimation?.cancel();
    if (kind === 'search') { listAnimation = null; return; }
    const category = kind === 'category';
    if (category || kind === 'reset') {
      const direction = moveCategory();
      if (empty.hidden) { listAnimation = null; revealTiles(false, direction); return; }
    }
    const startOpacity = Math.min(currentOpacity, category ? .65 : .86);
    listAnimation = animate(target, [
      { opacity: startOpacity, transform: `translateY(${category ? 4 : 0}px)` },
      { opacity: 1, transform: 'none' },
    ], { duration: category ? motionTiming.change : motionTiming.feedback });
  };
  const captureAnchor = () => {
    settleEntry();
    cancelTiles();
    listAnimation?.cancel();
    listAnimation = null;
    const edge = rect(scroll);
    const tiles = [.../** @type {NodeListOf<HTMLElement>} */ (root.querySelectorAll('[data-gallery-item]'))];
    const tile = tiles
      .find(el => {
        if (el.hidden) return false;
        const bounds = rect(el);
        return bounds.top + bounds.height > edge.top && bounds.top < edge.top + edge.height;
      });
    return tile ? { tile, index: tiles.indexOf(tile), offset: rect(tile).top - edge.top } : null;
  };
  const restoreAnchor = anchor => {
    if (!anchor?.tile.isConnected) return;
    const tiles = [.../** @type {NodeListOf<HTMLElement>} */ (root.querySelectorAll('[data-gallery-item]'))];
    const target = anchor.tile.hidden
      ? tiles.slice(anchor.index).find(tile => !tile.hidden) || tiles.slice(0, anchor.index).reverse().find(tile => !tile.hidden)
      : anchor.tile;
    if (!target) return;
    scroll.scrollTop += rect(target).top - rect(scroll).top - (target === anchor.tile ? anchor.offset : 0);
  };
  const openDetail = tile => {
    source?.classList.remove('is-detail-source');
    source = tile;
    source.classList.add('is-detail-source');
  };
  const closeDetail = finish => {
    source?.classList.remove('is-detail-source');
    source = null;
    finish();
  };
  const enterGallery = () => {
    revealTiles(true);
    animate(/** @type {HTMLElement} */ (root.querySelector('.ag-progress > span')), [
      { transform: 'scaleX(0)' }, { transform: 'scaleX(1)' },
    ], { duration: motionTiming.pageEnter, delay: motionTiming.stagger * 3 });
    animate(/** @type {HTMLElement} */ (root.querySelector('.ag-total')), [
      { opacity: 0, transform: 'translateY(12px)' }, { opacity: 1, transform: 'none' },
    ], { duration: motionTiming.regionEnter, delay: motionTiming.stagger * 2 });
  };
  return { enterGallery, revealList, captureAnchor, restoreAnchor, openDetail, closeDetail };
}
