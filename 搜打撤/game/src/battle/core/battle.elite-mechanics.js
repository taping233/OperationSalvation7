// Enemy-side passives. Stored aura contributions make repeated sync/restore idempotent.
export function syncEliteAuras(foes) {
  const living = foes.filter(foe => !foe.dead && foe.hp > 0);
  for (const foe of foes) {
    const bonus = living.includes(foe)
      ? living.filter(other => other !== foe && other.eliteSkill === 'attackAura').length * 2 : 0;
    foe.atk += bonus - (foe.eliteAuraBonus || 0);
    foe.eliteAuraBonus = bonus;
    if (foe.eliteSkill === 'firstTurnStealth' && living.length <= 1 && foe.status) foe.status.stealth = 0;
  }
}

export function initializeEliteEnemies(foes) {
  for (const foe of foes) {
    if (foe.eliteSkill === 'firstTurnStealth') foe.status.stealth = 1;
  }
  syncEliteAuras(foes);
}

export function blocksPlayerPowerGain(foes) {
  return foes.some(foe => !foe.dead && foe.hp > 0 && foe.eliteSkill === 'blockPowerGain');
}

// Called only after a real death (revival has already had its chance).
export function applyEliteDeath(foes, deadFoe, { gainEnergy, log, resolveDefeat }) {
  if (deadFoe.eliteSkill === 'deathEnergy') {
    gainEnergy(1);
    log('[[icon:bolt]] <b>拾能囊虫</b> 死亡：主人公回复 1 点能量', 'ok');
  }
  // Take the event's recipients once: cascading deaths are separate events.
  const recipients = foes.filter(foe => foe !== deadFoe && !foe.dead && foe.hp > 0);
  for (const foe of recipients) {
    if (foe.eliteSkill === 'allyDeathRage') {
      foe.atk += 2;
      log('[[icon:swords]] <b>暴怒者</b>：友方死亡，攻击力 +2', 'warn');
    } else if (foe.eliteSkill === 'allyDeathLoss') {
      foe.hp = Math.max(0, foe.hp - 2);
      log('[[icon:skull]] <b>落难逃兵</b>：友方死亡，失去 2 点生命', 'sys');
    }
  }
  syncEliteAuras(foes);
  for (const foe of recipients) if (foe.hp <= 0 && !foe.dead) resolveDefeat(foe, '因友方阵亡倒下');
}
