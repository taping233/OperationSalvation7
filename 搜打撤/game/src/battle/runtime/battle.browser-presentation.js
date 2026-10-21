import { clearFeedback, waitForFeedback, waitMs } from '../view/battle.feedback.js';
import { demoMs } from './battle.pace.js';
import { actionImpactRemaining } from '../view/battle.frames.js';
import { actionCancellationError, throwIfActionCancelled } from './battle.playback.js';

function waitForRenderedFrame(signal) {
  throwIfActionCancelled(signal);
  if (typeof requestAnimationFrame !== 'function') return Promise.resolve();
  return new Promise((/** @type {(value?: void) => void} */ resolve, reject) => {
    const frame = requestAnimationFrame(done);
    function cleanup() { signal?.removeEventListener('abort', cancel); }
    function done() { cleanup(); resolve(); }
    function cancel() { cancelAnimationFrame(frame); cleanup(); reject(actionCancellationError(signal)); }
    signal?.addEventListener('abort', cancel, { once: true });
  });
}

/** The browser battle shares the current view's feedback and frame clock. */
export function createBrowserBattlePresentation() {
  return { clearFeedback, waitForFeedback, waitMs, demoMs, actionImpactRemaining, waitForRenderedFrame };
}
