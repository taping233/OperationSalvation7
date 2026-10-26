// Shared by map entry and combat summons; battle restore keeps its stored stats.
export const ENEMY_MODE_MULTIPLIERS = Object.freeze({ standard: 1, elite: 1.35 });
export function scaleEnemyForMode(enemy, mode) {
  const multiplier = ENEMY_MODE_MULTIPLIERS[mode] || 1;
  if (!enemy || multiplier === 1) return enemy;
  return { ...enemy, hp: Math.round(enemy.hp * multiplier), atk: Math.round((enemy.atk || 2) * multiplier) };
}
