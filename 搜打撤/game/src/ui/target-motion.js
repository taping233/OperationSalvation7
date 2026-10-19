import { animate } from 'motion/mini';
import { motionTiming, motionEasing, motionReduced } from './motion-presets.js';

const kebab = key => key.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`);
const unitless = new Set(['opacity', 'zIndex', 'fontWeight', 'lineHeight', 'flexGrow', 'flexShrink']);
const transformKeys = new Set(['x', 'y', 'scale', 'rotate']);
const valueUnit = (value, unit) => typeof value === 'number' ? `${value}${unit}` : value;

function stylesFor(values, pose) {
  const styles = {};
  let hasTransform = false;
  for (const [key, value] of Object.entries(values)) {
    if (transformKeys.has(key)) { pose[key] = value; hasTransform = true; }
    else styles[kebab(key)] = typeof value === 'number' && !unitless.has(key) ? `${value}px` : String(value);
  }
  if (hasTransform) {
    styles.transform = `translate3d(${valueUnit(pose.x ?? 0, 'px')},${valueUnit(pose.y ?? 0, 'px')},0) rotate(${valueUnit(pose.rotate ?? 0, 'deg')}) scale(${pose.scale ?? 1})`;
  }
  return styles;
}

const setStyles = (element, styles) => {
  for (const [property, value] of Object.entries(styles)) element.style.setProperty(property, value);
};

// A finite animation per element. Native Motion.stop() commits the currently
// displayed values, so a new target continues from that point rather than a seed.
export function createTargetMotion({ run = animate, reduced = motionReduced } = {}) {
  const states = new WeakMap(), active = new Set();
  const finishedHandle = result => ({ finished:Promise.resolve(result), stop() {} });

  function stopVisual(element) {
    const state = states.get(element);
    if (!state?.animation) return;
    const animation = state.animation;
    state.animation = null;
    active.delete(element);
    try {
      // Native commitStyles cannot sample a hidden or removed target. Cleanup
      // discards that animation; visible interruptions retain the current pose.
      if (!element.isConnected || element.closest('[hidden]')) animation.cancel?.();
      else animation.stop();
    } catch {
      // A parent can become display:none between the DOM check and native stop.
      animation.cancel?.();
    } finally { state.resolve?.(false); state.resolve = null; }
  }

  function clearVisual(element) {
    const state = states.get(element);
    if (!state) return;
    stopVisual(element);
    for (const [property, original] of state.original) {
      if (original.value) element.style.setProperty(property, original.value, original.priority);
      else element.style.removeProperty(property);
    }
    states.delete(element);
  }

  function retargetVisual(element, target, { duration = motionTiming.change, easing = motionEasing.enter, delay = 0, from } = {}) {
    if (!element?.style || !target) return finishedHandle(false);
    let state = states.get(element);
    const first = !state;
    if (!state) {
      state = { original:new Map(), pose:{}, animation:null, resolve:null, target:{}, signature:'', handle:null, settled:false };
      states.set(element, state);
    }
    const seed = first && from ? stylesFor(from, state.pose) : null;
    const goal = stylesFor(target, state.pose);
    const signature = JSON.stringify(goal);
    if (!first && signature === state.signature && (state.animation || state.settled)) return state.handle || finishedHandle(true);
    stopVisual(element);
    for (const property of new Set([...Object.keys(seed || {}), ...Object.keys(goal)])) {
      if (!state.original.has(property)) state.original.set(property, {
        value:element.style.getPropertyValue(property), priority:element.style.getPropertyPriority(property),
      });
    }
    state.target = goal;
    state.signature = signature;
    state.settled = false;
    if (seed) setStyles(element, seed);
    if (reduced() || duration <= 0) {
      setStyles(element, goal);
      state.settled = true;
      state.handle = finishedHandle(true);
      return state.handle;
    }
    let resolve;
    const finished = new Promise(done => { resolve = done; });
    state.resolve = resolve;
    try {
      const keyframes = Object.fromEntries(Object.entries(goal).map(([key, value]) => [key.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase()), value]));
      const before = new Set(element.getAnimations?.() || []);
      const animation = run(element, keyframes, { duration:Math.max(0, duration) / 1000, delay:Math.max(0, delay) / 1000, ease:easing });
      state.native = new Set((element.getAnimations?.() || []).filter(item => !before.has(item)));
      state.animation = animation;
      active.add(element);
      const handle = { finished, stop() { if (state.animation === animation) stopVisual(element); } };
      state.handle = handle;
      Promise.resolve(animation).then(() => {
        if (state.animation !== animation) return;
        state.animation = null; active.delete(element);
        setStyles(element, goal);
        state.settled = true;
        state.resolve = null; resolve(true);
      }, () => {
        if (state.animation !== animation) return;
        state.animation = null; active.delete(element);
        setStyles(element, goal);
        state.settled = true;
        state.resolve = null; resolve(false);
      });
      return handle;
    } catch {
      // Environments without native animation still expose the final UI state.
      setStyles(element, goal);
      state.animation = null; active.delete(element); state.resolve = null;
      state.settled = true;
      resolve(true);
      state.handle = { finished, stop() {} };
      return state.handle;
    }
  }

  function flush() {
    for (const element of [...active]) {
      if (!element.isConnected || element.closest('[hidden]')) { clearVisual(element); continue; }
      if (reduced()) {
        const goal = states.get(element).target;
        stopVisual(element);
        setStyles(element, goal);
        states.get(element).settled = true;
      }
    }
  }
  return { retargetVisual, stopVisual, clearVisual, flush,
    hasVisualMotion:element => active.has(element),
    ownsVisualAnimation:(element, animation) => states.get(element)?.native?.has(animation) || false,
  };
}

const shared = createTargetMotion();
export const { retargetVisual, stopVisual, clearVisual, hasVisualMotion, ownsVisualAnimation } = shared;
const installed = new WeakSet();
export function installTargetMotionLifecycle(root = document.body) {
  if (!root || installed.has(root)) return;
  installed.add(root);
  const observer = new MutationObserver(() => shared.flush());
  observer.observe(root, { subtree:true, childList:true, attributes:true, attributeFilter:['hidden', 'class'] });
  const preference = window.matchMedia?.('(prefers-reduced-motion: reduce)');
  preference?.addEventListener?.('change', shared.flush);
}
