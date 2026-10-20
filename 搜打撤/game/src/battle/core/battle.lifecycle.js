import { createLifecycleDomain } from './battle.lifecycle.domain.js';
import { createDefaultBattleContext } from './battle.default-context.js';

// The browser compatibility path binds the one default battle at each call.
/** @type {ReturnType<typeof createLifecycleDomain>['createBattleLifecycle']} */
export const createBattleLifecycle = (...args) => createLifecycleDomain(createDefaultBattleContext()).createBattleLifecycle(...args);
