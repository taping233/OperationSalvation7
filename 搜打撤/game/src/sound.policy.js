// hit/hurt/strike：多段与 AOE 同帧结算会叠加爆响（audio-design 审查 P1#3），短冷却合并为一次
// buffUp/buffDown：开局被动/形态卡可能一帧挂多个增益，防同帧叠响（P2#6）
// foeLunge：多敌人同帧行动会叠前摇呼啸
// curse/parry/coin（迭代评审 09-20）：curse 在多敌 AOE 循环内逐敌触发（battle.core 敌方阶段），
// parry 连续格挡、coin 连续结算同样存在同帧叠响，纳入统一节流
const SFX_COOLDOWN_MS = Object.freeze({ click: 28, hover: 55, scene: 110, hit: 45, hurt: 60, strike: 45, buffUp: 80, buffDown: 120, foeLunge: 60, curse: 60, parry: 45, coin: 80 });

function shouldPlaySfx(name, now, lastAt = new Map()) {
  const cooldown = SFX_COOLDOWN_MS[name] || 0;
  const previous = lastAt.get(name);
  if (cooldown && previous != null && now - previous < cooldown) return false;
  if (cooldown) lastAt.set(name, now);
  return true;
}

export { SFX_COOLDOWN_MS, shouldPlaySfx };
