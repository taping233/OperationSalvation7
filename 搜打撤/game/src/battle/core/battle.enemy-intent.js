/* Enemy-intent projection from an enemy definition, round, and player status values. */
import { buildEnemyActionPlan } from './battle.enemy-plan.js';
const INTENT_META = {
  strike: ['[[icon:swords]]', '攻击'], volley: ['[[icon:swords]]', '攻击'], charge: ['[[icon:swords]]', '攻击'],
  guard: ['[[icon:swords]]', '攻击'], curse: ['[[icon:skull]]', '攻击并施加诅咒'],
  dragon: ['[[icon:demon]]', '攻击·阶段效果'], general: ['[[icon:arrow]]', '攻击·回合末强化'],
  orc_boss: ['[[icon:tools]]', '双击并施加诅咒'], element_boss: ['[[icon:crystal]]', '攻击·偶数回合庇幕'],
};

export function calculateEnemyIntent(def, round, playerStatus) {
  const { kind, skip, hits } = buildEnemyActionPlan(def, round);
  const meta = INTENT_META[kind] || INTENT_META.strike;
  // Even-attack enemies charge on odd rounds, matching the enemy phase.
  if (skip === 'oddRound' || skip === 'stunned') {
    return { kind, icon: '[[icon:crystal]]', label: '蓄力·下回合行动', damage: null, hits: 1 };
  }
  if (skip === 'firstRound') {
    return { kind, icon: '[[icon:crystal]]', label: '蓄力·首回合不攻击', damage: null, hits: 1 };
  }
  if (skip === 'frozen' || skip === 'dead') {
    return { kind, icon: '[[icon:crystal]]', label: skip === 'frozen' ? '冰冻·无法行动' : '已退场', damage: null, hits: 1 };
  }
  const bleed = (playerStatus && playerStatus.bleed) || 0;
  const atk = Math.max(0, def.atk || 0);
  return { kind, icon: meta[0], label: kind === 'orc_boss' && hits === 1 ? '攻击' : meta[1], damage: atk + bleed, hits, bleedBonus: bleed };
}
