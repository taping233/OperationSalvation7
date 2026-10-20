import { createStagedPlayback as createPlayback } from './battle.playback.js';
import { createBrowserBattlePresentation } from './battle.browser-presentation.js';

export { STAGED_BOSS_DEFEAT, actionCancellationError, throwIfActionCancelled } from './battle.playback.js';

/** Preserve the browser facade while sharing the instance-safe playback logic. */
export function createStagedPlayback(options) {
  return createPlayback({ ...options, presentation: options.presentation || createBrowserBattlePresentation() });
}
