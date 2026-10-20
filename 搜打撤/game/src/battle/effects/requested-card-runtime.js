import { createRequestedDomain } from './requested-card-runtime.domain.js';
import { createDefaultBattleContext } from '../core/battle.default-context.js';

// The browser compatibility path binds the one default battle at each call.
/** @type {ReturnType<typeof createRequestedDomain>['requestedBattleState']} */
export const requestedBattleState = (...args) => createRequestedDomain(createDefaultBattleContext()).requestedBattleState(...args);
/** @type {ReturnType<typeof createRequestedDomain>['recordCompletedBattleCard']} */
export const recordCompletedBattleCard = (...args) => createRequestedDomain(createDefaultBattleContext()).recordCompletedBattleCard(...args);
/** @type {ReturnType<typeof createRequestedDomain>['recordPlayerDamageFact']} */
export const recordPlayerDamageFact = (...args) => createRequestedDomain(createDefaultBattleContext()).recordPlayerDamageFact(...args);
/** @type {ReturnType<typeof createRequestedDomain>['requestedTargetReason']} */
export const requestedTargetReason = (...args) => createRequestedDomain(createDefaultBattleContext()).requestedTargetReason(...args);
/** @type {ReturnType<typeof createRequestedDomain>['recordRequestedDamage']} */
export const recordRequestedDamage = (...args) => createRequestedDomain(createDefaultBattleContext()).recordRequestedDamage(...args);
/** @type {ReturnType<typeof createRequestedDomain>['requestedPlayerDamaged']} */
export const requestedPlayerDamaged = (...args) => createRequestedDomain(createDefaultBattleContext()).requestedPlayerDamaged(...args);
/** @type {ReturnType<typeof createRequestedDomain>['requestedCardPlayed']} */
export const requestedCardPlayed = (...args) => createRequestedDomain(createDefaultBattleContext()).requestedCardPlayed(...args);
/** @type {ReturnType<typeof createRequestedDomain>['requestedInfusion']} */
export const requestedInfusion = (...args) => createRequestedDomain(createDefaultBattleContext()).requestedInfusion(...args);
/** @type {ReturnType<typeof createRequestedDomain>['resolveRequestedCard']} */
export const resolveRequestedCard = (...args) => createRequestedDomain(createDefaultBattleContext()).resolveRequestedCard(...args);
