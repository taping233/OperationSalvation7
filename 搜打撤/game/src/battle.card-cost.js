/* Card-cost rules are value-in/value-out; runtime state is collected by battle.engine.js. */
export function pocketSpellDiscountFor(card) {
  const modifiers = card && card.rules && card.rules.battle && card.rules.battle.costModifiers;
  if (Array.isArray(modifiers)) {
    const rule = modifiers.find(item => item.kind === 'consumedSpellDiscount');
    return rule ? (+rule.amount || 0) : 0;
  }
  const match = String(card.desc || '').match(/消耗口袋中每有一张法术牌[，,]?\s*本牌费用\s*-\s*(\d+)/);
  return match ? +match[1] : 0;
}

export function decayEffectiveCardCost(card, amount = 1) {
  if (!card) return card;
  const currentCost = Math.max(0, +(card.cost || 0));
  const nextCost = Math.max(0, currentCost - Math.max(0, +amount || 0));
  if (nextCost === currentCost) return card;
  return { ...card, cost: nextCost, _baseCost: card._baseCost != null ? card._baseCost : currentCost };
}

export function calculateEffectiveCardCost(card, uid, state) {
  // Infinite Rune applies only to battle-acquired moves and has the highest priority.
  if (state.unlimitedRune && ['武术', '法术'].includes(card.type) && uid && String(uid).startsWith('bts')) {
    return Math.max(0, (+(card.cost || 0)) - 1);
  }
  if (uid && ((state.zeroFeeTurn || 0) >= state.turn)) return 0;
  if (state.cosmosForm > 0) return 1;
  if (state.spellCost1 && card.type === '法术') return 1;
  if (state.meleeCost1 && card.type === '武术') return 1;

  const modifiers = card && card.rules && card.rules.battle && card.rules.battle.costModifiers;
  if (Array.isArray(modifiers)) {
    const previousFree = modifiers.find(item => item.kind === 'previousCardTypeFree');
    if (previousFree && state.lastPlayedType === (previousFree.type || '武术')) return 0;
    const martialDiscount = modifiers.find(item => item.kind === 'martialPlayedDiscount');
    if (martialDiscount) {
      return Math.max(0, (+card.cost || 0) - state.playedMartialThisTurn * (+martialDiscount.amount || 0));
    }
    if (modifiers.some(item => item.kind === 'armorZeroFree') && state.armor === 0) return 0;
    const consumedDiscount = modifiers.find(item => item.kind === 'consumedSpellDiscount');
    if (consumedDiscount && state.consumedSpellCount > 0) {
      return Math.max(0, (+card.cost || 0) - state.consumedSpellCount * (+consumedDiscount.amount || 0));
    }
    return card.cost;
  }

  const desc = String(card.desc || '');
  if (/上一张牌是武术/.test(desc) && state.lastPlayedType === '武术') return 0;
  if (/本回合每打出一张其他武术/.test(desc)) {
    return Math.max(0, (+card.cost || 0) - state.playedMartialThisTurn);
  }
  if (/护甲为\s*0[.。，,]?\s*本牌变为\s*0\s*费/.test(desc) && state.armor === 0) return 0;
  if (/没有护甲[，,]?\s*该牌变为\s*0\s*费/.test(desc) && state.armor === 0) return 0;
  if (state.pocketDiscount && state.consumedSpellCount > 0) {
    return Math.max(0, (+card.cost || 0) - state.consumedSpellCount * state.pocketDiscount);
  }
  return card.cost;
}
