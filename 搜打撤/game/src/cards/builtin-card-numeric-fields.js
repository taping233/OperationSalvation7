import { ownsBuiltinExecutionDomain } from './builtin-card-execution.js';
import { BUILTIN_CARD_FIELD_DEFAULTS } from './builtin-card-field-defaults.js';

function directOperations(card) {
  const rules = card.rules;
  return [...Object.values(rules?.triggers || {}).flatMap(value => Array.isArray(value) ? value : []),
    ...(rules?.equip?.onEquip || []), ...(rules?.equip?.battleStart || []), ...(rules?.equip?.skill?.ops || []),
    ...(rules?.bag?.use || [])];
}

// Native startup repair reads declared inputs and verified numeric defaults.
// Editable display text never participates, including zero and absent fields.
export function nativeNumericField(card, field) {
  if (!ownsBuiltinExecutionDomain(card)) return undefined;
  const explicit = Number(card[field]);
  if (Number.isFinite(explicit) && explicit !== 0) return explicit;
  const operations = directOperations(card);
  const value = BUILTIN_CARD_FIELD_DEFAULTS[card.id]?.[field];
  if (typeof value === 'number' && value !== 0 && field !== 'infuse' && !(field === 'dmg' && !['武术', '法术'].includes(card.type))) {
    const literal = operations.find(operation => operation?.op === (field === 'dmg' ? 'damage' : field)
      && typeof operation.amount === 'number' && operation.when === undefined);
    if (literal) return literal.amount;
  }
  return typeof value === 'number' ? value : 0;
}

export function nativeDamageType(card) {
  if (!ownsBuiltinExecutionDomain(card)) return undefined;
  const value = BUILTIN_CARD_FIELD_DEFAULTS[card.id]?.dmgType;
  return typeof value === 'string' ? value : null;
}
