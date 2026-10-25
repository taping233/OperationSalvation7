export const RANDOM_STREAM_VERSION = 2;
export const LEGACY_RANDOM_STREAM_VERSION = 1;
export const NON_RULE_RANDOM_STREAMS = Object.freeze(['agent-policy', 'recording', 'visual', 'fx', 'audio', 'scene']);
const nonRule = new Set(NON_RULE_RANDOM_STREAMS);
const purposes = new Set(['shuffle', 'reward', 'target', 'generation', 'enemy']);

// Unannotated streams (including map generation) keep their exact historic key.
export function randomStreamKey(legacy, purpose, version) {
  return version >= RANDOM_STREAM_VERSION && purposes.has(purpose) ? purpose : String(legacy);
}

export function rulesRandomSnapshot(snapshot) {
  return { seed:snapshot.seed, streams:Object.fromEntries(Object.entries(snapshot.streams || {})
    .filter(([name]) => !nonRule.has(name))) };
}
