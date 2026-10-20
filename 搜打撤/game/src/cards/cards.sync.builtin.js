import { migrateBuiltinExecutionCard } from './builtin-card-execution.js';
import { validateCardRules } from './card-rules.schema.js';

// Re-check former declaration fingerprints so late imports are handled too.
// Only rule data changes; custom names, descriptions and explicit rules survive.
export function ensureBuiltinExecutionRules(api = window.SDT.Cards) {
  const original = api.all();
  let changed = 0;
  const next = original.map(card => {
    const migrated = migrateBuiltinExecutionCard(card);
    if (migrated === card) return card;
    const validation = validateCardRules(migrated);
    if (!validation.ok) throw new TypeError(`Invalid native execution ${card.id}: ${JSON.stringify(validation.errors)}`);
    changed++;
    return migrated;
  });
  if (changed && api.saveAll(next) === false) return false;
  return changed;
}
