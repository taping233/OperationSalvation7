import { sdtDefine } from './sdt-facade.js';
import { hashSeed, nextRandom } from './random-core.js';
// hashSeed/nextRandom 的实现与口径注释在 random-core.js（零依赖件）；
// 此处转发导出维持既有 import 面（map-rng-bit-equivalence 等测试直引本文件）。
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

sdtDefine('Random', Random);

export { Random, SeededRandomService, generateSeed, hashSeed, nextRandom, setRandomService };
