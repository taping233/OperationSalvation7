// @ts-check
import { RULE_CONFIG } from '../core/rule-config.js';

/** @typedef {{ eggPity?: number, eggBattles?: number }} PetEggBaseState */
/** @typedef {{ read: () => PetEggBaseState, persistPity: (next: number) => boolean, persistBattles?: (next: number) => boolean }} PetEggPorts */
/** @typedef {{ eggPity: number, persisted: boolean }} PetEggRecordResult */
/** @typedef {{ eggBattles: number, persisted: boolean }} PetEggBattleResult */

/**
 * Base-owned pet-egg rules. `persistPity` owns the narrow legacy fallback for
 * a failed write; `persisted: false` means memory/reward progression may still
 * have happened, but this result did not reach durable storage.
 * @param {PetEggPorts} ports
 */
export function createBasePetEggCommands({ read, persistPity, persistBattles }) {
  /** @returns {number} */
  function petEggDropChance() {
    const state = read();
    const pityN = (state.eggPity || 0) + 1;
    return RULE_CONFIG.rewards.petEggBaseChance +
      RULE_CONFIG.rewards.petEggMissBonus * (pityN - 1) +
      RULE_CONFIG.rewards.petEggBattleBonus * (state.eggBattles || 0);
  }

  /**
   * Record the result of one already-rolled chest. A missing or duplicate egg
   * counts as a miss, matching the previous chest flow.
   * @param {{ eggGranted: boolean }} input
   * @returns {PetEggRecordResult}
   */
  function recordPetEggChestResult({ eggGranted }) {
    const state = read();
    const next = eggGranted ? 0 : (state.eggPity || 0) + 1;
    const persisted = persistPity(next);
    return { eggPity: next, persisted };
  }

  /**
   * Record one no-slot battle victory for the egg drop bonus (2026-09-29 收敛：
   * 原 game.bag.settle 战后直写 Base.data.eggBattles 移入命令层)。槽位对局的计数
   * 走结算事务（battle-settlement.commands 的 afterBase），不经过本命令。
   * 沿用保底计数的旧语义：先内存推进，持久化失败不回滚，仅以 persisted:false 标记。
   * @returns {PetEggBattleResult}
   */
  function recordEggBattle() {
    const next = (read().eggBattles || 0) + 1;
    const persisted = persistBattles ? persistBattles(next) === true : false;
    return { eggBattles: next, persisted };
  }

  return Object.freeze({ petEggDropChance, recordPetEggChestResult, recordEggBattle });
}
