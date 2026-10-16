const UNLOCK_DELAY_MS = 350;
const discoveryKey = state => state ? JSON.stringify(state) : '';

// UI admission only: no card draws, effects, timers or mutation of battle snapshots.
export function createDiscoverInputGate({ now = () => performance.now() } = {}) {
  let round = null;
  let pageSerial = 0;
  return {
    reset() { round = null; },
    bind(snapshot) {
      const state = snapshot.discovering;
      if (!state) { round = null; return null; }
      const key = discoveryKey(state);
      // Unrelated snapshot clones retain the deadline. A submitted round always
      // advances, including consecutive jobs with identical candidates and n.
      if (!round || round.battleToken !== snapshot.battleToken || round.key !== key || round.submitted) {
        round = { battleToken:snapshot.battleToken, state, key, readyAt:now() + UNLOCK_DELAY_MS, submitted:false, pageToken:'' };
      }
      const captured = round;
      const pageToken = `discover-${++pageSerial}`;
      captured.pageToken = pageToken;
      const isCurrent = () => round === captured && captured.pageToken === pageToken && !captured.submitted;
      return {
        pageToken,
        isCurrent,
        remainingMs:() => Math.max(0, captured.readyAt - now()),
        trySubmit(current, submittedPageToken, index) {
          if (!isCurrent() || submittedPageToken !== pageToken || now() < captured.readyAt) return false;
          if (current.battleToken !== captured.battleToken || !current.discovering || discoveryKey(current.discovering) !== captured.key) return false;
          if (!Number.isInteger(index) || index < 0 || index >= current.discovering.options.length) return false;
          captured.submitted = true;
          return true;
        },
      };
    },
  };
}
