/* Card-cost rules are value-in/value-out; runtime state is collected by battle.engine.js. */
export function calculateEffectiveCardCost(card, uid, state) {
  if (state.unlimitedRune && ['武术', '法术'].includes(card.type) && uid && String(uid).startsWith('bts')) return Math.max(0, (+(card.cost || 0)) - 1);
  if (uid && ((state.zeroFeeTurn || 0) >= state.turn)) return 0;
  if (state.cosmosForm > 0) return 1;
  if (state.spellCost1 && card.type === '法术') return 1;
  if (state.meleeCost1 && card.type === '武术') return 1;
  const desc = String(card.desc || '');
  if (/上一张牌是武术/.test(desc) && state.lastPlayedType === '武术') return 0;
  if (/本回合每打出一张其他武术/.test(desc)) return Math.max(0, (+card.cost || 0) - state.playedMartialThisTurn);
  if (/护甲为\s*0[.。，,]?\s*本牌变为\s*0\s*费/.test(desc) && state.armor === 0) return 0;
  return card.cost;
}
