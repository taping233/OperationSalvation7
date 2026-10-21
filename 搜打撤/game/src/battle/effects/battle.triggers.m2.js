import { createTriggersDomain } from './battle.triggers.m2.domain.js';
import { createDefaultBattleContext } from '../core/battle.default-context.js';

// The browser compatibility path binds the one default battle at each call.
/** @type {ReturnType<typeof createTriggersDomain>['createTriggerRunner']} */
export const createTriggerRunner = (...args) => createTriggersDomain(createDefaultBattleContext()).createTriggerRunner(...args);
