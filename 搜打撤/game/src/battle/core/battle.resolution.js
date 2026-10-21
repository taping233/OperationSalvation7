import { createResolutionDomain } from './battle.resolution.domain.js';

/** Resolve against caller-owned state; no browser or default battle is captured. */
export function createBattleResolution(ports) {
  if (!ports.runtime) throw new TypeError('Battle resolution requires a runtime port');
  return createResolutionDomain({ runtime: ports.runtime, combat: ports.combat, random: ports.random,
    normalizeCard: ports.normalizeCard || (card => card) }).createBattleResolution(ports);
}
