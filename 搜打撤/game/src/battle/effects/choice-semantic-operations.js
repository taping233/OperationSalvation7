// Choices preserve labels for the view, with separate executable plans. Gates
// register their declared turn-start operations without interpreting their text.
export function createChoiceSemanticOperations({ runtime, combat }) {
  function resolveOperation(card, operation, ports) {
    if (operation.op === 'choice') {
      ports.queueChoice({ cardName:card.name, options:operation.options.map(option => option.label),
        plans:operation.options, srcCard:card, otherAfterTurns:operation.otherAfterTurns || 0 });
      return true;
    }
    if (operation.op === 'freezeFirstEnemies') {
      for (const foe of ports.getAliveFoes().slice(0, operation.count)) combat.addCurse(foe, 'freeze', operation.duration);
      return true;
    }
    if (operation.op === 'randomCurse') {
      for (const foe of ports.getAliveFoes().slice()) {
        const fresh = operation.curses.filter(key => !(foe.status?.[key] > 0));
        const pool = operation.preferMissing && fresh.length ? fresh : operation.curses;
        combat.addCurse(foe, pool[Math.floor(ports.randomBattle() * pool.length)], operation.stacks);
      }
      return true;
    }
    if (operation.op === 'randomBlessing') {
      const targets = [{ unit:runtime.pstat, defense:runtime.pdef }];
      if (operation.target === 'allAllies') {
        runtime.allies.filter(ally => ally && !ally.dead && !ally.statless && ally.status && ally.hp > 0)
          .forEach(unit => targets.push({ unit, defense:unit.defense ||= { shield:0, armor:0, guard:false } }));
      }
      for (const { unit, defense } of targets) {
        const fresh = operation.choices.filter(key => key === 'purify' ? combat.hasCurse(unit)
          : key === 'armor' ? !(defense.armor > 0) : !(unit.status?.[key] > 0));
        const pool = operation.preferMissing && fresh.length ? fresh : operation.choices;
        const key = pool[Math.floor(ports.randomBattle() * pool.length)];
        if (key === 'purify') combat.purify(unit);
        else if (key === 'armor') defense.armor = (defense.armor || 0) + 5;
        else combat.addBlessing(unit, key, 1);
      }
      return true;
    }
    return null;
  }

  function* selectChoice(job, index, ports) {
    const option = job.plans?.[index];
    if (!option) return false;
    const register = (plan, delay = 0) => runtime.delayed.push({
      special:'choiceOps', ops:plan.ops, srcCard:job.srcCard, cardName:plan.label,
      repeat:plan.repeat === 'turnStart', ...(delay ? { notBeforeTurn:runtime.turn + delay } : {}),
    });
    if (option.repeat === 'turnStart') register(option);
    else yield* ports.stepsForOperations(job.srcCard, option.ops, ports.getAliveFoes()[0] || null);
    if (job.otherAfterTurns > 0 && job.plans.length === 2) register(job.plans[index === 0 ? 1 : 0], job.otherAfterTurns);
    return true;
  }

  return { resolveOperation, selectChoice };
}
