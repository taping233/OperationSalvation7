import { createEquipmentDomain } from './battle.equipment.domain.js';
import { createDefaultBattleContext } from '../core/battle.default-context.js';

// Compatibility exports bind the default battle at the call boundary.
/** @type {ReturnType<typeof createEquipmentDomain>['createBattleEquipment']} */
export const createBattleEquipment = (...args) => createEquipmentDomain(createDefaultBattleContext()).createBattleEquipment(...args);
