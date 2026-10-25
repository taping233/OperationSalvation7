import '../../css/base-page-motion-v7.css';
import { linkedAnimate } from '../ui/home-linked-interactions.js';
import { motionReduced } from '../ui/motion-presets.js';
import { navigationState, baseNavigationChange as navigationChange, baseNavigationTiming as navigationTiming, baseNavigationEasing } from '../ui/navigation-motion.js';

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

function animateRegion(state, node, { x = 0, y = 0, delay = 0, duration = /** @type {number} */ (navigationTiming.enter), fade = false } = {}) {
  if (!node?.isConnected || !node.animate) return;
  const animation = linkedAnimate(node, [
    { opacity: fade ? 0 : 1, transform: `translate(${x}px,${y}px)` },
    { opacity: 1, transform: 'none' },
  ], {
    duration,
    delay: Math.max(0, delay),
    easing: baseNavigationEasing,
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
  // 首次揭幕按固定栏、事务、整备入场；房间背景始终静止。
  if (state.coldEntry) {
    animateRegion(state, state.root.querySelector('.hub-head'), { y:-8, duration:340, fade:true });
    animateRegion(state, state.root.querySelector('.base-navigation-v7'), { y:12, delay:40, duration:340, fade:true });
  }
  animateRegion(state, home.querySelector('.base-home-affairs'), {
    x:state.coldEntry ? -52 : state.enterX * .5,
    delay:state.coldEntry ? 110 : 0, duration:state.coldEntry ? 400 : 320, fade:true,
  });
  animateRegion(state, home.querySelector('.base-home-preparation'), {
    x:state.coldEntry ? 72 : state.enterX,
    delay:state.coldEntry ? 170 : 60, duration:state.coldEntry ? 440 : 380, fade:true,
  });
  // 先建立延迟段首帧，再解除整区隐藏，避免闪现。
  delete home.dataset.baseMotionPending;
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
  state.root = root;
  state.coldEntry = !previousNavigation || covered(root.closest('#overlay'));
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
      duration: navigationTiming.refresh, easing: baseNavigationEasing, fill:'backwards',
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
  // 难度切换只移动标记和图标，不缩放整备面板或改变图标静止色。
  play(home.querySelector('#btnDeploy > .base-home-icon'), [
    { transform:`translateX(${mode === 'elite' ? 8 : -8}px)` },
    { transform:'none' },
  ]);
  animateRegion(state, home.querySelector('.base-home-mode p'), { y:8 });
}
