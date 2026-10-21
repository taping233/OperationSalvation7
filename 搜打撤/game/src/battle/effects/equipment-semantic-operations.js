// Equipment events read declared parameters. Card identity and display text do
// not select behavior; all mutable counters belong to the injected battle.
export function createEquipmentSemanticOperations({ runtime, combat, random, alive, hitFoe, drawCards }) {
  const passives = () => runtime.equipped.filter(entry => entry?.card?.rules?.equip?.passive);
  const state = () => {
    const requested = runtime.pstat.requestedCards ||= { damageTurn:-1, flameForms:[], astrolabes:{} };
    requested.astrolabes ||= {};
    return requested;
  };
  const isCurrent = token => runtime.battleState.token === token && runtime.G?.battleActive !== false;

  function registerEquipment(entry) {
    if (entry.card.rules?.equip?.passive?.alternatingRefund) {
      state().astrolabes[entry.uid] = { firstTurn:runtime.turn };
    }
  }

  function playerDamaged(amount) {
    if (!(amount > 0) || runtime.G.hp <= 0) return;
    const token = runtime.battleState.token;
    for (const entry of passives()) {
      if (!isCurrent(token)) return;
      const response = entry.card.rules.equip.passive.damageResponse;
      if (!response) continue;
      const targets = alive();
      if (targets.length) hitFoe(targets[Math.floor(random() * targets.length)], entry.card,
        response.damage, combat.TYPES.FIXED, '', { preserveBaseDamage:true });
      if (!isCurrent(token)) return;
      if (random() < response.drawChance) drawCards(response.draw);
    }
  }

  function cardPlayed(card) {
    // This hook runs before the original completion counters advance. A second
    // card of the same type cannot receive a late refund after mid-turn equip.
    if (card.type === '武术' && runtime.playedMartialThisTurn > 0) return;
    if (card.type === '法术' && runtime.playedMovesThisTurn - runtime.playedMartialThisTurn > 0) return;
    for (const entry of passives()) {
      const rule = entry.card.rules.equip.passive.alternatingRefund;
      if (!rule) continue;
      const old = state().astrolabes[entry.uid] || { firstTurn:runtime.turn };
      const firstTurn = old.firstTurn ?? runtime.turn;
      const required = rule.types[Math.abs(runtime.turn - firstTurn) % rule.types.length];
      const current = old.turn === runtime.turn ? { ...old } : { turn:runtime.turn, triggered:false };
      if (!current.triggered && card.type === required) {
        current.triggered = true;
        runtime.set$energy(runtime.energy + rule.amount);
      }
      state().astrolabes[entry.uid] = { ...current, firstTurn };
    }
  }

  function checkInfusionUnlock() {
    if (runtime.sealUnlocked) return false;
    const entry = passives().find(e => {
      const rule = e.card.rules.equip.passive.infusionUnlock;
      return rule && runtime.infuseFuels >= rule.fuel;
    });
    if (!entry) return false;
    const rule = entry.card.rules.equip.passive.infusionUnlock;
    runtime.set$sealUnlocked(true);
    combat.addBlessing(runtime.pstat, 'spellUp', rule.spellPower);
    const drawn = drawCards(rule.draw);
    runtime.G.log(`[[icon:crystal]] <b>装备解锁</b>：法伤 +${rule.spellPower}，抽了 ${drawn} 张牌`, 'ok');
    return true;
  }

  function heroSkillCost(skill) {
    const rules = passives().map(e => e.card.rules.equip.passive.heroSkillCost)
      .filter(rule => rule && runtime.hand.length <= rule.maxHand);
    if (!rules.length) return skill;
    const cost = Math.min(skill.cost, ...rules.map(rule => rule.cost));
    return { ...skill, cost, hint:skill.hint?.replace(/^\d+ 费/, `${cost} 费`) };
  }

  return { registerEquipment, playerDamaged, cardPlayed, checkInfusionUnlock, heroSkillCost };
}
