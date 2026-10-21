import { motionReduced, motionTiming } from './motion-presets.js';

// One completion owner for CSS motion: matching event, timeout, or cancellation.
// Cancellation releases listeners without finishing an obsolete surface.
/** @param {Element} target @param {() => void} finish @param {{duration?: number, event?: string, name?: string, immediate?: boolean}} [options] */
export function completeSurfaceMotion(target, finish, { duration = motionTiming.exit,
  event = 'animationend', name, immediate = false } = {}) {
  let settled = false, timer;
  const cancel = () => {
    settled = true;
    clearTimeout(timer);
    target?.removeEventListener(event, onEnd);
  };
  const complete = () => {
    if (settled) return;
    cancel();
    finish();
  };
  const onEnd = event => {
    if (event.target !== target) return;
    if (name && (event.animationName || event.propertyName) !== name) return;
    complete();
  };
  if (!target || immediate || motionReduced()) complete();
  else {
    target.addEventListener(event, onEnd);
    timer = setTimeout(complete, duration + motionTiming.completionSlack);
  }
  return cancel;
}
