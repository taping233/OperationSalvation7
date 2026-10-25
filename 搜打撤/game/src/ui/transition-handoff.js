import { motionReduced, motionTiming } from './motion-presets.js';
import { silentFilmRemaining } from './silent-node-film.js';
import { cinematicProfile } from './cinematic-profiles.js';
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
// The whole cover fades, including opaque scene wrappers, before it is removed.
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
  // Node cuts have already presented their destination while resources load.
  // Keep that settled image through the handoff; only dedicated entrances replay.
  const held = cover.matches('.city-run-transition.resume-hold')
    || !!cover.querySelector('.city-run-transition.resume-hold');
  const rich = !held && (cover.matches('.camp-entry-cut') || !!cover.querySelector('.camp-entry-cut'));
  const resume = cover.dataset.handoffProfile === 'resume';
  const richDuration=cover.dataset.handoffProfile==='brief' ? 260 : duration;
  const silentFilm=/** @type {HTMLElement} */ (cover.matches('.silent-node-cut') ? cover : cover.querySelector('.silent-node-cut'));
  const richExit=silentFilm ? Math.max(cover.dataset.handoffProfile === 'brief' ? cinematicProfile('loading').exitDuration : 680,
    Number(silentFilm.dataset.filmExitDuration) || 0) : richDuration;
  const exitDuration = silentFilm ? richExit : held ? 680 : resume ? motionTiming.resumeExit : rich ? richExit : motionTiming.handoff;
  cover.style.setProperty('--motion-handoff', `${exitDuration}ms`);
  cover.style.setProperty('--silent-film-exit-duration',`${richExit}ms`);
  cover.classList.add(held ? 'transition-handoff-held' : rich ? 'transition-handoff-rich' : 'transition-handoff');
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
  await dwell;
  if (!current()) return false;
  if (silentFilm && !held) await transitionPause(silentFilmRemaining(silentFilm),signal);
  if (!current()) return false;
  await transitionFrame(signal);
  if (!current()) return false;
  onReveal?.();
  cover.classList.remove('page-cut-waiting');
  cover.querySelectorAll('.page-cut-waiting').forEach(cut => cut.classList.remove('page-cut-waiting'));
  cover.classList.add('leaving');
  if (!rich) cover.classList.add('transition-handoff-leaving');
  if (!motionReduced()) await transitionPause(exitDuration, signal);
  return current();
}
