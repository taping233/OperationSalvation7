import { KEY } from './cards.consts.js';

/** Acknowledge only the exact persisted snapshot, including no-change migrations. */
export function createCardMigrationMarker(storage) {
  return function markCardMigration(markerKey, cards) {
    if (storage().getItem(KEY) !== JSON.stringify(cards)) return;
    storage().setItem(markerKey, '1');
  };
}
