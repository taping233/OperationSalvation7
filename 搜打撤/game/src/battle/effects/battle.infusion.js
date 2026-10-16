/** Instance waivers and the battle-wide move blessing share the same play semantics. */
export function hasInfusionWaiver(card, allSpellsInfused = false) {
  return !!card?._noInfuse || !!(allSpellsInfused && ['武术', '法术'].includes(card?.type));
}
