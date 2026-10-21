import { createBattleSummary } from './battle.summary.factory.js';

// Compatibility consumers share the default instance; independent engines create their own.
const { resetBattleSummary, recordBattleDamage, readBattleSummary } = createBattleSummary();
export { resetBattleSummary, recordBattleDamage, readBattleSummary };
