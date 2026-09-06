const UINT32_RANGE = 0x100000000;
const STEP = 0x6D2B79F5;

function hashSeed(value) {
  const text = String(value);
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

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
  constructor(seed = generateSeed()) { this.reseed(seed); }

  reseed(seed = generateSeed()) {
    this.seed = normalizeSeed(seed);
    this.streams = Object.create(null);
    return this.seed;
  }

  random(stream = 'gameplay') {
    const key = String(stream);
    let state = this.streams[key];
    if (state === undefined) state = hashSeed(`${this.seed}:${key}`);
    state = (state + STEP) >>> 0;
    this.streams[key] = state;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / UINT32_RANGE;
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

let service = new SeededRandomService();

function setRandomService(next) {
  if (!next || !['random', 'reseed', 'snapshot', 'restore'].every(name => typeof next[name] === 'function')) {
    throw new TypeError('随机数服务必须实现 random、reseed、snapshot 和 restore');
  }
  service = next;
  return service;
}

const Random = Object.freeze({
  random: stream => service.random(stream),
  reseed: seed => service.reseed(seed),
  snapshot: () => service.snapshot(),
  restore: snapshot => service.restore(snapshot),
  get seed() { return service.seed; },
});

window.SDT = window.SDT || {};
window.SDT.Random = Random;

export { Random, SeededRandomService, generateSeed, setRandomService };
