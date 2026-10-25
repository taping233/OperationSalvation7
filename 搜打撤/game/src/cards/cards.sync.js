// Legacy assembly facade: migration families receive explicit lazy ports.
// Public methods retain their receiver (notably ensureCardsSyncLive and TT12 chaining).
const SDT = window.SDT;
import { DATA } from '../core/data-loader.js';
import { Random } from '../core/random.js';
import { createCatalogCardMigrations } from './cards.sync.catalog.js';
import { createCardRenameMigrations } from './cards.sync.renames.js';
import { createNumericCardMigrations } from './cards.sync.numeric.js';
import { createCardRuleBackfillMigrations } from './cards.sync.rule-backfill.js';

const migrationPorts = { library: () => SDT.Cards, storage: () => localStorage, data: DATA, random: Random };
export const syncSlice = {
  ...createCatalogCardMigrations(migrationPorts),
  ...createCardRenameMigrations(migrationPorts),
  ...createNumericCardMigrations(migrationPorts),
  ...createCardRuleBackfillMigrations(migrationPorts),
};
