/* Enemy-intent projection from an enemy definition, round, and player status values. */
const INTENT_META = {
  strike: ['[[icon:swords]]', '攻击'], volley: ['[[icon:swords]]', '攻击'], charge: ['[[icon:swords]]', '攻击'],
  guard: ['[[icon:swords]]', '攻击'], burn: ['[[icon:fire]]', '攻击并灼烧'], curse: ['[[icon:skull]]', '攻击并施加诅咒'],
  dragon: ['[[icon:demon]]', '攻击·阶段效果'], general: ['[[icon:arrow]]', '攻击·回合末强化'],
  orc_boss: ['[[icon:tools]]', '双击并施加诅咒'], element_boss: ['[[icon:crystal]]', '攻击·偶数回合庇幕'],
};

export function calculateEnemyIntent(def, round, playerStatus) {
  const kind = def.behavior || (def.affix === 'grow' ? 'general' : def.affix === 'frenzy' ? 'orc_boss' : def.affix === 'aegis' ? 'element_boss' : 'strike');
  const meta = INTENT_META[kind] || INTENT_META.strike;
  const hits = def.affix === 'frenzy' || kind === 'orc_boss' ? 2 : 1;
  // Even-attack enemies charge on odd rounds, matching the enemy phase.
  if (def.evenAttack && ((round || 1) % 2 === 1)) {
    return { kind, icon: '[[icon:crystal]]', label: '蓄力·下回合行动', damage: null, hits: 1 };
  }
  const bleed = (playerStatus && playerStatus.bleed) || 0;
  const atk = Math.max(0, def.atk || 0);
  return { kind, icon: meta[0], label: meta[1], damage: atk + bleed, hits, bleedBonus: bleed };
}
