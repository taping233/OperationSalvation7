import '../../css/base-page-motion-v7.css';
import { linkedAnimate } from '../ui/home-linked-interactions.js';
import { motionReduced, motionTiming, motionEasing } from '../ui/motion-presets.js';
import { navigationState, navigationChange, navigationTiming } from '../ui/navigation-motion.js';

const roots = new WeakMap();
let previousNavigation = null;

function stop(state) {
  state.stopWatching?.();
  state.stopWatching = null;
  state.pending = false;
  if (state.home) delete state.home.dataset.baseMotionPending;
  state.home = null;
  for (const animation of state.animations) animation.cancel();
  state.animations.clear();
}

function animateRegion(state, node, { x = 0, y = 0, delay = 0 } = {}) {
  if (!node?.isConnected || !node.animate) return;
  const animation = linkedAnimate(node, [
    { opacity: 1, transform: `translate(${x}px,${y}px)` },
    { opacity: 1, transform: 'none' },
  ], {
    duration: navigationTiming.enter,
    delay: Math.min(delay, motionTiming.staggerMax),
    easing: motionEasing.enter,
    fill: 'backwards',
  });
  if (!animation) return;
  state.animations.add(animation);
  const release = () => {
    state.animations.delete(animation);
    if (!state.animations.size) {
      state.stopWatching?.();
      state.stopWatching = null;
    }
  };
  animation.finished.then(release, release);
}

function covered(overlay) {
  // camp-entry exposes its live flag and removes it together with the cut/ghost.
  // page-loading's public reveal callback belongs to its caller; node removal is
  // the shared observable completion state. Never spend a local reveal behind it.
  return !!overlay?.hasAttribute('data-camp-entry')
    || !!document.querySelector('.page-loading');
}

function playHome(home, state) {
  state.pending = false;
  delete home.dataset.baseMotionPending;
  animateRegion(state, home.querySelector('.base-home-title'), { x: -24 });
  animateRegion(state, home.querySelector('.base-home-launch'), { x: state.enterX ?? 72 });
  // Each room is a destination. Reveal the rows, not a single menu container.
  if (!state.switchingPage) home.closest('.base-frame-v7')?.querySelectorAll('.base-navigation-v7 > button').forEach((button, index) => {
    animateRegion(state, button, { y: 24, delay: index * motionTiming.stagger });
  });
  animateRegion(state, home.querySelector('.base-home-mode'), { x: state.switchingPage ? state.enterX : 0, y: state.switchingPage ? 0 : 24, delay: motionTiming.stagger });
  home.querySelectorAll('.base-home-services > button').forEach((button, index) => {
    animateRegion(state, button, { x: state.switchingPage ? state.enterX : 0, y: state.switchingPage ? 0 : 24, delay: (index + 1) * motionTiming.stagger });
  });
  if (!state.animations.size) stop(state);
}

function awaitVisibleHome(root, home, state) {
  const controller = new AbortController();
  const overlay = root.closest('#overlay');
  const cancel = () => stop(state);
  // Controls respond immediately. A new interaction finishes this reveal without
  // inserting a navigation delay, changing focus, or retaining an input lock.
  root.addEventListener('pointerdown', cancel, { capture: true, signal: controller.signal });
  root.addEventListener('keydown', event => {
    if (['Enter', ' ', 'Escape'].includes(event.key)) cancel();
  }, { capture: true, signal: controller.signal });

  const media = window.matchMedia?.('(prefers-reduced-motion: reduce)');
  const reduced = () => { if (motionReduced()) cancel(); };
  media?.addEventListener?.('change', reduced);
  const ready = () => {
    if (!root.isConnected || !home.isConnected || motionReduced()
      || overlay?.hidden || overlay?.classList.contains('closing')
      || overlay?.hasAttribute('data-ui-closing')) {
      cancel();
      return;
    }
    if (state.pending && !covered(overlay)) playHome(home, state);
  };
  const observer = new MutationObserver(ready);
  observer.observe(document.body, {
    attributes: true, attributeFilter: ['class'], childList: true,
  });
  if (overlay) observer.observe(overlay, {
    attributes: true, attributeFilter: ['hidden', 'class', 'data-ui-closing', 'data-camp-entry'],
  });
  if (root.parentNode) observer.observe(root.parentNode, { childList: true });
  if (home.parentNode) observer.observe(home.parentNode, { childList: true });
  state.stopWatching = () => {
    controller.abort();
    observer.disconnect();
    media?.removeEventListener?.('change', reduced);
  };
  state.pending = true;
  state.home = home;
  if (covered(overlay)) home.dataset.baseMotionPending = '1';
  ready();
}

// Call after presentHub has installed the current DOM. Subpages retain the shared
// surface-motion / hub.presentation choreography; only this home is composed here.
// The returned cleanup can be called on close and never forgets the last view.
export function bindBasePageMotionV7(root, { changed = true } = {}) {
  if (!root?.matches('.base-frame-v7')) return () => {};
  let state = roots.get(root);
  if (!state) {
    state = { seen: false, view: '', pending: false, home: null, animations: new Set(), stopWatching: null };
    roots.set(root, state);
  }
  const page = root.querySelector('.hub-page');
  const home = root.querySelector('.base-home-v7');
  const view = page?.dataset.motionView || page?.dataset.view || root.dataset.page || (home ? 'home' : 'subpage');
  const nextNavigation = navigationState(root);
  const transition = navigationChange(previousNavigation, nextNavigation);
  state.switchingPage = !!(changed && previousNavigation && transition.changed);
  state.enterX = transition.x;
  previousNavigation = nextNavigation;
  // A same-view resource update while the cover is live must keep the requested
  // reveal, even when presentHub rebuilt its home DOM before the flag cleared.
  const entering = (changed && (!state.seen || state.view !== view))
    || (state.pending && state.view === view);
  stop(state);
  state.seen = true;
  state.view = view;
  if (!home) return () => stop(state);

  // Shared same-shell navigation falls back to moving its first child when no
  // subpage regions exist. Remove that home-container effect before local regions
  // enter, so the room art itself remains still. Do not cancel child/object motion.
  for (const container of [page, home]) {
    container?.getAnimations?.().forEach(animation => {
      if (animation.effect?.target === container) animation.cancel();
    });
  }
  if (!entering || motionReduced()) return () => stop(state);
  awaitVisibleHome(root, home, state);
  return () => stop(state);
}

// 难度保存成功后才播放局部反馈；失败与重复点当前项不制造成功动画。
export function animateBaseModeChangeV12(root, previousMode) {
  const home = root?.querySelector('.base-home-v7');
  const mode = home?.dataset.mode;
  const state = roots.get(root);
  if (!home || !state || previousMode === mode || motionReduced()) return;
  stop(state);
  const shift = value => value === 'elite' ? 'translateX(calc(100% + 6px))' : 'none';
  const color = value => value === 'elite' ? '#ff818c' : '#9edce7';
  const play = (node, frames) => {
    if (!node?.animate) return;
    const animation = linkedAnimate(node, frames, {
      duration: motionTiming.change, easing: motionEasing.enter, fill:'backwards',
    });
    if (!animation) return;
    state.animations.add(animation);
    const release = () => state.animations.delete(animation);
    animation.finished.then(release, release);
  };
  play(home.querySelector('.base-mode-indicator'), [
    { transform:shift(previousMode), backgroundColor:color(previousMode) },
    { transform:shift(mode), backgroundColor:color(mode) },
  ]);
  // 图标静止色恒为金（base-home-v7.css #e2c891），动画若带颜色终点会在 fill 释放时弹回闪色，故只留缩放脉冲。
  play(home.querySelector('#btnDeploy > .base-home-icon'), [
    { transform:'scale(.82)' },
    { transform:'scale(1.08)', offset:.65 },
    { transform:'none' },
  ]);
  animateRegion(state, home.querySelector('.base-home-mode p'), { y:8 });
}
