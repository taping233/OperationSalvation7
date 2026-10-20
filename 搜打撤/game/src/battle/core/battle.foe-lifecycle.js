import { createFoeLifecycleDomain } from './battle.foe-lifecycle.domain.js';
import { createDefaultBattleContext } from './battle.default-context.js';

// Compatibility exports bind the default battle at the call boundary.
/** @type {ReturnType<typeof createFoeLifecycleDomain>['createBattleFoeLifecycle']} */
export const createBattleFoeLifecycle = (...args) => createFoeLifecycleDomain(createDefaultBattleContext()).createBattleFoeLifecycle(...args);
