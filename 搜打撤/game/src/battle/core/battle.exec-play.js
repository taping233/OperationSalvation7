import { createExecPlayDomain } from './battle.exec-play.domain.js';
import { createDefaultBattleContext } from './battle.default-context.js';

// The browser compatibility path binds the one default battle at each call.
/** @type {ReturnType<typeof createExecPlayDomain>['createBattleExecPlay']} */
export const createBattleExecPlay = (...args) => createExecPlayDomain(createDefaultBattleContext()).createBattleExecPlay(...args);
