// Read-only live card presentation; definitions and execution rules stay unchanged.
let provider = null;
export function registerCardStateProvider(read) { provider = read; }
export function cardStateContext() { return provider?.() || null; }

export function currentCardDescription(text, card, uid = card?._presentation?.uid, context) {
  const rule = card?.rules?.equip?.passive?.alternatingRefund
    || (card?.id === 'tt13-astrolabe' ? { types: ['武术', '法术'], amount: 1 } : null);
  if (!rule?.types?.length) return text;
  const types = rule.types;
  const general = `装备后首回合为${types[0]}相位，之后每回合依次切换（${types.join('→')}）。本回合首次打出相位对应的招式后，回复 ${rule.amount} 点能量。`;
  if (uid == null) return general;
  const snapshot = (context === undefined ? cardStateContext() : context)?.snapshot;
  if (!snapshot) return general;
  const state = snapshot.pstat?.requestedCards?.astrolabes?.[uid];
  const firstTurn = state?.firstTurn ?? snapshot.turn;
  const index = Math.abs(snapshot.turn - firstTurn) % types.length;
  const used = state?.turn === snapshot.turn && state.triggered;
  return `本回合：${types[index]}相位，${used ? '回能已触发' : `首次打出${types[index]}招式后回复 ${rule.amount} 点能量`}；下回合：${types[(index + 1) % types.length]}相位。${general}`;
}

export function liveCardOptions(card, options) {
  if (options?.costOverride != null) return options;
  const uid = card?._presentation?.uid;
  const context = uid != null && cardStateContext();
  if (!context) return options;
  return { ...options, costOverride: { v: context.effCostOf(card, uid), base: card._baseCost ?? card._presentation.baseCost ?? card.cost } };
}
