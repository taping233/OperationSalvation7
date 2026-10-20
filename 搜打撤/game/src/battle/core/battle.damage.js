import { createDamageDomain } from './battle.damage.domain.js';
import * as Combat from './combat.js';

// Compatibility exports bind the default battle at the call boundary.
export const createBattleDamage = ports => createDamageDomain({ combat: ports.combat || Combat }).createBattleDamage(ports);
