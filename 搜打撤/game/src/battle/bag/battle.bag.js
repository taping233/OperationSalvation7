import { createBagDomain } from './battle.bag.domain.js';
import { createDefaultBattleContext } from '../core/battle.default-context.js';

// The browser compatibility path binds the one default battle at each call.
/** @type {ReturnType<typeof createBagDomain>['createBattleBag']} */
export const createBattleBag = (...args) => createBagDomain(createDefaultBattleContext()).createBattleBag(...args);
