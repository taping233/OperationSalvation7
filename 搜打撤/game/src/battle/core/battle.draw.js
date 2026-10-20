import { createDrawDomain } from './battle.draw.domain.js';
import { createDefaultBattleContext } from './battle.default-context.js';

// The browser compatibility path binds the one default battle at each call.
/** @type {ReturnType<typeof createDrawDomain>['createBattleDraw']} */
export const createBattleDraw = (...args) => createDrawDomain(createDefaultBattleContext()).createBattleDraw(...args);
