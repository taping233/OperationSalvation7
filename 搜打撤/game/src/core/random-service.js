import { hashSeed, nextRandom } from './random-core.js';
/** @param {unknown} seed */
function normalizeSeed(seed) {
  return typeof seed === 'number' && Number.isFinite(seed) ? seed >>> 0 : hashSeed(seed);
}

function generateSeed() {
  const cryptoApi = globalThis.crypto;
  if (cryptoApi && typeof cryptoApi.getRandomValues === 'function') {
    return cryptoApi.getRandomValues(new Uint32Array(1))[0] >>> 0;
  }
  return hashSeed(`${Date.now()}:${globalThis.performance?.now?.() || 0}`);
}

class SeededRandomService {
  /** @param {unknown} [seed] */
  constructor(seed = generateSeed()) { this.reseed(seed); }

  /** @param {unknown} [seed] */
  reseed(seed = generateSeed()) {
    this.seed = normalizeSeed(seed);
    this.streams = Object.create(null);
    return this.seed;
  }

  random(stream = 'gameplay') {
    const key = String(stream);
    let state = this.streams[key];
    if (state === undefined) state = hashSeed(`${this.seed}:${key}`);
    const step = nextRandom(state);
    this.streams[key] = step.state;
    return step.value;
  }

  snapshot() { return { seed: this.seed, streams: { ...this.streams } }; }

  restore(snapshot) {
    const data = snapshot && typeof snapshot === 'object' ? snapshot : { seed: snapshot };
    this.reseed(data.seed ?? generateSeed());
    for (const [key, value] of Object.entries(data.streams || {})) {
      if (Number.isFinite(value)) this.streams[key] = value >>> 0;
    }
    return this.seed;
  }
}

export { SeededRandomService, generateSeed };
