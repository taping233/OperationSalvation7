// hit/hurt/strike：多段与 AOE 同帧结算会叠加爆响（audio-design 审查 P1#3），短冷却合并为一次
// buffUp/buffDown：开局被动/形态卡可能一帧挂多个增益，防同帧叠响（P2#6）
// foeLunge：多敌人同帧行动会叠前摇呼啸
// curse/parry/coin（迭代评审 09-20）：curse 在多敌 AOE 循环内逐敌触发（battle.core 敌方阶段），
// parry 连续格挡、coin 连续结算同样存在同帧叠响，纳入统一节流
const SFX_COOLDOWN_MS = Object.freeze({
  click: 28, hover: 55, scene: 110,
  hit: 45, hurt: 60, strike: 45, kill: 90,
  buffUp: 80, buffDown: 120, foeLunge: 60, curse: 60, curseEnd: 160,
  parry: 45, coin: 80, cardSelect: 45, discard: 65, burn: 80, rarePlay: 180,
  danger: 300, energyUp: 45, energyDown: 45, shieldUp: 220, shieldBreak: 100, armorBreak: 120, phase: 180,
  attackSlash: 45, attackPierce: 45, attackArrow: 45, attackBlunt: 60,
  attackFire: 80, attackIce: 80, attackLightning: 80, attackPoison: 80, attackPsychic: 80, attackBossHeavy: 120,
  phaseSelf: 180, phaseFoe: 180, eventEnter: 110, bossReveal: 300,
  fireEnter: 250, altarEnter: 250, doorEnter: 250, shopEnter: 250, extractionEnter: 250,
  eventComplete: 180, achievementUnlock: 180, collectionUnlock: 180,
});

const SFX_PRIORITY = Object.freeze({
  victory: 6, bossVictory: 6, defeat: 6, runClear: 6, extractionSuccess: 6,
  danger: 5, phase: 4, kill: 4, shieldBreak: 5, armorBreak: 5, rarePlay: 4, curseEnd: 4,
  hurt: 3, hit: 3, strike: 3, foeLunge: 3, shieldUp: 2, energyUp: 2, energyDown: 2,
  curse: 2, cardSelect: 1, discard: 1, burn: 1, hover: 0,
  attackSlash: 3, attackPierce: 3, attackArrow: 3, attackBlunt: 3,
  attackFire: 3, attackIce: 3, attackLightning: 3, attackPoison: 3, attackPsychic: 3, attackBossHeavy: 4,
  phaseSelf: 4, phaseFoe: 4, bossReveal: 5,
});

function shouldPlaySfx(name, now, lastAt = new Map()) {
  const cooldown = SFX_COOLDOWN_MS[name] || 0;
  const previous = lastAt.get(name);
  if (cooldown && previous != null && now - previous < cooldown) return false;
  const recent = lastAt.get('__recentSfx') || [];
  const live = recent.filter(time => now >= time && now - time < 45);
  const priority = SFX_PRIORITY[name] ?? 2;
  // 密集结算时收敛操作/装饰声，危险与战斗结果提示仍可穿透。
  if (priority <= 1 && live.length >= 4) { lastAt.set('__recentSfx', live); return false; }
  if (cooldown) lastAt.set(name, now);
  live.push(now);
  lastAt.set('__recentSfx', live);
  return true;
}

export { SFX_COOLDOWN_MS, SFX_PRIORITY, shouldPlaySfx };
