// 成就页内部反馈独立于整页入场；不修改筛选结果、奖章状态或奖励。
import { rect } from './ui-scale.js';
import { trackLinkedAnimation } from './home-linked-interactions.js';
import { motionTiming, motionEasing } from './motion-presets.js';

const reduced = () => document.body.classList.contains('reduce-motion')
  || !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

export function createAchievementMotion(root) {
  const scroll = root.querySelector('.ag-scroll');
  const grid = root.querySelector('.ag-grid');
  const empty = root.querySelector('.ag-empty');
  const detail = root.querySelector('.ag-detail');
  const backdrop = root.querySelector('.ag-detail-backdrop');
  let listAnimation = null;
  let detailAnimations = [];
  let detailEpoch = 0;
  let source = null;
  let detailOrigin = { x: 0, y: 0 };
  let tileAnimations = [];
  let categoryAnimation = null;
  let categoryMarker = null;
  const categoryNav = root.querySelector('.ag-categories');
  const categoryButtons = [...root.querySelectorAll('[data-gallery-category]')];
  let categoryIndex = Math.max(0, categoryButtons.findIndex(button => button.getAttribute('aria-pressed') === 'true'));

  const animate = (el, frames, options) => {
    if (!el?.isConnected || reduced() || typeof el.animate !== 'function') return null;
    return trackLinkedAnimation(el.animate(frames, { easing: motionEasing.enter, fill: 'backwards', ...options }));
  };
  const cancelDetail = () => {
    detailAnimations.forEach(animation => animation?.cancel());
    detailAnimations = [];
  };
  const settleEntry = () => {
    root.querySelectorAll('[data-surface-role]').forEach(el => {
      el.getAnimations?.().forEach(animation => {
        if (animation.effect?.target === el && 'animationName' in animation) animation.cancel();
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
    const visible = [...grid.querySelectorAll('[data-gallery-item]')]
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
      { transform: `translate(${oldRect.left - newRect.left}px,${oldRect.top - newRect.top}px) scale(${oldRect.width / newRect.width},${oldRect.height / newRect.height})`, opacity: .7 },
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
    const tiles = [...root.querySelectorAll('[data-gallery-item]')];
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
    const tiles = [...root.querySelectorAll('[data-gallery-item]')];
    const target = anchor.tile.hidden
      ? tiles.slice(anchor.index).find(tile => !tile.hidden) || tiles.slice(0, anchor.index).reverse().find(tile => !tile.hidden)
      : anchor.tile;
    if (!target) return;
    scroll.scrollTop += rect(target).top - rect(scroll).top - (target === anchor.tile ? anchor.offset : 0);
  };
  const openDetail = tile => {
    settleEntry();
    cancelTiles();
    listAnimation?.cancel();
    detailEpoch++;
    cancelDetail();
    source?.classList.remove('is-detail-source');
    source = tile;
    source.classList.add('is-detail-source');
    const art = detail.querySelector('.ag-detail-art');
    const from = rect(tile.querySelector('.ag-emblem') || tile);
    const to = rect(art);
    detailOrigin = {
      x: Math.max(-24, Math.min(24, (from.left + from.width / 2 - to.left - to.width / 2) * .12)),
      y: Math.max(-12, Math.min(12, (from.top + from.height / 2 - to.top - to.height / 2) * .08)),
    };
    detailAnimations = [
      animate(backdrop, [{ opacity: 0 }, { opacity: 1 }], { duration: motionTiming.feedback }),
      animate(detail, [{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'none' }], { duration: motionTiming.detailEnter }),
      animate(art, [{ opacity: 0, transform: `translate(${detailOrigin.x}px,${detailOrigin.y}px) scale(.95)` }, { opacity: 1, transform: 'none' }], { duration: motionTiming.detailEnter }),
      animate(detail.querySelector('.ag-detail-copy'), [{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'none' }], { duration: motionTiming.detailEnter, delay: motionTiming.stagger }),
    ];
  };
  const closeDetail = finish => {
    const epoch = ++detailEpoch;
    // 快速关闭从当前进度收回，不能先取消入场再跳到完全展开状态。
    const current = { opacity: getComputedStyle(detail).opacity, transform: getComputedStyle(detail).transform };
    const shadeOpacity = getComputedStyle(backdrop).opacity;
    const art = detail.querySelector('.ag-detail-art');
    const artCurrent = { opacity: getComputedStyle(art).opacity, transform: getComputedStyle(art).transform };
    cancelDetail();
    const animation = animate(detail, [current, { opacity: 0, transform: 'translateY(5px)' }], { duration: motionTiming.exit, easing: motionEasing.exit, fill: 'forwards' });
    const shade = animate(backdrop, [{ opacity: shadeOpacity }, { opacity: 0 }], { duration: motionTiming.exit, easing: motionEasing.exit, fill: 'forwards' });
    const medal = animate(art, [artCurrent, { opacity: 0, transform: `translate(${detailOrigin.x * .5}px,${detailOrigin.y * .5}px) scale(.98)` }], { duration: motionTiming.exit, easing: motionEasing.exit, fill: 'forwards' });
    detailAnimations = [animation, shade, medal];
    const complete = () => {
      if (epoch !== detailEpoch) return;
      finish();
      source?.classList.remove('is-detail-source');
      source = null;
      cancelDetail();
    };
    if (!animation) complete();
    else animation.finished.then(complete).catch(() => {});
  };
  const enterGallery = () => {
    revealTiles(true);
    animate(root.querySelector('.ag-progress > span'), [
      { transform: 'scaleX(0)' }, { transform: 'scaleX(1)' },
    ], { duration: motionTiming.pageEnter, delay: motionTiming.stagger * 3 });
    animate(root.querySelector('.ag-total'), [
      { opacity: 0, transform: 'translateY(12px)' }, { opacity: 1, transform: 'none' },
    ], { duration: motionTiming.regionEnter, delay: motionTiming.stagger * 2 });
  };
  return { enterGallery, revealList, captureAnchor, restoreAnchor, openDetail, closeDetail };
}
