// One name tooltip owns enemy attack and special-effect descriptions.
export function enemyDetails(foe, intents, combat, affix) {
  const attack = intents.map(intent => `${intent.label}${intent.damage == null ? '' : ` · ${intent.damage}${intent.hits > 1 ? ` ×${intent.hits}（共${intent.totalDamage}）` : ''}`}${intent.bleedBonus ? ` · 流血 ${intent.bleedBonus} 层` : ''}`).join('；');
  const details = [`攻击方式：${attack || '无行动'}。基础攻击 ${foe.atk}${foe.affix === 'frenzy' ? '×2' : ''}`];
  if (foe.desc) details.push(foe.desc);
  if (affix) details.push(`${affix.name}：${affix.desc}`);
  if (foe.rotSeedMarked || foe.deathBurst) details.push('腐化标记：死亡时，对所有敌人造成等同于此时中毒层数的真实伤害');
  const echo = foe.damageEcho || (foe.soulContractMarked ? { amount:2 } : null);
  if (echo) details.push(`契约回响：${+echo.amount || 2}`);
  for (const [keys, metadata, curse] of [[combat.BUFFS, combat.BUFF_META, false], [combat.CURSES, combat.CURSE_META, true]]) {
    for (const key of keys) {
      const value = foe.status?.[key], meta = metadata[key];
      if (!(value > 0) || !meta) continue;
      const unit = meta.flag ? '生效中' : meta.timed || (curse && !meta.stack) ? `${value}回合` : curse ? `${value}层` : key === 'dodge' ? `${value}次` : `${value}`;
      details.push(`${meta.name} ${unit}：${meta.desc || ''}`);
    }
  }
  return details.join('\n');
}
