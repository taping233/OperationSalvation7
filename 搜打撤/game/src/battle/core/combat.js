import { createCombatRuntime } from './combat.factory.js';

// Compatibility consumers share the default instance; independent engines create their own.
const { COMBAT_HOOKS, TYPES, TYPE_NAME, dealDamage, addBleed, clearBleed, CURSES, CURSE_META, addCurse, hasCurse, purify, BUFFS, BUFF_META, addBlessing, isStealthed, breakStealth, tickPoison, tickDurations, canAct, parseNotation, ensureStatus, selfTest } = createCombatRuntime();
export { COMBAT_HOOKS, TYPES, TYPE_NAME, dealDamage, addBleed, clearBleed, CURSES, CURSE_META, addCurse, hasCurse, purify, BUFFS, BUFF_META, addBlessing, isStealthed, breakStealth, tickPoison, tickDurations, canAct, parseNotation, ensureStatus, selfTest };
