/** Serializable facts store values at the commit point, never live cards or units. */
export function createBattleFacts(legacyDamageTurn = -1) {
  return { version: 1, events: legacyDamageTurn >= 0 ? [{ kind: 'legacyEnemyDamage', turn: legacyDamageTurn }] : [] };
}

export function recordDamageFact(history, { turn, targetSide, amount, target, card }) {
  if (!(amount > 0) || !Number.isFinite(amount)) return null;
  const event = Object.freeze({ kind: 'damage', turn, targetSide, amount,
    targetId: target?.id || null, targetName: target?.name || '', hpAfter: target?.hp ?? null,
    cardId: card?.id || null, cardName: card?.name || '' });
  history.events.push(event);
  return event;
}

export function hasEnemyDamageFact(history, turn) {
  return history.events.some(event => event.turn === turn &&
    (event.kind === 'legacyEnemyDamage' || event.kind === 'damage' && event.targetSide === 'enemy' && event.amount > 0));
}

export function recordCardCompletedFact(history, { turn, uid, card, movesBefore = 0, martialBefore = 0 }) {
  const event = Object.freeze({ kind: 'cardCompleted', turn, uid,
    cardId: card.id || null, cardName: card.name || '', cardType: card.type,
    movesAfter: movesBefore + (card.type === '武术' || card.type === '法术' ? 1 : 0),
    martialAfter: martialBefore + (card.type === '武术' ? 1 : 0) });
  history.events.push(event);
  return event;
}
