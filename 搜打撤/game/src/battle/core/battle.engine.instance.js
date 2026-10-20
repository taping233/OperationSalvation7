import { createBattleRuntime } from '../runtime/battle.runtime.factory.js';
import { createBattleSummary } from './battle.summary.factory.js';
import { createBattlePresentationPorts } from '../runtime/battle.presentation-ports.js';
import { SeededRandomService } from '../../core/random-service.js';
import { createEngineDomain } from './battle.engine.factory.domain.js';
import { createEnemyPhaseDomain } from './battle.enemy-phase.domain.js';

/**
 * @typedef {object} BattleEngineOptions
 * @property {object} cards
 * @property {() => object} readRules
 * @property {ReturnType<typeof createBattleRuntime>} [runtime]
 * @property {number | string} [seed]
 * @property {(name: string) => void} [sound]
 * @property {(slots: unknown[]) => object} [evaluateRunes]
 * @property {object} [presentation]
 * @property {object} [combat]
 * @property {object} [random]
 * @property {object} [summary]
 * @property {object} [audio]
 * @property {(card: object) => object} [normalizeCard]
 * @property {(event: string, value: object) => unknown} [emitEvent]
 * @property {(name: string, work: () => unknown) => unknown} [traceRestoreStep]
 * @property {(player: object) => unknown} [presentBattleDefeat]
 * @property {object} [items]
 * @property {(work: () => unknown) => unknown} [scheduleFrame]
 * @property {(write: () => unknown) => unknown} [deferPersist]
 * @property {boolean} [dev]
 * @property {boolean} [testMode]
 */

/** A complete battle owns its state, random streams, queue, hooks and presentation waits.
 * @param {BattleEngineOptions} options
 */
export function createBattleEngineInstance(options = {}) {
  const runtime = options.runtime || createBattleRuntime(options.combat ? { combat: options.combat } : undefined);
  if (options.runtime && options.combat && options.combat !== runtime.combat) {
    throw new TypeError('Battle engine and runtime must use the same combat port');
  }
  const random = options.random || new SeededRandomService(options.seed);
  const presentation = createBattlePresentationPorts(options.presentation);
  const context = {
    ...options,
    runtime, random, presentation,
    combat: options.combat || runtime.combat,
    cards: options.cards,
    readRules: options.readRules,
    audio: { sfx: options.sound || (() => {}), music() {}, setDucked() {}, setBoss() {}, ...options.audio },
    summary: options.summary || createBattleSummary(),
    emitEvent: options.emitEvent || (() => false),
    normalizeCard: options.normalizeCard || (card => card),
    traceRestoreStep: options.traceRestoreStep || ((_name, work) => work()),
    presentBattleDefeat: options.presentBattleDefeat || (() => null),
    evaluateRunes: options.evaluateRunes || (() => ({})),
    items: options.items || {},
    scheduleFrame: options.scheduleFrame || null,
    deferPersist: options.deferPersist || (write => write()),
    dev: options.dev || false,
    testMode: options.testMode || false,
  };
  const { createBattleEngine } = createEngineDomain(context);
  const engine = createBattleEngine({ cards: context.cards, readRules: context.readRules,
    sound: context.audio.sfx, evaluateRunes: context.evaluateRunes });
  context.engine = engine;
  const phase = createEnemyPhaseDomain(context);
  const commands = Object.freeze({
    playCard: engine.play, submitCardPlay: engine.submitCardPlay,
    getCardPlayAvailability: engine.getCardPlayAvailability,
    endTurn: phase.endTurn, flee: engine.flee, surrender: phase.surrender,
  });
  return Object.freeze({ ...engine, ...phase, runtime, random, commands,
    idle: () => context.executionSession.actionQueue.idle() });
}
