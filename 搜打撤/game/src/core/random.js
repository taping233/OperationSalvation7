import { sdtDefine } from './sdt-facade.js';
import { hashSeed, nextRandom } from './random-core.js';
// hashSeed/nextRandom 的实现与口径注释在 random-core.js（零依赖件）；
// 此处转发导出维持既有 import 面（map-rng-bit-equivalence 等测试直引本文件）。
import { SeededRandomService, generateSeed } from './random-service.js';

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
  /** @param {unknown} [seed] */
  reseed: seed => service.reseed(seed),
  snapshot: () => service.snapshot(),
  restore: snapshot => service.restore(snapshot),
  get seed() { return service.seed; },
});

sdtDefine('Random', Random);

export { Random, SeededRandomService, generateSeed, hashSeed, nextRandom, setRandomService };
