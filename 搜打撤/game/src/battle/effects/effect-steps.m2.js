import { createM2Domain } from './effect-steps.m2.domain.js';
import { defaultBattleRuntime as runtime } from '../runtime/battle.runtime.default.js';

// The browser compatibility path binds the one default battle at each call.
/** @type {ReturnType<typeof createM2Domain>['resolveStealAtk']} */
export const resolveStealAtk = (...args) => createM2Domain({ runtime }).resolveStealAtk(...args);
/** @type {ReturnType<typeof createM2Domain>['resolveNoDrawNext']} */
export const resolveNoDrawNext = (...args) => createM2Domain({ runtime }).resolveNoDrawNext(...args);
/** @type {ReturnType<typeof createM2Domain>['resolveExtraTurn']} */
export const resolveExtraTurn = (...args) => createM2Domain({ runtime }).resolveExtraTurn(...args);
/** @type {ReturnType<typeof createM2Domain>['resolveRegisterRule']} */
export const resolveRegisterRule = (...args) => createM2Domain({ runtime }).resolveRegisterRule(...args);
/** @type {ReturnType<typeof createM2Domain>['applyDamageOnKill']} */
export const applyDamageOnKill = (...args) => createM2Domain({ runtime }).applyDamageOnKill(...args);
/** @type {ReturnType<typeof createM2Domain>['applyAtkDown']} */
export const applyAtkDown = (...args) => createM2Domain({ runtime }).applyAtkDown(...args);
/** @type {ReturnType<typeof createM2Domain>['restoreAtkDown']} */
export const restoreAtkDown = (...args) => createM2Domain({ runtime }).restoreAtkDown(...args);
/** @type {ReturnType<typeof createM2Domain>['matchesExecuteCap']} */
export const matchesExecuteCap = (...args) => createM2Domain({ runtime }).matchesExecuteCap(...args);
/** @type {ReturnType<typeof createM2Domain>['executeTargetReason']} */
export const executeTargetReason = (...args) => createM2Domain({ runtime }).executeTargetReason(...args);
/** @type {ReturnType<typeof createM2Domain>['resolveExecute']} */
export const resolveExecute = (...args) => createM2Domain({ runtime }).resolveExecute(...args);
/** @type {ReturnType<typeof createM2Domain>['resolveFoeFight']} */
export const resolveFoeFight = (...args) => createM2Domain({ runtime }).resolveFoeFight(...args);
/** @type {ReturnType<typeof createM2Domain>['resolveCopyRandom']} */
export const resolveCopyRandom = (...args) => createM2Domain({ runtime }).resolveCopyRandom(...args);
/** @type {ReturnType<typeof createM2Domain>['countCurseKinds']} */
export const countCurseKinds = (...args) => createM2Domain({ runtime }).countCurseKinds(...args);
/** @type {ReturnType<typeof createM2Domain>['resolveSummon']} */
export const resolveSummon = (...args) => createM2Domain({ runtime }).resolveSummon(...args);
/** @type {ReturnType<typeof createM2Domain>['resolveConsumeEquip']} */
export const resolveConsumeEquip = (...args) => createM2Domain({ runtime }).resolveConsumeEquip(...args);
/** @type {ReturnType<typeof createM2Domain>['handMoveCurses']} */
export const handMoveCurses = (...args) => createM2Domain({ runtime }).handMoveCurses(...args);
/** @type {ReturnType<typeof createM2Domain>['isLastHandCard']} */
export const isLastHandCard = (...args) => createM2Domain({ runtime }).isLastHandCard(...args);
