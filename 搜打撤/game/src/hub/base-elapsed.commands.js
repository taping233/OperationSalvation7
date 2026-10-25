// @ts-check

/** @typedef {{ stats: { playSeconds?: unknown, playTimeCheckpoint?: {runId:string, elapsed:number} } }} BaseElapsedState */
/** @typedef {{ read: () => BaseElapsedState, persistPlaySeconds: (next: number, checkpoint?: {runId:string, elapsed:number}|null) => boolean }} BaseElapsedPorts */
/** @typedef {{ changed: false, delta: 0, checkpoint: number }} ElapsedSyncNoop */
/** @typedef {{ changed: true, delta: number, checkpoint: number, persisted: boolean }} ElapsedSyncChanged */
/** @typedef {ElapsedSyncNoop | ElapsedSyncChanged} ElapsedSyncResult */
/** @typedef {{ changed: false, checkpoint: number }} ElapsedMigrationNoop */
/** @typedef {{ changed: true, checkpoint: number, persisted: boolean }} ElapsedMigrationChanged */
/** @typedef {ElapsedMigrationNoop | ElapsedMigrationChanged} ElapsedMigrationResult */

/**
 * Keeps cumulative play-time arithmetic in Base while leaving persistence and
 * the legacy in-memory-on-write-failure policy with the owning Base module.
 * @param {BaseElapsedPorts} ports
 */
export function createBaseElapsedCommands({ read, persistPlaySeconds }) {
  /** @param {number} elapsed @param {number} elapsedSynced @returns {ElapsedSyncResult} */
  function syncPlayTime(elapsed, elapsedSynced, runId = null) {
    const now = Math.max(0, Number(elapsed) || 0);
    const stored = read().stats.playTimeCheckpoint;
    const previous = Math.max(0, Number(runId && stored?.runId === runId ? stored.elapsed : elapsedSynced) || 0);
    const delta = Math.max(0, now - previous);
    const establish = runId && stored?.runId !== runId;
    if (!(delta > 0) && !establish) return { changed: false, delta: 0, checkpoint: previous };

    const current = Math.max(0, Number(read().stats.playSeconds) || 0);
    const persisted = persistPlaySeconds(current + delta, runId ? { runId, elapsed: now } : null);
    return { changed: true, delta, checkpoint: now, persisted };
  }

  /** @param {number} elapsed @returns {ElapsedMigrationResult} */
  function migrateElapsed(elapsed) {
    const checkpoint = Number(elapsed) || 0;
    const current = Number(read().stats.playSeconds) || 0;
    if (!(current < checkpoint)) return { changed: false, checkpoint };
    const persisted = persistPlaySeconds(checkpoint);
    return { changed: true, checkpoint, persisted };
  }

  return Object.freeze({ syncPlayTime, migrateElapsed });
}
