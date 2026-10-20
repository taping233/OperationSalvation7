import { defaultBattleRuntime as runtime } from '../runtime/battle.runtime.default.js';
import * as combat from './combat.js';
import * as summary from './battle.summary.js';
import { Random } from '../../core/random.js';
import SDT from '../../core/sdt-facade.js';
import { emit } from '../../core/event-bus.js';
import { getHostedExecutionCard } from '../effects/battle.hosted.js';
import { presentBattleDefeat } from './battle.presentation.js';
import { createBrowserBattlePresentation } from '../runtime/battle.browser-presentation.js';
import { deferBattlePersistence } from '../runtime/battle.host-scheduling.js';
import { traceRestoreStep } from '../../core/flight-recorder.local.js';

/** Compatibility adapters explicitly bind the one existing browser battle. */
export function createDefaultBattleContext(overrides = {}) {
  const audio = Object.fromEntries(['sfx', 'music', 'setDucked', 'setBoss', 'setBattlePressure']
    .map(name => [name, (...args) => SDT.Sound?.[name]?.(...args)]));
  return {
    runtime, combat, summary, random: Random,
    get cards() { return SDT.Cards; }, readRules: () => SDT.MAP.rules, audio,
    normalizeCard: getHostedExecutionCard,
    emitEvent: emit, presentBattleDefeat,
    presentation: createBrowserBattlePresentation(),
    traceRestoreStep, deferPersist: deferBattlePersistence,
    scheduleFrame: typeof requestAnimationFrame === 'function' ? work => requestAnimationFrame(work) : null,
    track: (...args) => SDT.Meta?.track?.(...args),
    noteBattle: (...args) => SDT.Agent?.recorder?.noteBattle?.(...args),
    warmCards: cards => {
      if (SDT.Art?.collectCardAssets && SDT.Art?.warm) {
        SDT.Art.warm(SDT.Art.collectCardAssets(cards, { includePortraits: false }), { retain: false });
      }
    },
    get items() { return SDT.MAP?.items || {}; },
    dev: !!import.meta.env?.DEV,
    testMode: typeof process !== 'undefined' && !!process.env?.VITEST,
    ...overrides,
  };
}
