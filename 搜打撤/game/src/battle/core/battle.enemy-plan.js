/** One read-only decision for intent, forecast and the next enemy action. */
export function buildEnemyActionPlan(foe, round = 1) {
  const turn = round || 1;
  const kind = foe.behavior || (foe.affix === 'grow' ? 'general' : foe.affix === 'frenzy' ? 'orc_boss' : foe.affix === 'aegis' ? 'element_boss' : 'strike');
  const skip = foe.dead ? 'dead' : foe.stunned ? 'stunned'
    : foe.evenAttack && turn % 2 === 1 ? 'oddRound'
    : foe.noFirstAttack && turn === 1 ? 'firstRound'
    : (foe.status?.freeze || 0) > 0 ? 'frozen' : null;
  return Object.freeze({ kind, skip, canAttack: skip === null, hits: foe.affix === 'frenzy' ? 2 : 1 });
}

/** Forecast copies use their simulated HP; stealthed allies cannot intercept attacks. */
export function findEnemyAttackGuard(allies) {
  return allies.find(ally => !ally.dead && !ally.statless && ally.hp > 0 && !(ally.status?.stealth > 0));
}
