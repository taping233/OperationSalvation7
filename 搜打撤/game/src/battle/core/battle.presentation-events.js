// Semantic feedback only: no resource changes, waits, or action queue entries.
export function createBattlePresentation({ readState, emitEvent }) {
  let eventSequence = 0;
  function emitBattlePresentation(event) {
    const { game, foes, signal, battleToken } = readState();
    if (!game?.battleActive || game.hp <= 0 || signal?.aborted || !foes.some(foe => !foe.dead)) return false;
    emitEvent({ ...event, eventId: ++eventSequence, battleToken });
    return true;
  }
  /** @param {Parameters<import('./battle.core-ports.types.js').EffectCommands['emitRecast']>[0]} event */
  function emitRecast({ card, uid, source, repeatIndex, repeatTotal, scope = 'card' }) {
    return emitBattlePresentation({ kind: 'recast', uid, name: card.name, card: { ...card },
      source, repeatIndex, repeatTotal, scope });
  }
  return { emitBattlePresentation, emitRecast };
}
