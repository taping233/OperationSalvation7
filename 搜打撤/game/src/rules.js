import { sdtDefine } from './sdt-facade.js';
/* 跨模块规则的唯一代码真源。文档规则见 docs/rules.md。 */
const groups = {
  map: { diceSides: 3, stepMs: 340, emergencyExitCost: 10, fireHeal: 8, fireClassCardChance: 0.3, staminaMax: 60, staminaWarn: 10 },
  battle: { energy: 2, startDraw: 5, turnDraw: 1, handMax: 8, bossDeckSize: 15, starterAttack: 5 },
  backpack: { start: 16, max: 30, upgradeWood: 2, safeStart: 2, safeMax: 6, safeUpgradeRations: 2 },
  base: { stashStart: 25, stashMax: 49, stashUpgradeWood: 2, stashUpgradeSlots: 3 },
  growth: { playerMaxHp: 30, playerAtk: 4 },
};
Object.values(groups).forEach(Object.freeze);

// 顶层别名保留给 v0.51 现有模块与 window.SDT 调试脚本；新代码优先使用分组字段。
const RULES = Object.freeze({
  ...groups,
  diceSides: groups.map.diceSides,
  stepMs: groups.map.stepMs,
  emergencyExitCost: groups.map.emergencyExitCost,
  fireHeal: groups.map.fireHeal,
  fireClassCardChance: groups.map.fireClassCardChance,
  staminaMax: groups.map.staminaMax,
  staminaWarn: groups.map.staminaWarn,
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
