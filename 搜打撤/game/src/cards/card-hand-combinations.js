// Built-in hand collection identities share one recipe with their arrival policy.
export const SWORD_HAND_COMBINATION = Object.freeze({
  ingredients:Object.freeze(['tt8-heavensword', 'tt8-demonslay']),
  result:'tt8-archdemon',
});

export const retainsDrawnSwordInHand = card => SWORD_HAND_COMBINATION.ingredients.includes(card?.id);
