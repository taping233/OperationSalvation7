import { createInspectionDomain } from './battle.card-inspection.domain.js';

// Compatibility exports bind the default battle at the call boundary.
/** @type {ReturnType<typeof createInspectionDomain>['createBattleCardInspection']} */
export const createBattleCardInspection = (...args) => createInspectionDomain({ normalizeCard: card => card }).createBattleCardInspection(...args);
