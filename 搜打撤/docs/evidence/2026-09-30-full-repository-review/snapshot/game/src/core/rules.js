import { sdtDefine } from './sdt-facade.js';
import { RULE_CONFIG } from './rule-config.js';
/* 跨模块规则的唯一代码真源。文档规则见 docs/rules.md。 */
const groups = RULE_CONFIG;

// 顶层别名保留给 v0.51 现有模块与 window.SDT 调试脚本；新代码优先使用分组字段。
const RULES = Object.freeze({
  ...groups,
  stepMs: groups.map.stepMs,
  emergencyExitCost: groups.map.emergencyExitCost,
  fireHeal: groups.map.fireHeal,
  fireClassCardChance: groups.map.fireClassCardChance,
  playerMaxHp: groups.growth.playerMaxHp,
  playerAtk: groups.growth.playerAtk,
  bagSize: groups.backpack.start,
  bagMax: groups.backpack.max,
  bagUpgradeWood: groups.backpack.upgradeWood,
  safeStart: groups.backpack.safeStart,
  safeMax: groups.backpack.safeMax,
  safeUpgradeRations: groups.backpack.safeUpgradeRations,
  stashStart: groups.base.stashStart,
  stashMax: groups.base.stashMax,
  stashUpgradeWood: groups.base.stashUpgradeWood,
  stashUpgradeSlots: groups.base.stashUpgradeSlots,
  battleEnergy: groups.battle.energy,
  battleStartDraw: groups.battle.startDraw,
  battleTurnDraw: groups.battle.turnDraw,
  battleHandMax: groups.battle.handMax,
  bossDeckSize: groups.battle.bossDeckSize,
  starterSha: groups.battle.starterAttack,
});

sdtDefine('RULES', RULES);

export { RULES };
