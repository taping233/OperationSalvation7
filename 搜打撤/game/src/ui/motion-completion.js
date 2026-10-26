import { motionReduced, motionTiming } from './motion-presets.js';

// One completion owner for CSS motion: matching event, timeout, or cancellation.
// Cancellation releases listeners without finishing an obsolete surface.
/** @param {Element} target @param {() => void} finish @param {{duration?: number, slack?: number, event?: string | null, name?: string, immediate?: boolean}} [options] */
export function completeSurfaceMotion(target, finish, { duration = motionTiming.exit,
  slack = motionTiming.completionSlack, event = 'animationend', name, immediate = false } = {}) {
  let settled = false, timer;
  const cancel = () => {
    settled = true;
    clearTimeout(timer);
    if (event) target?.removeEventListener(event, onEnd);
  };
  const complete = () => {
    if (settled) return;
    cancel();
    finish();
  };
  const onEnd = event => {
    if (settled) return;
    if (event.target !== target) return;
    if (name && (event.animationName || event.propertyName) !== name) return;
    complete();
  };
  if (!target || immediate || motionReduced(target.ownerDocument)) complete();
  else {
    if (event) target.addEventListener(event, onEnd);
    timer = setTimeout(complete, duration + slack);
  }
  return cancel;
}
