// @ts-check
import { RULE_CONFIG } from '../core/rule-config.js';

/** @typedef {{ eggPity?: number, eggBattles?: number }} PetEggBaseState */
/** @typedef {{ read: () => PetEggBaseState, persistPity: (next: number) => boolean }} PetEggPorts */
/** @typedef {{ eggPity: number, persisted: boolean }} PetEggRecordResult */

/**
 * Base-owned pet-egg rules. `persistPity` owns the narrow legacy fallback for
 * a failed write; `persisted: false` means memory/reward progression may still
 * have happened, but this result did not reach durable storage.
 * @param {PetEggPorts} ports
 */
export function createBasePetEggCommands({ read, persistPity }) {
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

  return Object.freeze({ petEggDropChance, recordPetEggChestResult });
}
