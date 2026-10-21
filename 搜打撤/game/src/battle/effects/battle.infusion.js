import { splitEffectClauses } from './battle.effect-clauses.js';

/** Instance waivers and the battle-wide move blessing share the same play semantics. */
export function hasInfusionWaiver(card, allSpellsInfused = false) {
  return !!card?._noInfuse || !!(allSpellsInfused && ['武术', '法术'].includes(card?.type));
}

const REQUIRED_HOSTED_EFFECTS = new Set([
  'infused-immune-spell', 'infused-ray', 'infused-price-heal', 'infused-fireball-burst',
]);

/** Structural play requirement, never a prediction of damage against today's target. */
export function requiresInfusion(card, normalizeCard = card => card) {
  if (card?.rules?.battle?.requirements?.some(rule => rule.kind === 'infused')) return true;
  const execution = normalizeCard(card);
  // Structured operations and equipment registration have independent effects;
  // their editable description must not override their executable contract.
  if (!execution || execution.rules?.triggers || execution.rules?.equip || execution.rules?.bag
    || ['装备', '生物'].includes(execution.type)) return false;
  const hosted = execution.rules?.battle?.hosted;
  if (hosted?.some(effect => REQUIRED_HOSTED_EFFECTS.has(effect))) return true;
  // Legacy text-only cards share the resolver's clause parser. Hosted cards use
  // canonical source text, never the player's editable display description.
  const desc = String(execution.desc || '').trim();
  const gated = text => /^注能\s*[（(][^）)]*[）)][：:]?/.test(text);
  if (!gated(desc)) return false;
  const parts = splitEffectClauses(desc);
  return parts.immediate.length > 0 && parts.immediate.every(gated)
    && !parts.turnStart.length && !parts.battle.length && !parts.skill.length;
}

export function missingInfusionReason(card, fuelCount = 0, allSpellsInfused = false, normalizeCard = card => card) {
  return requiresInfusion(card, normalizeCard) && !fuelCount && !hasInfusionWaiver(card, allSpellsInfused)
    ? `【${card.name}】需要先注能才能打出，未注能时没有效果` : '';
}
