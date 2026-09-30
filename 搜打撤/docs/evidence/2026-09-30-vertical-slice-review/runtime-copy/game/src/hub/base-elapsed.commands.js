// @ts-check

/** @typedef {{ stats: { playSeconds?: unknown } }} BaseElapsedState */
/** @typedef {{ read: () => BaseElapsedState, persistPlaySeconds: (next: number) => boolean }} BaseElapsedPorts */
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
  function syncPlayTime(elapsed, elapsedSynced) {
    const now = Math.max(0, Number(elapsed) || 0);
    const previous = Math.max(0, Number(elapsedSynced) || 0);
    const delta = Math.max(0, now - previous);
    if (!(delta > 0)) return { changed: false, delta: 0, checkpoint: previous };

    const current = Math.max(0, Number(read().stats.playSeconds) || 0);
    const persisted = persistPlaySeconds(current + delta);
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
