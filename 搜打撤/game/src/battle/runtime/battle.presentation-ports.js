import { actionCancellationError } from './battle.playback.js';

function waitMs(ms, signal) {
  if (signal?.aborted) return Promise.reject(actionCancellationError(signal));
  if (!(ms > 0)) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const cleanup = () => { clearTimeout(timer); signal?.removeEventListener('abort', cancel); };
    const done = () => { cleanup(); resolve(); };
    const cancel = () => { cleanup(); reject(actionCancellationError(signal)); };
    const timer = setTimeout(done, ms);
    signal?.addEventListener('abort', cancel, { once: true });
  });
}

/** Presentation is optional; rule generators keep their real asynchronous cancellation. */
export function createBattlePresentationPorts(overrides = {}) {
  return {
    clearFeedback() {},
    waitForFeedback: signal => waitMs(0, signal),
    waitForRenderedFrame: signal => waitMs(0, signal),
    waitMs,
    demoMs: ms => ms,
    actionImpactRemaining: () => null,
    ...overrides,
  };
}
