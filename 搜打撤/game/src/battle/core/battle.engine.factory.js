import { createBattleEngineInstance } from './battle.engine.instance.js';

/** Compose a battle only from explicit ports; each call owns its runtime by default.
 * @param {import('./battle.engine.instance.js').BattleEngineOptions & { sound: (name: string) => void, evaluateRunes: (slots: unknown[]) => object }} ports
 */
export function createBattleEngine(ports) {
  if (!ports?.cards || typeof ports.readRules !== 'function' || typeof ports.sound !== 'function' || typeof ports.evaluateRunes !== 'function') {
    throw new TypeError('Battle engine requires cards, readRules, sound and evaluateRunes ports');
  }
  return createBattleEngineInstance(ports);
}
