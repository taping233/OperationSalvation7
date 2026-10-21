import { motionReduced, motionTiming } from './motion-presets.js';
import '../../css/transition-handoff.css';

let resumePresentation = null;
// The resume adapter holds all map chrome until this same handoff has finished.
// Ownership prevents an older restore from exposing a newer restore's map.
export function beginResumePresentation() {
  const owner = {};
  resumePresentation = owner;
  document.body.dataset.mapPresentation = 'restoring';
  document.querySelectorAll('.rmb-hint-toast').forEach(tip => tip.remove());
  return () => {
    if (resumePresentation !== owner) return false;
    resumePresentation = null;
    document.getElementById('layerBanner')?.classList.remove('lb-swap');
    delete document.body.dataset.mapPresentation;
    return true;
  };
}

// All page/scene adapters share the same paint, readiness and reveal boundary.
// Adapters supply destination work and ownership; they do not animate the exit.
export function transitionPause(ms, signal) {
  if (ms <= 0 || signal?.aborted) return Promise.resolve();
  return new Promise((/** @type {(value?: void) => void} */ resolve) => {
    const finish = () => { clearTimeout(timer); signal?.removeEventListener('abort', finish); resolve(); };
    const timer = setTimeout(finish, ms);
    signal?.addEventListener('abort', finish, { once:true });
    if (signal?.aborted) finish();
  });
}

export function transitionFrame(signal) {
  return new Promise((/** @type {(value?: void) => void} */ resolve) => {
    let frame, timer, done = false;
    const finish = () => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      if (frame != null) cancelAnimationFrame(frame);
      signal?.removeEventListener('abort', finish);
      resolve();
    };
    timer = setTimeout(finish, 150);
    signal?.addEventListener('abort', finish, { once:true });
    if (signal?.aborted) finish();
    else frame = requestAnimationFrame(finish);
  });
}

/** @param {HTMLElement} cover @param {{ready?: () => unknown, isCurrent?: () => boolean, signal?: AbortSignal, onReveal?: () => void, minimum?: number, duration?: number, painted?: boolean}} [options] */
export async function revealTransition(cover, { ready = () => true, isCurrent = () => true,
  signal, onReveal, minimum = 0, duration = 980, painted = false } = {}) {
  const current = () => !signal?.aborted && cover.isConnected && isCurrent();
  if (!current()) return false;
  const rich = cover.matches('.camp-entry-cut') || !!cover.querySelector('.camp-entry-cut');
  const resume = cover.dataset.handoffProfile === 'resume';
  const mapReturn = cover.matches('.page-visual-return:not([data-kind="panel"])');
  // Full-page returns retain their entrance before revealing the prepared map.
  const returnDwell = transitionPause(motionReduced() || !mapReturn ? 0 : motionTiming.mapReturnHold, signal);
  cover.classList.add(rich ? 'transition-handoff-rich' : 'transition-handoff');
  if (!painted) {
    await transitionFrame(signal);
    await transitionFrame(signal);
    if (!current()) return false;
  }
  const dwell = transitionPause(motionReduced() ? 0 : minimum, signal);
  let stop;
  const cancelled = new Promise(resolve => { stop = () => resolve(false); });
  signal?.addEventListener('abort', stop, { once:true });
  let result;
  try { result = await Promise.race([Promise.resolve().then(ready), cancelled]); }
  finally { signal?.removeEventListener('abort', stop); }
  if (result === false || !current()) return false;
  await Promise.all([dwell, returnDwell]);
  if (!current()) return false;
  await transitionFrame(signal);
  if (!current()) return false;
  onReveal?.();
  cover.classList.remove('page-cut-waiting');
  cover.querySelectorAll('.page-cut-waiting').forEach(cut => cut.classList.remove('page-cut-waiting'));
  cover.classList.add('leaving');
  if (!rich) cover.classList.add('transition-handoff-leaving');
  if (!motionReduced()) await transitionPause(resume ? motionTiming.resumeExit : rich ? duration : mapReturn ? motionTiming.mapReturnExit : motionTiming.handoff, signal);
  return current();
}
