import { createSelectionDomain } from './battle.selection-flow.domain.js';

/**
 * Standalone callers provide the same explicit runtime as the engine.
 * @param {Parameters<ReturnType<typeof createSelectionDomain>['createBattleSelectionFlow']>[0] & { runtime: ReturnType<typeof import('../runtime/battle.runtime.factory.js').createBattleRuntime>, normalizeCard?: (card: object) => object }} ports
 */
export function createBattleSelectionFlow(ports) {
  if (!ports.runtime) throw new TypeError('Battle selection requires a runtime port');
  return createSelectionDomain({ runtime: ports.runtime, combat: ports.combat, normalizeCard: ports.normalizeCard || (card => card) })
    .createBattleSelectionFlow(ports);
}
