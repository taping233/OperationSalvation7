import { createEnemyPhaseDomain } from './battle.enemy-phase.domain.js';
import { createDefaultBattleContext } from './battle.default-context.js';
import * as engine from './battle.engine.js';

// The browser compatibility path binds the one default battle at each call.
/** @type {ReturnType<typeof createEnemyPhaseDomain>['endTurn']} */
export const endTurn = (...args) => createEnemyPhaseDomain(createDefaultBattleContext({ engine })).endTurn(...args);
/** @type {ReturnType<typeof createEnemyPhaseDomain>['surrender']} */
export const surrender = (...args) => createEnemyPhaseDomain(createDefaultBattleContext({ engine })).surrender(...args);
