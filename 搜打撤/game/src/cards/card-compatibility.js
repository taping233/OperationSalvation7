/** Historical identity exceptions belong here, separate from rule execution.
 * Keep identity gates exact: matching a hosted ability alone must not change
 * the immediate text of a custom card. Explicit rule domains keep authority. */
/** @param {import('./card-execution-plan.types').ExecutionCard} card */
export function suppressLegacyImmediateText(card) {
  return card.id === 'tt2-venomstaff'
    && !!card.rules?.battle?.hosted?.includes('venom-staff')
    && !card.rules?.triggers && !card.rules?.equip && !card.rules?.bag;
}

/** The pass fragment's historical exclusion applies to drop selection only.
 * It does not change the general discover/class pool contracts.
 * @param {{id?:string}} card */
export function isLegacyDropExcluded(card) {
  return card.id === 'tt-token-color';
}
