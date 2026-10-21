import { createM1Domain } from './effect-steps.m1.domain.js';
import { defaultBattleRuntime as runtime } from '../runtime/battle.runtime.default.js';

// The browser compatibility path binds the one default battle at each call.
/** @type {ReturnType<typeof createM1Domain>['resolveCleanseOperation']} */
export const resolveCleanseOperation = (...args) => createM1Domain({ runtime }).resolveCleanseOperation(...args);
/** @type {ReturnType<typeof createM1Domain>['resolveDrawUntilHandN']} */
export const resolveDrawUntilHandN = (...args) => createM1Domain({ runtime }).resolveDrawUntilHandN(...args);
/** @type {ReturnType<typeof createM1Domain>['resolveDrawHandOps']} */
export const resolveDrawHandOps = (...args) => createM1Domain({ runtime }).resolveDrawHandOps(...args);
