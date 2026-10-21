import { hasInfusionWaiver, requiresInfusion, missingInfusionReason } from './battle.infusion.js';

/** Bind canonical hosted-card normalization only at engine composition. */
export function createInfusionDomain(context) {
  return {
    hasInfusionWaiver,
    requiresInfusion: card => requiresInfusion(card, context.normalizeCard),
    missingInfusionReason: (card, fuelCount, allSpellsInfused) => missingInfusionReason(card, fuelCount, allSpellsInfused, context.normalizeCard),
  };
}
