// Replay comparisons use the complete public battle snapshot, including ordered piles and effects.
// Callback source is diagnostic data only; replay never evaluates code from a packet.
import { game } from '../run/game.session.js';
import { Random, hashSeed } from '../core/random.js';
import { isTurbo } from '../core/turbo.js';
import { observe } from './agent.state.js';

const NON_RULE_STREAMS = new Set(['agent-policy', 'recording', 'visual']);
const RUN_KEYS = ['runActive', 'nestActive', 'battleActive', 'state', 'mode', 'mapSeed', 'turn',
  'hp', 'maxHp', 'atk', 'spellPower', 'coins', 'myClass', 'characterId', 'layerIdx', 'trackPos',
  'ownedCards', 'inventory', 'cardOrder', 'usedPocket', 'cardBox', 'nestRunes', 'nestEquipped',
  'nestBossName', 'nestTargetedBox', 'bossKilled'];

function plainData(value, callbacks = false, ancestors = new WeakSet()) {
  if (value == null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'function' && callbacks) return { callbackSource: String(value) };
  if (typeof value !== 'object') throw new TypeError('Replay data must contain finite JSON values');
  if (ancestors.has(value)) throw new TypeError('Replay data cannot contain cycles');
  ancestors.add(value);
  try {
    const descriptors = Object.getOwnPropertyDescriptors(value);
    if (Object.values(descriptors).some(descriptor => descriptor.get || descriptor.set)) {
      throw new TypeError('Replay data cannot contain accessors');
    }
    if (Array.isArray(value)) return value.map(item => plainData(item, callbacks, ancestors));
    if (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null) {
      throw new TypeError('Replay data must use plain objects');
    }
    const out = {};
    for (const key of Object.keys(value).sort()) {
      if (descriptors[key].value !== undefined) Object.defineProperty(out, key, {
        value: plainData(descriptors[key].value, callbacks, ancestors), enumerable: true, writable: true, configurable: true,
      });
    }
    return out;
  } finally { ancestors.delete(value); }
}

function rulesRng(snapshot) {
  return { seed: snapshot.seed, streams: Object.fromEntries(Object.entries(snapshot.streams || {})
    .filter(([name]) => !NON_RULE_STREAMS.has(name))) };
}

function readReplayState(obs = observe()) {
  const diagnostics = window.SDT?.Battle?.getReplayState?.();
  if (!diagnostics) throw new Error('Battle replay diagnostics are unavailable');
  const battle = diagnostics.battle;
  return plainData({ phase: obs.phase, turbo: isTurbo(), battle,
    battleRules: diagnostics.rules,
    run: Object.fromEntries(RUN_KEYS.filter(key => game[key] !== undefined).map(key => [key, game[key]])),
    rules: window.SDT?.MAP?.rules || {}, rng: rulesRng(Random.snapshot()) }, true);
}

function firstDifference(expected, actual, path = '$') {
  if (Object.is(expected, actual)) return null;
  if (!expected || !actual || typeof expected !== 'object' || typeof actual !== 'object'
      || Array.isArray(expected) !== Array.isArray(actual)) return { path, expected, actual };
  const keys = [...new Set([...Object.keys(expected), ...Object.keys(actual)])].sort();
  for (const key of keys) {
    if (!Object.hasOwn(expected, key) || !Object.hasOwn(actual, key)) {
      return { path: `${path}.${key}`, expected: expected[key], actual: actual[key] };
    }
    const difference = firstDifference(expected[key], actual[key], `${path}.${key}`);
    if (difference) return difference;
  }
  return null;
}

function stateSummary(state) {
  return { hash: hashSeed(JSON.stringify(state)).toString(16), phase: state.phase,
    turn: state.battle?.turn ?? null, hp: state.run.hp ?? null,
    energy: state.battle?.energy ?? null,
    piles: state.battle ? Object.fromEntries(['hand', 'drawPile', 'discard', 'grave']
      .map(key => [key, state.battle[key]?.length ?? 0])) : null };
}

function fingerprintOf(value) {
  if (!value || typeof value.version !== 'string' || !value.version.trim()
      || typeof value.code !== 'string' || !value.code.trim()) {
    throw new TypeError('Replay requires an explicit fingerprint { version, code } from its caller');
  }
  return plainData({ version: value.version, code: value.code, source: 'caller-provided' });
}

export { plainData, readReplayState, firstDifference, stateSummary, fingerprintOf };
