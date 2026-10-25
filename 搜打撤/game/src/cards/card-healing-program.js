// Self-effect schema metadata. Execution retains its existing context-specific paths.
const healingSources = ['amountField', 'amount', 'upTo', 'selfDamage', 'perFuelCost', 'perSpellHeal'];
export const SELF_EFFECT_DEFINITIONS = {
  heal: { sources: healingSources, keys: healingSources },
  armor: { sources: ['amountField', 'amount', 'priceOf'], keys: ['amountField', 'amount', 'guard', 'decayAtTurnEnd', 'priceOf', 'consumeEquip'] },
  draw: { sources: ['amountField', 'amount', 'untilHandN', 'range', 'perCurseKinds'], keys: ['amountField', 'amount', 'untilHandN', 'handOps', 'range', 'perCurseKinds', 'filter'] },
};
